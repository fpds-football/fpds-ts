/** The rules in §13.1 of the specification, which JSON Schema cannot express. */

import { labelFor } from "./labels.js";
import { calculateIsMinor } from "./minor.js";
import { resolvePointer, toPointer } from "./pointer.js";
import type { Issue } from "./types.js";

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Rule 1: `consent.is_minor` agrees with the date of birth on the date of `submitted_at`. */
export function checkMinorStatus(document: AnyRecord): Issue[] {
  const player = isRecord(document.player) ? document.player : {};
  const submission = isRecord(document.submission) ? document.submission : {};
  const consent = isRecord(document.consent) ? document.consent : {};

  const calculated = calculateIsMinor(player.date_of_birth, submission.submitted_at);
  if (calculated === undefined || typeof consent.is_minor !== "boolean") return [];
  if (consent.is_minor === calculated) return [];

  return [
    {
      code: "minor_mismatch",
      path: "/consent/is_minor",
      rule: 1,
      severity: "error",
      message: calculated
        ? "This file says that the player is not a minor. From the date of birth, the player is a minor."
        : "This file says that the player is a minor. From the date of birth, the player is not a minor.",
    },
  ];
}

const SPLIT_SEASON = /^([0-9]{4})\/([0-9]{2})$/;

/** Rule 2: in a `YYYY/YY` season, the second part is the year after the first part. */
export function checkSeasonYears(document: AnyRecord): Issue[] {
  if (!Array.isArray(document.performance)) return [];
  const issues: Issue[] = [];

  document.performance.forEach((record, index) => {
    if (!isRecord(record) || typeof record.season !== "string") return;
    const match = SPLIT_SEASON.exec(record.season);
    if (!match) return;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if ((first + 1) % 100 !== second) {
      const path = toPointer(["performance", index, "season"]);
      const expected = `${first}/${String((first + 1) % 100).padStart(2, "0")}`;
      issues.push({
        code: "season_years",
        path,
        rule: 2,
        severity: "error",
        message: `${labelFor(path)} is ${record.season}. The second year must follow the first, for example ${expected}.`,
      });
    }
  });
  return issues;
}

/** Rule 3: each key in `provenance` resolves to a value in the same document. */
export function checkProvenancePointers(document: AnyRecord): Issue[] {
  if (!isRecord(document.provenance)) return [];
  const issues: Issue[] = [];

  for (const pointer of Object.keys(document.provenance)) {
    if (!pointer.startsWith("/")) continue; // The schema reports this.
    if (pointer === "/provenance" || pointer.startsWith("/provenance/")) {
      issues.push(unresolved(pointer, "A source cannot describe the provenance block itself."));
      continue;
    }
    if (!resolvePointer(document, pointer).found) {
      issues.push(unresolved(pointer, `There is a source for ${pointer}, but the document has no value there.`));
    }
  }
  return issues;
}

function unresolved(pointer: string, message: string): Issue {
  return {
    code: "provenance_unresolved",
    path: toPointer(["provenance", pointer]),
    rule: 3,
    severity: "error",
    message,
  };
}

const MEDICAL_WORDS =
  /injur|diagnos|medical|surgery|surgical|operation|fracture|rupture|ligament|\bacl\b|hamstring|concussion|rehab|illness|disease|physio/i;

/**
 * §12: a producer must not put diagnoses, injury details or medical history in `extensions`.
 *
 * This is not a rule in §13.1, because software cannot decide it with certainty. §12 permits a warning.
 * This check finds words that suggest medical content. A person must make the decision.
 */
export function checkExtensionsForMedicalContent(document: AnyRecord): Issue[] {
  if (!isRecord(document.extensions)) return [];
  const issues: Issue[] = [];

  for (const [key, value] of Object.entries(document.extensions)) {
    if (MEDICAL_WORDS.test(key) || containsMedicalText(value)) {
      issues.push({
        code: "possible_medical_extension",
        path: toPointer(["extensions", key]),
        severity: "warning",
        message: `Extension ${key} can contain medical information. FPDS does not permit diagnoses, injury details or medical history.`,
      });
    }
  }
  return issues;
}

function containsMedicalText(value: unknown): boolean {
  if (typeof value === "string") return MEDICAL_WORDS.test(value);
  if (Array.isArray(value)) return value.some(containsMedicalText);
  if (isRecord(value)) {
    return Object.entries(value).some(([key, inner]) => MEDICAL_WORDS.test(key) || containsMedicalText(inner));
  }
  return false;
}

/** Rule 4: `secondary_positions` does not contain the primary position. */
export function checkSecondaryPositions(document: AnyRecord): Issue[] {
  const positions = isRecord(document.positions) ? document.positions : {};
  const primary = positions.primary_position;
  const secondary = positions.secondary_positions;
  if (typeof primary !== "string" || !Array.isArray(secondary) || !secondary.includes(primary)) return [];

  return [
    {
      code: "secondary_repeats_primary",
      path: "/positions/secondary_positions",
      rule: 4,
      severity: "error",
      message: `Secondary positions include ${primary}, which is already the primary position.`,
    },
  ];
}

export function checkRules(document: AnyRecord): Issue[] {
  return [
    ...checkMinorStatus(document),
    ...checkSeasonYears(document),
    ...checkProvenancePointers(document),
    ...checkExtensionsForMedicalContent(document),
    ...checkSecondaryPositions(document),
  ];
}

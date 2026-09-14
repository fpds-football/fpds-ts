/**
 * The state of each field for a partial document.
 *
 * A builder renders from these states and holds no rules of its own (DECISIONS.md D-34).
 * The tests make sure that these states agree with the schema for each conformance case.
 */

import { labelFor, VALUE_LABELS } from "./labels.js";
import { calculateIsMinor } from "./minor.js";
import { escapeToken, resolvePointer, toPointer } from "./pointer.js";
import type { ContractStatus, DraftDocument, Issue, Sender } from "./types.js";

export type FieldStateKind = "required" | "optional" | "not_applicable" | "calculated";

export interface DisabledValue {
  value: string;
  reason: string;
}

export interface FieldState {
  state: FieldStateKind;
  /** Why the field is in this state, in plain English. Present when a condition causes the state. */
  reason?: string;
  /** Enum values that are not permitted now, with the reason. */
  disabledValues?: DisabledValue[];
}

export type FieldStates = Record<string, FieldState>;

export interface FieldStatesResult {
  fields: FieldStates;
  /** The calculated minor status, if the date of birth and the submission time are valid. */
  isMinor: boolean | undefined;
}

const PLAYER_CLUB_STATUSES: ContractStatus[] = ["under_contract", "on_loan", "amateur"];
const EXPIRY_STATUSES: ContractStatus[] = ["under_contract", "on_loan"];

/** Returns the state of each field in a partial document. */
export function getFieldStates(draft: DraftDocument): FieldStatesResult {
  const fields: FieldStates = {};
  const set = (pointer: string, state: FieldState) => {
    fields[pointer] = state;
  };

  const rawStatus = draft.contract?.status;
  const status = rawStatus && rawStatus in VALUE_LABELS.contract_status ? (rawStatus as ContractStatus) : undefined;
  const sender = draft.submission?.sender as Sender | undefined;
  const isMinor = calculateIsMinor(draft.player?.date_of_birth, draft.submission?.submitted_at);
  const statusLabel = status ? VALUE_LABELS.contract_status[status]?.toLowerCase() : undefined;

  // Values that the producer sets (§13 checklist).
  set("/fpds_version", { state: "calculated" });
  set("/submission/submission_id", { state: "calculated" });
  set("/submission/submitted_at", { state: "calculated" });
  set("/consent/is_minor", { state: "calculated", reason: "Calculated from the date of birth." });

  // Submission (§4).
  const purposes = draft.submission?.purposes ?? [];
  const purposeState: FieldState = { state: "required" };
  if (purposes.includes("information_only")) {
    purposeState.disabledValues = (["permanent_transfer", "loan", "trial"] as const).map((value) => ({
      value,
      reason: "Information only cannot be combined with another purpose.",
    }));
  } else if (purposes.length > 0) {
    purposeState.disabledValues = [
      { value: "information_only", reason: "Information only cannot be combined with another purpose." },
    ];
  }
  set("/submission/purposes", purposeState);

  const senderState: FieldState = { state: "required" };
  if (isMinor === true) {
    senderState.disabledValues = [{ value: "player", reason: "A minor cannot send their own submission." }];
  }
  set("/submission/sender", senderState);

  // Player (§5).
  set("/player/full_name", { state: "required" });
  set("/player/date_of_birth", { state: "required" });
  set("/player/nationalities", { state: "required" });
  set("/player/external_ids/fifa_connect_id", { state: "optional" });

  if (status && PLAYER_CLUB_STATUSES.includes(status)) {
    set("/player/current_club", { state: "required", reason: `Required when the contract status is ${statusLabel}.` });
  } else if (status === "free_agent") {
    set("/player/current_club", {
      state: "not_applicable",
      reason: "A free agent is not registered with a club.",
    });
  } else {
    set("/player/current_club", { state: "optional" });
  }

  // Positions (§6).
  set("/positions/primary_position", { state: "required" });
  const primary = draft.positions?.primary_position;
  const secondaryState: FieldState = { state: "optional" };
  if (primary) {
    secondaryState.disabledValues = [{ value: primary, reason: "This is already the primary position." }];
  }
  set("/positions/secondary_positions", secondaryState);

  // Contract (§7).
  set("/contract/status", { state: "required" });
  if (status && EXPIRY_STATUSES.includes(status)) {
    set("/contract/expiry_date", { state: "required", reason: `Required when the contract status is ${statusLabel}.` });
  } else if (status) {
    set("/contract/expiry_date", {
      state: "not_applicable",
      reason: `Not used when the contract status is ${statusLabel}.`,
    });
  } else {
    set("/contract/expiry_date", { state: "not_applicable", reason: "Select a contract status first." });
  }
  if (status === "on_loan") {
    set("/contract/parent_club", { state: "required", reason: "Required when the player is on loan." });
  } else {
    set("/contract/parent_club", { state: "not_applicable", reason: "Used only when the player is on loan." });
  }

  // Representation (§4.2, §8).
  if (sender === "intermediary") {
    set("/representation", { state: "required", reason: "Required when an intermediary sends the submission." });
  } else if (sender === "player") {
    set("/representation", { state: "optional", reason: "Optional when the player sends the submission." });
  } else {
    set("/representation", { state: "optional", reason: "Select a sender first." });
  }
  if (draft.representation !== undefined || sender === "intermediary") {
    set("/representation/agent_name", { state: "required" });
    set("/representation/fifa_agent_licence", { state: "optional" });
    set("/representation/mandate_status", { state: "required" });
  }

  // Performance (§9).
  set("/performance", { state: "optional" });
  (draft.performance ?? []).forEach((_, index) => {
    const row = (field: string) => toPointer(["performance", index, field]);
    for (const field of ["season", "competition", "competition_country", "appearances", "minutes"]) {
      set(row(field), { state: "required" });
    }
    for (const field of ["goals", "assists", "clean_sheets"]) {
      set(row(field), { state: "optional" });
    }
  });

  // Media (§9.3).
  set("/media", { state: "optional" });
  (draft.media ?? []).forEach((_, index) => {
    for (const field of ["type", "video_type", "url"]) {
      set(toPointer(["media", index, field]), { state: "required" });
    }
  });

  // Consent (§10).
  set("/consent/lawful_basis", { state: "required" });
  if (draft.consent?.lawful_basis === "consent") {
    set("/consent/consent_date", { state: "required", reason: "Required when the lawful basis is consent." });
  } else {
    set("/consent/consent_date", { state: "optional" });
  }

  // Provenance (§11).
  for (const [pointer, entry] of Object.entries(draft.provenance ?? {})) {
    const base = `/provenance/${escapeToken(pointer)}`;
    set(`${base}/source`, { state: "required" });
    set(`${base}/asserted_by`, { state: "optional" });
    set(`${base}/asserted_at`, { state: "optional" });
    if (entry?.source === "verified") {
      set(`${base}/verified_against`, { state: "required", reason: "Required when the source is verified." });
    } else {
      set(`${base}/verified_against`, { state: "not_applicable", reason: "Used only when the source is verified." });
    }
  }

  return { fields, isMinor };
}

/**
 * Compares a partial document with its field states.
 * Returns an issue for each required field that is missing, each field that does not apply but has a value,
 * and each value that is not permitted now. A builder shows these issues as conflicts.
 *
 * Calculated fields are not checked here. `validate` checks them.
 */
export function getFieldStateIssues(draft: DraftDocument): Issue[] {
  const { fields } = getFieldStates(draft);
  const issues: Issue[] = [];

  for (const [pointer, field] of Object.entries(fields)) {
    if (field.state === "calculated") continue;
    const { present, value } = lookup(draft, pointer);

    // When a required block is missing, report the block only, not each field inside it.
    const missingParent = Object.entries(fields).some(
      ([parent, state]) =>
        state.state === "required" && pointer.startsWith(`${parent}/`) && !lookup(draft, parent).present,
    );
    if (field.state === "required" && !present && !missingParent) {
      issues.push({
        code: "required",
        path: pointer,
        message: field.reason ? `${labelFor(pointer)} is missing. ${field.reason}` : `${labelFor(pointer)} is required.`,
        severity: "error",
      });
    }
    if (field.state === "not_applicable" && present) {
      issues.push({
        code: "not_applicable",
        path: pointer,
        message: `${labelFor(pointer)} must not be present. ${field.reason ?? ""}`.trim(),
        severity: "error",
      });
    }
    if (present && field.disabledValues) {
      const values = Array.isArray(value) ? value : [value];
      for (const disabled of field.disabledValues) {
        if (values.includes(disabled.value)) {
          issues.push({
            code: codeForDisabled(pointer),
            path: pointer,
            message: disabled.reason,
            severity: "error",
            ...(pointer === "/positions/secondary_positions" ? { rule: 4 as const } : {}),
          });
          break;
        }
      }
    }
  }
  return issues;
}

function codeForDisabled(pointer: string): Issue["code"] {
  if (pointer === "/submission/sender") return "minor_cannot_send";
  if (pointer === "/submission/purposes") return "information_only_exclusive";
  if (pointer === "/positions/secondary_positions") return "secondary_repeats_primary";
  return "invalid_value";
}

function lookup(document: unknown, pointer: string): { present: boolean; value?: unknown } {
  const { found, value } = resolvePointer(document, pointer);
  return found ? { present: true, value } : { present: false };
}

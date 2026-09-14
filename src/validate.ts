import type { ErrorObject } from "ajv";
import validateSchema from "./generated/validate-v0-1.js";
import { labelFor, VALUE_LABELS } from "./labels.js";
import { calculateIsMinor } from "./minor.js";
import { escapeToken, toPointer } from "./pointer.js";
import { checkRules } from "./rules.js";
import type { FpdsDocument, Issue } from "./types.js";

/** FPDS versions that this library supports. */
export const SUPPORTED_VERSIONS = /^0\.1\.[0-9]+$/;

export interface ValidationResult {
  /** True if the document has no issues with severity "error". Warnings do not make a document invalid. */
  valid: boolean;
  issues: Issue[];
  /** The document, typed, when `valid` is true. */
  document?: FpdsDocument;
  /** Values that the library calculates from the document. */
  calculated: { isMinor?: boolean };
}

/**
 * Validates a value as an FPDS submission.
 * It checks the schema and the rules in §13.1 of the specification, and returns issues in plain English.
 */
export function validate(input: unknown): ValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return result([issue("not_an_object", "", "This is not an FPDS document. An FPDS document is a JSON object.")]);
  }

  const document = input as Record<string, unknown>;
  const version = document.fpds_version;
  if (typeof version !== "string" || !SUPPORTED_VERSIONS.test(version)) {
    const found = typeof version === "string" ? `version ${version}` : "no version";
    return result([
      issue(
        "unsupported_version",
        "/fpds_version",
        `This document has ${found}. This software supports FPDS 0.1.`,
      ),
    ]);
  }

  const schemaValid = validateSchema(document);
  const schemaIssues = schemaValid ? [] : mapSchemaErrors(validateSchema.errors ?? []);
  const issues = [...schemaIssues, ...checkRules(document)];

  const player = document.player as Record<string, unknown> | undefined;
  const submission = document.submission as Record<string, unknown> | undefined;
  const isMinor = calculateIsMinor(player?.date_of_birth, submission?.submitted_at);

  return result(issues, document, isMinor);
}

function result(issues: Issue[], document?: Record<string, unknown>, isMinor?: boolean): ValidationResult {
  const valid = !issues.some((i) => i.severity === "error");
  return {
    valid,
    issues,
    ...(valid && document ? { document: document as unknown as FpdsDocument } : {}),
    calculated: isMinor === undefined ? {} : { isMinor },
  };
}

function issue(code: Issue["code"], path: string, message: string, severity: Issue["severity"] = "error"): Issue {
  return { code, path, message, severity };
}

/** Conditional rules in the schema, keyed by the start of the schema path of the error. */
const CONDITIONAL_RULES: { schemaPath: string; code: Issue["code"]; path: string; message: string }[] = [
  {
    schemaPath: "#/properties/contract/allOf/0/then/required",
    code: "required",
    path: "/contract/expiry_date",
    message: "Contract expiry date is required when the player is under contract or on loan.",
  },
  {
    schemaPath: "#/properties/contract/allOf/1/then/not",
    code: "not_applicable",
    path: "/contract/expiry_date",
    message: "Contract expiry date must not be present for an amateur, a free agent or an unknown contract status.",
  },
  {
    schemaPath: "#/properties/contract/allOf/2/then/required",
    code: "required",
    path: "/contract/parent_club",
    message: "Parent club is required when the player is on loan.",
  },
  {
    schemaPath: "#/properties/contract/allOf/2/else/not",
    code: "not_applicable",
    path: "/contract/parent_club",
    message: "Parent club must not be present unless the player is on loan.",
  },
  {
    schemaPath: "#/allOf/0/then/properties/player/required",
    code: "required",
    path: "/player/current_club",
    message: "Current club is required when the player is under contract, on loan or an amateur.",
  },
  {
    schemaPath: "#/allOf/1/then/properties/player/not",
    code: "not_applicable",
    path: "/player/current_club",
    message: "Current club must not be present for a free agent. A free agent is not registered with a club.",
  },
  {
    schemaPath: "#/allOf/2/then/required",
    code: "required",
    path: "/representation",
    message: "Representation is required when an intermediary sends the submission.",
  },
  {
    schemaPath: "#/allOf/3/then/properties/submission/properties/sender/not",
    code: "minor_cannot_send",
    path: "/submission/sender",
    message: "A minor cannot send their own submission. An intermediary must send it.",
  },
  {
    schemaPath: "#/properties/consent/then/required",
    code: "required",
    path: "/consent/consent_date",
    message: "Consent date is required when the lawful basis is consent.",
  },
  {
    schemaPath: "#/properties/submission/properties/purposes/then/maxItems",
    code: "information_only_exclusive",
    path: "/submission/purposes",
    message: "Information only cannot be combined with another purpose.",
  },
];

function mapSchemaErrors(errors: ErrorObject[]): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const error of errors) {
    // Ajv reports a summary error for "if" and "propertyNames", and also the detailed error inside. Keep the detail.
    if (error.keyword === "if" || error.keyword === "propertyNames") continue;
    const mapped = mapSchemaError(error);
    const key = `${mapped.code}|${mapped.path}|${mapped.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(mapped);
    }
  }
  return issues;
}

function mapSchemaError(error: ErrorObject): Issue {
  const conditional = CONDITIONAL_RULES.find((rule) => error.schemaPath.startsWith(rule.schemaPath));
  if (conditional) return issue(conditional.code, conditional.path, conditional.message);

  const path = error.instancePath;
  const params = error.params as Record<string, unknown>;

  if (error.schemaPath.startsWith("#/properties/provenance/additionalProperties/then/required")) {
    return issue("verified_needs_target", `${path}/verified_against`, `${labelFor(path)}: a verified source needs "verified against".`);
  }

  if (error.schemaPath.startsWith("#/properties/extensions/propertyNames")) {
    const key = String(params.propertyName ?? "");
    const keyPath = toPointer(["extensions", key]);
    if (error.keyword === "not") {
      return issue("reserved_extension_prefix", keyPath, `Extension ${key} uses the prefix football.fpds, which is reserved.`);
    }
    return issue(
      "invalid_extension_key",
      keyPath,
      `Extension ${key} needs a reverse domain name and a field name, for example com.example/scouting_grade.`,
    );
  }

  if (error.schemaPath.startsWith("#/properties/provenance/propertyNames")) {
    const key = String(params.propertyName ?? "");
    return issue("invalid_format", toPointer(["provenance", key]), `The source key ${key} must be a JSON Pointer that starts with /.`);
  }

  switch (error.keyword) {
    case "required": {
      const missing = String(params.missingProperty);
      const target = `${path}/${missing}`;
      return issue("required", target, `${labelFor(target)} is required.`);
    }
    case "additionalProperties": {
      const extra = String(params.additionalProperty);
      const target = `${path}/${escapeToken(extra)}`;
      return issue("unknown_field", target, `${extra} is not a field in FPDS 0.1. Put extra information in extensions.`);
    }
    case "type":
      return issue("invalid_type", path, `${labelFor(path)} has the wrong type of value. Expected ${describeType(String(params.type))}.`);
    case "enum":
    case "const":
      if (COUNTRY_PATH.test(path)) {
        return issue(
          "invalid_value",
          path,
          `${labelFor(path)} is not a country code that FPDS permits. Use a three-letter ISO code in capitals, for example POL. For a football nation in the United Kingdom, use ENG, SCO, WAL or NIR.`,
        );
      }
      return issue("invalid_value", path, `${labelFor(path)} has a value that FPDS does not permit.${allowedValues(path)}`);
    case "pattern":
    case "format":
      return issue("invalid_format", path, `${labelFor(path)} has the wrong format.${formatHint(path)}`);
    case "minItems":
    case "minLength":
      return issue("too_few", path, `${labelFor(path)} must not be empty.`);
    case "maxItems":
      return issue("too_many", path, `${labelFor(path)} has too many values. The maximum is ${params.limit}.`);
    case "uniqueItems":
      return issue("duplicate", path, `${labelFor(path)} contains the same value more than once.`);
    case "minimum":
      return issue("out_of_range", path, `${labelFor(path)} must not be less than ${params.limit}.`);
    case "maximum":
      return issue("out_of_range", path, `${labelFor(path)} must not be more than ${params.limit}.`);
    default:
      return issue("invalid_value", path, `${labelFor(path)} is not valid.`);
  }
}

const COUNTRY_PATH = /(^\/player\/nationalities\/[0-9]+|\/country|\/competition_country)$/;

function describeType(type: string): string {
  return { string: "text", integer: "a whole number", number: "a number", boolean: "true or false", object: "a group of fields", array: "a list" }[type] ?? type;
}

function formatHint(path: string): string {
  if (/date_of_birth|expiry_date|consent_date$/.test(path)) return " Use YYYY-MM-DD, for example 2003-04-17.";
  if (/submitted_at|asserted_at$/.test(path)) return " Use a time with a time zone, for example 2026-09-13T09:41:00Z.";
  if (path.endsWith("/season")) return " Use YYYY/YY or YYYY, for example 2025/26 or 2026.";
  if (path.endsWith("/submission_id")) return " Use a lowercase UUID, for example b7f3c2e1-4a9d-4f11-9c3e-2a1d5f8b0c44.";
  if (path === "/fpds_version") return " Use 0.1.x, for example 0.1.0.";
  return "";
}

function allowedValues(path: string): string {
  const lists: [RegExp, Record<string, string>][] = [
    [/^\/submission\/purposes\/[0-9]+$/, VALUE_LABELS.purposes],
    [/^\/submission\/sender$/, VALUE_LABELS.sender],
    [/^\/contract\/status$/, VALUE_LABELS.contract_status],
    [/^\/representation\/mandate_status$/, VALUE_LABELS.mandate_status],
    [/^\/consent\/lawful_basis$/, VALUE_LABELS.lawful_basis],
    [/\/source$/, VALUE_LABELS.source],
    [/^\/positions\/(primary_position|secondary_positions\/[0-9]+)$/, VALUE_LABELS.position],
  ];
  const match = lists.find(([pattern]) => pattern.test(path));
  return match ? ` Permitted values: ${Object.keys(match[1]).join(", ")}.` : "";
}

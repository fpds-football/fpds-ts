/** Producer steps from §13 of the specification. */

import { getFieldStates } from "./field-states.js";
import { calculateIsMinor } from "./minor.js";
import { parsePointer } from "./pointer.js";
import type { DraftDocument } from "./types.js";
import { type ValidationResult, validate } from "./validate.js";

export const FPDS_VERSION = "0.1.0";

export interface PrepareOptions {
  /** The time of this version. The default is now. */
  now?: Date;
  /** A function that makes a UUID. The default is `crypto.randomUUID`, which makes a version 4 UUID. */
  createId?: () => string;
}

/**
 * Makes a new version of a document from a draft, and validates it. The steps are:
 *
 * 1. Set `fpds_version`.
 * 2. Make a new `submission_id` and set `submitted_at` to now.
 * 3. Calculate `consent.is_minor`.
 * 4. Remove each field that does not apply.
 * 5. Validate the result.
 *
 * The draft does not change. Call this function each time the user exports, so that a changed document gets a new ID.
 */
export function prepareDocument(draft: DraftDocument, options: PrepareOptions = {}): ValidationResult {
  const now = options.now ?? new Date();
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());

  const document = structuredClone(draft) as Record<string, any>;
  document.fpds_version = FPDS_VERSION;
  document.submission = { ...document.submission, submission_id: createId(), submitted_at: toTimestamp(now) };

  const isMinor = calculateIsMinor(document.player?.date_of_birth, document.submission.submitted_at);
  if (isMinor !== undefined) {
    document.consent = { ...document.consent, is_minor: isMinor };
  }

  const { fields } = getFieldStates(document as DraftDocument);
  for (const [pointer, field] of Object.entries(fields)) {
    if (field.state === "not_applicable") removeAt(document, pointer);
  }

  return validate(document);
}

/** Checks whether a file is an FPDS draft from a builder, not a submission (DECISIONS.md D-36). */
export const DRAFT_MARKER = "fpds_draft";

export function isDraft(value: unknown): boolean {
  return value !== null && typeof value === "object" && Object.hasOwn(value, DRAFT_MARKER);
}

/** RFC 3339 timestamp in UTC, to the second. */
function toTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

function removeAt(document: Record<string, any>, pointer: string): void {
  const tokens = parsePointer(pointer);
  if (!tokens || tokens.length === 0) return;
  let parent: any = document;
  for (const token of tokens.slice(0, -1)) {
    if (parent === null || typeof parent !== "object") return;
    parent = parent[token];
  }
  if (parent !== null && typeof parent === "object") {
    delete parent[tokens[tokens.length - 1] as string];
  }
}

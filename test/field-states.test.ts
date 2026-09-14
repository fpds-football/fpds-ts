import { describe, expect, it } from "vitest";
import { type DraftDocument, getFieldStateIssues, getFieldStates, validate } from "../src/index.js";
import { loadConformanceCases, readSpecJson } from "./spec.js";

const cases = loadConformanceCases();

describe("field states agree with the schema", () => {
  it.each(cases)("$file: $description", ({ document, valid }) => {
    const stateIssues = getFieldStateIssues(document as DraftDocument);
    const result = validate(document);

    // A valid document has no conflicts with its field states.
    if (valid) expect(stateIssues).toEqual([]);
    // A conflict with the field states always means that the document is invalid.
    if (stateIssues.length > 0) expect(result.valid).toBe(false);
    // Each conditional issue from the validator is also a field-state issue.
    for (const issue of result.issues) {
      if (["required", "not_applicable", "minor_cannot_send", "information_only_exclusive"].includes(issue.code)) {
        const conditional = !issue.message.endsWith(" is required.");
        if (conditional) {
          expect(stateIssues.map((i) => `${i.code} ${i.path}`)).toContain(`${issue.code} ${issue.path}`);
        }
      }
    }
  });
});

describe("getFieldStates", () => {
  const midfielder = readSpecJson("examples/valid/midfielder-under-contract.json") as DraftDocument;

  it("calculates minor status and disables a player sender for a minor", () => {
    const draft: DraftDocument = {
      submission: { submitted_at: "2026-09-14T10:00:00Z", sender: "player" },
      player: { date_of_birth: "2010-03-08" },
    };
    const { fields, isMinor } = getFieldStates(draft);
    expect(isMinor).toBe(true);
    expect(fields["/consent/is_minor"]?.state).toBe("calculated");
    expect(fields["/submission/sender"]?.disabledValues).toEqual([
      { value: "player", reason: "A minor cannot send their own submission." },
    ]);
    expect(getFieldStateIssues(draft).map((i) => i.code)).toContain("minor_cannot_send");
  });

  it.each([
    ["under_contract", "required", "required", "not_applicable"],
    ["on_loan", "required", "required", "required"],
    ["amateur", "required", "not_applicable", "not_applicable"],
    ["free_agent", "not_applicable", "not_applicable", "not_applicable"],
    ["unknown", "optional", "not_applicable", "not_applicable"],
  ] as const)("contract status %s: current club %s, expiry %s, parent club %s", (status, club, expiry, parent) => {
    const { fields } = getFieldStates({ ...midfielder, contract: { status } });
    expect(fields["/player/current_club"]?.state).toBe(club);
    expect(fields["/contract/expiry_date"]?.state).toBe(expiry);
    expect(fields["/contract/parent_club"]?.state).toBe(parent);
  });

  it("gives states for representation fields before the block exists, and reports only the missing block", () => {
    const draft: DraftDocument = { submission: { sender: "intermediary" } };
    expect(getFieldStates(draft).fields["/representation/agent_name"]?.state).toBe("required");
    const paths = getFieldStateIssues(draft).map((i) => i.path);
    expect(paths).toContain("/representation");
    expect(paths).not.toContain("/representation/agent_name");
  });

  it("makes representation required for an intermediary and optional for a player", () => {
    expect(getFieldStates({ submission: { sender: "intermediary" } }).fields["/representation"]?.state).toBe("required");
    expect(getFieldStates({ submission: { sender: "player" } }).fields["/representation"]?.state).toBe("optional");
  });

  it("disables other purposes when information only is selected", () => {
    const { fields } = getFieldStates({ submission: { purposes: ["information_only"] } });
    expect(fields["/submission/purposes"]?.disabledValues?.map((d) => d.value)).toEqual([
      "permanent_transfer",
      "loan",
      "trial",
    ]);
  });

  it("disables the primary position in secondary positions", () => {
    const { fields } = getFieldStates({ positions: { primary_position: "CM" } });
    expect(fields["/positions/secondary_positions"]?.disabledValues?.map((d) => d.value)).toEqual(["CM"]);
  });

  it("makes media optional, and each field of a media link required", () => {
    expect(getFieldStates({}).fields["/media"]?.state).toBe("optional");
    const { fields } = getFieldStates({ media: [{ type: "video" }] });
    expect(fields["/media/0/video_type"]?.state).toBe("required");
    expect(fields["/media/0/url"]?.state).toBe("required");
    expect(getFieldStateIssues({ media: [{ type: "video" }] }).map((i) => i.path)).toEqual(
      expect.arrayContaining(["/media/0/video_type", "/media/0/url"]),
    );
  });

  it("requires a consent date only when the lawful basis is consent", () => {
    expect(getFieldStates({ consent: { lawful_basis: "consent" } }).fields["/consent/consent_date"]?.state).toBe("required");
    expect(getFieldStates({ consent: { lawful_basis: "contract" } }).fields["/consent/consent_date"]?.state).toBe("optional");
  });
});

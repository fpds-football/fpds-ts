import { describe, expect, it } from "vitest";
import { ageOn, isMinorOn, prepareDocument, validate } from "../src/index.js";
import { readSpecJson } from "./spec.js";

const example = (name: string) => structuredClone(readSpecJson(`examples/valid/${name}`)) as any;
const codes = (document: unknown) => validate(document).issues.map((i) => i.code);

describe("isMinorOn", () => {
  it.each([
    ["2008-09-14", "2026-09-13", true],
    ["2008-09-14", "2026-09-14", false],
    ["2008-02-29", "2026-02-28", true],
    ["2008-02-29", "2026-03-01", false],
    ["2004-02-29", "2022-02-28", true],
    ["2004-02-29", "2022-03-01", false],
  ])("born %s, on %s: minor is %s", (birth, on, expected) => {
    expect(isMinorOn(birth, on)).toBe(expected);
  });

  it("uses the date in the time zone offset of the timestamp", async () => {
    const { calculateIsMinor } = await import("../src/index.js");
    // 23:30 at UTC-5 on 13 September is 14 September in UTC. The date in the timestamp is 13 September.
    expect(calculateIsMinor("2008-09-14", "2026-09-13T23:30:00-05:00")).toBe(true);
    expect(calculateIsMinor("2008-09-14", "2026-09-14T00:30:00+02:00")).toBe(false);
  });

  it("returns undefined for a date that does not exist", () => {
    expect(isMinorOn("2003-02-30", "2026-01-01")).toBeUndefined();
  });
});

describe("ageOn", () => {
  it.each([
    ["2008-09-14", "2026-09-13", 17],
    ["2008-09-14", "2026-09-14", 18],
    ["2010-03-02", "2026-09-14", 16],
    ["2008-02-29", "2026-02-28", 17],
    ["2008-02-29", "2026-03-01", 18],
    ["2004-02-29", "2024-02-29", 20],
    ["2026-09-14", "2026-09-14", 0],
  ])("born %s, on %s: age is %s", (birth, on, expected) => {
    expect(ageOn(birth, on)).toBe(expected);
  });

  it("returns undefined for a date that does not exist, or a reference date before the birth", () => {
    expect(ageOn("2003-02-30", "2026-01-01")).toBeUndefined();
    expect(ageOn("2026-09-15", "2026-09-14")).toBeUndefined();
  });

  it("agrees with isMinorOn for every day around the 18th birthday", () => {
    for (const birth of ["2008-02-29", "2008-03-01", "2008-02-28", "2007-12-31", "2008-01-01"]) {
      const start = Date.UTC(Number(birth.slice(0, 4)) + 17, 11, 1);
      for (let day = 0; day < 180; day++) {
        const on = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
        expect((ageOn(birth, on) as number) < 18, `${birth} on ${on}`).toBe(isMinorOn(birth, on));
      }
    }
  });
});

describe("rules in §13.1", () => {
  it("rule 1: reports a minor status that does not agree with the date of birth", () => {
    const document = example("midfielder-under-contract.json");
    document.consent.is_minor = true;
    const result = validate(document);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "minor_mismatch", rule: 1 }));
    expect(result.calculated.isMinor).toBe(false);
  });

  it("rule 1: the message states the calculated age on the date of the submission", () => {
    const document = example("academy-prospect-minor.json");
    document.consent.is_minor = false;
    const result = validate(document);
    const issue = result.issues.find((i) => i.code === "minor_mismatch");
    expect(issue?.message).toBe(
      `This file says that the player is not a minor. From the date of birth, the player was ${result.calculated.age} on the date of the submission.`,
    );
    expect(result.calculated.age).toBeLessThan(18);
  });

  it("rule 2: reports a season where the second year does not follow the first", () => {
    const document = example("midfielder-under-contract.json");
    document.performance[0].season = "2025/27";
    expect(codes(document)).toContain("season_years");
  });

  it("rule 2: accepts a season across a century", () => {
    const document = example("midfielder-under-contract.json");
    document.performance[0].season = "2099/00";
    expect(codes(document)).not.toContain("season_years");
  });

  it("rule 3: reports a provenance key that points to no value", () => {
    const document = example("midfielder-under-contract.json");
    document.provenance["/contract/release_clause"] = { source: "agent_stated" };
    expect(codes(document)).toContain("provenance_unresolved");
  });

  it("§12: warns about possible medical content in extensions, without making the document invalid", () => {
    const document = example("midfielder-under-contract.json");
    document.extensions["com.example/notes"] = "Hamstring injury in March";
    const result = validate(document);
    expect(result.valid).toBe(true);
    const warning = result.issues.find((i) => i.code === "possible_medical_extension");
    expect(warning).toMatchObject({ severity: "warning" });
    expect(warning?.rule).toBeUndefined();
  });

  it("rule 4: reports a secondary position that repeats the primary position", () => {
    const document = example("midfielder-under-contract.json");
    document.positions.secondary_positions = ["CM", "CAM"];
    expect(validate(document).issues).toContainEqual(expect.objectContaining({ code: "secondary_repeats_primary", rule: 4 }));
  });
});

describe("validate", () => {
  it("refuses a value that is not an object", () => {
    expect(codes([])).toEqual(["not_an_object"]);
  });

  it("refuses an unsupported version without other checks", () => {
    const document = example("free-agent-minimal.json");
    document.fpds_version = "0.2.0";
    expect(codes(document)).toEqual(["unsupported_version"]);
  });

  it("gives a plain-English message for a country code that is not permitted", () => {
    const document = example("midfielder-under-contract.json");
    document.player.nationalities = ["GER"];
    expect(validate(document).issues).toContainEqual(
      expect.objectContaining({ code: "invalid_value", path: "/player/nationalities/0", message: expect.stringContaining("ENG, SCO, WAL or NIR") }),
    );
  });

  it("accepts the football codes for the United Kingdom and Kosovo", () => {
    const document = example("midfielder-under-contract.json");
    document.player.nationalities = ["ENG", "XKX"];
    document.performance[0].competition_country = "SCO";
    expect(validate(document).valid).toBe(true);
  });

  it("gives a plain-English message for a conditional rule", () => {
    const document = example("midfielder-under-contract.json");
    delete document.contract.expiry_date;
    delete document.provenance["/contract/expiry_date"];
    expect(validate(document).issues).toContainEqual(
      expect.objectContaining({
        code: "required",
        path: "/contract/expiry_date",
        message: "Contract expiry date is required when the player is under contract or on loan.",
      }),
    );
  });
});

describe("prepareDocument", () => {
  const now = new Date("2026-09-14T10:30:00.123Z");
  const createId = () => "01928f3a-7b2c-7d4e-9f10-2a3b4c5d6e7f";

  it("sets the version, the ID, the time and the minor status, then validates", () => {
    const draft = example("academy-prospect-minor.json");
    delete draft.fpds_version;
    delete draft.submission.submission_id;
    delete draft.submission.submitted_at;
    draft.consent.is_minor = false;

    const result = prepareDocument(draft, { now, createId });
    expect(result.valid).toBe(true);
    expect(result.document?.fpds_version).toBe("0.1.0");
    expect(result.document?.submission.submission_id).toBe("01928f3a-7b2c-7d4e-9f10-2a3b4c5d6e7f");
    expect(result.document?.submission.submitted_at).toBe("2026-09-14T10:30:00Z");
    expect(result.document?.consent.is_minor).toBe(true);
  });

  it("removes fields that do not apply", () => {
    const draft = example("midfielder-under-contract.json");
    draft.contract.status = "free_agent";
    delete draft.provenance["/contract/expiry_date"];

    const result = prepareDocument(draft, { now, createId });
    expect(result.valid, JSON.stringify(result.issues)).toBe(true);
    expect(result.document?.contract).toEqual({ status: "free_agent" });
    expect(result.document?.player.current_club).toBeUndefined();
  });

  it("makes a UUID that the schema accepts by default", () => {
    const result = prepareDocument(example("free-agent-minimal.json"), { now });
    expect(result.valid, JSON.stringify(result.issues)).toBe(true);
  });

  it("does not change the draft", () => {
    const draft = example("free-agent-minimal.json");
    const copy = structuredClone(draft);
    prepareDocument(draft, { now, createId });
    expect(draft).toEqual(copy);
  });
});

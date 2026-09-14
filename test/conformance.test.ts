import { describe, expect, it } from "vitest";
import { validate } from "../src/index.js";
import { loadConformanceCases, loadExamples } from "./spec.js";

const cases = loadConformanceCases();

describe("conformance suite from fpds-football/spec", () => {
  it("finds the conformance cases", () => {
    expect(cases.length).toBeGreaterThan(50);
  });

  it.each(cases)("$file: $description", ({ document, valid }) => {
    const result = validate(document);
    expect(result.valid, JSON.stringify(result.issues, null, 2)).toBe(valid);
  });

  it.each(cases.filter((c) => !c.valid))("$file: $description has a specific issue code", ({ document }) => {
    const { issues } = validate(document);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.message).not.toMatch(/is not valid\.$/);
    }
  });
});

describe("examples from fpds-football/spec", () => {
  it.each(loadExamples())("$name is valid with no issues", ({ document }) => {
    expect(validate(document).issues).toEqual([]);
  });
});

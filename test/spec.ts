/** Access to a checkout of fpds-football/spec. Set FPDS_SPEC_DIR, or keep the checkout at ../spec. */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import jsonpatch, { type Operation } from "fast-json-patch";

export const SPEC_DIR = resolve(process.env.FPDS_SPEC_DIR ?? join(import.meta.dirname, "../../spec"));

export interface ConformanceCase {
  file: string;
  description: string;
  valid: boolean;
  document: unknown;
}

export function readSpecJson(path: string): unknown {
  return JSON.parse(readFileSync(join(SPEC_DIR, path), "utf8"));
}

export function loadConformanceCases(): ConformanceCase[] {
  const dir = join(SPEC_DIR, "tests/conformance/v0.1");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => {
      const fixture = JSON.parse(readFileSync(join(dir, name), "utf8"));
      const base = readSpecJson(fixture.base);
      return fixture.tests.map((test: { description: string; valid: boolean; patch: Operation[] }) => ({
        file: name,
        description: test.description,
        valid: test.valid,
        document: jsonpatch.applyPatch(structuredClone(base), test.patch, true, false).newDocument,
      }));
    });
}

export function loadExamples(): { name: string; document: unknown }[] {
  const dir = join(SPEC_DIR, "examples/valid");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({ name, document: readSpecJson(`examples/valid/${name}`) }));
}

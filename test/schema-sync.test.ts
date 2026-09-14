import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { SPEC_DIR } from "./spec.js";

it("the bundled schema is identical to the schema in fpds-football/spec", () => {
  const bundled = readFileSync(join(import.meta.dirname, "../src/schema/v0.1/player.json"), "utf8");
  const source = readFileSync(join(SPEC_DIR, "schema/v0.1/player.json"), "utf8");
  expect(bundled, "Run pnpm sync-schema").toBe(source);
});

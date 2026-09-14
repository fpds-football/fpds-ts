// Copy the schema from a checkout of fpds-football/spec into this package.
// The spec repository is the only source of the schema. Do not edit src/schema by hand.
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const specDir = resolve(process.env.FPDS_SPEC_DIR ?? "../spec");
const from = resolve(specDir, "schema/v0.1/player.json");
const to = resolve("src/schema/v0.1/player.json");

copyFileSync(from, to);
console.log(`Copied ${from} to ${to}`);

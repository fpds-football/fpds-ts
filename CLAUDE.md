# fpds-ts: working notes for Claude Code

This repository is `@fpds-football/fpds`, a TypeScript library for the Football Player Data Standard. The specification is in `fpds-football/spec`, checked out at `../spec`.

## Hard rules

- **The specification is the authority.** If this library and `SPEC.md` disagree, the library has a defect, or the specification has a gap. If the specification has a gap, tell the user. Do not decide the answer in code only.
- **Do not edit `src/schema/` by hand.** Run `pnpm sync-schema`. A test makes sure that the schema is identical to the schema in the spec repository.
- **Do not edit `src/generated/`.** `scripts/compile-schema.mjs` makes it.
- **The library sends no data over the network, and it does no runtime code generation.** The website uses it under a strict Content Security Policy with player data.
- **Every conformance case must pass.** A change that makes a case fail is a defect.
- **Keep field states and the schema in agreement.** `test/field-states.test.ts` checks this for every conformance case. If you add a conditional rule to the schema, add it to `src/field-states.ts` and to `CONDITIONAL_RULES` in `src/validate.ts`.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Release

Push a tag that matches `version` in `package.json`, for example `v0.1.0-alpha.0`. `.github/workflows/release.yml` tests, builds and publishes to npm with provenance. A pre-release version publishes under its label, for example `alpha`, not `latest`. Do not push a release tag without the user.

## Style

- Messages to users are in Simple English (ASD-STE100, pragmatic mode), with British spelling. Use the `simple-english` skill.
- Issue codes are stable. Do not rename a code without a major version of this package.

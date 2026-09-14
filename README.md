# @fpds-football/fpds

A TypeScript library that validates and prepares [Football Player Data Standard (FPDS)](https://fpds.football) submissions.

**Status:** alpha. It supports FPDS 0.1, which is a draft. Breaking changes are expected.

## What it does

- **Validates a document** against the FPDS schema and the rules in §13.1 of the specification. The schema alone cannot check these rules.
- **Gives messages in plain English**, for example "Contract expiry date is required when the player is under contract or on loan."
- **Gives the state of each field** for a partial document: required, optional, not applicable or calculated. A form can use these states, so that the form contains no rules of its own.
- **Prepares a document for export.** It sets the version, makes a new submission ID, sets the time, calculates the minor status and removes fields that do not apply.

The library runs in browsers and in Node.js 20 or later. It sends no data over the network. It needs no runtime code generation, so it works with a strict Content Security Policy.

## Install

```bash
npm install @fpds-football/fpds
```

## Validate a document

```ts
import { validate } from "@fpds-football/fpds";

const result = validate(JSON.parse(fileContents));

if (!result.valid) {
  for (const issue of result.issues) {
    console.log(issue.path, issue.message);
  }
}
```

`result.valid` is `true` when there are no issues with severity `"error"`. An issue with severity `"warning"` does not make a document invalid.

Each issue has:

| Field | Meaning |
|---|---|
| `code` | A stable code, for example `required` or `minor_mismatch` |
| `path` | A JSON Pointer to the value, for example `/contract/expiry_date` |
| `message` | A message in plain English |
| `severity` | `"error"` or `"warning"` |
| `rule` | The number of the rule in §13.1, when the issue comes from one |

`result.calculated.isMinor` is the minor status that the library calculates from the date of birth. `result.calculated.age` is the age of the player on the date of the submission. A viewer shows these values when they do not agree with the document.

## Build a form

```ts
import { getFieldStates, getFieldStateIssues } from "@fpds-football/fpds";

const { fields, isMinor } = getFieldStates(draft);

fields["/contract/expiry_date"];
// { state: "not_applicable", reason: "Not used when the contract status is free agent." }

fields["/submission/sender"].disabledValues;
// [{ value: "player", reason: "A minor cannot send their own submission." }]

const conflicts = getFieldStateIssues(draft);
```

## Prepare a document for export

```ts
import { prepareDocument } from "@fpds-football/fpds";

const result = prepareDocument(draft);
if (result.valid) {
  download(JSON.stringify(result.document, null, 2), "player-name-2026-09-14.fpds.json");
}
```

Call `prepareDocument` each time the user exports. Each call makes a new `submission_id`, as §4.3 of the specification requires for a changed document.

## Limits

- **Medical information in extensions.** §12 of the specification makes the producer responsible for this rule, because software cannot decide it with certainty. The library reports a warning when an extension contains words such as "injury" or "diagnosis". A warning does not make a document invalid.
- **Valid is not true.** A valid document has the correct structure. The library does not check that the information in the document is true.

## Conformance

The tests run every case in the [FPDS conformance suite](https://github.com/fpds-football/spec/tree/main/tests/conformance). The tests also make sure that:

- the schema in this package is identical to the schema in `fpds-football/spec`
- the field states agree with the schema for every conformance case

## Development

This package needs a checkout of `fpds-football/spec` next to it, at `../spec`. You can also set `FPDS_SPEC_DIR`.

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm build
```

The schema comes from `fpds-football/spec`. Do not edit `src/schema/` by hand. To copy a new version of the schema, run `pnpm sync-schema`.

## Licence

Apache License 2.0.

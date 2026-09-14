# Changelog

This file records the changes to `@fpds-football/fpds`. The version of this package is separate from the version of FPDS.

## [Unreleased]

### Added

- `validate`: checks the FPDS 0.1 schema and the rules in §13.1, and returns issues in plain English.
- `getFieldStates` and `getFieldStateIssues`: the state of each field for a partial document.
- `prepareDocument`: the producer steps in §13 of the specification.
- `isMinorOn` and `calculateIsMinor`: minor status as §10.1 defines it.
- Labels in plain English for fields and values.
- A schema validator that is compiled at build time.
- Tests that run the full FPDS conformance suite.

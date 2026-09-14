# Changelog

This file records the changes to `@fpds-football/fpds`. The version of this package is separate from the version of FPDS.

## [Unreleased]

## [0.1.0-alpha.4] - 2026-09-14

### Added

- The schema has a `media` array of video links (FPDS D-43). Each item has `type`, `video_type` and an `https` `url`.
- The types `MediaItem`, `MediaType` and `VideoType`.
- `getFieldStates` gives the states of `/media` and of the fields in each media link.
- Labels for media fields, and `VALUE_LABELS.media_type` and `VALUE_LABELS.video_type`.
- A message for a media URL with the wrong format, which states the `https` rule.

## [0.1.0-alpha.3] - 2026-09-14

### Added

- `ageOn` and `calculateAge`: the age in whole years on a date, with the same birthday rules as `isMinorOn` (§10.1).
- `validate` returns `calculated.age`, the age of the player on the date of the submission.

### Changed

- The `minor_mismatch` message states the calculated age, for example "From the date of birth, the player was 16 on the date of the submission."

## [0.1.0-alpha.2] - 2026-09-14

### Changed

- The schema permits only listed country codes: ISO 3166-1 alpha-3, plus `ENG`, `SCO`, `WAL`, `NIR` and `XKX` (FPDS D-42).
- A country code that is not permitted gets a message that explains the football codes.

## [0.1.0-alpha.1] - 2026-09-14

### Changed

- `getFieldStates` gives the states of representation fields when the sender is an intermediary, before the block exists.
- `getFieldStateIssues` does not report a missing field inside a required block that is itself missing.

## [0.1.0-alpha.0] - 2026-09-14

### Added

- `validate`: checks the FPDS 0.1 schema and the rules in §13.1, and returns issues in plain English.
- `getFieldStates` and `getFieldStateIssues`: the state of each field for a partial document.
- `prepareDocument`: the producer steps in §13 of the specification.
- `isMinorOn` and `calculateIsMinor`: minor status as §10.1 defines it.
- Labels in plain English for fields and values.
- A schema validator that is compiled at build time.
- Tests that run the full FPDS conformance suite.

/** Names in plain English for fields and values, for messages and user interfaces. */

import { parsePointer } from "./pointer.js";

const FIELD_LABELS: Record<string, string> = {
  "": "The document",
  "/fpds_version": "FPDS version",
  "/submission": "Submission",
  "/submission/submission_id": "Submission ID",
  "/submission/submitted_at": "Submission time",
  "/submission/purposes": "Purposes",
  "/submission/sender": "Sender",
  "/player": "Player",
  "/player/full_name": "Full name",
  "/player/date_of_birth": "Date of birth",
  "/player/nationalities": "Nationalities",
  "/player/current_club": "Current club",
  "/player/current_club/name": "Current club name",
  "/player/current_club/country": "Current club country",
  "/player/external_ids": "External identifiers",
  "/player/external_ids/fifa_connect_id": "FIFA Connect ID",
  "/positions": "Positions",
  "/positions/primary_position": "Primary position",
  "/positions/secondary_positions": "Secondary positions",
  "/contract": "Contract",
  "/contract/status": "Contract status",
  "/contract/expiry_date": "Contract expiry date",
  "/contract/parent_club": "Parent club",
  "/contract/parent_club/name": "Parent club name",
  "/contract/parent_club/country": "Parent club country",
  "/representation": "Representation",
  "/representation/agent_name": "Agent name",
  "/representation/fifa_agent_licence": "FIFA agent licence",
  "/representation/mandate_status": "Mandate status",
  "/performance": "Performance",
  "/performance/*": "Season record",
  "/performance/*/season": "Season",
  "/performance/*/competition": "Competition",
  "/performance/*/competition_country": "Competition country",
  "/performance/*/appearances": "Appearances",
  "/performance/*/minutes": "Minutes",
  "/performance/*/goals": "Goals",
  "/performance/*/assists": "Assists",
  "/performance/*/clean_sheets": "Clean sheets",
  "/media": "Media",
  "/media/*": "Media link",
  "/media/*/type": "Media type",
  "/media/*/video_type": "Video type",
  "/media/*/url": "URL",
  "/consent": "Consent",
  "/consent/lawful_basis": "Lawful basis",
  "/consent/consent_date": "Consent date",
  "/consent/is_minor": "Minor status",
  "/provenance": "Provenance",
  "/provenance/*": "Source",
  "/provenance/*/source": "Source",
  "/provenance/*/asserted_by": "Asserted by",
  "/provenance/*/asserted_at": "Assertion time",
  "/provenance/*/verified_against": "Verified against",
  "/extensions": "Extensions",
};

export const VALUE_LABELS = {
  purposes: {
    permanent_transfer: "Permanent transfer",
    loan: "Loan",
    trial: "Trial",
    information_only: "Information only",
  },
  sender: { intermediary: "Intermediary", player: "Player" },
  contract_status: {
    under_contract: "Under contract",
    on_loan: "On loan",
    amateur: "Amateur",
    free_agent: "Free agent",
    unknown: "Unknown",
  },
  mandate_status: {
    exclusive: "Exclusive",
    non_exclusive: "Non-exclusive",
    club_mandate: "Club mandate",
    none: "No mandate",
    unknown: "Unknown",
  },
  lawful_basis: {
    consent: "Consent",
    contract: "Contract",
    legitimate_interest: "Legitimate interest",
    legal_obligation: "Legal obligation",
    not_stated: "Not stated",
  },
  media_type: { video: "Video" },
  video_type: { highlights: "Highlights", full_match: "Full match" },
  source: {
    verified: "Verified",
    third_party_data: "Data provider",
    club_stated: "Stated by club",
    agent_stated: "Stated by agent",
    player_stated: "Stated by player",
    estimated: "Estimated",
    unknown: "Unknown source",
  },
  position: {
    GK: "Goalkeeper",
    RB: "Right-back",
    LB: "Left-back",
    RWB: "Right wing-back",
    LWB: "Left wing-back",
    CB: "Centre-back",
    LCB: "Left centre-back",
    RCB: "Right centre-back",
    CDM: "Defensive midfielder",
    CM: "Central midfielder",
    CAM: "Attacking midfielder",
    RM: "Right midfielder",
    LM: "Left midfielder",
    RW: "Right winger",
    LW: "Left winger",
    ST: "Striker",
  },
} as const;

/** A label for a JSON Pointer, for example "Season 2: Minutes". */
export function labelFor(pointer: string): string {
  const tokens = parsePointer(pointer) ?? [];

  if (tokens[0] === "provenance" && tokens.length >= 2) {
    const target = tokens[1] ?? "";
    const base = FIELD_LABELS[toPattern(["provenance", "*", ...tokens.slice(2)])] ?? "Source";
    return `${base} for ${labelFor(target)}`;
  }

  if (tokens[0] === "extensions" && tokens.length >= 2) {
    return `Extension ${tokens[1]}`;
  }

  const pattern = toPattern(tokens);
  const label = FIELD_LABELS[pattern] ?? tokens.at(-1) ?? "The document";

  if (tokens[0] === "performance" && tokens.length >= 2 && /^[0-9]+$/.test(tokens[1] ?? "")) {
    const row = Number(tokens[1]) + 1;
    return tokens.length === 2 ? `Season record ${row}` : `Season record ${row}: ${label}`;
  }
  if (tokens[0] === "media" && tokens.length >= 2 && /^[0-9]+$/.test(tokens[1] ?? "")) {
    const row = Number(tokens[1]) + 1;
    return tokens.length === 2 ? `Media link ${row}` : `Media link ${row}: ${label}`;
  }
  return label;
}

function toPattern(tokens: string[]): string {
  return tokens.map((token) => (/^[0-9]+$/.test(token) ? "/*" : `/${token}`)).join("");
}

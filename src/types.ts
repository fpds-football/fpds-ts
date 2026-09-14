/** Types for an FPDS v0.1 player submission. The schema in `src/schema/v0.1/player.json` is the authority. */

export type Purpose = "permanent_transfer" | "loan" | "trial" | "information_only";
export type Sender = "intermediary" | "player";
export type ContractStatus = "under_contract" | "on_loan" | "amateur" | "free_agent" | "unknown";
export type MandateStatus = "exclusive" | "non_exclusive" | "club_mandate" | "none" | "unknown";
export type LawfulBasis = "consent" | "contract" | "legitimate_interest" | "legal_obligation" | "not_stated";
export type ProvenanceSource =
  | "verified"
  | "third_party_data"
  | "club_stated"
  | "agent_stated"
  | "player_stated"
  | "estimated"
  | "unknown";
export type PositionCode =
  | "GK"
  | "RB"
  | "LB"
  | "RWB"
  | "LWB"
  | "CB"
  | "LCB"
  | "RCB"
  | "CDM"
  | "CM"
  | "CAM"
  | "RM"
  | "LM"
  | "RW"
  | "LW"
  | "ST";

export interface Club {
  name: string;
  country: string;
}

export interface SeasonRecord {
  season: string;
  competition: string;
  competition_country: string;
  appearances: number;
  minutes: number;
  goals?: number;
  assists?: number;
  clean_sheets?: number;
}

export interface ProvenanceEntry {
  source: ProvenanceSource;
  asserted_by?: string;
  asserted_at?: string;
  verified_against?: string;
}

export interface FpdsDocument {
  fpds_version: string;
  submission: {
    submission_id: string;
    submitted_at: string;
    purposes: Purpose[];
    sender: Sender;
  };
  player: {
    full_name: string;
    date_of_birth: string;
    nationalities: string[];
    current_club?: Club;
    external_ids?: { fifa_connect_id?: string };
  };
  positions: {
    primary_position: PositionCode;
    secondary_positions?: PositionCode[];
  };
  contract: {
    status: ContractStatus;
    expiry_date?: string;
    parent_club?: Club;
  };
  representation?: {
    agent_name: string;
    fifa_agent_licence?: string;
    mandate_status: MandateStatus;
  };
  performance?: SeasonRecord[];
  consent: {
    lawful_basis: LawfulBasis;
    consent_date?: string;
    is_minor: boolean;
  };
  provenance?: Record<string, ProvenanceEntry>;
  extensions?: Record<string, unknown>;
}

/** A partial document, as a builder holds it before it is complete. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type DraftDocument = DeepPartial<FpdsDocument>;

export type IssueCode =
  | "not_an_object"
  | "unsupported_version"
  | "required"
  | "not_applicable"
  | "unknown_field"
  | "invalid_type"
  | "invalid_value"
  | "invalid_format"
  | "too_few"
  | "too_many"
  | "duplicate"
  | "out_of_range"
  | "information_only_exclusive"
  | "minor_cannot_send"
  | "verified_needs_target"
  | "invalid_extension_key"
  | "reserved_extension_prefix"
  | "minor_mismatch"
  | "season_years"
  | "provenance_unresolved"
  | "possible_medical_extension"
  | "secondary_repeats_primary";

export interface Issue {
  code: IssueCode;
  /** JSON Pointer to the value with the problem. An empty string is the full document. */
  path: string;
  /** A message in plain English. */
  message: string;
  severity: "error" | "warning";
  /** The rule in §13.1 of the specification, if the issue comes from one. */
  rule?: 1 | 2 | 3 | 4;
}

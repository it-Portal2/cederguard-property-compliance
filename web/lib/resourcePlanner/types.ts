/**
 * Resource Planner — shared types (pure, framework-agnostic).
 *
 * SINGLE SOURCE OF TRUTH for the FTE resource-demand model rebuilt from the
 * "Resource Profile" Excel workbook. No React / store / API imports here.
 *
 * Model: a scheme's dates (Planning → SoS → Handover → EOD) split its life into
 * four stages (S1–S4); the rate card gives FTE per (Stage × Role × Complexity);
 * the engine lays that across fiscal quarters (FY starts April) and totals it.
 */

/** The five PM-tier roles modelled as demand (client answer 7-C). */
export type Role = "SPM" | "PM" | "APM" | "StrategicLead" | "DefectsPM";

/** The six canonical complexity bands (raw labels are normalised into these). */
export type ComplexityBand =
  | "Small"
  | "Mid"
  | "Large"
  | "Complex"
  | "S106/GLA"
  | "DP";

/** The four delivery stages. S1 Site&Concept · S2 Design&Delivery · S3 Construction · S4 Defects&BAU. */
export type Stage = "S1" | "S2" | "S3" | "S4";

/** A scheme in the register. Dates are ISO strings; quarters are derived, never stored. */
export interface ResourceScheme {
  id: string;
  name: string;
  /** Current stage / status text, e.g. "On site", "PRE-CONSTRUCTION". */
  status?: string;
  /** PROGRAMME grouping, e.g. "2500", "Future Pipeline", "2026-DA-LOT A". */
  programme?: string;
  batch?: string;
  /** Delivery route, e.g. "Direct Delivery", "DA", "Regen. Prog.". */
  deliveryRoute?: string;
  /** Raw complexity label from the source data. */
  complexityRaw?: string;
  /** Normalised band (set by `normalizeScheme`); undefined ⇒ contributes 0 FTE. */
  complexity?: ComplexityBand;

  // Home counts
  councilHomes?: number;
  intermediateHomes?: number;
  privateHomes?: number;
  allHomes?: number;

  // Key dates (ISO 8601). A missing boundary makes its stage contribute 0 FTE.
  demolitionStart?: string | null;
  /** Start on Site. */
  sosDate?: string | null;
  handoverDate?: string | null;
  /** End of Defects. */
  eodDate?: string | null;
  planningSubmitted?: string | null;
  planningAchieved?: string | null;

  // Assignment (informational only — capacity is by role, not by person: answer 19-A)
  strategicLead?: string;
  seniorPM?: string;
  projectManager?: string;
  assistantPM?: string;
  defectsPM?: string;

  // Linkage + metadata
  linkedProjectId?: string | null;
  projectCode?: string;
  notes?: string;

  [k: string]: any;
}

/** FTE per Stage → Role → Complexity band. */
export type RateCard = Record<Stage, Record<Role, Record<ComplexityBand, number>>>;

/** Inclusive fiscal-year window for the quarter axis. `startFy` 2026 ⇒ FY 2026-27. */
export interface HorizonConfig {
  startFy: number;
  endFy: number;
}

/** Available supply (FTE) per role for capacity planning (supply-vs-demand, answer 19-A). */
export type SupplyByRole = Partial<Record<Role, number>>;

/** The full editable assumptions document persisted per tenant. */
export interface ResourceAssumptions {
  rateCard: RateCard;
  /** Raw complexity label (normalised key) → canonical band. */
  complexityMap: Record<string, ComplexityBand>;
  /** Programme-overhead uplift as a fraction, e.g. 0.2 = +20% (PM-adjustable, answer 21-A). */
  overheadPct: number;
  /** Annual-leave uplift as a fraction, e.g. 0.15 = +15% (PM-adjustable, answer 21-A). */
  leavePct: number;
  horizon: HorizonConfig;
  /** Available FTE per role (optional, drives the capacity shortfall/surplus view). */
  supplyByRole?: SupplyByRole;
  /** LEGACY single day-rate (£) — fallback only. Superseded by `dayRateByRole`. */
  dayRate?: number;
  /** Day-rate (£) per role used to convert FTE → cost. Unset role → `dayRate` → DEFAULT. */
  dayRateByRole?: Partial<Record<Role, number>>;
  /** Working days that equal 1.0 FTE in one quarter (FTE × this × dayRate = cost). */
  workingDaysPerQuarter?: number;
  /**
   * Resources in post (actual / established), per role → absolute quarter index →
   * FTE. The SINGLE shared input that drives BOTH the Capacity view (supply vs
   * required) AND the Actual-under-Demand comparison. Manually entered.
   */
  inPostByRoleQuarter?: Partial<Record<Role, Record<number, number>>>;
  /**
   * Per-person availability (FTE), keyed by the normalized person key (see
   * `personKey` in compute.ts). Default 1.0 when a person is unset. Drives the
   * person-level "who can take on more" view.
   */
  personAvailability?: Record<string, number>;
}

/** One column on the quarter axis. */
export interface QuarterAxisEntry {
  /** Absolute quarter index from the FY base year (sheet's index 0 = FY2016-17 Q1). */
  index: number;
  /** Display label, e.g. "2026-27 Q1". */
  label: string;
  /** Fiscal year start, e.g. 2026 for FY 2026-27. */
  fy: number;
  fyLabel: string;
  quarterOfFy: 1 | 2 | 3 | 4;
}

/** One scheme's per-role demand curve across the axis. */
export interface SchemeRoleDemand {
  schemeId: string;
  schemeName: string;
  role: Role;
  complexity?: ComplexityBand;
  /** FTE per axis position (length === axis.length). */
  quarters: number[];
}

/** Computed demand across the whole portfolio, indexed by axis position. */
export interface DemandMatrix {
  axis: QuarterAxisEntry[];
  totalByQuarter: number[];
  byRole: Record<Role, number[]>;
  byComplexity: Record<ComplexityBand, number[]>;
  bySchemeRole: SchemeRoleDemand[];
}

/** FTE rolled up to a single financial year. */
export interface FinancialYearAggregate {
  fy: number;
  fyLabel: string;
  byRole: Record<Role, number>;
  total: number;
}

/** Demand vs supply for one role in one quarter. */
export interface CapacityQuarter {
  quarter: number;
  fyLabel: string;
  role: Role;
  demand: number;
  supply: number;
  /** supply − demand. Negative = shortfall, positive = surplus. */
  balance: number;
}

/** Capacity result across the axis (answer 19-A: supply-vs-demand by role). */
export interface CapacityResult {
  byQuarter: CapacityQuarter[];
  /** Worst (most negative) balance per role across the axis. */
  worstByRole: Record<Role, number>;
}

/** One person's committed load vs availability across the axis ("can they take more?"). */
export interface PersonCapacityRow {
  /** Normalized key (lowercased, single-spaced). */
  key: string;
  /** Display name (original casing). */
  name: string;
  /** Distinct roles the person is assigned across schemes. */
  roles: Role[];
  /** Number of schemes the person is assigned to. */
  schemeCount: number;
  /** Availability FTE (default 1.0). */
  availability: number;
  /** Committed (planned) FTE per axis position, summed across their schemes/roles. */
  committedByQuarter: number[];
  /** availability − committed per axis position (negative = over-allocated). */
  headroomByQuarter: number[];
  /** Highest committed FTE in any single quarter. */
  peakCommitted: number;
  /** Worst (most negative) headroom across the axis. */
  minHeadroom: number;
  /** True if the person has spare capacity in any quarter. */
  hasHeadroom: boolean;
}

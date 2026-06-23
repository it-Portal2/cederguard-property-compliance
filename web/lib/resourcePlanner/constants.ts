/**
 * Resource Planner — constants & seed data (pure).
 *
 * `DEFAULT_RATE_CARD` is seeded verbatim from the workbook's ASSUMPTIONS tab
 * (the per-stage `Role_Complexity` lookup blocks: S1 = col P, S2 = col W,
 * S3 = col AD, S4 = col AK). Strategic Lead & Defects PM rows are all 0 — the
 * sheet has no FTE values for them, so the Programme Manager fills them in
 * (client answer 20-B). S106/GLA at S1 is 0 for every role (blank in the sheet).
 */

import type {
  ComplexityBand,
  RateCard,
  Role,
  Stage,
} from "./types";

/** Quarter index 0 corresponds to FY2016-17 Q1 (matches the sheet's axis). */
export const FY_BASE_YEAR = 2016;

/** Fiscal year starts in April (client answer 5-A). */
export const FY_START_MONTH = 4;

export const ROLES: Role[] = ["SPM", "PM", "APM", "StrategicLead", "DefectsPM"];

export const ROLE_LABELS: Record<Role, string> = {
  SPM: "Senior PM",
  PM: "Project Manager",
  APM: "Assistant PM",
  StrategicLead: "Strategic Lead",
  DefectsPM: "Defects PM",
};

export const STAGES: Stage[] = ["S1", "S2", "S3", "S4"];

export const STAGE_LABELS: Record<Stage, string> = {
  S1: "Site & Concept",
  S2: "Design & Delivery",
  S3: "Construction",
  S4: "Defects & BAU",
};

export const STAGE_RIBA: Record<Stage, string> = {
  S1: "RIBA 0–1",
  S2: "RIBA 2–4",
  S3: "RIBA 5",
  S4: "RIBA 6",
};

export const COMPLEXITY_BANDS: ComplexityBand[] = [
  "Small",
  "Mid",
  "Large",
  "Complex",
  "S106/GLA",
  "DP",
];

/** Build a complexity-band record in the canonical band order. */
function band(
  small: number,
  mid: number,
  large: number,
  complex: number,
  s106: number,
  dp: number,
): Record<ComplexityBand, number> {
  return { Small: small, Mid: mid, Large: large, Complex: complex, "S106/GLA": s106, DP: dp };
}

const zeroBands = (): Record<ComplexityBand, number> => band(0, 0, 0, 0, 0, 0);

/**
 * Seed rate card from the ASSUMPTIONS tab. Values are FTE per quarter for a
 * role on a scheme of the given complexity while it is in that stage.
 */
export const DEFAULT_RATE_CARD: RateCard = {
  // S1 · Site & Concept (ASSUMPTIONS col P)
  S1: {
    SPM: band(0.1, 0.2, 0.2, 0.8, 0, 0.6),
    PM: band(0.2, 0.3, 0.4, 0.6, 0, 0.2),
    APM: band(0.1, 0.1, 0.1, 0.1, 0, 0.2),
    StrategicLead: zeroBands(),
    DefectsPM: zeroBands(),
  },
  // S2 · Design & Delivery (col W)
  S2: {
    SPM: band(0.1, 0.2, 0.2, 0.8, 0.1, 0.4),
    PM: band(0.2, 0.3, 0.4, 0.6, 0.4, 0.4),
    APM: band(0.2, 0.2, 0.2, 0.2, 0.2, 0.2),
    StrategicLead: zeroBands(),
    DefectsPM: zeroBands(),
  },
  // S3 · Construction (col AD)
  S3: {
    SPM: band(0.1, 0.1, 0.2, 0.5, 0.2, 0.2),
    PM: band(0.3, 0.3, 0.4, 0.6, 0.4, 0.4),
    APM: band(0.2, 0.2, 0.2, 0.2, 0.2, 0.2),
    StrategicLead: zeroBands(),
    DefectsPM: zeroBands(),
  },
  // S4 · Defects & BAU (col AK)
  S4: {
    SPM: band(0.05, 0.05, 0.1, 0.2, 0.1, 0.1),
    PM: band(0.1, 0.2, 0.2, 0.2, 0.2, 0.2),
    APM: band(0.1, 0.2, 0.2, 0.2, 0.2, 0.2),
    StrategicLead: zeroBands(),
    DefectsPM: zeroBands(),
  },
};

/**
 * Raw complexity label → canonical band (from the sheet's mapping table AN:AO).
 * Keys are normalised (lowercase, single-spaced) for tolerant matching.
 * Unmapped labels are intentionally absent ⇒ that scheme contributes 0 FTE
 * (client answer 6-A).
 */
export const DEFAULT_COMPLEXITY_MAP: Record<string, ComplexityBand> = {
  small: "Small",
  mid: "Mid",
  large: "Large",
  complex: "Complex",
  s106: "S106/GLA",
  "s106/gla": "S106/GLA",
  da: "DP",
  dp: "DP",
  "development partnership delivery": "DP",
  "various small& mid sites": "Mid",
  "various small & mid sites": "Mid",
};

/** Default programme-overhead uplift (+20%). Editable by the Programme Manager. */
export const DEFAULT_OVERHEAD_PCT = 0.2;

/** Default annual-leave uplift (+15% ≈ 40 days/year, from the sheet). Editable. */
export const DEFAULT_LEAVE_PCT = 0.15;

/**
 * Default day-rate (£) used to convert FTE → cost (client answer: "£250/day for
 * now, editable"). A single rate applied to all roles. Editable on Assumptions.
 */
export const DEFAULT_DAY_RATE = 250;

/**
 * Working days that equal 1.0 FTE for one quarter. The workbook's basis is a
 * ~260-day working year (40 days leave), so a quarter ≈ 65 days. The FTE already
 * carries the leave uplift, so days are NOT reduced again. Editable.
 */
export const DEFAULT_WORKING_DAYS_PER_QUARTER = 65;

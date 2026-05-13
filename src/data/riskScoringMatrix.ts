// Risk scoring matrix — calibrated 5×5 lookup. Single source of truth for
// the matrix-based scoring used across both risk registers, RiskModal,
// AIRiskID, RiskAggregation, and TrendsHeatmaps. Converts (Likelihood,
// Impact) into a 1–25 score plus band label.
//
// Score matrix:
//
//                L=1  L=2  L=3  L=4  L=5
//   Severe (5)   15   19   22   24   25
//   Major  (4)   10   14   18   21   23
//   Medium (3)    6    9   13   17   20
//   Minor  (2)    3    5    8   12   16
//   Insig  (1)    1    2    4    7   11
//
// Likelihood: 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain.
// Impact:     1=Insignificant, 2=Minor, 3=Medium, 4=Major, 5=Severe.
//
// Each cell's value is its rank when all 25 cells are ordered by overall
// severity — NOT a product or sum. Example: L=1, I=2 → 3 (NOT 1 × 2 = 2).

import {
  PROJECT_IMPACT_BANDS,
  PROGRAMME_IMPACT_BANDS,
  type ProjectSize,
  type RiskLevel,
} from "./riskBands";

// SCORE_MATRIX[likelihood-1][impact-1] returns the calibrated score (1-25).
export const SCORE_MATRIX: number[][] = [
  // Likelihood = 1 (Rare): I=1 I=2 I=3 I=4 I=5
  /* L=1*/ [1, 3, 6, 10, 15],
  // Likelihood = 2 (Unlikely):
  /* L=2*/ [2, 5, 9, 14, 19],
  // Likelihood = 3 (Possible):
  /* L=3*/ [4, 8, 13, 18, 22],
  // Likelihood = 4 (Likely):
  /* L=4*/ [7, 12, 17, 21, 24],
  // Likelihood = 5 (Almost Certain):
  /* L=5*/ [11, 16, 20, 23, 25],
];

export const LIKELIHOOD_LABELS: ReadonlyArray<string> = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost Certain",
];

export const IMPACT_LABELS: ReadonlyArray<string> = [
  "Insignificant",
  "Minor",
  "Medium",
  "Major",
  "Severe",
];

export function calculateMatrixScore(
  likelihood: number | null | undefined,
  impact: number | null | undefined,
): number {
  const l = clamp1to5(likelihood);
  const i = clamp1to5(impact);
  if (l === 0 || i === 0) return 0;
  return SCORE_MATRIX[l - 1][i - 1];
}

function clamp1to5(v: number | null | undefined): number {
  const n = Math.round(v ?? 0);
  if (!Number.isFinite(n) || n < 1) return 0;
  if (n > 5) return 5;
  return n;
}

// =====================================================================
// 5-band scheme
// =====================================================================
//
// Bands per Risk Matrix lookup table (, col A-C):
//   1–3 Insignificant (emerald — green cells in spec)
//   4–6 Minor (lime cells)
//   7–11 Moderate (amber — yellow cells)
//   12–18 Major (orange cells)
//   19–25 Severe (rose — red cells)
//
// Verified cell-by-cell against the lookup rows R2-R26 in the client Excel
//  on.

export type RiskBand =
  | "insignificant"
  | "minor"
  | "moderate"
  | "major"
  | "severe";

export function bandForScore(score: number): RiskBand {
  if (!score || score <= 3) return "insignificant";
  if (score <= 6) return "minor";
  if (score <= 11) return "moderate";
  if (score <= 18) return "major";
  return "severe";
}

export function bandLabelForScore(score: number): string {
  return BAND_STYLES[bandForScore(score)].label;
}

/**
 * Display format for the Rating column answer
 * "Severe · 24".
 * When score is 0/unset, returns "—".
 */
export function formatRatingDisplay(score: number | null | undefined): string {
  const s = Number(score) || 0;
  if (s <= 0) return "—";
  return `${BAND_STYLES[bandForScore(s)].label} · ${s}`;
}

export const BAND_STYLES: Record<
  RiskBand,
  {
    /** Pill chip used in tables and modals.*/
    pill: string;
    /** Solid cell fill used in the 5×5 heatmap grid.*/
    cell: string;
    /** Coloured dot for legends + meta lines.*/
    dot: string;
    /** Display label exactly as written in the client's Excel lookup.*/
    label: string;
  }
> = {
  insignificant: {
    pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cell: "bg-emerald-100 text-emerald-900",
    dot: "bg-emerald-500",
    label: "Insignificant",
  },
  minor: {
    pill: "bg-lime-100 text-lime-800 border-lime-200",
    cell: "bg-lime-100 text-lime-900",
    dot: "bg-lime-500",
    label: "Minor",
  },
  moderate: {
    pill: "bg-amber-100 text-amber-800 border-amber-200",
    cell: "bg-amber-200 text-amber-900",
    dot: "bg-amber-500",
    label: "Moderate",
  },
  major: {
    pill: "bg-orange-100 text-orange-800 border-orange-200",
    cell: "bg-orange-200 text-orange-900",
    dot: "bg-orange-500",
    label: "Major",
  },
  severe: {
    pill: "bg-rose-200 text-rose-900 border-rose-300 font-bold",
    cell: "bg-rose-300 text-rose-950",
    dot: "bg-rose-600",
    label: "Severe",
  },
};

export const BAND_RANGES: ReadonlyArray<{
  band: RiskBand;
  min: number;
  max: number;
  range: string;
}> = [
  { band: "insignificant", min: 1, max: 3, range: "1–3" },
  { band: "minor", min: 4, max: 6, range: "4–6" },
  { band: "moderate", min: 7, max: 11, range: "7–11" },
  { band: "major", min: 12, max: 18, range: "12–18" },
  { band: "severe", min: 19, max: 25, range: "19–25" },
];

// Minimum score that puts a risk into the Severe band. Consumed by KPI
// counts, register filters, and any escalation gate that triggers on Severe.
export const SEVERE_SCORE_THRESHOLD = 19;

// =====================================================================
// Severe-trigger helper (— escalate any risk with Impact=5)
// =====================================================================

/**
 * Returns true if EITHER the gross OR the residual impact rating is 5.
 * Drives the rose "ESCALATE" pill on register rows AND the Strategic
 * Director notification fired from the save handler.
 */
export function isSevereImpact(risk: {
  grossI?: number | null;
  residualI?: number | null;
}): boolean {
  const g = Number(risk.grossI) || 0;
  const r = Number(risk.residualI) || 0;
  return g >= 5 || r >= 5;
}

// =====================================================================
// Project / Programme £ band display (— projects different from programmes)
// =====================================================================
//
// These helpers return the £ RANGE for each Impact level (1-5), shown to the
// user as a reference table beside the Impact dropdown in RiskModal AND as
// a tooltip on the Impact column of the registers.
//
// Source: Project Excel `Financial Ratings` sheet rows 1-36 (4 size tiers);
// Programme Excel `RAD data` sheet rows 16-21 (single 5-band table).

export interface ImpactBandRange {
  level: RiskLevel;
  /** Lower bound in £ (inclusive). 0 means "from zero".*/
  min: number;
  /** Upper bound in £ (inclusive). null means "no upper cap".*/
  max: number | null;
  /** Human-readable range, e.g. "£0 – £25,000" or "More than £150,000".*/
  rangeLabel: string;
  /** Band label aligned with the matrix bands (Insignificant/Minor/Moderate/Major/Severe).*/
  bandLabel: string;
}

const PROJECT_BAND_RANGES: Record<ProjectSize, ImpactBandRange[]> = {
  Small: [
    { level: 1, min: 0, max: 5_000, rangeLabel: "< £5,000", bandLabel: "Insignificant" },
    { level: 2, min: 5_000, max: 50_000, rangeLabel: "£5,000 – £50,000", bandLabel: "Minor" },
    { level: 3, min: 50_000, max: 100_000, rangeLabel: "> £50,000 – £100,000", bandLabel: "Moderate" },
    { level: 4, min: 100_000, max: 150_000, rangeLabel: "> £100,000 – £150,000", bandLabel: "Major" },
    { level: 5, min: 150_000, max: 200_000, rangeLabel: "£150,000 – £200,000", bandLabel: "Severe" },
  ],
  Medium: [
    { level: 1, min: 0, max: 25_000, rangeLabel: "£0 – £25,000", bandLabel: "Insignificant" },
    { level: 2, min: 25_000, max: 50_000, rangeLabel: "£25,000 – £50,000", bandLabel: "Minor" },
    { level: 3, min: 50_000, max: 100_000, rangeLabel: "£50,000 – £100,000", bandLabel: "Moderate" },
    { level: 4, min: 100_000, max: 150_000, rangeLabel: "£100,000 – £150,000", bandLabel: "Major" },
    { level: 5, min: 150_000, max: null, rangeLabel: "More than £150,000", bandLabel: "Severe" },
  ],
  Large: [
    { level: 1, min: 0, max: 25_000, rangeLabel: "£0 – £25,000", bandLabel: "Insignificant" },
    { level: 2, min: 25_000, max: 50_000, rangeLabel: "£25,000 – £50,000", bandLabel: "Minor" },
    { level: 3, min: 50_000, max: 100_000, rangeLabel: "£50,000 – £100,000", bandLabel: "Moderate" },
    { level: 4, min: 100_000, max: 150_000, rangeLabel: "£100,000 – £150,000", bandLabel: "Major" },
    { level: 5, min: 150_000, max: null, rangeLabel: "More than £150,000", bandLabel: "Severe" },
  ],
  Major: [
    { level: 1, min: 0, max: 25_000, rangeLabel: "£0 – £25,000", bandLabel: "Insignificant" },
    { level: 2, min: 25_000, max: 50_000, rangeLabel: "£25,000 – £50,000", bandLabel: "Minor" },
    { level: 3, min: 50_000, max: 100_000, rangeLabel: "£50,000 – £100,000", bandLabel: "Moderate" },
    { level: 4, min: 250_000, max: 350_000, rangeLabel: "£250,000 – £350,000", bandLabel: "Major" },
    { level: 5, min: 350_000, max: null, rangeLabel: "More than £350,000", bandLabel: "Severe" },
  ],
};

const PROGRAMME_BAND_RANGES: ImpactBandRange[] = [
  { level: 1, min: 0, max: 250_000, rangeLabel: "< £250,000", bandLabel: "Insignificant" },
  { level: 2, min: 250_000, max: 1_000_000, rangeLabel: "£250,000 – £1,000,000", bandLabel: "Minor" },
  { level: 3, min: 1_000_000, max: 5_000_000, rangeLabel: "£1,000,000 – £5,000,000", bandLabel: "Moderate" },
  { level: 4, min: 5_000_000, max: 15_000_000, rangeLabel: "£5,000,000 – £15,000,000", bandLabel: "Major" },
  { level: 5, min: 15_000_000, max: null, rangeLabel: "> £15,000,000", bandLabel: "Severe" },
];

export function impactBandsForProject(size: ProjectSize): ImpactBandRange[] {
  return PROJECT_BAND_RANGES[size] ?? PROJECT_BAND_RANGES.Medium;
}

export function impactBandsForProgramme(): ImpactBandRange[] {
  return PROGRAMME_BAND_RANGES;
}

/**
 * Returns the £-range table that applies to a given risk based on whether
 * it is a programme-level risk or a project-level risk. :
 *   Programme-level risks use the single programme £ table.
 *   Project-level risks use the project-size-driven table (Small / Medium
 *     / Large / Major) derived from the linked project.
 */
export function impactBandsForRisk(
  risk: { isProgrammeLevel?: boolean | null },
  projectSize: ProjectSize | null | undefined,
): ImpactBandRange[] {
  if (risk?.isProgrammeLevel) return impactBandsForProgramme();
  return impactBandsForProject(projectSize ?? "Medium");
}

/** Returns true when the risk should use programme semantics.*/
export function isProgrammeRisk(risk: {
  isProgrammeLevel?: boolean | null;
}): boolean {
  return !!risk?.isProgrammeLevel;
}

/**
 * Pick the closest matching Impact level (1-5) for a given £ amount using
 * the supplied band table. Used as a hint in RiskModal: "your £75,000 falls
 * in Band 3 (Moderate)".
 */
export function suggestImpactLevelForAmount(
  amount: number,
  bands: ImpactBandRange[],
): RiskLevel | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  for (const b of bands) {
    if (b.max === null) {
      if (amount >= b.min) return b.level;
    } else if (amount <= b.max) {
      return b.level;
    }
  }
  return null;
}

// =====================================================================
// Probability mapping helper (mirrors L_TO_PCT exactly for symmetry)
// =====================================================================

/**
 * Likelihood (1-5) → Probability decimal (0.2-1.0).
 * Mirrors L_TO_PCT in riskBands.ts as a decimal so ALE = Impact × Probability
 * can be computed directly without rescaling.
 */
export const LIKELIHOOD_TO_PROBABILITY: Record<RiskLevel, number> = {
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 1.0,
};

export function probabilityForLikelihood(
  likelihood: number | null | undefined,
): number {
  const l = clamp1to5(likelihood);
  if (l === 0) return 0;
  return LIKELIHOOD_TO_PROBABILITY[l as RiskLevel];
}

// Re-export the existing impact-band constants so consumers only need to
// import from this module going forward.
export { PROJECT_IMPACT_BANDS, PROGRAMME_IMPACT_BANDS };
export type { ProjectSize, RiskLevel };

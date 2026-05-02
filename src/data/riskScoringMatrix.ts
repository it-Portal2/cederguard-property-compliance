// Risk Scoring Matrix — calibrated 5×5 lookup per client spec (2026-05-03).
//
// This module is ADDITIVE. The existing `likelihood × impact` formula used
// across riskData.ts / RiskModal.tsx / RiskRegister / RiskDashboard / etc. is
// intentionally preserved — it powers the existing risk-rating fields that
// many surfaces already render correctly. This new module exists ONLY so
// the heatmap (and any future surface explicitly choosing to opt in) can
// render the calibrated 1–25 rank-ordered scoring the client specified.
//
// Client matrix (verbatim from spec):
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
// The scores are NOT a product or sum — each cell's value is its rank when
// all 25 cells are ordered by overall severity.

// SCORE_MATRIX[likelihood-1][impact-1] returns the calibrated score (1-25).
export const SCORE_MATRIX: number[][] = [
  // Likelihood = 1 (Rare):           I=1  I=2  I=3  I=4  I=5
  /* L=1 */ [   1,   3,   6,  10,  15 ],
  // Likelihood = 2 (Unlikely):
  /* L=2 */ [   2,   5,   9,  14,  19 ],
  // Likelihood = 3 (Possible):
  /* L=3 */ [   4,   8,  13,  18,  22 ],
  // Likelihood = 4 (Likely):
  /* L=4 */ [   7,  12,  17,  21,  24 ],
  // Likelihood = 5 (Almost Certain):
  /* L=5 */ [  11,  16,  20,  23,  25 ],
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

// 4-band scheme matching the client matrix's colour distribution:
//   1–5    Low        (green cells in the spec)
//   6–12   Moderate   (lime / yellow cells)
//   13–19  High       (amber cells)
//   20–25  Critical   (red cells)
export type RiskBand = "low" | "moderate" | "high" | "critical";

export function bandForScore(score: number): RiskBand {
  if (!score || score <= 5) return "low";
  if (score <= 12) return "moderate";
  if (score <= 19) return "high";
  return "critical";
}

export const BAND_STYLES: Record<
  RiskBand,
  { pill: string; cell: string; dot: string; label: string }
> = {
  low: {
    pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cell: "bg-emerald-100 text-emerald-900",
    dot: "bg-emerald-500",
    label: "Low",
  },
  moderate: {
    pill: "bg-lime-100 text-lime-800 border-lime-200",
    cell: "bg-lime-100 text-lime-900",
    dot: "bg-lime-500",
    label: "Moderate",
  },
  high: {
    pill: "bg-amber-100 text-amber-800 border-amber-200",
    cell: "bg-amber-200 text-amber-900",
    dot: "bg-amber-500",
    label: "High",
  },
  critical: {
    pill: "bg-rose-200 text-rose-900 border-rose-300 font-bold",
    cell: "bg-rose-300 text-rose-950",
    dot: "bg-rose-600",
    label: "Critical",
  },
};

// Useful for the workstream heatmap legend ranges (1-25 → band).
export const BAND_RANGES: ReadonlyArray<{
  band: RiskBand;
  min: number;
  max: number;
  range: string;
}> = [
  { band: "low", min: 1, max: 5, range: "1–5" },
  { band: "moderate", min: 6, max: 12, range: "6–12" },
  { band: "high", min: 13, max: 19, range: "13–19" },
  { band: "critical", min: 20, max: 25, range: "20–25" },
];

// =====================================================================
// ALE / Financial Threshold Helpers
// =====================================================================
//
// Per client spec (2026-05-03): project/programme costs must be linked to
// risks so financial thresholds are determined correctly for Gross ALE and
// Residual ALE. These helpers compute "ALE as % of project/programme value"
// and apply escalation rules. Additive — does not replace any existing
// scoring or ALE logic in riskData.ts / RiskModal.tsx / etc.
//
// Default thresholds (informed by industry-standard council risk practice):
//   ≥ 10% of value → escalate one band (e.g. Moderate → High)
//   ≥ 25% of value → force Critical band regardless of base band

export const DEFAULT_ALE_ONE_BAND_PCT = 0.1;
export const DEFAULT_ALE_FORCE_CRITICAL_PCT = 0.25;

/**
 * Compute ALE as a fraction of the linked project/programme value.
 * Returns null when value is missing, zero, or negative — caller should
 * render "—" / "n/a" rather than 0%, since no link is meaningfully different
 * from "linked but ALE is zero".
 */
export function computeAleAsPercent(
  ale: number | null | undefined,
  value: number | null | undefined,
): number | null {
  const a = Number(ale) || 0;
  const v = Number(value) || 0;
  if (v <= 0) return null;
  if (a <= 0) return 0;
  return a / v;
}

/** Format ALE % for display: "25%" or "—" when null. */
export function formatAlePercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  if (pct < 0.005) return "<1%";
  return `${(pct * 100).toFixed(0)}%`;
}

export interface AleEscalationResult {
  /** ALE / value as fraction (0..1+), or null if not computable. */
  pct: number | null;
  /** Effective band after applying ALE escalation (or baseBand if no escalation). */
  band: RiskBand;
  /** True if ALE escalation changed the band beyond the L×I matrix score. */
  escalated: boolean;
  /** Human-readable reason; null when not escalated. */
  reason: string | null;
}

/**
 * Apply ALE-based escalation on top of a base band (typically derived from
 * the L×I matrix score via bandForScore(calculateMatrixScore(L, I))). Returns
 * the effective band + display metadata for UI surfaces.
 */
export function aleEscalation(
  ale: number | null | undefined,
  value: number | null | undefined,
  baseBand: RiskBand,
  options?: { oneBandPct?: number; forceCriticalPct?: number },
): AleEscalationResult {
  const oneBandPct = options?.oneBandPct ?? DEFAULT_ALE_ONE_BAND_PCT;
  const forceCriticalPct =
    options?.forceCriticalPct ?? DEFAULT_ALE_FORCE_CRITICAL_PCT;
  const pct = computeAleAsPercent(ale, value);

  if (pct === null) {
    return { pct: null, band: baseBand, escalated: false, reason: null };
  }
  if (pct >= forceCriticalPct) {
    if (baseBand === "critical") {
      return { pct, band: "critical", escalated: false, reason: null };
    }
    return {
      pct,
      band: "critical",
      escalated: true,
      reason: `ALE ${formatAlePercent(pct)} of value → forced Critical (≥${Math.round(
        forceCriticalPct * 100,
      )}%)`,
    };
  }
  if (pct >= oneBandPct) {
    const next = bumpBand(baseBand);
    if (next === baseBand) {
      return { pct, band: next, escalated: false, reason: null };
    }
    return {
      pct,
      band: next,
      escalated: true,
      reason: `ALE ${formatAlePercent(pct)} of value → escalated one band`,
    };
  }
  return { pct, band: baseBand, escalated: false, reason: null };
}

function bumpBand(b: RiskBand): RiskBand {
  if (b === "low") return "moderate";
  if (b === "moderate") return "high";
  if (b === "high") return "critical";
  return "critical";
}

/**
 * Resolve the linked project/programme value for a risk.
 *
 * - If risk.projectId is set, returns that project's contractValue.
 * - Else if risk.programmeId is set, returns the SUM of contractValue
 *   across every project under that programme (portfolio-level exposure).
 * - Returns null when neither path resolves to a positive value.
 *
 * Caller passes the projects array from the store so this helper stays
 * pure (no store dependency, easy to test, easy to memo at the call site).
 */
export interface ProjectForLinkage {
  id?: string;
  programmeId?: string | null;
  contractValue?: number | null;
  totalValue?: number | null;
  value?: number | null;
}

export interface RiskForLinkage {
  projectId?: string | null;
  programmeId?: string | null;
}

export function resolveLinkedValue(
  risk: RiskForLinkage,
  projects: ReadonlyArray<ProjectForLinkage>,
): number | null {
  // Project value can be stored under any of three field names depending on
  // entity (Project uses contractValue; Programme aggregations use totalValue;
  // legacy seed data uses `value`). Try them in order so we work everywhere.
  const valueOf = (p: ProjectForLinkage): number => {
    const v =
      Number(p.contractValue) ||
      Number(p.totalValue) ||
      Number(p.value) ||
      0;
    return v;
  };

  if (risk.projectId) {
    const p = projects.find((p) => p.id === risk.projectId);
    if (!p) return null;
    const v = valueOf(p);
    return v > 0 ? v : null;
  }
  if (risk.programmeId) {
    const sum = projects
      .filter((p) => p.programmeId === risk.programmeId)
      .reduce((acc, p) => acc + valueOf(p), 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

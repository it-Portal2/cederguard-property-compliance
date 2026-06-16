/**
 * Resource Planner — demand engine (pure, framework-agnostic).
 *
 * SINGLE SOURCE OF TRUTH for FTE demand. Faithful to the workbook's per-quarter
 * stage logic, extended per client answers:
 *  - Stage boundaries (from the sheet's nested IF over EG/EH/EI/EJ/EK):
 *      S1 Site&Concept : PlanningSubmitted → min(PlanningAchieved, SoS)
 *      S2 Design&Deliv : min(PlanningAchieved, SoS) → SoS
 *      S3 Construction : SoS → Handover
 *      S4 Defects&BAU  : Handover → EOD (inclusive)
 *    A missing boundary date ⇒ that stage contributes 0 FTE (answer 4-A).
 *  - Demand = rate card FTE for (stage, role, complexity); unmapped complexity ⇒ 0 (answer 6-A).
 *  - Overhead + Annual-Leave are PM-adjustable % uplifts on computed demand (answer 21-A).
 *  - Capacity is supply-vs-demand by role (answer 19-A).
 */

import {
  DEFAULT_COMPLEXITY_MAP,
  COMPLEXITY_BANDS,
  ROLES,
} from "./constants";
import {
  buildQuarterAxis,
  dateToFyQuarterIndex,
  horizonFromIndices,
} from "./quarters";
import type {
  CapacityQuarter,
  CapacityResult,
  ComplexityBand,
  DemandMatrix,
  FinancialYearAggregate,
  RateCard,
  ResourceAssumptions,
  ResourceScheme,
  Role,
  Stage,
} from "./types";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/** Resolve a raw complexity label to a canonical band (tolerant matching). */
export function resolveComplexityBand(
  raw: string | undefined,
  map: Record<string, ComplexityBand> = DEFAULT_COMPLEXITY_MAP,
): ComplexityBand | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
  return map[key];
}

/**
 * Backfill a scheme on load: resolve the complexity band and derive total homes.
 * Idempotent. Mirrors the store's `normalizeRisk` pattern.
 */
export function normalizeScheme(
  s: ResourceScheme,
  map: Record<string, ComplexityBand> = DEFAULT_COMPLEXITY_MAP,
): ResourceScheme {
  const complexity = s.complexity ?? resolveComplexityBand(s.complexityRaw, map);
  const council = num(s.councilHomes);
  const inter = num(s.intermediateHomes);
  const priv = num(s.privateHomes);
  const hasAll = s.allHomes != null && (s.allHomes as unknown) !== "";
  const allHomes = hasAll ? num(s.allHomes) : council + inter + priv;
  return { ...s, complexity, allHomes };
}

interface StageBoundaries {
  planSub: number | null;
  planAch: number | null;
  sos: number | null;
  handover: number | null;
  eod: number | null;
}

/** Convert a scheme's dates to absolute fiscal-quarter indices. */
export function schemeStageBoundaries(s: ResourceScheme): StageBoundaries {
  return {
    planSub: dateToFyQuarterIndex(s.planningSubmitted),
    planAch: dateToFyQuarterIndex(s.planningAchieved),
    sos: dateToFyQuarterIndex(s.sosDate),
    handover: dateToFyQuarterIndex(s.handoverDate),
    eod: dateToFyQuarterIndex(s.eodDate),
  };
}

/** The non-null boundary indices for a scheme (used to derive the horizon). */
export function schemeBoundaryIndices(s: ResourceScheme): number[] {
  const b = schemeStageBoundaries(s);
  return [b.planSub, b.sos, b.handover, b.eod].filter(
    (i): i is number => i != null,
  );
}

/**
 * Which stage (if any) a scheme is in at absolute quarter index `q`.
 * Evaluated in S1→S4 order (matching the sheet's nested IF); intervals are
 * adjacent so at most one matches. Missing boundary ⇒ that stage is skipped.
 */
export function stageAtQuarter(q: number, b: StageBoundaries): Stage | null {
  // S1: PlanningSubmitted → min(PlanningAchieved, SoS)
  if (b.planSub != null) {
    const s1End = Math.min(b.planAch ?? Infinity, b.sos ?? Infinity);
    if (q >= b.planSub && q < s1End) return "S1";
  }
  // S2: min(PlanningAchieved, SoS) → SoS
  if (b.sos != null) {
    const s2Start = Math.min(b.planAch ?? b.sos, b.sos);
    if (q >= s2Start && q < b.sos) return "S2";
  }
  // S3: SoS → Handover
  if (b.sos != null && b.handover != null) {
    if (q >= b.sos && q < b.handover) return "S3";
  }
  // S4: Handover → EOD (inclusive)
  if (b.handover != null && b.eod != null) {
    if (q >= b.handover && q <= b.eod) return "S4";
  }
  return null;
}

/** FTE for one scheme/role at absolute quarter `q`. 0 when out of stage or unmapped. */
export function schemeQuarterDemand(
  scheme: ResourceScheme,
  boundaries: StageBoundaries,
  rateCard: RateCard,
  role: Role,
  q: number,
): number {
  const stage = stageAtQuarter(q, boundaries);
  if (!stage) return 0;
  const band = scheme.complexity;
  if (!band) return 0;
  return rateCard[stage]?.[role]?.[band] ?? 0;
}

function emptyByRole(len: number): Record<Role, number[]> {
  const out = {} as Record<Role, number[]>;
  for (const r of ROLES) out[r] = new Array(len).fill(0);
  return out;
}

function emptyByComplexity(len: number): Record<ComplexityBand, number[]> {
  const out = {} as Record<ComplexityBand, number[]>;
  for (const c of COMPLEXITY_BANDS) out[c] = new Array(len).fill(0);
  return out;
}

/**
 * Compute the raw demand matrix (no overhead/leave uplift) across `axis`.
 * Schemes should already be normalised. `axis` positions map 1:1 to the result arrays.
 */
export function computeDemandMatrix(
  schemes: ResourceScheme[],
  rateCard: RateCard,
  axis: DemandMatrix["axis"],
): DemandMatrix {
  const len = axis.length;
  const totalByQuarter = new Array(len).fill(0);
  const byRole = emptyByRole(len);
  const byComplexity = emptyByComplexity(len);
  const bySchemeRole: DemandMatrix["bySchemeRole"] = [];

  for (const scheme of schemes) {
    const boundaries = schemeStageBoundaries(scheme);
    const band = scheme.complexity;
    for (const role of ROLES) {
      const quarters = new Array(len).fill(0);
      let any = false;
      for (let p = 0; p < len; p++) {
        const fte = schemeQuarterDemand(
          scheme,
          boundaries,
          rateCard,
          role,
          axis[p].index,
        );
        if (fte) {
          quarters[p] = fte;
          totalByQuarter[p] += fte;
          byRole[role][p] += fte;
          if (band) byComplexity[band][p] += fte;
          any = true;
        }
      }
      if (any) {
        bySchemeRole.push({
          schemeId: scheme.id,
          schemeName: scheme.name,
          role,
          complexity: band,
          quarters,
        });
      }
    }
  }

  return { axis, totalByQuarter, byRole, byComplexity, bySchemeRole };
}

/**
 * Apply the Programme-overhead + Annual-Leave uplift as a flat percentage on
 * computed demand (answer 21-A). Returns a new matrix; the original is untouched.
 */
export function applyOverheadAndLeave(
  matrix: DemandMatrix,
  overheadPct: number,
  leavePct: number,
): DemandMatrix {
  const factor = 1 + (overheadPct || 0) + (leavePct || 0);
  if (factor === 1) return matrix;
  const scaleArr = (a: number[]) => a.map((v) => v * factor);
  const byRole = {} as Record<Role, number[]>;
  for (const r of ROLES) byRole[r] = scaleArr(matrix.byRole[r]);
  const byComplexity = {} as Record<ComplexityBand, number[]>;
  for (const c of COMPLEXITY_BANDS) byComplexity[c] = scaleArr(matrix.byComplexity[c]);
  return {
    axis: matrix.axis,
    totalByQuarter: scaleArr(matrix.totalByQuarter),
    byRole,
    byComplexity,
    bySchemeRole: matrix.bySchemeRole.map((s) => ({
      ...s,
      quarters: scaleArr(s.quarters),
    })),
  };
}

/** Roll demand up to financial years (the dashboard's FTE-by-FY table). */
export function aggregateByFinancialYear(
  matrix: DemandMatrix,
): FinancialYearAggregate[] {
  const byFy = new Map<number, FinancialYearAggregate>();
  matrix.axis.forEach((entry, p) => {
    let agg = byFy.get(entry.fy);
    if (!agg) {
      const byRole = {} as Record<Role, number>;
      for (const r of ROLES) byRole[r] = 0;
      agg = { fy: entry.fy, fyLabel: entry.fyLabel, byRole, total: 0 };
      byFy.set(entry.fy, agg);
    }
    for (const r of ROLES) agg.byRole[r] += matrix.byRole[r][p];
    agg.total += matrix.totalByQuarter[p];
  });
  return [...byFy.values()].sort((a, b) => a.fy - b.fy);
}

/** FTE per complexity band at a given axis position (default: the peak quarter). */
export function complexityAtQuarter(
  matrix: DemandMatrix,
  axisPos?: number,
): Record<ComplexityBand, number> {
  const pos = axisPos ?? peakQuarterFte(matrix).axisPos;
  const out = {} as Record<ComplexityBand, number>;
  for (const c of COMPLEXITY_BANDS) out[c] = pos >= 0 ? matrix.byComplexity[c][pos] : 0;
  return out;
}

/** The quarter with the highest total FTE. */
export function peakQuarterFte(matrix: DemandMatrix): {
  axisPos: number;
  label: string;
  fte: number;
} {
  let axisPos = -1;
  let fte = 0;
  matrix.totalByQuarter.forEach((v, p) => {
    if (v > fte) {
      fte = v;
      axisPos = p;
    }
  });
  return { axisPos, label: axisPos >= 0 ? matrix.axis[axisPos].label : "—", fte };
}

/** Sum of FTE across all quarters (matches the DASHBOARD "Total FTE" KPI). */
export function totalFte(matrix: DemandMatrix): number {
  return matrix.totalByQuarter.reduce((a, b) => a + b, 0);
}

/**
 * Supply-vs-demand by role across the axis (answer 19-A). `supplyByRole` is a
 * flat available-FTE figure per role; balance = supply − demand (negative = shortfall).
 */
export function computeCapacity(
  supplyByRole: Partial<Record<Role, number>> | undefined,
  matrix: DemandMatrix,
): CapacityResult {
  const byQuarter: CapacityQuarter[] = [];
  const worstByRole = {} as Record<Role, number>;
  for (const r of ROLES) worstByRole[r] = Infinity;
  matrix.axis.forEach((entry, p) => {
    for (const role of ROLES) {
      const demand = matrix.byRole[role][p];
      const supply = num(supplyByRole?.[role]);
      const balance = supply - demand;
      byQuarter.push({
        quarter: entry.index,
        fyLabel: entry.fyLabel,
        role,
        demand,
        supply,
        balance,
      });
      if (balance < worstByRole[role]) worstByRole[role] = balance;
    }
  });
  for (const r of ROLES) if (!Number.isFinite(worstByRole[r])) worstByRole[r] = 0;
  return { byQuarter, worstByRole };
}

export interface ResourcePlan {
  axis: DemandMatrix["axis"];
  /** Demand before the overhead/leave uplift. */
  rawMatrix: DemandMatrix;
  /** Demand after the overhead/leave uplift (the headline figures). */
  matrix: DemandMatrix;
  byFinancialYear: FinancialYearAggregate[];
  peak: { axisPos: number; label: string; fte: number };
  totalFte: number;
  capacity: CapacityResult;
}

/**
 * One-shot entry point: normalise schemes, build the axis (from the configured
 * horizon, or derived from the data when absent), compute demand, apply the
 * uplift, and roll up every view the pages need. The store computes this once
 * and memoises it.
 */
export function buildResourcePlan(
  rawSchemes: ResourceScheme[],
  assumptions: ResourceAssumptions,
): ResourcePlan {
  const schemes = rawSchemes.map((s) =>
    normalizeScheme(s, assumptions.complexityMap),
  );

  const horizon =
    assumptions.horizon && assumptions.horizon.endFy >= assumptions.horizon.startFy
      ? assumptions.horizon
      : horizonFromIndices(schemes.flatMap(schemeBoundaryIndices));
  const axis = buildQuarterAxis(horizon.startFy, horizon.endFy);

  const rawMatrix = computeDemandMatrix(schemes, assumptions.rateCard, axis);
  const matrix = applyOverheadAndLeave(
    rawMatrix,
    assumptions.overheadPct,
    assumptions.leavePct,
  );

  return {
    axis,
    rawMatrix,
    matrix,
    byFinancialYear: aggregateByFinancialYear(matrix),
    peak: peakQuarterFte(matrix),
    totalFte: totalFte(matrix),
    capacity: computeCapacity(assumptions.supplyByRole, matrix),
  };
}

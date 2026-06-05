// Risk-to-Issue conversion engine — SINGLE SOURCE OF TRUTH for deciding when a
// documented risk is "trending toward becoming an active issue" and WHY.
//
// Pure module: no React, no store, no side effects. Every surface (RiskRegister
// badge/tooltip/tile, ProgrammeRiskRegister, the Alert Board "Conversion Watch"
// group) calls `evaluateConversion` so the logic lives in exactly one place.
//
// Scores come exclusively from riskMetrics.ts (never re-derived inline, never
// raw L×I). Thresholds below are calibrated defaults (client decision Q4=A) —
// retune the whole system by editing these constants.

import {
  getGrossScore,
  getResidualScore,
  MAJOR_SCORE_THRESHOLD,
  SEVERE_SCORE_THRESHOLD,
} from "./riskMetrics";
import { differenceInDays } from "date-fns";
import type { RiskItem } from "../store/useStore";

// ── Tunable thresholds ───────────────────────────────────────────────────────
/** How many independent factors must stack before a risk is flagged "trending". */
export const CONVERSION_MIN_FACTORS = 2;
/** A risk not reviewed within this many days counts as "stale". */
export const STALE_REVIEW_DAYS = 90;
/** Need at least this many probability snapshots to call an upward trend. */
export const PROB_TREND_MIN_SNAPSHOTS = 2;
/** Residual score at/above this triggers the severity factor (= MAJOR band). */
export const CONVERSION_SEVERITY_THRESHOLD = MAJOR_SCORE_THRESHOLD;

/**
 * Per-appetite residual-score ceiling. `APPETITES` runs low→high tolerance
 * (Averse → Hungry); a residual score above the ceiling for the stated appetite
 * means the risk sits outside tolerance. Tunable alongside the constants above.
 */
const APPETITE_CEILING: Record<string, number> = {
  Averse: 6,
  Minimal: 9,
  Cautious: MAJOR_SCORE_THRESHOLD, // 12
  Open: 16,
  Hungry: SEVERE_SCORE_THRESHOLD, // 19
};

/** Statuses that mean the risk is resolved — never flagged as trending. */
const RESOLVED_STATUSES = new Set(["Closed"]);

export interface ConversionFactor {
  key: string;
  reason: string;
  weight: number;
}

export interface ConversionResult {
  /** True when `factors.length >= CONVERSION_MIN_FACTORS`. */
  isTrending: boolean;
  /** Sum of factor weights — a rough "how close to an issue" magnitude. */
  score: number;
  /** Plain-English justifications ("why this might be so"). */
  reasons: string[];
  /** Factor keys (for badges/analytics). */
  factors: string[];
}

const EMPTY: ConversionResult = {
  isTrending: false,
  score: 0,
  reasons: [],
  factors: [],
};

function isResolved(risk: RiskItem): boolean {
  return !!risk.convertedToIssue || RESOLVED_STATUSES.has(risk.status);
}

/**
 * Evaluate a single risk against all conversion signals.
 * @param risk     the risk to assess
 * @param allRisks the full in-scope risk list (for dependency-cascade lookup)
 */
export function evaluateConversion(
  risk: RiskItem,
  allRisks: RiskItem[] = [],
): ConversionResult {
  // Resolved / already-converted risks are out of scope entirely.
  if (isResolved(risk)) return EMPTY;

  const factors: ConversionFactor[] = [];
  const now = new Date();
  const rScore = getResidualScore(risk);
  const status = (risk.status || "Open").toLowerCase();

  // 1. Severity — residual score at/above the major threshold.
  if (rScore >= CONVERSION_SEVERITY_THRESHOLD) {
    const severe = rScore >= SEVERE_SCORE_THRESHOLD;
    factors.push({
      key: "severity",
      weight: severe ? 3 : 2,
      reason: `Residual score ${rScore} sits in the ${severe ? "severe" : "major"} band (≥ ${CONVERSION_SEVERITY_THRESHOLD}).`,
    });
  }

  // 2. Overdue — mitigation past its due date.
  if (risk.dueDate) {
    const due = new Date(risk.dueDate);
    if (!isNaN(due.getTime()) && due < now) {
      const days = differenceInDays(now, due);
      factors.push({
        key: "overdue",
        weight: 2,
        reason: `Mitigation is ${days} day${days === 1 ? "" : "s"} past its due date.`,
      });
    }
  }

  // 3. Stale review — not reviewed within the cutoff (falls back to dateAdded).
  const reviewRef = risk.lastReviewDate || risk.dateAdded;
  if (reviewRef) {
    const ref = new Date(reviewRef);
    if (!isNaN(ref.getTime())) {
      const days = differenceInDays(now, ref);
      if (days >= STALE_REVIEW_DAYS) {
        factors.push({
          key: "stale",
          weight: 1,
          reason: risk.lastReviewDate
            ? `Not reviewed in ${days} days (cutoff ${STALE_REVIEW_DAYS}).`
            : `No review recorded in the ${days} days since it was added.`,
        });
      }
    }
  }

  // 4. Escalated but still open/in-progress.
  if (risk.escalated && (risk.status === "Open" || risk.status === "In Progress")) {
    factors.push({
      key: "escalated",
      weight: 2,
      reason: `Escalated to the programme board but still ${status}.`,
    });
  }

  // 5. Residual exposure above the stated appetite tolerance.
  const ceiling = APPETITE_CEILING[risk.appetite ?? ""];
  if (typeof ceiling === "number" && rScore > ceiling) {
    factors.push({
      key: "appetite",
      weight: 1,
      reason: `Residual score ${rScore} is above the '${risk.appetite}' appetite tolerance (${ceiling}).`,
    });
  }

  // 6. Open & unmitigated — no documented controls.
  const noControls = !risk.controls || risk.controls.trim().length === 0;
  if (noControls && risk.status !== "Mitigated" && risk.status !== "Managed") {
    factors.push({
      key: "unmitigated",
      weight: 1,
      reason: `Still ${status} with no documented controls in place.`,
    });
  }

  // 7. Probability trend up — score rose across the recorded snapshots.
  const hist = Array.isArray(risk.probHistory) ? risk.probHistory : [];
  if (hist.length >= PROB_TREND_MIN_SNAPSHOTS) {
    const first = hist[0];
    const last = hist[hist.length - 1];
    if (last.residualScore > first.residualScore || last.grossScore > first.grossScore) {
      factors.push({
        key: "trend",
        weight: 2,
        reason: `Risk score has trended upward over time (residual ${first.residualScore} → ${last.residualScore}).`,
      });
    }
  }

  // 8. Dependency cascade — a linked dependency is itself severe/overdue/converted.
  const deps = Array.isArray(risk.dependencies) ? risk.dependencies : [];
  if (deps.length) {
    const byId = new Map(allRisks.map((r) => [r.id, r]));
    for (const depId of deps) {
      const dep = byId.get(depId);
      if (!dep) continue;
      const depSevere =
        getResidualScore(dep) >= SEVERE_SCORE_THRESHOLD ||
        getGrossScore(dep) >= SEVERE_SCORE_THRESHOLD;
      const depOverdue =
        !!dep.dueDate && new Date(dep.dueDate) < now && dep.status !== "Closed";
      const depConverted = !!dep.convertedToIssue;
      if (depSevere || depOverdue || depConverted) {
        const state = depConverted
          ? "already become an issue"
          : depSevere
            ? "is rated severe"
            : "is overdue";
        factors.push({
          key: "dependency",
          weight: 2,
          reason: `A linked dependency (${dep.title || dep.id}) ${state}.`,
        });
        break; // one dependency reason is enough
      }
    }
  }

  const score = factors.reduce((s, f) => s + f.weight, 0);
  return {
    isTrending: factors.length >= CONVERSION_MIN_FACTORS,
    score,
    reasons: factors.map((f) => f.reason),
    factors: factors.map((f) => f.key),
  };
}

/** A recommended next step for a trending risk, keyed off its strongest factor. */
export function conversionAction(result: ConversionResult): string {
  if (result.factors.includes("dependency"))
    return "Review the linked dependency and convert this risk to a managed issue if it has materialised.";
  if (result.factors.includes("overdue"))
    return "Re-baseline the mitigation plan, or convert to an issue if the risk has already materialised.";
  if (result.factors.includes("trend"))
    return "Investigate the rising trend at the next risk review and convert to an issue if it can no longer be treated as a risk.";
  return "Review at the next risk meeting and convert to an issue if it can no longer be treated as a risk.";
}

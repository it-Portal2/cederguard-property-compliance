import {
  calculateMatrixScore,
  SEVERE_SCORE_THRESHOLD,
} from "../data/riskScoringMatrix";

export { SEVERE_SCORE_THRESHOLD };
export const MAJOR_SCORE_THRESHOLD = 12;

type RiskLike = {
  grossRating?: number;
  residualRating?: number;
  grossL?: number;
  grossI?: number;
  residualL?: number;
  residualI?: number;
  grossImpact?: number;
  grossProb?: number;
  residualImpact?: number;
  residualProb?: number;
  grossALE?: number;
  residualALE?: number;
  [k: string]: any;
};

/**
 * Calibrated gross score. Prefers the pre-computed `grossRating` (backfilled
 * by the store's `normalizeRisk`), falls back to `calculateMatrixScore`,
 * then raw L×I as a last resort.
 */
export function getGrossScore(r: RiskLike): number {
  if (typeof r.grossRating === "number" && r.grossRating > 0)
    return r.grossRating;
  const l = Number(r.grossL || 0);
  const i = Number(r.grossI || 0);
  if (l > 0 && i > 0) return calculateMatrixScore(l, i);
  return 0;
}

/**
 * Calibrated residual score. Same precedence as `getGrossScore`.
 */
export function getResidualScore(r: RiskLike): number {
  if (typeof r.residualRating === "number" && r.residualRating > 0)
    return r.residualRating;
  const l = Number(r.residualL || 0);
  const i = Number(r.residualI || 0);
  if (l > 0 && i > 0) return calculateMatrixScore(l, i);
  return 0;
}

/**
 * Residual Annual Loss Expectancy. Prefers the stored value (set by
 * RiskModal at save time), falls back to `impact × probability`.
 */
export function getResidualALE(r: RiskLike): number {
  if (typeof r.residualALE === "number" && r.residualALE > 0)
    return r.residualALE;
  const impact = r.residualImpact || 0;
  const prob = r.residualProb || 0;
  return impact * (prob > 1 ? prob / 100 : prob);
}

/**
 * Gross Annual Loss Expectancy. Same precedence as `getResidualALE`.
 */
export function getGrossALE(r: RiskLike): number {
  if (typeof r.grossALE === "number" && r.grossALE > 0) return r.grossALE;
  const impact = r.grossImpact || 0;
  const prob = r.grossProb || 0;
  return impact * (prob > 1 ? prob / 100 : prob);
}

// 5×5 mini-heatmap visualisation +.
//
// Renders the calibrated risk matrix from `riskScoringMatrix.ts` with the
// currently-selected (Likelihood, Impact) cell ring-highlighted in indigo.
// Used twice in the RiskModal — once for Gross, once for Residual.
//
// Axes match the client's Excel `Risk Matrix` sheet layout:
//   Rows (top → bottom): I=5 Severe → I=1 Insignificant
//   Columns (left → right): L=1 Rare → L=5 Almost Certain
//
// Reads `SCORE_MATRIX[likelihood-1][impact-1]` so each cell shows the
// calibrated rank-ordered score (1-25), not L × I.

import { clsx } from "clsx";
import {
  SCORE_MATRIX,
  BAND_STYLES,
  bandForScore,
  bandLabelForScore,
  LIKELIHOOD_LABELS,
  IMPACT_LABELS,
} from "../data/riskScoringMatrix";

interface RiskMatrixHeatmapProps {
  /** Selected likelihood (1-5). 0/undefined hides the highlight.*/
  likelihood: number | null | undefined;
  /** Selected impact (1-5). 0/undefined hides the highlight.*/
  impact: number | null | undefined;
  /** "gross" or "residual" — drives the legend label only.*/
  variant?: "gross" | "residual";
  /**
   * Compact mode shrinks the cell + axis font so the heatmap fits in
   * tight modal columns. Defaults to false (regular size).
   */
  compact?: boolean;
}

export function RiskMatrixHeatmap({
  likelihood,
  impact,
  variant = "gross",
  compact = false,
}: RiskMatrixHeatmapProps) {
  const selL = Number(likelihood) || 0;
  const selI = Number(impact) || 0;
  const hasSelection = selL >= 1 && selL <= 5 && selI >= 1 && selI <= 5;
  const selectedScore = hasSelection ? SCORE_MATRIX[selL - 1][selI - 1] : 0;
  const selectedBandLabel = hasSelection ? bandLabelForScore(selectedScore) : "";

  // Build cells in display order: top row I=5, bottom row I=1.
  const rows = [5, 4, 3, 2, 1];
  const cols = [1, 2, 3, 4, 5];

  const cellSize = compact ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]";
  const labelSize = compact ? "text-[8px]" : "text-[9px]";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 sm:p-3">
      {/* Header with current selection meta*/}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {variant === "gross" ? "Gross matrix" : "Residual matrix"}
        </span>
        {hasSelection && (
          <span
            className={clsx(
              "px-2 py-0.5 rounded text-[10px] font-black border whitespace-nowrap",
              BAND_STYLES[bandForScore(selectedScore)].pill,
            )}
            title={`L=${selL} (${LIKELIHOOD_LABELS[selL - 1]}) × I=${selI} (${IMPACT_LABELS[selI - 1]}) = ${selectedScore}`}
          >
            {selectedBandLabel} · {selectedScore}
          </span>
        )}
      </div>

      {/* Grid: I (rows) × L (cols). Left column is the Impact axis label.*/}
      <div className="flex gap-1.5">
        {/* Impact axis label (rotated, on the left)*/}
        <div className="flex flex-col items-center justify-center">
          <span
            role="img"
            aria-label="Impact axis, low to high"
            className={clsx(
              "font-black text-slate-400 uppercase tracking-widest",
              labelSize,
            )}
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Impact →
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Cell grid*/}
          <div className="space-y-1">
            {rows.map((i) => (
              <div key={i} className="flex items-center gap-1">
                <span
                  className={clsx(
                    "w-3 text-right font-black text-slate-400 tabular-nums shrink-0",
                    labelSize,
                  )}
                  title={IMPACT_LABELS[i - 1]}
                >
                  {i}
                </span>
                <div className="flex gap-1">
                  {cols.map((l) => {
                    const score = SCORE_MATRIX[l - 1][i - 1];
                    const band = bandForScore(score);
                    const isSelected = l === selL && i === selI;
                    return (
                      <div
                        key={l}
                        title={`L=${l} (${LIKELIHOOD_LABELS[l - 1]}) × I=${i} (${IMPACT_LABELS[i - 1]}) = ${score} (${bandLabelForScore(score)})`}
                        className={clsx(
                          "inline-flex items-center justify-center font-black rounded transition-all border",
                          cellSize,
                          BAND_STYLES[band].cell,
                          isSelected
                            ? "ring-2 ring-indigo-600 ring-offset-1 shadow-md scale-110 border-indigo-700"
                            : "border-transparent",
                        )}
                      >
                        {score}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Likelihood axis labels under the grid*/}
            <div className="flex items-center gap-1 pt-1">
              <span className="w-3 shrink-0" />
              <div className="flex gap-1">
                {cols.map((l) => (
                  <span
                    key={l}
                    className={clsx(
                      "inline-flex items-center justify-center font-black text-slate-400 tabular-nums",
                      cellSize,
                      labelSize,
                    )}
                    title={LIKELIHOOD_LABELS[l - 1]}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 shrink-0" />
              <span
                className={clsx(
                  "font-black text-slate-400 uppercase tracking-widest text-center w-full",
                  labelSize,
                )}
              >
                Likelihood →
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

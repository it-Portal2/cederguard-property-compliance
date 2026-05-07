import { clsx } from "clsx";
import type { SummaryInsightOption } from "../../types/technicalAssurance";

// One ranked-option card on the Summary tab. The "recommended" option (set
// server-side, deterministic) gets an indigo accent + Recommended pill.
// Compliance status renders as a coloured pill in the top-right.

const COMPLIANCE_PILL: Record<
  SummaryInsightOption["compliance"],
  string
> = {
  compliant: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  borderline: "bg-amber-50 text-amber-800 border border-amber-200",
  "non-compliant": "bg-rose-50 text-rose-700 border border-rose-200",
};

interface RankedOptionCardProps {
  option: SummaryInsightOption;
  index: number;
}

export function RankedOptionCard({ option, index }: RankedOptionCardProps) {
  return (
    <li
      className={clsx(
        "rounded-lg border p-4 transition-colors",
        option.recommended
          ? "border-indigo-200 bg-indigo-50/40"
          : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              #{index + 1}
            </span>
            <h3 className="text-sm font-semibold text-slate-900">
              {option.label}
            </h3>
            {option.recommended && (
              <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-700">{option.summary}</p>
        </div>
        <span
          className={clsx(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
            COMPLIANCE_PILL[option.compliance],
          )}
        >
          {option.compliance.replace("-", " ")}
        </span>
      </div>
      {option.rationale && (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          {option.rationale}
        </p>
      )}
      {(option.costDelta !== 0 || option.programmeDelta !== 0) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
          <span>
            Cost Δ:{" "}
            <strong className="text-slate-700">
              £{option.costDelta.toLocaleString()}
            </strong>
          </span>
          <span>
            Programme Δ:{" "}
            <strong className="text-slate-700">
              {option.programmeDelta} day{option.programmeDelta === 1 ? "" : "s"}
            </strong>
          </span>
        </div>
      )}
    </li>
  );
}

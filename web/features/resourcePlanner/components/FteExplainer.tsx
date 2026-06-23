import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";

/**
 * Collapsible "What do these numbers mean?" panel for the Resource Planner.
 * Presentational only — takes the live overhead/leave percentages so the worked
 * example matches the actual uplift the engine applies (a `0.20` rate-card value
 * is shown as `0.27` at the default +35%). Copy is the client's own FTE wording.
 */
export default function FteExplainer({
  overheadPct,
  leavePct,
  className = "",
}: {
  overheadPct: number;
  leavePct: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const overheadWhole = Math.round((overheadPct || 0) * 100);
  const leaveWhole = Math.round((leavePct || 0) * 100);
  const upliftWhole = overheadWhole + leaveWhole;
  const factor = 1 + (overheadPct || 0) + (leavePct || 0);
  const exampleBase = 0.2;
  const exampleShown = Math.round(exampleBase * factor * 100) / 100;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Info className="h-4 w-4 text-indigo-500" />
          What do these numbers mean?
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-[13px] leading-relaxed text-slate-600">
          <div>
            <p className="font-medium text-slate-700">
              FTE stands for Full Time Equivalent.
            </p>
            <p>
              In a 3-month period, FTE shows how much of one full-time person's
              capacity is needed for that quarter. It's a way of measuring how
              much work is needed compared to one full-time employee.
            </p>
          </div>

          <ul className="space-y-1">
            <li>
              <span className="font-mono tabular-nums text-slate-700">1.0 FTE</span>{" "}
              = 1 person working full-time for 3 months.
            </li>
            <li>
              <span className="font-mono tabular-nums text-slate-700">0.5 FTE</span>{" "}
              = half of one person's time for 3 months.
            </li>
            <li>
              <span className="font-mono tabular-nums text-slate-700">2.0 FTE</span>{" "}
              = 2 people working full-time for 3 months.
            </li>
            <li>
              <span className="font-mono tabular-nums text-slate-700">0.25 FTE</span>{" "}
              = about 25% of one person's time for 3 months.
            </li>
          </ul>

          <p>
            In resource planning, FTE answers:{" "}
            <span className="italic">
              "How many full-time people do we need to deliver this work?"
            </span>{" "}
            So if a scheme requires{" "}
            <span className="font-mono tabular-nums text-slate-700">1.8 FTE</span>,
            the work is roughly equivalent to needing almost two full-time people
            over that 3-month period.
          </p>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-700">
              Why a value can look "odd" (e.g. 0.27)
            </p>
            <p>
              The figures shown <strong>include a +{upliftWhole}% uplift</strong>{" "}
              ({overheadWhole}% programme overhead + {leaveWhole}% annual leave) on
              top of the base rate-card figure. For example, a base{" "}
              <span className="font-mono tabular-nums text-slate-700">
                {exampleBase.toFixed(2)}
              </span>{" "}
              FTE is shown as{" "}
              <span className="font-mono tabular-nums text-slate-700">
                {exampleShown.toFixed(2)}
              </span>{" "}
              ({exampleBase.toFixed(2)} × {factor.toFixed(2)}). You can adjust the
              overhead and leave percentages on the Assumptions page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

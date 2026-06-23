import type { QuarterAxisEntry } from "../../../lib/resourcePlanner/types";
import {
  quarterCalendarLabel,
  currentFyQuarterIndex,
} from "../../../lib/resourcePlanner/quarters";

export interface GridRow {
  key: string;
  label: string;
  sublabel?: string;
  values: number[];
  strong?: boolean;
}

/** Display unit for the cells. Values are always supplied as FTE; £/people are derived. */
export type GridUnit = "fte" | "gbp" | "people";

const fmtFte = (v: number) => (v ? String(Math.round(v * 100) / 100) : "");
const gbp = (v: number) => "£" + Math.round(v).toLocaleString("en-GB");

/** Format one FTE cell value in the chosen unit. `perQ` = workingDays × dayRate. */
function fmtCell(v: number, unit: GridUnit, perQ: number): string {
  if (!v) return "";
  if (unit === "gbp") return gbp(v * perQ);
  if (unit === "people") return String(Math.ceil(v - 1e-9));
  return fmtFte(v);
}

/**
 * A horizontally-scrollable demand matrix: sticky first column (the row label),
 * a two-tier header (financial year over quarters), and one numeric cell per
 * quarter. Rows can be emphasised (totals). Zeros render blank for readability.
 */
export default function DemandGrid({
  axis,
  rows,
  unit = "fte",
  perQ = 0,
}: {
  axis: QuarterAxisEntry[];
  rows: GridRow[];
  unit?: GridUnit;
  perQ?: number;
}) {
  const todayIdx = currentFyQuarterIndex();
  // Tint normalised on FTE (unit-independent) so colour intensity is stable across units.
  const maxV = rows.reduce(
    (m, r) => r.values.reduce((mm, v) => (v > mm ? v : mm), m),
    0,
  );
  // Group consecutive quarters by financial year for the top header tier.
  const fyGroups: { fyLabel: string; span: number }[] = [];
  for (const q of axis) {
    const last = fyGroups[fyGroups.length - 1];
    if (last && last.fyLabel === q.fyLabel) last.span += 1;
    else fyGroups.push({ fyLabel: q.fyLabel, span: 1 });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="border-collapse text-[13px]">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 border-b border-r border-slate-200 min-w-[200px]"
            >
              Role / Complexity
            </th>
            {fyGroups.map((g, i) => (
              <th
                key={`${g.fyLabel}-${i}`}
                colSpan={g.span}
                className="bg-slate-50 px-2 py-1.5 text-center font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 border-b border-l border-slate-200"
              >
                {g.fyLabel}
              </th>
            ))}
          </tr>
          <tr>
            {axis.map((q) => {
              const isToday = q.index === todayIdx;
              return (
                <th
                  key={q.index}
                  title={`${quarterCalendarLabel(q.fy, q.quarterOfFy)} · ${q.label}${isToday ? " · Today" : ""}`}
                  className={`px-2 py-1 text-center font-mono text-[10px] font-medium border-b min-w-[44px] ${
                    isToday
                      ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                      : "bg-slate-50 text-slate-400 border-slate-100"
                  }`}
                >
                  Q{q.quarterOfFy}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={row.strong ? "bg-slate-50/70 font-semibold" : ""}
            >
              <td
                className={`sticky left-0 z-10 px-4 py-1.5 border-r border-slate-200 whitespace-nowrap ${
                  row.strong ? "bg-slate-50" : "bg-white"
                }`}
              >
                <span className="text-slate-800">{row.label}</span>
                {row.sublabel && (
                  <span className="ml-1.5 font-mono uppercase tracking-wide text-[10px] text-slate-400">
                    {row.sublabel}
                  </span>
                )}
              </td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  className="px-2 py-1.5 text-center font-mono tabular-nums text-slate-700 border-l border-slate-50"
                  style={
                    v && maxV
                      ? { backgroundColor: `rgba(79,70,229,${Math.min(0.18, (v / maxV) * 0.18)})` }
                      : undefined
                  }
                >
                  {fmtCell(v, unit, perQ)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

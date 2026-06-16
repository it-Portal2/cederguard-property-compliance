import type { QuarterAxisEntry } from "../../../lib/resourcePlanner/types";

export interface GridRow {
  key: string;
  label: string;
  sublabel?: string;
  values: number[];
  strong?: boolean;
}

const fmtFte = (v: number) => (v ? String(Math.round(v * 100) / 100) : "");

/**
 * A horizontally-scrollable demand matrix: sticky first column (the row label),
 * a two-tier header (financial year over quarters), and one numeric cell per
 * quarter. Rows can be emphasised (totals). Zeros render blank for readability.
 */
export default function DemandGrid({
  axis,
  rows,
}: {
  axis: QuarterAxisEntry[];
  rows: GridRow[];
}) {
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
            {axis.map((q) => (
              <th
                key={q.index}
                className="bg-slate-50 px-2 py-1 text-center font-mono text-[10px] font-medium text-slate-400 border-b border-slate-100 min-w-[44px]"
              >
                Q{q.quarterOfFy}
              </th>
            ))}
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
                    v
                      ? { backgroundColor: `rgba(79,70,229,${Math.min(0.18, v * 0.12)})` }
                      : undefined
                  }
                >
                  {fmtFte(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

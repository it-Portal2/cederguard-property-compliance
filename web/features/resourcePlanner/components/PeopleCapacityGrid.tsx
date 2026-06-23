import { ROLE_LABELS } from "../../../lib/resourcePlanner/constants";
import { currentFyQuarterIndex, quarterCalendarLabel } from "../../../lib/resourcePlanner/quarters";
import type { PersonCapacityRow, QuarterAxisEntry } from "../../../lib/resourcePlanner/types";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Person-level capacity grid — one row per person, quarter columns showing
 * committed FTE tinted by headroom (green = room, red = over-allocated). The
 * person's availability (FTE) is editable inline. Read-only renders plain text.
 */
export default function PeopleCapacityGrid({
  axis,
  people,
  editable,
  onAvailabilityChange,
}: {
  axis: QuarterAxisEntry[];
  people: PersonCapacityRow[];
  editable: boolean;
  onAvailabilityChange: (key: string, v: number) => void;
}) {
  const todayIdx = currentFyQuarterIndex();

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
              className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 border-b border-r border-slate-200 min-w-[220px]"
            >
              Person · availability (FTE)
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
                  title={`${quarterCalendarLabel(q.fy, q.quarterOfFy)} · ${q.label}`}
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
          {people.map((p) => (
            <tr key={p.key}>
              <td className="sticky left-0 z-10 bg-white px-4 py-1.5 border-r border-slate-200 whitespace-nowrap">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-slate-800">{p.name}</div>
                    <div className="font-mono uppercase tracking-wide text-[10px] text-slate-400">
                      {p.roles.map((r) => ROLE_LABELS[r]).join(", ")} · {p.schemeCount} scheme
                      {p.schemeCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={p.availability}
                      onChange={(e) =>
                        onAvailabilityChange(p.key, parseFloat(e.target.value) || 0)
                      }
                      className="w-14 rounded-md border border-slate-200 px-1 py-1 text-center font-mono tabular-nums text-[12px] focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                    />
                  ) : (
                    <span className="font-mono tabular-nums text-[12px] text-slate-500">
                      {r1(p.availability)}
                    </span>
                  )}
                </div>
              </td>
              {axis.map((q, i) => {
                const committed = p.committedByQuarter[i] ?? 0;
                const headroom = p.headroomByQuarter[i] ?? 0;
                const show = committed > 0.001;
                const over = headroom < -0.001;
                return (
                  <td
                    key={q.index}
                    title={
                      show
                        ? `${p.name} · ${quarterCalendarLabel(q.fy, q.quarterOfFy)} — committed ${r1(committed)} / avail ${r1(p.availability)} → headroom ${r1(headroom)}`
                        : undefined
                    }
                    className="px-2 py-1.5 text-center font-mono tabular-nums border-l border-slate-50"
                    style={
                      show
                        ? {
                            backgroundColor: over
                              ? `rgba(220,38,38,${Math.min(0.22, Math.abs(headroom) * 0.18)})`
                              : `rgba(16,185,129,${Math.min(0.18, Math.abs(headroom) * 0.14)})`,
                            color: over ? "#b91c1c" : "#334155",
                          }
                        : undefined
                    }
                  >
                    {show ? r1(committed) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

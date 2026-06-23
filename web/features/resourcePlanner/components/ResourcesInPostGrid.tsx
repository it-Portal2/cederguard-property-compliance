import { ROLES, ROLE_LABELS } from "../../../lib/resourcePlanner/constants";
import { currentFyQuarterIndex, quarterCalendarLabel } from "../../../lib/resourcePlanner/quarters";
import type { QuarterAxisEntry, Role } from "../../../lib/resourcePlanner/types";

type InPostMap = Partial<Record<Role, Record<number, number>>>;

/**
 * Editable "Resources in post" grid — role rows × quarter columns. The single
 * shared input that drives BOTH the Capacity view (supply vs required) and the
 * Actual-under-Demand comparison. Controlled: emits per-cell changes; the parent
 * holds the draft + Save. Read-only (no `editable`) renders plain numbers.
 */
export default function ResourcesInPostGrid({
  axis,
  value,
  editable,
  onChange,
}: {
  axis: QuarterAxisEntry[];
  value: InPostMap;
  editable: boolean;
  onChange: (role: Role, quarterIndex: number, v: number | undefined) => void;
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
              className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 border-b border-r border-slate-200 min-w-[160px]"
            >
              Role / quarter
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
                  className={`px-2 py-1 text-center font-mono text-[10px] font-medium border-b min-w-[56px] ${
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
          {ROLES.map((role) => (
            <tr key={role}>
              <td className="sticky left-0 z-10 bg-white px-4 py-1.5 border-r border-slate-200 whitespace-nowrap text-slate-800">
                {ROLE_LABELS[role]}
              </td>
              {axis.map((q) => {
                const raw = value[role]?.[q.index];
                return (
                  <td
                    key={q.index}
                    className="px-1 py-1 text-center border-l border-slate-50"
                  >
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={raw ?? ""}
                        onChange={(e) => {
                          const s = e.target.value;
                          onChange(role, q.index, s === "" ? undefined : parseFloat(s) || 0);
                        }}
                        className="w-14 rounded-md border border-slate-200 px-1 py-1 text-center font-mono tabular-nums text-[12px] focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                      />
                    ) : (
                      <span className="font-mono tabular-nums text-[12px] text-slate-700">
                        {raw ? Math.round(raw * 100) / 100 : ""}
                      </span>
                    )}
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

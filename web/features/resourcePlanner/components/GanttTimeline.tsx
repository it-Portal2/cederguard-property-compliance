import {
  schemeStageBoundaries,
  stageAtQuarter,
} from "../../../lib/resourcePlanner/compute";
import { STAGE_LABELS, STAGES } from "../../../lib/resourcePlanner/constants";
import type {
  QuarterAxisEntry,
  ResourceScheme,
  Stage,
} from "../../../lib/resourcePlanner/types";

const STAGE_COLORS: Record<Stage, string> = {
  S1: "#94a3b8", // slate — Site & Concept
  S2: "#6366f1", // indigo — Design & Delivery
  S3: "#f59e0b", // amber — Construction
  S4: "#10b981", // emerald — Defects & BAU
};

/** A stage Gantt: one row per scheme, each quarter cell tinted by its active stage. */
export default function GanttTimeline({
  axis,
  schemes,
}: {
  axis: QuarterAxisEntry[];
  schemes: ResourceScheme[];
}) {
  const fyGroups: { fyLabel: string; span: number }[] = [];
  for (const q of axis) {
    const last = fyGroups[fyGroups.length - 1];
    if (last && last.fyLabel === q.fyLabel) last.span += 1;
    else fyGroups.push({ fyLabel: q.fyLabel, span: 1 });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {STAGES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: STAGE_COLORS[s] }}
            />
            {s} · {STAGE_LABELS[s]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 border-b border-r border-slate-200 min-w-[220px]"
              >
                Scheme
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
                  className="bg-slate-50 px-1 py-1 text-center font-mono text-[10px] font-medium text-slate-400 border-b border-slate-100 min-w-[22px]"
                >
                  {q.quarterOfFy}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schemes.map((scheme) => {
              const b = schemeStageBoundaries(scheme);
              return (
                <tr key={scheme.id}>
                  <td className="sticky left-0 z-10 bg-white px-4 py-1 border-r border-slate-200 whitespace-nowrap text-slate-700">
                    {scheme.name}
                  </td>
                  {axis.map((q) => {
                    const stage = stageAtQuarter(q.index, b);
                    return (
                      <td
                        key={q.index}
                        className="p-0 border-l border-slate-50"
                        title={stage ? `${scheme.name} · ${stage}` : undefined}
                      >
                        <div
                          className="h-5"
                          style={{
                            backgroundColor: stage ? STAGE_COLORS[stage] : undefined,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

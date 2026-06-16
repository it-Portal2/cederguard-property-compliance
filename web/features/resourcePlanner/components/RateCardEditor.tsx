import type {
  ComplexityBand,
  RateCard,
  Role,
  Stage,
} from "../../../lib/resourcePlanner/types";
import {
  COMPLEXITY_BANDS,
  ROLES,
  ROLE_LABELS,
  STAGE_LABELS,
  STAGE_RIBA,
  STAGES,
} from "../../../lib/resourcePlanner/constants";

interface Props {
  rateCard: RateCard;
  editable: boolean;
  onChange: (stage: Stage, role: Role, band: ComplexityBand, value: number) => void;
}

/**
 * The editable FTE rate card: one panel per stage, rows = roles, columns =
 * complexity bands. Values are FTE-per-quarter for a role on a scheme of that
 * complexity while in that stage.
 */
export default function RateCardEditor({ rateCard, editable, onChange }: Props) {
  return (
    <div className="space-y-5">
      {STAGES.map((stage) => (
        <div
          key={stage}
          className="rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
              {stage} · {STAGE_RIBA[stage]}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {STAGE_LABELS[stage]}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 px-4 py-2">
                    Role
                  </th>
                  {COMPLEXITY_BANDS.map((b) => (
                    <th
                      key={b}
                      className="text-center font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 px-3 py-2 whitespace-nowrap"
                    >
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {ROLE_LABELS[role]}
                    </td>
                    {COMPLEXITY_BANDS.map((band) => (
                      <td key={band} className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={0}
                          step={0.05}
                          value={rateCard[stage]?.[role]?.[band] ?? 0}
                          disabled={!editable}
                          onChange={(e) =>
                            onChange(stage, role, band, parseFloat(e.target.value) || 0)
                          }
                          className="w-16 rounded-md border border-slate-200 px-2 py-1 text-center font-mono tabular-nums text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:bg-slate-50 disabled:text-slate-400"
                          aria-label={`${role} ${band} ${stage} FTE`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

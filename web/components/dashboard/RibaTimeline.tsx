import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { RIBA_STAGES } from '../../constants/ribaStages';

type Milestone = {
  stage?: string;
  date?: string | number | Date;
  [k: string]: any;
};

type Props = {
  /** Current RIBA stage on the active project/programme (e.g. "S2", "Stage 2", "Stage 2 — Concept Design"). */
  currentRiba?: string;
  /** Optional milestones — used to overlay the earliest-date per stage. */
  milestones?: Milestone[];
  className?: string;
};

function extractStageDigit(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.toString().match(/\d/);
  return m ? Number(m[0]) : null;
}

function formatStageDate(d?: string | number | Date): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function RibaTimeline({ currentRiba, milestones = [], className }: Props) {
  const stages = RIBA_STAGES; // S0..S7

  // Earliest milestone date per stage code (for the per-stage date overlay).
  const dateByStage = useMemo(() => {
    const out: Record<string, Date> = {};
    milestones.forEach((m) => {
      const stage = (m.stage || '').toString().toUpperCase();
      if (!stage) return;
      const d = m.date ? new Date(m.date) : null;
      if (!d || isNaN(d.getTime())) return;
      if (!out[stage] || d < out[stage]) out[stage] = d;
    });
    return out;
  }, [milestones]);

  const currentDigit = extractStageDigit(currentRiba);
  const todayMs = Date.now();

  return (
    <div className={clsx('bg-white rounded-lg border border-slate-200 p-5', className)}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 tracking-tight">
          RIBA Plan of Work
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Stage progression · next gateway derives from the active project's RIBA stage
        </p>
      </div>
      {/* Vertical stage rail — each stage is a row with a left-edge badge + connector */}
      <ol className="relative">
        {stages.map((s, idx) => {
          const stageDigit = idx;
          const stageDate = dateByStage[s.id];
          const stageDateMs = stageDate ? stageDate.getTime() : null;
          let state: 'done' | 'active' | 'pending';
          if (currentDigit != null) {
            if (stageDigit < currentDigit) state = 'done';
            else if (stageDigit === currentDigit) state = 'active';
            else state = 'pending';
          } else if (stageDateMs != null) {
            state = stageDateMs < todayMs ? 'done' : 'pending';
          } else {
            state = idx === 0 ? 'active' : 'pending';
          }
          const isActive = state === 'active';
          const isDone = state === 'done';
          const isLast = idx === stages.length - 1;

          return (
            <li key={s.id} className="relative pl-9 pb-3 last:pb-0">
              {/* Vertical connector line (behind the badge) — drawn from this
                  badge down to the next stage's badge. Coloured emerald if
                  this stage is done, slate otherwise. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    'absolute left-2.75 top-6 bottom-0 w-px',
                    isDone ? 'bg-emerald-300' : 'bg-slate-200',
                  )}
                />
              )}
              {/* Stage badge */}
              <span
                className={clsx(
                  'absolute left-0 top-0 inline-flex w-6 h-6 items-center justify-center rounded-full text-[10px] font-medium font-mono shrink-0',
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : 'bg-white text-slate-500 border border-slate-200',
                )}
              >
                {isDone ? <Check className="w-3 h-3" /> : s.id}
              </span>
              {/* Row content — sits inside an opt-coloured rounded panel when active */}
              <div
                className={clsx(
                  'rounded-md px-3 py-2',
                  isActive
                    ? 'bg-indigo-50 border border-indigo-200'
                    : isDone
                      ? 'bg-emerald-50/40'
                      : 'bg-slate-50/60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={clsx(
                        'text-[12.5px] font-semibold leading-snug',
                        isActive ? 'text-indigo-900' : 'text-slate-900',
                      )}
                    >
                      {s.label.replace(/^S\d\s*-\s*/, '')}
                    </p>
                    <p className="font-mono uppercase tracking-wide text-[10px] text-slate-400 mt-0.5">
                      {s.id}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'font-mono tabular-nums text-[10.5px] shrink-0 pt-0.5',
                      isActive ? 'text-indigo-700 font-medium' : 'text-slate-500',
                    )}
                  >
                    {isActive ? 'Now' : formatStageDate(stageDate)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { clsx } from 'clsx';
import { Check } from 'lucide-react';

type Phase = { id: string; label: string };

type PhaseStepperProps = {
  phases: Phase[];
  current: number;
  completed?: number[];
  onJump?: (idx: number) => void;
};

export function PhaseStepper({
  phases,
  current,
  completed = [],
  onJump,
}: PhaseStepperProps) {
  const total = phases.length;
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  const clickable = typeof onJump === 'function';

  return (
    <div className="w-full">
      {/* Mobile: compact progress pill */}
      <div className="flex md:hidden items-center justify-between gap-3 px-1">
        <p className="text-sm font-medium text-slate-700">
          Step {current + 1} of {total}
        </p>
        <p className="text-xs font-medium text-slate-500 tabular-nums">{pct}%</p>
      </div>
      <div className="mt-2 md:hidden h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Desktop: numbered stepper */}
      <ol className="hidden md:flex items-center gap-2 w-full">
        {phases.map((phase, idx) => {
          const isCurrent = idx === current;
          const isCompleted = completed.includes(idx) || idx < current;
          return (
            <li
              key={phase.id}
              className={clsx(
                'flex items-center gap-2 flex-1 min-w-0',
                idx < total - 1 && 'pr-2',
              )}
            >
              <button
                type="button"
                onClick={clickable ? () => onJump!(idx) : undefined}
                disabled={!clickable}
                className={clsx(
                  'flex items-center gap-2 min-w-0 text-left transition-colors',
                  clickable && 'hover:opacity-80 cursor-pointer',
                  !clickable && 'cursor-default',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={clsx(
                    'flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors',
                    isCurrent && 'bg-indigo-600 text-white ring-4 ring-indigo-100',
                    !isCurrent && isCompleted && 'bg-emerald-100 text-emerald-700',
                    !isCurrent && !isCompleted && 'bg-slate-100 text-slate-500',
                  )}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  className={clsx(
                    'text-sm truncate',
                    isCurrent && 'font-semibold text-slate-900',
                    !isCurrent && isCompleted && 'text-slate-700',
                    !isCurrent && !isCompleted && 'text-slate-500',
                  )}
                >
                  {phase.label}
                </span>
              </button>
              {idx < total - 1 && (
                <span
                  className={clsx(
                    'flex-1 h-px',
                    isCompleted ? 'bg-emerald-200' : 'bg-slate-200',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

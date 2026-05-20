import { clsx } from 'clsx';
import { Check } from 'lucide-react';

type Option = { value: string; label: string; description?: string };

type CheckPillGroupProps = {
  id: string;
  options: Option[] | string[];
  values: string[];
  onChange: (next: string[]) => void;
  variant?: 'pill' | 'card';
  columns?: 1 | 2 | 3;
  disabled?: boolean;
};

const colsClass: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
};

function normalize(opts: CheckPillGroupProps['options']): Option[] {
  return opts.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
}

export function CheckPillGroup({
  id,
  options,
  values,
  onChange,
  variant = 'pill',
  columns = 2,
  disabled,
}: CheckPillGroupProps) {
  const safeValues = Array.isArray(values) ? values : [];
  const opts = normalize(options);

  const toggle = (v: string) => {
    if (disabled) return;
    onChange(
      safeValues.includes(v)
        ? safeValues.filter((x) => x !== v)
        : [...safeValues, v],
    );
  };

  if (variant === 'pill') {
    return (
      <div
        id={id}
        role="group"
        className="flex flex-wrap gap-2"
      >
        {opts.map((opt) => {
          const checked = safeValues.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 h-8 rounded-md border text-sm cursor-pointer transition-colors select-none',
                checked
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggle(opt.value)}
                disabled={disabled}
              />
              {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div id={id} role="group" className={clsx('grid gap-2', colsClass[columns])}>
      {opts.map((opt) => {
        const checked = safeValues.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={clsx(
              'flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors select-none',
              checked
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-slate-300 bg-white hover:border-slate-400',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() => toggle(opt.value)}
              disabled={disabled}
            />
            <span
              className={clsx(
                'mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors',
                checked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white',
              )}
              aria-hidden="true"
            >
              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="flex-1 min-w-0">
              <span
                className={clsx(
                  'block text-sm leading-snug',
                  checked ? 'text-slate-900 font-medium' : 'text-slate-700',
                )}
              >
                {opt.label}
              </span>
              {opt.description && (
                <span className="block mt-0.5 text-xs text-slate-500 leading-snug">
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

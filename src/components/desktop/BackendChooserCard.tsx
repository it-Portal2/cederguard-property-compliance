// Card primitive for the first-run wizard's backend chooser.
// Two states: enabled (clickable, hover ring) or disabled ("Coming soon" badge).

import { type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface BackendChooserCardProps {
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  icon: ReactNode;
  enabled: boolean;
  badge?: { label: string; tone: 'recommended' | 'coming-soon' };
  onChoose?: () => void;
}

export default function BackendChooserCard({
  title,
  subtitle,
  description,
  bullets,
  icon,
  enabled,
  badge,
  onChoose,
}: BackendChooserCardProps) {
  return (
    <div
      className={clsx(
        'group relative flex flex-col rounded-2xl border bg-white p-6 transition-all',
        'dark:bg-slate-900',
        enabled
          ? 'border-slate-200 hover:border-indigo-400 hover:shadow-lg dark:border-white/10 dark:hover:border-indigo-400/60'
          : 'border-slate-200/60 opacity-60 dark:border-white/5'
      )}
    >
      {badge && (
        <span
          className={clsx(
            'absolute -top-2.5 right-5 inline-flex items-center rounded-full px-2.5 py-0.5',
            'font-mono uppercase tracking-wide text-[10px] font-medium',
            badge.tone === 'recommended'
              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/30'
              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-white/10'
          )}
        >
          {badge.label}
        </span>
      )}

      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {icon}
      </div>

      <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
        {subtitle}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {description}
      </p>

      <ul className="mt-4 space-y-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
          >
            <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled={!enabled}
          onClick={enabled ? onChoose : undefined}
          className={clsx(
            'w-full rounded-lg py-2.5 text-sm font-medium transition-colors',
            enabled
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
          )}
          title={!enabled ? 'Available in a future release' : undefined}
        >
          {enabled ? 'Choose' : 'Coming soon'}
        </button>
      </div>
    </div>
  );
}

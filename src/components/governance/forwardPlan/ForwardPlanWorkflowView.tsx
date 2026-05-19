import { Fragment, useMemo, useState } from 'react';
import {
  addMonths,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import type { ForwardPlanItem } from './types';
import { STATUS_STYLES } from './types';
import type { FpBodyOption } from './ForwardPlanItemModal';

type Horizon = '6m' | '12m';

interface Props {
  items: ForwardPlanItem[];
  bodies: FpBodyOption[];
  onOpenItem: (item: ForwardPlanItem) => void;
}

function shortenBodyName(fullName: string | undefined): string {
  if (!fullName) return '';
  const idx = fullName.indexOf(' · ');
  return idx > 0 ? fullName.slice(0, idx) : fullName;
}

const TIER_ORDER = ['Political', 'Corporate', 'Programme', 'Project'] as const;
type Tier = (typeof TIER_ORDER)[number];

const TIER_STYLES: Record<Tier | 'Other', { label: string; cls: string }> = {
  Political: { label: 'Political', cls: 'bg-amber-50 text-amber-800' },
  Corporate: { label: 'Corporate', cls: 'bg-indigo-50 text-indigo-800' },
  Programme: { label: 'Programme', cls: 'bg-emerald-50 text-emerald-800' },
  Project: { label: 'Project', cls: 'bg-slate-100 text-slate-700' },
  Other: { label: 'Other', cls: 'bg-slate-100 text-slate-700' },
};

function tierFor(raw: string | undefined): Tier | 'Other' {
  if (!raw) return 'Other';
  const norm = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if ((TIER_ORDER as readonly string[]).includes(norm)) return norm as Tier;
  return 'Other';
}

// A single cell entry = one FP item with a scheduled gate on the given
// body + month. Day number is shown inline so users can scan "CCRB
// 26 April" etc. without clicking.
interface CellEntry {
  item: ForwardPlanItem;
  day: number;
  date: Date;
}

function buildPivot(
  items: ForwardPlanItem[],
  bodies: FpBodyOption[],
  months: Date[],
): {
  groupedBodies: Record<Tier | 'Other', FpBodyOption[]>;
  cells: Map<string, CellEntry[]>;
} {
  // cells keyed by `${bodyLookupKey}|${yyyy-MM}`
  const cells = new Map<string, CellEntry[]>();
  const bodyLookup = new Set<string>();
  for (const b of bodies) {
    if (b._id) bodyLookup.add(b._id);
    if (b.id) bodyLookup.add(b.id);
  }

  const monthKeys = months.map((m) => format(m, 'yyyy-MM'));

  for (const item of items) {
    for (const [bodyId, gate] of Object.entries(item.boardGates ?? {})) {
      if (!gate?.targetDate || gate.status !== 'scheduled') continue;
      const d = parseISO(gate.targetDate);
      if (Number.isNaN(d.getTime())) continue;
      const mKey = format(d, 'yyyy-MM');
      if (!monthKeys.includes(mKey)) continue; // outside the visible window
      const cellKey = `${bodyId}|${mKey}`;
      const bucket = cells.get(cellKey) ?? [];
      bucket.push({ item, day: d.getDate(), date: d });
      cells.set(cellKey, bucket);
    }
  }

  // Sort each cell by day ascending so the earliest gate of the month is
  // always at the top of the stack.
  for (const bucket of cells.values()) {
    bucket.sort((a, b) => a.day - b.day);
  }

  // Group bodies by tier, alphabetical within tier.
  const groupedBodies: Record<Tier | 'Other', FpBodyOption[]> = {
    Political: [],
    Corporate: [],
    Programme: [],
    Project: [],
    Other: [],
  };
  for (const b of bodies) {
    groupedBodies[tierFor(b.tier)].push(b);
  }
  for (const key of Object.keys(groupedBodies) as Array<Tier | 'Other'>) {
    groupedBodies[key].sort((a, b) =>
      shortenBodyName(a.name).localeCompare(shortenBodyName(b.name)),
    );
  }

  return { groupedBodies, cells };
}

export function ForwardPlanWorkflowView({ items, bodies, onOpenItem }: Props) {
  const [horizon, setHorizon] = useState<Horizon>('6m');
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  const months = useMemo(() => {
    const count = horizon === '6m' ? 6 : 12;
    return eachMonthOfInterval({
      start: cursor,
      end: endOfMonth(addMonths(cursor, count - 1)),
    }).filter((_, i) => i < count);
  }, [horizon, cursor]);

  const { groupedBodies, cells } = useMemo(
    () => buildPivot(items, bodies, months),
    [items, bodies, months],
  );

  const todayKey = format(new Date(), 'yyyy-MM');

  // Tier iteration order: Political → Corporate → Programme → Project → Other
  const orderedTiers: Array<Tier | 'Other'> = [...TIER_ORDER, 'Other'];

  const totalBodies = bodies.length;
  const scheduledCellCount = cells.size;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h3 className="ml-2 text-sm font-semibold text-slate-900">
            {format(months[0], 'MMM yyyy')}
            {months.length > 1 && <> → {format(months[months.length - 1], 'MMM yyyy')}</>}
          </h3>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
          {([
            { key: '6m' as const, label: '6 months' },
            { key: '12m' as const, label: '12 months' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setHorizon(opt.key)}
              className={clsx(
                'rounded-md px-3 py-1.5 transition-colors',
                horizon === opt.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Pivot grid — horizontally scrollable when many months; sticky-left
          body column so users can scan across.  */}
      {totalBodies === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No framework bodies to plot. Add bodies in the Framework editor first.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 w-56 min-w-56 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  Body
                </th>
                {months.map((m) => {
                  const mKey = format(m, 'yyyy-MM');
                  const isCurrent = mKey === todayKey;
                  return (
                    <th
                      key={mKey}
                      className={clsx(
                        'min-w-36 border-b border-r border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider last:border-r-0',
                        isCurrent
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-50 text-slate-500',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{format(m, 'MMM')}</span>
                        <span className="text-slate-400">{format(m, 'yyyy')}</span>
                        {isCurrent && (
                          <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-[9px] text-white">
                            now
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {orderedTiers.map((tier) => {
                const bodiesInTier = groupedBodies[tier];
                if (bodiesInTier.length === 0) return null;
                const tierStyle = TIER_STYLES[tier];
                return (
                  <Fragment key={`tier-${tier}`}>
                    {/* Tier header row */}
                    <tr>
                      <td
                        colSpan={months.length + 1}
                        className={clsx(
                          'border-b border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest',
                          tierStyle.cls,
                        )}
                      >
                        {tierStyle.label}
                      </td>
                    </tr>

                    {/* Bodies in this tier */}
                    {bodiesInTier.map((body) => {
                      const short = shortenBodyName(body.name);
                      return (
                        <tr
                          key={body._id ?? body.id}
                          className="hover:bg-indigo-50/20"
                        >
                          <td
                            className="sticky left-0 z-10 w-56 min-w-56 border-b border-r border-slate-200 bg-white px-3 py-2 align-top"
                          >
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {short || body.name}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {body.name}
                            </p>
                          </td>
                          {months.map((m) => {
                            const mKey = format(m, 'yyyy-MM');
                            // Look up cells under either the composite `_id`
                            // or the short `id` — body-gate keys vary.
                            const entries: CellEntry[] = [];
                            if (body._id) {
                              const bucket = cells.get(`${body._id}|${mKey}`);
                              if (bucket) entries.push(...bucket);
                            }
                            if (body.id && body.id !== body._id) {
                              const bucket = cells.get(`${body.id}|${mKey}`);
                              if (bucket) entries.push(...bucket);
                            }
                            const isCurrent = mKey === todayKey;
                            return (
                              <td
                                key={mKey}
                                className={clsx(
                                  'min-w-36 border-b border-r border-slate-100 p-1 align-top last:border-r-0',
                                  isCurrent && 'bg-indigo-50/40',
                                  !isSameMonth(m, cursor) &&
                                    horizon === '12m' &&
                                    'bg-white',
                                )}
                              >
                                {entries.length === 0 ? (
                                  <span className="block h-full min-h-8" />
                                ) : (
                                  <ul className="space-y-0.5">
                                    {entries.map((ev) => {
                                      const style = STATUS_STYLES[ev.item.status];
                                      return (
                                        <li key={`${ev.item.id}-${ev.date.toISOString()}`}>
                                          <button
                                            type="button"
                                            onClick={() => onOpenItem(ev.item)}
                                            className={clsx(
                                              'flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight',
                                              style.cls,
                                              'hover:brightness-95',
                                              ev.item.softDeleted &&
                                                'opacity-50 line-through',
                                            )}
                                            title={`${short} · ${format(ev.date, 'EEE d MMM yyyy')} · ${ev.item.title}`}
                                          >
                                            <span
                                              className="shrink-0 rounded bg-white/70 px-1 text-[9px] font-bold tabular-nums"
                                            >
                                              {ev.day}
                                            </span>
                                            {ev.item.isKeyDecision && (
                                              <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                                            )}
                                            <span className="truncate">
                                              {ev.item.title}
                                            </span>
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-600">
        <span>
          {totalBodies} {totalBodies === 1 ? 'body' : 'bodies'} ·{' '}
          {scheduledCellCount}{' '}
          {scheduledCellCount === 1 ? 'scheduled gate' : 'scheduled gates'} in view
        </span>
        <span className="ml-auto text-slate-400">
          Rows grouped by tier · current month highlighted
        </span>
      </footer>
    </section>
  );
}

import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import type { ForwardPlanItem } from './types';
import { STATUS_STYLES } from './types';
import type { FpBodyOption } from './ForwardPlanItemModal';

type Horizon = 'month' | 'rolling28';

// One calendar event = one (item, body-gate) pair, OR one fallback item with
// no scheduled gates (rendered on its top-level targetDecisionDate). The
// body context is what makes the calendar useful — PgMs need to see "CCRB
// on 26 April" + "Cabinet on 14 May" as separate dots, not a single dot
// per FP item.
interface CalendarEvent {
  item: ForwardPlanItem;
  date: Date;
  /** Short label shown as a prefix in the pill (e.g. "CCRB"). null = the
   *  fallback top-level decision date for items with no scheduled gates. */
  bodyShortName: string | null;
  /** Stable key for React. */
  key: string;
}

interface Props {
  items: ForwardPlanItem[];
  bodies: FpBodyOption[];
  onOpenItem: (item: ForwardPlanItem) => void;
}

// Body names ship as "CCRB · Corporate Contracts Review Board" — the short
// code before the ` · ` is what fits in a calendar pill. Fallback to the
// full name if no separator is present.
function shortenBodyName(fullName: string | undefined): string {
  if (!fullName) return '';
  const idx = fullName.indexOf(' · ');
  return idx > 0 ? fullName.slice(0, idx) : fullName;
}

// Build calendar events from items + bodies. Rules:
//  - Every boardGates entry with a targetDate AND status === 'scheduled'
//    becomes a calendar event prefixed with its body's short code.
//  - Items with NO scheduled gates fall back to their top-level
//    targetDecisionDate so they don't disappear from the calendar.
//  - Held / deferred / na gates are intentionally skipped — they're audit
//    history, not forward-looking calendar events.
function buildDayIndex(
  items: ForwardPlanItem[],
  bodies: FpBodyOption[],
): Map<string, CalendarEvent[]> {
  // boardGates is keyed by the body's Firestore doc id (`_id`, e.g. the
  // clientId-prefixed composite like `cli_abc_housing-dpb`) — that's what
  // the modal writes with. Index under BOTH `_id` and the short `id` so
  // older or externally-seeded records using the short key still resolve.
  const bodyShortById = new Map<string, string>();
  for (const b of bodies) {
    const short = shortenBodyName(b.name);
    if (b._id) bodyShortById.set(b._id, short);
    if (b.id) bodyShortById.set(b.id, short);
  }

  const index = new Map<string, CalendarEvent[]>();
  const push = (key: string, ev: CalendarEvent) => {
    const bucket = index.get(key) ?? [];
    bucket.push(ev);
    index.set(key, bucket);
  };

  for (const item of items) {
    let scheduledCount = 0;

    for (const [bodyId, gate] of Object.entries(item.boardGates ?? {})) {
      if (!gate?.targetDate || gate.status !== 'scheduled') continue;
      const d = parseISO(gate.targetDate);
      if (Number.isNaN(d.getTime())) continue;
      scheduledCount += 1;
      // Fall back to a generic 'Board' label (never the raw composite ID)
      // when the body isn't in the framework we loaded — e.g. it was
      // deleted, or the framework query failed. Users should never see
      // hashes on the calendar.
      const shortName = bodyShortById.get(bodyId) ?? 'Board';
      push(format(d, 'yyyy-MM-dd'), {
        item,
        date: d,
        bodyShortName: shortName,
        key: `${item.id}::${bodyId}`,
      });
    }

    if (scheduledCount === 0 && item.targetDecisionDate) {
      const d = parseISO(item.targetDecisionDate);
      if (!Number.isNaN(d.getTime())) {
        push(format(d, 'yyyy-MM-dd'), {
          item,
          date: d,
          bodyShortName: null,
          key: `${item.id}::__decision`,
        });
      }
    }
  }

  // Sort each day by status priority (Published > Draft > Decided > …)
  // then by body code so the busy dates have a predictable order.
  const priority: Record<string, number> = {
    Published: 0,
    Draft: 1,
    Decided: 2,
    Deferred: 3,
    Archived: 4,
  };
  for (const bucket of index.values()) {
    bucket.sort((a, b) => {
      const pa = priority[a.item.status] ?? 9;
      const pb = priority[b.item.status] ?? 9;
      if (pa !== pb) return pa - pb;
      const sa = a.bodyShortName ?? '';
      const sb = b.bodyShortName ?? '';
      if (sa !== sb) return sa.localeCompare(sb);
      return (a.item.title ?? '').localeCompare(b.item.title ?? '');
    });
  }
  return index;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ForwardPlanCalendarView({ items, bodies, onOpenItem }: Props) {
  const [horizon, setHorizon] = useState<Horizon>('month');
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const dayIndex = useMemo(() => buildDayIndex(items, bodies), [items, bodies]);

  // Range: either a month grid (padded to full weeks) or a 28-day rolling
  // strip starting from today. Both render inside the same 7-col grid so
  // the visual rhythm stays consistent.
  const { gridStart, gridEnd, rangeLabel } = useMemo(() => {
    if (horizon === 'rolling28') {
      const start = startOfDay(new Date());
      const end = addDays(start, 27);
      return {
        gridStart: startOfWeek(start, { weekStartsOn: 1 }),
        gridEnd: endOfWeek(end, { weekStartsOn: 1 }),
        rangeLabel: `${format(start, 'd MMM')} → ${format(end, 'd MMM yyyy')}`,
      };
    }
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    return {
      gridStart: startOfWeek(monthStart, { weekStartsOn: 1 }),
      gridEnd: endOfWeek(monthEnd, { weekStartsOn: 1 }),
      rangeLabel: format(cursor, 'MMMM yyyy'),
    };
  }, [horizon, cursor]);

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const activeMonth = horizon === 'month' ? cursor : new Date();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const selectedEvents = useMemo(() => {
    if (!selectedDay) return [];
    return dayIndex.get(format(selectedDay, 'yyyy-MM-dd')) ?? [];
  }, [selectedDay, dayIndex]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setHorizon('month');
              setCursor(subMonths(cursor, 1));
              setSelectedDay(null);
            }}
            disabled={horizon !== 'month'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(startOfDay(new Date()));
              setSelectedDay(null);
            }}
            className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setHorizon('month');
              setCursor(addMonths(cursor, 1));
              setSelectedDay(null);
            }}
            disabled={horizon !== 'month'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h3 className="ml-2 text-sm font-semibold text-slate-900">{rangeLabel}</h3>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
          {([
            { key: 'month' as const, label: 'Month' },
            { key: 'rolling28' as const, label: '28-day rolling' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setHorizon(opt.key);
                setSelectedDay(null);
              }}
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

      {/* Weekday header */}
      <div className="font-mono grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = dayIndex.get(key) ?? [];
          const outOfMonth = horizon === 'month' && !isSameMonth(day, activeMonth);
          const today = isToday(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const visible = dayEvents.slice(0, 2);
          const overflow = Math.max(0, dayEvents.length - visible.length);

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={clsx(
                'group min-h-22 border-b border-r border-slate-100 p-1.5 text-left transition-colors last:border-r-0',
                outOfMonth ? 'bg-slate-50/60' : 'bg-white',
                isSelected && 'ring-2 ring-inset ring-indigo-400',
                'hover:bg-indigo-50/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                    today
                      ? 'bg-indigo-600 px-1.5 text-white'
                      : outOfMonth
                        ? 'text-slate-300'
                        : 'text-slate-700',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {key === todayKey && horizon !== 'month' && (
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-indigo-600">
                    today
                  </span>
                )}
              </div>

              <div className="mt-1 space-y-0.5">
                {visible.map((ev) => {
                  const item = ev.item;
                  const style = STATUS_STYLES[item.status];
                  const tooltip = ev.bodyShortName
                    ? `${ev.bodyShortName} · ${item.title}`
                    : `Decision date · ${item.title}`;
                  return (
                    <span
                      key={ev.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenItem(item);
                      }}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpenItem(item);
                        }
                      }}
                      className={clsx(
                        'flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[10px] font-medium leading-tight',
                        style.cls,
                        'cursor-pointer hover:brightness-95',
                        item.softDeleted && 'opacity-50 line-through',
                      )}
                      title={tooltip}
                    >
                      <span className={clsx('h-1 w-1 shrink-0 rounded-full', style.dot)} />
                      {item.isKeyDecision && (
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                      )}
                      {ev.bodyShortName && (
                        <span className="shrink-0 font-bold tabular-nums">
                          {ev.bodyShortName}
                        </span>
                      )}
                      <span className="truncate">{item.title}</span>
                    </span>
                  );
                })}
                {overflow > 0 && (
                  <span className="block text-[10px] font-semibold text-indigo-600">
                    +{overflow} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected-day detail strip. Shows when the user clicks a day with
          events — lists every (item, body) pair on that date and lets the
          user jump into the full FP item modal. Each row's body label
          tells the user *which* board the gate sits on. */}
      {selectedDay && selectedEvents.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              {format(selectedDay, 'EEEE d MMMM yyyy')} ·{' '}
              <span className="text-slate-500">
                {selectedEvents.length}{' '}
                {selectedEvents.length === 1 ? 'gate' : 'gates'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <ul className="space-y-1.5">
            {selectedEvents.map((ev) => {
              const item = ev.item;
              const style = STATUS_STYLES[item.status];
              return (
                <li key={ev.key}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={clsx('h-2 w-2 shrink-0 rounded-full', style.dot)} />
                      <div className="min-w-0">
                        <p
                          className={clsx(
                            'truncate text-xs font-semibold text-slate-900',
                            item.softDeleted && 'line-through text-slate-400',
                          )}
                        >
                          {ev.bodyShortName ? (
                            <>
                              <span className="font-bold text-indigo-700">
                                {ev.bodyShortName}
                              </span>{' '}
                              · {item.title}
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-slate-500">
                                Decision date
                              </span>{' '}
                              · {item.title}
                            </>
                          )}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">{item.scheme}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.isKeyDecision && (
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                          Key
                        </span>
                      )}
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                          style.cls,
                        )}
                      >
                        {style.label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedDay && selectedEvents.length === 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          No items on {format(selectedDay, 'EEEE d MMMM yyyy')}.{' '}
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="font-semibold text-indigo-600 hover:underline"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}

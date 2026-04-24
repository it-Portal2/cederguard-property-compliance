import { useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { ForwardPlanItem } from './types';
import { STATUS_STYLES } from './types';
import type { FpBodyOption } from './ForwardPlanItemModal';

type Zoom = '3m' | '6m' | '12m';

interface Props {
  items: ForwardPlanItem[];
  bodies: FpBodyOption[];
  onOpenItem: (item: ForwardPlanItem) => void;
}

// px-per-day per zoom — balances bar readability with viewport fit.
const PX_PER_DAY: Record<Zoom, number> = {
  '3m': 12,
  '6m': 7,
  '12m': 4,
};

const ROW_HEIGHT = 44;
const LABEL_COL = 220;
const AXIS_HEIGHT = 40;

function shortenBodyName(fullName: string | undefined): string {
  if (!fullName) return '';
  const idx = fullName.indexOf(' · ');
  return idx > 0 ? fullName.slice(0, idx) : fullName;
}

interface GateMarker {
  bodyShort: string;
  date: Date;
}

interface ItemRow {
  item: ForwardPlanItem;
  start: Date | null;
  end: Date | null;
  gates: GateMarker[];
}

function buildRows(
  items: ForwardPlanItem[],
  bodies: FpBodyOption[],
): { dated: ItemRow[]; undated: ItemRow[] } {
  const bodyShortById = new Map<string, string>();
  for (const b of bodies) {
    const short = shortenBodyName(b.name);
    if (b._id) bodyShortById.set(b._id, short);
    if (b.id) bodyShortById.set(b.id, short);
  }

  const dated: ItemRow[] = [];
  const undated: ItemRow[] = [];

  for (const item of items) {
    const gates: GateMarker[] = [];
    for (const [bodyId, gate] of Object.entries(item.boardGates ?? {})) {
      if (!gate?.targetDate || gate.status !== 'scheduled') continue;
      const d = parseISO(gate.targetDate);
      if (Number.isNaN(d.getTime())) continue;
      gates.push({
        bodyShort: bodyShortById.get(bodyId) ?? 'Board',
        date: d,
      });
    }
    // Top-level decision date is appended as a terminal gate if set.
    const decisionDate = item.targetDecisionDate
      ? parseISO(item.targetDecisionDate)
      : null;
    const allDates: Date[] = [...gates.map((g) => g.date)];
    if (decisionDate && !Number.isNaN(decisionDate.getTime())) {
      allDates.push(decisionDate);
    }
    if (allDates.length === 0) {
      undated.push({ item, start: null, end: null, gates: [] });
      continue;
    }
    const sorted = allDates.slice().sort((a, b) => a.getTime() - b.getTime());
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    gates.sort((a, b) => a.date.getTime() - b.date.getTime());
    dated.push({ item, start, end, gates });
  }

  // Dated rows ordered by their end date (earliest first = most urgent up top).
  dated.sort((a, b) => (a.end?.getTime() ?? 0) - (b.end?.getTime() ?? 0));
  undated.sort((a, b) =>
    (a.item.title ?? '').localeCompare(b.item.title ?? ''),
  );
  return { dated, undated };
}

export function ForwardPlanTimelineView({ items, bodies, onOpenItem }: Props) {
  const [zoom, setZoom] = useState<Zoom>('6m');
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  const { viewStart, viewEnd } = useMemo(() => {
    // Bias the window slightly forward since forward plans are forward-
    // looking — past context is useful but future is what's actionable.
    if (zoom === '3m') {
      return {
        viewStart: startOfMonth(subMonths(today, 1)),
        viewEnd: addDays(addMonths(today, 2), -1),
      };
    }
    if (zoom === '12m') {
      return {
        viewStart: startOfMonth(subMonths(today, 3)),
        viewEnd: addDays(addMonths(today, 9), -1),
      };
    }
    // 6m default
    return {
      viewStart: startOfMonth(subMonths(today, 2)),
      viewEnd: addDays(addMonths(today, 4), -1),
    };
  }, [zoom, today]);

  const pxPerDay = PX_PER_DAY[zoom];
  const totalDays = differenceInCalendarDays(viewEnd, viewStart) + 1;
  const totalWidth = totalDays * pxPerDay;

  const xForDate = (d: Date) =>
    Math.max(0, differenceInCalendarDays(d, viewStart) * pxPerDay);

  const months = useMemo(
    () => eachMonthOfInterval({ start: viewStart, end: viewEnd }),
    [viewStart, viewEnd],
  );

  const { dated, undated } = useMemo(
    () => buildRows(items, bodies),
    [items, bodies],
  );

  // Filter dated rows to those that actually overlap the visible window —
  // an item whose only dates are in September shouldn't render an empty row
  // in the March-June view. The footer surfaces the hidden count so users
  // know to zoom out if they're missing something.
  const { visibleDated, hiddenCount } = useMemo(() => {
    const visible: ItemRow[] = [];
    let hidden = 0;
    for (const row of dated) {
      if (!row.start || !row.end) continue;
      const overlaps =
        row.end.getTime() >= viewStart.getTime() &&
        row.start.getTime() <= viewEnd.getTime();
      if (overlaps) visible.push(row);
      else hidden += 1;
    }
    return { visibleDated: visible, hiddenCount: hidden };
  }, [dated, viewStart, viewEnd]);

  const rows = useMemo(
    () => [...visibleDated, ...undated],
    [visibleDated, undated],
  );

  const todayX = xForDate(today);
  const gridHeight = rows.length * ROW_HEIGHT;

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Center the Today marker in the viewport.
    el.scrollTo({ left: Math.max(0, todayX - el.clientWidth / 2), behavior: 'smooth' });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <span className="text-[11px] text-slate-500">
            {format(viewStart, 'd MMM')} → {format(viewEnd, 'd MMM yyyy')}
          </span>
          <button
            type="button"
            onClick={scrollToToday}
            className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Jump to today
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
          {([
            { key: '3m' as const, label: '3 months' },
            { key: '6m' as const, label: '6 months' },
            { key: '12m' as const, label: '12 months' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setZoom(opt.key)}
              className={clsx(
                'rounded-md px-3 py-1.5 transition-colors',
                zoom === opt.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No Forward Plan items to plot.
        </div>
      ) : (
        <div className="flex">
          {/* Label column (sticky-left) */}
          <div
            className="shrink-0 border-r border-slate-200 bg-white"
            style={{ width: LABEL_COL }}
          >
            <div
              className="border-b border-slate-200 bg-slate-50"
              style={{ height: AXIS_HEIGHT }}
            />
            {rows.map(({ item }) => {
              const style = STATUS_STYLES[item.status];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className={clsx(
                    'flex w-full items-center gap-2 border-b border-slate-100 px-3 text-left transition-colors last:border-b-0 hover:bg-indigo-50/30',
                  )}
                  style={{ height: ROW_HEIGHT }}
                  title={item.title}
                >
                  <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        'truncate text-xs font-semibold text-slate-900',
                        item.softDeleted && 'line-through text-slate-400',
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {item.scheme}
                    </p>
                  </div>
                  {item.isKeyDecision && (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Timeline (scrollable) */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, position: 'relative' }}>
              {/* Axis */}
              <div
                className="flex border-b border-slate-200 bg-slate-50"
                style={{ height: AXIS_HEIGHT, width: totalWidth }}
              >
                {months.map((m) => {
                  const x = xForDate(m);
                  const nextX = xForDate(addMonths(m, 1));
                  const w = nextX - x;
                  return (
                    <div
                      key={m.toISOString()}
                      className="flex flex-col justify-center border-r border-slate-200 px-2"
                      style={{ width: w }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {format(m, 'MMM')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {format(m, 'yyyy')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Today marker line — spans full grid height */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div
                  className="pointer-events-none absolute top-0 w-0.5 bg-indigo-500"
                  style={{
                    left: todayX - 1,
                    height: AXIS_HEIGHT + gridHeight,
                    zIndex: 2,
                  }}
                >
                  <span className="absolute left-1 top-0 inline-flex items-center rounded-br bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    Today
                  </span>
                </div>
              )}

              {/* Month gridlines */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={totalWidth}
                height={AXIS_HEIGHT + gridHeight}
                style={{ zIndex: 1 }}
              >
                {months.map((m) => {
                  const x = xForDate(m);
                  return (
                    <line
                      key={`grid-${m.toISOString()}`}
                      x1={x}
                      x2={x}
                      y1={AXIS_HEIGHT}
                      y2={AXIS_HEIGHT + gridHeight}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                  );
                })}
              </svg>

              {/* Rows */}
              {rows.map((row) => {
                const style = STATUS_STYLES[row.item.status];
                const hasDates = row.start && row.end;
                const isMilestone =
                  hasDates && row.start!.getTime() === row.end!.getTime();
                const barX = row.start ? xForDate(row.start) : 0;
                const barEndX = row.end ? xForDate(row.end) : 0;
                const barWidth = barEndX - barX;
                const opacity = row.item.softDeleted ? 0.4 : 1;

                return (
                  <div
                    key={row.item.id}
                    className={clsx(
                      'relative border-b border-slate-100 last:border-b-0 hover:bg-indigo-50/20',
                    )}
                    style={{ height: ROW_HEIGHT, width: totalWidth }}
                  >
                    {!hasDates && (
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] italic text-slate-400"
                        style={{ zIndex: 3 }}
                      >
                        No scheduled dates yet
                      </span>
                    )}

                    {hasDates && isMilestone && (
                      // Single-date items render as a milestone diamond +
                      // label to the right — same convention as Linear /
                      // Asana / Jira Gantts. A 6px coloured stub is
                      // unreadable; a diamond-and-label is instantly
                      // scannable.
                      <button
                        type="button"
                        onClick={() => onOpenItem(row.item)}
                        className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-left transition-opacity hover:opacity-80"
                        style={{ left: barX - 6, opacity, zIndex: 3 }}
                        title={`${row.item.title} · ${format(row.start!, 'd MMM yyyy')}`}
                      >
                        <span
                          className={clsx(
                            'block h-3 w-3 rotate-45 border border-white shadow-sm',
                            style.dot,
                          )}
                        />
                        <span
                          className={clsx(
                            'whitespace-nowrap text-[10px] font-semibold',
                            row.item.softDeleted
                              ? 'text-slate-400 line-through'
                              : 'text-slate-800',
                          )}
                        >
                          {row.item.title}
                        </span>
                      </button>
                    )}

                    {hasDates && !isMilestone && (
                      <>
                        {/* Duration bar */}
                        <button
                          type="button"
                          onClick={() => onOpenItem(row.item)}
                          className={clsx(
                            'absolute top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border px-2 text-[10px] font-medium leading-tight shadow-sm transition-transform hover:scale-[1.01] hover:shadow',
                            style.cls,
                          )}
                          style={{
                            left: barX,
                            width: Math.max(24, barWidth),
                            height: 22,
                            opacity,
                            zIndex: 3,
                          }}
                          title={`${row.item.title} · ${format(row.start!, 'd MMM')} → ${format(row.end!, 'd MMM yyyy')}`}
                        >
                          <span
                            className={clsx('h-1 w-1 shrink-0 rounded-full', style.dot)}
                          />
                          <span className="truncate">
                            {row.item.title}
                          </span>
                        </button>

                        {/* Gate diamonds — one per scheduled boardGate
                            along the bar */}
                        {row.gates.map((g) => {
                          const x = xForDate(g.date);
                          return (
                            <span
                              key={`${row.item.id}-${g.bodyShort}-${g.date.toISOString()}`}
                              className="absolute top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                              style={{ left: x, zIndex: 4 }}
                              title={`${g.bodyShort} · ${format(g.date, 'd MMM yyyy')}`}
                            >
                              <span
                                className="block h-2 w-2 rotate-45 border border-white bg-slate-900"
                                style={{ opacity }}
                              />
                            </span>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <footer className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rotate-45 border border-white bg-indigo-500 shadow-sm" />
          Milestone (single date)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rotate-45 border border-white bg-slate-900" />
          Scheduled board gate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-indigo-500" />
          Today
        </span>
        <span className="ml-auto text-slate-400">
          {visibleDated.length} in view · {undated.length} undated
          {hiddenCount > 0 && (
            <>
              {' · '}
              <span className="text-amber-700">
                {hiddenCount} outside view — switch to 12 months to see all
              </span>
            </>
          )}
        </span>
      </footer>
    </section>
  );
}

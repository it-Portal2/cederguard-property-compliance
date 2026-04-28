import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Meeting } from './types';
import { STATUS_STYLES } from './types';

interface Props {
  items: Meeting[];
  onOpenItem: (m: Meeting) => void;
}

// Status priority for the within-day sort: Scheduled > Held > Cancelled.
const STATUS_PRIORITY: Record<Meeting['status'], number> = {
  Scheduled: 0,
  Held: 1,
  Cancelled: 2,
};

const PILL_LIMIT = 2;

export function MeetingsCalendarView({ items, onOpenItem }: Props) {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const dayIndex = useMemo(() => {
    const idx = new Map<string, Meeting[]>();
    for (const m of items) {
      if (m.softDeleted) continue;
      if (!m.date) continue;
      try {
        const d = parseISO(m.date);
        const key = format(d, 'yyyy-MM-dd');
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key)!.push(m);
      } catch {
        // bad date — skip
      }
    }
    // Sort within each day: Scheduled first, then Held, then Cancelled,
    // then by time, then by title.
    for (const arr of idx.values()) {
      arr.sort((a, b) => {
        const sa = STATUS_PRIORITY[a.status];
        const sb = STATUS_PRIORITY[b.status];
        if (sa !== sb) return sa - sb;
        const ta = (a.timeStart ?? '').localeCompare(b.timeStart ?? '');
        if (ta !== 0) return ta;
        return (a.title ?? '').localeCompare(b.title ?? '');
      });
    }
    return idx;
  }, [items]);

  const goPrev = () => setCursor((c) => subMonths(c, 1));
  const goNext = () => setCursor((c) => addMonths(c, 1));
  const goToday = () => {
    setCursor(new Date());
    setSelectedDay(new Date());
  };

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedDayItems = selectedKey ? dayIndex.get(selectedKey) ?? [] : [];

  return (
    <section className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-bold tracking-tight text-slate-900">
          {format(cursor, 'MMMM yyyy')}
        </p>
        <p className="text-[10px] text-slate-400">
          Click a day for the full list
        </p>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayItems = dayIndex.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            const isSelected =
              selectedDay !== null && isSameDay(day, selectedDay);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={clsx(
                  'flex min-h-24 flex-col items-stretch gap-1 border-r border-b border-slate-100 px-1.5 py-1 text-left transition-colors',
                  inMonth ? 'bg-white' : 'bg-slate-50/40',
                  isSelected && 'ring-2 ring-indigo-400 ring-inset',
                  'hover:bg-slate-50',
                )}
              >
                <span
                  className={clsx(
                    'inline-flex h-5 w-5 items-center justify-center self-end rounded-full text-[10px] font-semibold',
                    today
                      ? 'bg-indigo-600 text-white'
                      : inMonth
                        ? 'text-slate-700'
                        : 'text-slate-300',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  {dayItems.slice(0, PILL_LIMIT).map((m) => {
                    const style = STATUS_STYLES[m.status];
                    return (
                      <span
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenItem(m);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpenItem(m);
                          }
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                          style.cls,
                          'cursor-pointer hover:brightness-95',
                        )}
                        title={`${m.timeStart}–${m.timeEnd} · ${m.title}`}
                      >
                        <span className="font-mono text-[9px] opacity-70">
                          {m.timeStart}
                        </span>
                        <span className="truncate">{m.title}</span>
                      </span>
                    );
                  })}
                  {dayItems.length > PILL_LIMIT && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      +{dayItems.length - PILL_LIMIT} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day strip */}
      {selectedDay && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {format(selectedDay, 'EEEE, d MMMM yyyy')}
          </p>
          {selectedDayItems.length === 0 ? (
            <p className="mt-2 text-xs italic text-slate-400">
              No meetings scheduled.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-50">
              {selectedDayItems.map((m) => {
                const style = STATUS_STYLES[m.status];
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onOpenItem(m)}
                      className="flex w-full items-start gap-3 py-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="mt-0.5 inline-flex w-12 shrink-0 font-mono text-[11px] text-slate-500">
                        {m.timeStart}
                      </span>
                      <span className="flex-1">
                        <p className="text-xs font-semibold text-slate-900">
                          {m.title}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {m.governanceBodyLabel || 'No body assigned'} ·{' '}
                          {m.location || 'No location'}
                        </p>
                      </span>
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          style.cls,
                        )}
                      >
                        <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
                        {style.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

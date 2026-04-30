// Phase 5.5c — Public board calendar (read-only).
//
// Q14 = c. Surfaces the year-ahead schedule to non-PM workspace
// members (Strategic Director, Viewer, etc.) so they can see what's
// coming up without needing access to the FP / Reports surfaces.
// Reuses MeetingsCalendarView + MeetingModal (canEdit=false) from
// Phase 8c.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, List as ListIcon, CalendarRange } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { type Meeting, STATUS_STYLES } from '../../components/governance/meetings/types';
import { MeetingsCalendarView } from '../../components/governance/meetings/MeetingsCalendarView';
import { MeetingModal } from '../../components/governance/meetings/MeetingModal';

type ViewMode = 'list' | 'calendar';

function formatGbDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function GovernanceBoardCalendarPage() {
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('calendar');
  const [opened, setOpened] = useState<Meeting | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.governanceListMeetings();
      const list = ((res.items ?? []) as Meeting[])
        .filter((m) => !m.softDeleted)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
      setItems(list);
    } catch (e: any) {
      console.error('[BoardCalendarPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load board calendar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleItems = useMemo(
    () => (showCancelled ? items : items.filter((m) => m.status !== 'Cancelled')),
    [items, showCancelled],
  );

  const handleOpen = (m: Meeting) => {
    setOpened(m);
    setModalOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto max-w-7xl space-y-6"
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <CalendarDays className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Board calendar
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Read-only view of every scheduled board meeting in your
              workspace. Open a meeting to see attendees, agenda and the
              reports being discussed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show cancelled
          </label>
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                view === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <CalendarRange className="h-3 w-3" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <ListIcon className="h-3 w-3" />
              List
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-900">No board meetings yet</p>
          <p className="mt-1 max-w-md text-xs text-slate-500 mx-auto">
            Your Programme Manager hasn't set up the year-ahead schedule yet.
            Check back later or ask them when meetings will be planned.
          </p>
        </div>
      ) : view === 'calendar' ? (
        <MeetingsCalendarView items={visibleItems} onOpenItem={handleOpen} />
      ) : (
        <PublicMeetingList items={visibleItems} onOpen={handleOpen} />
      )}

      {/* Read-only modal — `canEdit={false}` ensures all tabs are
          view-only. Same Phase 8 chrome the PgM sees. */}
      <MeetingModal
        isOpen={modalOpen}
        meeting={opened}
        existingIds={items.map((i) => i.id)}
        canEdit={false}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          /* read-only — no-op */
        }}
      />
    </motion.div>
  );
}

function PublicMeetingList({
  items,
  onOpen,
}: {
  items: Meeting[];
  onOpen: (m: Meeting) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-600">Body</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Time</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Location</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Reports</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((m) => {
            const style = STATUS_STYLES[m.status];
            const reports = (m.linkedReportIds ?? []).length;
            return (
              <tr
                key={m.id}
                className="cursor-pointer transition-colors hover:bg-slate-50"
                onClick={() => onOpen(m)}
              >
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{m.governanceBodyLabel || '—'}</p>
                </td>
                <td className="px-3 py-2 text-slate-700">{formatGbDate(m.date)}</td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {m.timeStart}–{m.timeEnd}
                </td>
                <td className="px-3 py-2 text-slate-700">{m.location || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{reports}</td>
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      style.cls,
                    )}
                  >
                    <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
                    {style.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Schedule planner view (5th tab on Forward Plan).
//
// PgM-only header actions (Import / Create yearly / Add single / Export);
// PMs see read-only list. Calendar toggle reuses MeetingsCalendarView
// . List view shows meetings sorted by date with quick edit.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  UploadCloud,
  Sparkles as _Sparkles, // banned per, removed below
  CalendarDays,
  List as ListIcon,
  CalendarRange,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import {
  type Meeting,
  STATUS_STYLES,
} from '../meetings/types';
import { MeetingsCalendarView } from '../meetings/MeetingsCalendarView';
import { MeetingModal } from '../meetings/MeetingModal';
import { MeetingsImportModal } from '../meetings/MeetingsImportModal';
import { RecurringMeetingsWizard } from '../meetings/RecurringMeetingsWizard';

// Suppress the unused _Sparkles re-export — banned icon.
void _Sparkles;

type LocalView = 'list' | 'calendar';

interface Props {
  /** Whether the current user can edit (PgM / Admin). PMs see read-only.*/
  canEdit: boolean;
  /** Called whenever meetings change so the parent FP page can refresh
   *  default-view logic ("Schedule default when empty").*/
  onMeetingsChanged?: (count: number) => void;
}

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

function downloadBase64File(b64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${b64}`;
  link.download = filename;
  link.click();
}

export function SchedulePlannerView({ canEdit, onMeetingsChanged }: Props) {
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<LocalView>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Scheduled' | 'Held' | 'Cancelled'>('Scheduled');
  const [opened, setOpened] = useState<Meeting | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.governanceListMeetings();
      const list = ((res.items ?? []) as Meeting[])
        .filter((m) => !m.softDeleted)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
      setItems(list);
      onMeetingsChanged?.(list.length);
    } catch (e: any) {
      console.error('[SchedulePlannerView] load failed', e);
      toast.error(e?.message ?? 'Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [onMeetingsChanged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter((m) => m.status === statusFilter);
  }, [items, statusFilter]);

  const counts = useMemo(() => {
    const totals = { Scheduled: 0, Held: 0, Cancelled: 0 };
    for (const m of items) totals[m.status] += 1;
    return totals;
  }, [items]);

  const handleEdit = (item: Meeting) => {
    setOpened(item);
    setModalOpen(true);
    void (async () => {
      try {
        const res = await api.governanceGetMeeting(item.id);
        if (res?.success && res.item) setOpened(res.item as Meeting);
      } catch (e: any) {
        console.error('[SchedulePlannerView] background refresh failed', e);
      }
    })();
  };

  const handleSaved = (saved: Meeting) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = saved;
      else next.push(saved);
      return next.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    });
    setOpened(saved);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await api.governanceExportMeetingsXlsx();
      if (!res?.success) throw new Error(res?.error ?? 'Export failed.');
      downloadBase64File(res.fileBase64, res.filename ?? 'meetings.xlsx');
      toast.success('Schedule exported');
    } catch (e: any) {
      console.error('[SchedulePlannerView] export failed', e);
      toast.error(e?.message ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Action bar*/}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Filter
          </span>
          {(['Scheduled', 'Held', 'Cancelled', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition-colors',
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {s === 'all' ? 'All' : s}
              {s !== 'all' && (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0 text-[10px]',
                    statusFilter === s ? 'bg-white/25' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle*/}
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
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
          </div>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || items.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Import
              </button>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Create yearly
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpened(null);
                  setModalOpen(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add meeting
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body*/}
      {loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState canEdit={canEdit} onWizard={() => setWizardOpen(true)} onImport={() => setImportOpen(true)} />
      ) : view === 'calendar' ? (
        <MeetingsCalendarView items={filtered} onOpenItem={handleEdit} />
      ) : (
        <ScheduleList items={filtered} onOpen={handleEdit} />
      )}

      <MeetingModal
        isOpen={modalOpen}
        meeting={opened}
        existingIds={items.map((i) => i.id)}
        canEdit={canEdit}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
      <MeetingsImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onCommitted={() => {
          setImportOpen(false);
          void refresh();
        }}
      />
      <RecurringMeetingsWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          setWizardOpen(false);
          void refresh();
        }}
      />
    </motion.div>
  );
}

function EmptyState({
  canEdit,
  onWizard,
  onImport,
}: {
  canEdit: boolean;
  onWizard: () => void;
  onImport: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-900">
        No board meetings scheduled yet
      </p>
      <p className="mt-1 max-w-md text-xs text-slate-500 mx-auto">
        Set up the year ahead so PMs can pick board dates for their reports.
        {!canEdit && ' Ask your Programme Manager to set up the schedule.'}
      </p>
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onWizard}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Create yearly schedule
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Import from Excel
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduleList({
  items,
  onOpen,
}: {
  items: Meeting[];
  onOpen: (m: Meeting) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-8 text-center text-xs italic text-slate-400">
        No meetings match this filter.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-600">Body</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Time</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Location</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Chair</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((m) => {
            const style = STATUS_STYLES[m.status];
            return (
              <tr
                key={m.id}
                className="cursor-pointer transition-colors hover:bg-slate-50"
                onClick={() => onOpen(m)}
              >
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{m.governanceBodyLabel || '—'}</p>
                  <p className="text-[10px] text-slate-500">{m.title}</p>
                </td>
                <td className="px-3 py-2 text-slate-700">{formatGbDate(m.date)}</td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {m.timeStart}–{m.timeEnd}
                </td>
                <td className="px-3 py-2 text-slate-700">{m.location || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{m.chairLabel || '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      style.cls,
                    )}
                  >
                    <StatusIcon status={m.status} />
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

function StatusIcon({ status }: { status: Meeting['status'] }) {
  if (status === 'Held') return <CheckCircle2 className="h-3 w-3" />;
  if (status === 'Cancelled') return <XCircle className="h-3 w-3" />;
  return <AlertTriangle className="h-3 w-3 opacity-0" />;
}

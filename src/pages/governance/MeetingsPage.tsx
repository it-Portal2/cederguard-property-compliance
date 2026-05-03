import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  List,
  CalendarRange,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { isAtLeastClientAdmin, isSuperAdmin } from '../../lib/roles';
import DynamicTable from '../../components/table/DynamicTable';
import type { ColumnDef, FilterDef, RowAction } from '../../components/table/types';
import { StatsCard } from '../../components/common/StatsCard';
import ConfirmDialog from '../../components/table/ConfirmDialog';
import { ReasonDialog } from '../../components/governance/ReasonDialog';
import {
  type Meeting,
  STATUS_STYLES,
} from '../../components/governance/meetings/types';
import { MeetingModal } from '../../components/governance/meetings/MeetingModal';
import { MeetingsCalendarView } from '../../components/governance/meetings/MeetingsCalendarView';
import { RescheduleMeetingDialog } from '../../components/governance/meetings/RescheduleMeetingDialog';
import { useHistoricalView } from '../../hooks/useHistoricalView';
import { MonthPicker } from '../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../components/historicalReporting/HistoricalBanner';

type ViewMode = 'list' | 'calendar';

type ReasonKind = 'softDelete' | 'cancel';

interface PendingReason {
  kind: ReasonKind;
  item: Meeting;
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

export function GovernanceMeetingsPage() {
  const user = useStore((s) => s.user);
  const userIsAdmin =
    isAtLeastClientAdmin(user?.role) || isSuperAdmin(user?.email, user?.role);

  // HRC HR-5 — historical view hook. When the user picks a past month,
  // the page swaps live meetings for the snapshot's frozen state and
  // disables every edit affordance.
  const historicalView = useHistoricalView<{
    kind: 'governanceDoc';
    doc: Meeting;
  }>({ collection: 'meetings' });
  const isHistorical = historicalView.isHistorical;
  const isAdmin = userIsAdmin && !isHistorical;

  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState<Meeting | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [confirmHold, setConfirmHold] = useState<Meeting | null>(null);
  const [reschedTarget, setReschedTarget] = useState<Meeting | null>(null);
  const [reschedBusy, setReschedBusy] = useState(false);
  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.governanceListMeetings();
      const list = ((res.items ?? []) as Meeting[]).sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? ''),
      );
      setItems(list);
    } catch (e: any) {
      console.error('[MeetingsPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load meetings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // HRC HR-5 — effective items source. Switches between live `items`
  // and the historical snapshot's frozen rows based on the MonthPicker.
  const historicalItems = useMemo<Meeting[]>(() => {
    if (!isHistorical) return [];
    return historicalView.entries
      .map((e) => (e?.doc as Meeting | undefined))
      .filter((d): d is Meeting => !!d);
  }, [isHistorical, historicalView.entries]);
  const effectiveItems = isHistorical ? historicalItems : items;

  const counts = useMemo(() => {
    const totals = { Scheduled: 0, Held: 0, Cancelled: 0, softDeleted: 0 };
    for (const it of effectiveItems) {
      if (it.softDeleted) {
        totals.softDeleted += 1;
        continue;
      }
      totals[it.status] += 1;
    }
    return totals;
  }, [effectiveItems]);

  const handleEdit = (item: Meeting) => {
    setOpened(item);
    setModalOpen(true);
    void (async () => {
      try {
        const res = await api.governanceGetMeeting(item.id);
        if (res?.success && res.item) setOpened(res.item as Meeting);
      } catch (e: any) {
        console.error('[MeetingsPage] background refresh failed', e);
      }
    })();
  };

  const handleSaved = (saved: Meeting) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = saved;
      else next.push(saved);
      return next.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    });
    setOpened(saved);
  };

  // Phase 5.5c — Reschedule. Server keeps linked FP items + reports
  // attached and mirrors the new date onto their `targetDecisionDate`.
  const handleReschedule = async (params: {
    newDate: string;
    newTimeStart?: string;
    newTimeEnd?: string;
    reason: string;
  }) => {
    if (!reschedTarget) return;
    setReschedBusy(true);
    try {
      const res = await api.governanceRescheduleMeeting(
        reschedTarget.id,
        params.newDate,
        params.reason,
        params.newTimeStart,
        params.newTimeEnd,
      );
      if (!res?.success) throw new Error(res?.error ?? 'Reschedule failed.');
      setItems((prev) =>
        prev.map((i) => (i.id === reschedTarget.id ? (res.item as Meeting) : i)),
      );
      toast.success('Meeting rescheduled — linked items updated.');
      setReschedTarget(null);
    } catch (e: any) {
      console.error('[MeetingsPage] reschedule failed', e);
      toast.error(e?.message ?? 'Reschedule failed.');
    } finally {
      setReschedBusy(false);
    }
  };

  const handleHold = async (item: Meeting) => {
    if (holdingId) return;
    setHoldingId(item.id);
    try {
      const res = await api.governanceMarkMeetingHeld(item.id);
      if (!res?.success) throw new Error(res?.error ?? 'Action failed.');
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (res.item as Meeting) : i)),
      );
      toast.success('Meeting marked as held');
      setConfirmHold(null);
    } catch (e: any) {
      console.error('[MeetingsPage] hold failed', e);
      toast.error(e?.message ?? 'Action failed.');
    } finally {
      setHoldingId(null);
    }
  };

  const handleRestore = async (item: Meeting) => {
    if (restoringId) return;
    setRestoringId(item.id);
    try {
      const res = await api.governanceRestoreMeeting(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (res.item as Meeting) : i)),
      );
      toast.success('Meeting restored');
    } catch (e: any) {
      console.error('[MeetingsPage] restore failed', e);
      toast.error(e?.message ?? 'Restore failed.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleReasonConfirm = async (reason: string) => {
    if (!pendingReason) return;
    setReasonBusy(true);
    try {
      const fn =
        pendingReason.kind === 'softDelete'
          ? api.governanceSoftDeleteMeeting
          : api.governanceCancelMeeting;
      const res = await fn(pendingReason.item.id, reason);
      if (!res?.success) throw new Error(res?.error ?? 'Action failed.');
      setItems((prev) =>
        prev.map((i) =>
          i.id === pendingReason.item.id ? (res.item as Meeting) : i,
        ),
      );
      toast.success(
        pendingReason.kind === 'softDelete'
          ? 'Meeting soft-deleted'
          : 'Meeting cancelled',
      );
      setPendingReason(null);
    } catch (e: any) {
      console.error('[MeetingsPage] reason action failed', e);
      toast.error(e?.message ?? 'Action failed.');
    } finally {
      setReasonBusy(false);
    }
  };

  const canDeleteRow = (m: Meeting) =>
    isAdmin || (user?.uid && m.ownerUid === user.uid);

  const columns: ColumnDef<Meeting>[] = [
    {
      key: 'title',
      label: 'Meeting',
      sortable: true,
      render: (_v, row) => (
        <div>
          <p
            className={clsx(
              'text-xs font-semibold leading-snug',
              row.softDeleted ? 'text-slate-400 line-through' : 'text-slate-900',
            )}
          >
            {row.title}
          </p>
          <p className="text-[10px] text-slate-500">{row.governanceBodyLabel}</p>
        </div>
      ),
      exportValue: (_v, row) => row.title ?? '',
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (_v, row) => (
        <div>
          <p className="text-xs text-slate-700">{formatGbDate(row.date)}</p>
          <p className="text-[10px] text-slate-500">
            {row.timeStart}–{row.timeEnd}
          </p>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (_v, row) =>
        row.location ? (
          <span className="text-xs text-slate-700">{row.location}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'chairLabel',
      label: 'Chair',
      render: (_v, row) =>
        row.chairLabel ? (
          <span className="text-xs text-slate-700">{row.chairLabel}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'attendees',
      label: 'Attendees',
      render: (_v, row) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          <Users className="h-3 w-3 text-slate-400" />
          {row.attendees?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, row) => {
        const style = STATUS_STYLES[row.status];
        return (
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              style.cls,
            )}
          >
            <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
            {style.label}
          </span>
        );
      },
      exportValue: (_v, row) => row.status,
    },
  ];

  const filters: FilterDef<Meeting>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'Scheduled', label: 'Scheduled' },
          { value: 'Held', label: 'Held' },
          { value: 'Cancelled', label: 'Cancelled' },
        ],
        match: (rowValue, filterValue) => rowValue === filterValue,
      },
      {
        key: 'softDeleted',
        label: '',
        type: 'select',
        options: [
          { value: 'true', label: 'Show soft-deleted' },
          { value: 'false', label: 'Hide soft-deleted' },
        ],
        match: (rowValue, filterValue) => String(!!rowValue) === filterValue,
      },
    ],
    [],
  );

  const rowActions: RowAction<Meeting>[] = [
    {
      key: 'edit',
      label: (r) => (canDeleteRow(r) && !r.softDeleted && r.status === 'Scheduled' ? 'Edit' : 'View'),
      icon: Pencil,
      onClick: handleEdit,
    },
    {
      key: 'mark-held',
      label: 'Mark as held',
      icon: CheckCircle2,
      onClick: (r) => setConfirmHold(r),
      isLoading: (r) => holdingId === r.id,
      isVisible: (r) =>
        !r.softDeleted && r.status === 'Scheduled' && canDeleteRow(r),
    },
    {
      key: 'reschedule',
      label: 'Reschedule',
      icon: CalendarClock,
      onClick: (r) => setReschedTarget(r),
      isVisible: (r) =>
        !r.softDeleted && r.status === 'Scheduled' && canDeleteRow(r),
    },
    {
      key: 'cancel',
      label: 'Cancel meeting',
      icon: XCircle,
      onClick: (r) => setPendingReason({ kind: 'cancel', item: r }),
      isVisible: (r) =>
        !r.softDeleted && r.status === 'Scheduled' && canDeleteRow(r),
    },
    {
      key: 'restore',
      label: 'Restore',
      icon: RotateCcw,
      onClick: handleRestore,
      isLoading: (r) => restoringId === r.id,
      isVisible: (r) => r.softDeleted && canDeleteRow(r),
    },
    {
      key: 'soft-delete',
      label: 'Soft-delete',
      icon: Trash2,
      isDanger: true,
      onClick: (r) => setPendingReason({ kind: 'softDelete', item: r }),
      // Server also blocks soft-delete on Held meetings — UI mirrors it
      // (lesson #75 — UI gate AND server gate must agree).
      isVisible: (r) =>
        !r.softDeleted && r.status !== 'Held' && canDeleteRow(r),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
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
              Meetings
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Schedule, attendees, agendas, minutes, decisions and actions for
              each governance body. Mark held when the meeting takes place.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
          {/* HRC HR-5 — month picker for historical view. */}
          <MonthPicker
            monthEnd={historicalView.monthEnd}
            availableMonths={historicalView.availableMonths}
            onChange={historicalView.setMonthEnd}
            loading={historicalView.loading}
          />
          {/* View mode toggle — same chrome as Forward Plan (lesson #47:
              calendar = read-only surface; CRUD stays in modal). */}
        <div className="inline-flex shrink-0 items-center gap-0.5 self-start rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              viewMode === 'list'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              viewMode === 'calendar'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Calendar
          </button>
        </div>
        </div>
      </header>

      {isHistorical && historicalView.monthEnd && (
        <HistoricalBanner
          monthEnd={historicalView.monthEnd}
          meta={historicalView.meta}
          onExit={() => historicalView.setMonthEnd(null)}
        />
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Scheduled"
          value={counts.Scheduled}
          icon={CalendarDays}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Held"
          value={counts.Held}
          icon={CheckCircle2}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
        <StatsCard
          title="Cancelled"
          value={counts.Cancelled}
          icon={XCircle}
          size="sm"
          iconBgClassName="bg-slate-100"
          iconClassName="text-slate-600"
        />
        <StatsCard
          title="Soft-deleted"
          value={counts.softDeleted}
          icon={Trash2}
          size="sm"
          iconBgClassName="bg-rose-100"
          iconClassName="text-rose-700"
        />
      </section>

      {loading || historicalView.loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : viewMode === 'calendar' ? (
        <MeetingsCalendarView items={effectiveItems} onOpenItem={handleEdit} />
      ) : (
        <DynamicTable<Meeting>
          data={effectiveItems}
          columns={columns}
          rowActions={rowActions}
          filters={filters}
          toolbarActions={
            <button
              type="button"
              onClick={() => {
                setOpened(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New meeting
            </button>
          }
          getRowId={(r) => r.id}
          searchable
          searchPlaceholder="Search by title, body, location or chair…"
          searchFields={
            ['title', 'governanceBodyLabel', 'location', 'chairLabel'] as (keyof Meeting)[]
          }
          headerVariant="light"
          emptyState={{
            icon: ClipboardList,
            title: 'No meetings match',
            description:
              'Click New meeting to schedule one, or clear the filters.',
          }}
        />
      )}

      <MeetingModal
        isOpen={modalOpen}
        meeting={opened}
        existingIds={items.map((i) => i.id)}
        canEdit={
          opened
            ? isAdmin || (user?.uid && opened.ownerUid === user.uid) || !opened
            : true
        }
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={confirmHold !== null}
        title={`Mark "${confirmHold?.title ?? ''}" as held?`}
        message="The meeting record becomes immutable on this endpoint. Minutes, decisions and actions land in the next phase."
        confirmLabel="Mark as held"
        variant="default"
        loading={holdingId !== null}
        onConfirm={() => confirmHold && handleHold(confirmHold)}
        onCancel={() => (holdingId ? null : setConfirmHold(null))}
      />

      <ReasonDialog
        open={pendingReason !== null}
        title={
          pendingReason?.kind === 'cancel'
            ? `Cancel "${pendingReason?.item.title ?? ''}"?`
            : `Soft-delete "${pendingReason?.item.title ?? ''}"?`
        }
        message={
          pendingReason?.kind === 'cancel'
            ? 'The meeting moves to Cancelled. Reason is recorded for the audit trail.'
            : 'Meeting will be hidden from default views but kept in the audit trail.'
        }
        reasonLabel={
          pendingReason?.kind === 'cancel' ? 'Cancellation reason' : 'Reason for soft-delete'
        }
        reasonPlaceholder={
          pendingReason?.kind === 'cancel'
            ? 'e.g. Quorum not reached · deferred to May.'
            : 'e.g. Created in error · superseded by another meeting.'
        }
        confirmLabel={
          pendingReason?.kind === 'cancel' ? 'Cancel meeting' : 'Soft-delete'
        }
        variant={pendingReason?.kind === 'cancel' ? 'warning' : 'danger'}
        loading={reasonBusy}
        onConfirm={handleReasonConfirm}
        onCancel={() => (reasonBusy ? null : setPendingReason(null))}
      />

      <RescheduleMeetingDialog
        open={reschedTarget !== null}
        meetingTitle={reschedTarget?.title ?? ''}
        currentDate={reschedTarget?.date ?? ''}
        currentTimeStart={reschedTarget?.timeStart ?? '10:00'}
        currentTimeEnd={reschedTarget?.timeEnd ?? '12:00'}
        loading={reschedBusy}
        onConfirm={handleReschedule}
        onCancel={() => (reschedBusy ? null : setReschedTarget(null))}
      />
    </motion.div>
  );
}

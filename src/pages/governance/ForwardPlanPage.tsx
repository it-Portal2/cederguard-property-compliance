import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  AlertTriangle,
  FileEdit,
  CheckSquare,
  Trash,
  List as ListIcon,
  BarChart3,
  LayoutGrid,
  Upload,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { isAtLeastClientAdmin, isSuperAdmin } from '../../lib/roles';
import DynamicTable from '../../components/table/DynamicTable';
import type { ColumnDef, FilterDef, RowAction } from '../../components/table/types';
import { StatsCard } from '../../components/common/StatsCard';
import { ReasonDialog } from '../../components/governance/ReasonDialog';
import {
  type ForwardPlanItem,
  type ForwardPlanStatus,
  STATUS_STYLES,
} from '../../components/governance/forwardPlan/types';
import {
  ForwardPlanItemModal,
  type FpBodyOption,
} from '../../components/governance/forwardPlan/ForwardPlanItemModal';
import { ForwardPlanCalendarView } from '../../components/governance/forwardPlan/ForwardPlanCalendarView';
import { ForwardPlanTimelineView } from '../../components/governance/forwardPlan/ForwardPlanTimelineView';
import { ForwardPlanWorkflowView } from '../../components/governance/forwardPlan/ForwardPlanWorkflowView';
import { ForwardPlanImportModal } from '../../components/governance/forwardPlan/ForwardPlanImportModal';
import { SchedulePlannerView } from '../../components/governance/forwardPlan/SchedulePlannerView';

type ViewMode = 'schedule' | 'list' | 'calendar' | 'timeline' | 'workflow';

function formatGBP(value: number): string {
  if (!value || Number.isNaN(value)) return '—';
  return `£${Math.round(value).toLocaleString()}`;
}

interface PendingReason {
  kind: 'softDelete' | 'markDecided';
  item: ForwardPlanItem;
}

export function GovernanceForwardPlanPage() {
  const user = useStore((s) => s.user);
  const canEdit =
    isAtLeastClientAdmin(user?.role) || isSuperAdmin(user?.email, user?.role);

  const [items, setItems] = useState<ForwardPlanItem[]>([]);
  const [bodies, setBodies] = useState<FpBodyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState<ForwardPlanItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [importOpen, setImportOpen] = useState(false);
  // Phase 5.5b — Proposed/Confirm/Decline/Withdraw flow
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [pendingDecline, setPendingDecline] = useState<ForwardPlanItem | null>(null);
  const [declineBusy, setDeclineBusy] = useState(false);
  // Q8 = b — Schedule view becomes default ONLY when workspace has zero
  // meetings yet (onboarding-aware). Single mount-time check; once
  // user picks a different view, we honour their choice.
  const [scheduleEmptyChecked, setScheduleEmptyChecked] = useState(false);

  useEffect(() => {
    if (scheduleEmptyChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.governanceListMeetings();
        if (cancelled) return;
        const live = ((res?.items ?? []) as Array<{ softDeleted?: boolean }>).filter(
          (m) => !m.softDeleted,
        );
        if (live.length === 0) {
          setViewMode('schedule');
        }
      } catch (e: any) {
        // Non-fatal — fall through to List default.
        console.error('[ForwardPlanPage] empty-check failed', e);
      } finally {
        if (!cancelled) setScheduleEmptyChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleEmptyChecked]);

  // Reason-required action queue (soft-delete + mark-as-decided).
  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [itemsRes, fwRes] = await Promise.all([
        api.governanceListForwardPlanItems(),
        api.governanceGetFramework(),
      ]);
      const list = ((itemsRes.items ?? []) as ForwardPlanItem[]).sort((a, b) =>
        (a.title ?? '').localeCompare(b.title ?? ''),
      );
      setItems(list);
      setBodies((fwRes.bodies ?? []) as FpBodyOption[]);
    } catch (e: any) {
      console.error('[ForwardPlanPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load Forward Plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── StatsCard counts ────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const totals = {
      Draft: 0,
      Proposed: 0,
      Published: 0,
      Decided: 0,
      softDeleted: 0,
      needsRerouting: 0,
    };
    for (const it of items) {
      if (it.softDeleted) {
        totals.softDeleted += 1;
        continue;
      }
      if (it.status === 'Draft') totals.Draft += 1;
      else if (it.status === 'Proposed') totals.Proposed += 1;
      else if (it.status === 'Published') totals.Published += 1;
      else if (it.status === 'Decided') totals.Decided += 1;
      if (it.needsRerouting) totals.needsRerouting += 1;
    }
    return totals;
  }, [items]);

  // ── Row handlers ────────────────────────────────────────────────────────
  // List-view Open button: fetches the freshest copy from the server before
  // rendering the modal (audit/concurrency safety).
  const handleOpen = async (item: ForwardPlanItem) => {
    setOpeningId(item.id);
    try {
      const res = await api.governanceGetForwardPlanItem(item.id);
      setOpened(res.item as ForwardPlanItem);
      setModalOpen(true);
    } catch (e: any) {
      console.error('[ForwardPlanPage] open failed', e);
      toast.error(e?.message ?? 'Failed to open item.');
    } finally {
      setOpeningId(null);
    }
  };

  // Calendar pill click: open the modal instantly from the already-loaded
  // item (no server round-trip) so the interaction feels snappy. Staleness
  // risk is tiny — lists refresh on every page mount — and PMs rarely hold
  // the calendar open for minutes before clicking.
  const handleOpenFromCalendar = (item: ForwardPlanItem) => {
    setOpened(item);
    setModalOpen(true);
  };

  const handleSaved = (item: ForwardPlanItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = item;
      else next.push(item);
      return next.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    });
    setOpened(item);
  };

  // Phase 5.5b — PgM confirms a Proposed FP item (auto-publishes + syncs
  // to meeting.linkedReportIds server-side).
  const handleConfirmFp = async (item: ForwardPlanItem) => {
    if (confirmingId) return;
    setConfirmingId(item.id);
    try {
      const res = await api.governanceConfirmFpItem(item.id);
      if (!res?.success) throw new Error(res?.error ?? 'Confirm failed.');
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (res.item as ForwardPlanItem) : i)),
      );
      toast.success('Request confirmed — published to the board.');
    } catch (e: any) {
      console.error('[ForwardPlanPage] confirm failed', e);
      toast.error(e?.message ?? 'Confirm failed.');
    } finally {
      setConfirmingId(null);
    }
  };

  // PM withdraws their own Proposed item before PgM acts (Q21 = c —
  // soft-delete + audit row).
  const handleWithdrawFp = async (item: ForwardPlanItem) => {
    if (withdrawingId) return;
    setWithdrawingId(item.id);
    try {
      const res = await api.governanceWithdrawFpItem(item.id);
      if (!res?.success) throw new Error(res?.error ?? 'Withdraw failed.');
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (res.item as ForwardPlanItem) : i)),
      );
      toast.success('Request withdrawn');
    } catch (e: any) {
      console.error('[ForwardPlanPage] withdraw failed', e);
      toast.error(e?.message ?? 'Withdraw failed.');
    } finally {
      setWithdrawingId(null);
    }
  };

  // PgM declines a Proposed FP item (Q10 = c — flips back to Draft +
  // captures lastDeclineReason). Reason ≥5 chars enforced server-side.
  const handleDeclineConfirm = async (reason: string) => {
    if (!pendingDecline) return;
    setDeclineBusy(true);
    try {
      const res = await api.governanceDeclineFpItem(pendingDecline.id, reason);
      if (!res?.success) throw new Error(res?.error ?? 'Decline failed.');
      setItems((prev) =>
        prev.map((i) =>
          i.id === pendingDecline.id ? (res.item as ForwardPlanItem) : i,
        ),
      );
      toast.success('Request declined — PM notified to pick another meeting.');
      setPendingDecline(null);
    } catch (e: any) {
      console.error('[ForwardPlanPage] decline failed', e);
      toast.error(e?.message ?? 'Decline failed.');
    } finally {
      setDeclineBusy(false);
    }
  };

  const handleRestore = async (item: ForwardPlanItem) => {
    if (restoringId) return; // guard against double-click races
    setRestoringId(item.id);
    try {
      const res = await api.governanceRestoreForwardPlanItem(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (res.item as ForwardPlanItem) : i)),
      );
      toast.success('Item restored');
    } catch (e: any) {
      console.error('[ForwardPlanPage] restore failed', e);
      toast.error(e?.message ?? 'Restore failed.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleReasonConfirm = async (reason: string) => {
    if (!pendingReason) return;
    setReasonBusy(true);
    try {
      if (pendingReason.kind === 'softDelete') {
        const res = await api.governanceSoftDeleteForwardPlanItem(
          pendingReason.item.id,
          reason,
        );
        setItems((prev) =>
          prev.map((i) =>
            i.id === pendingReason.item.id ? (res.item as ForwardPlanItem) : i,
          ),
        );
        toast.success('Item soft-deleted');
      } else {
        const res = await api.governanceMarkForwardPlanItemDecided(
          pendingReason.item.id,
          reason || undefined,
        );
        setItems((prev) =>
          prev.map((i) =>
            i.id === pendingReason.item.id ? (res.item as ForwardPlanItem) : i,
          ),
        );
        toast.success('Item marked as Decided');
      }
      setPendingReason(null);
    } catch (e: any) {
      console.error('[ForwardPlanPage] reason action failed', e);
      toast.error(e?.message ?? 'Action failed.');
    } finally {
      setReasonBusy(false);
    }
  };

  // ── DynamicTable column + filter + action defs ──────────────────────────
  const columns: ColumnDef<ForwardPlanItem>[] = [
    {
      key: 'title',
      label: 'Title',
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
          <p className="text-[10px] text-slate-500">{row.scheme}</p>
        </div>
      ),
      exportValue: (_v, row) => row.title ?? '',
    },
    {
      key: 'flags',
      label: 'Type',
      render: (_v, row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              row.isKeyDecision
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-slate-50 text-slate-600',
            )}
          >
            {row.isKeyDecision ? 'Key' : 'Non-key'}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {row.classification}
          </span>
          {row.isHRB && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              HRB
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (_v, row) => (
        <span className="text-xs tabular-nums text-slate-800">{formatGBP(row.value)}</span>
      ),
      exportValue: (_v, row) => formatGBP(row.value),
    },
    {
      key: 'targetDecisionDate',
      label: 'Target date',
      sortable: true,
      render: (_v, row) =>
        row.targetDecisionDate ? (
          <span className="text-xs text-slate-700">
            {new Date(row.targetDecisionDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'strategicLead',
      label: 'Lead',
      render: (_v, row) =>
        row.strategicLead ? (
          <span className="text-xs text-slate-700">{row.strategicLead}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
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

  // ── DynamicTable filters ───────────────────────────────────────────────
  // All filters use `select` so the chrome is a single dropdown each — no
  // two-button toggles which look noisy when stacked side by side.
  const filters: FilterDef<ForwardPlanItem>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'All',
        options: [
          { value: 'Draft', label: 'Draft' },
          { value: 'Published', label: 'Published' },
          { value: 'Decided', label: 'Decided' },
          { value: 'Deferred', label: 'Deferred' },
          { value: 'Archived', label: 'Archived' },
        ],
        match: (rowValue, filterValue) => rowValue === filterValue,
      },
      {
        key: 'isKeyDecision',
        label: 'Key decision',
        type: 'select',
        placeholder: 'All',
        options: [
          { value: 'true', label: 'Key only' },
          { value: 'false', label: 'Non-key only' },
        ],
        match: (rowValue, filterValue) => String(!!rowValue) === filterValue,
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
      {
        key: 'isHRB',
        label: 'HRB',
        type: 'select',
        placeholder: 'All',
        options: [
          { value: 'true', label: 'HRB only' },
          { value: 'false', label: 'Non-HRB only' },
        ],
        match: (rowValue, filterValue) => String(!!rowValue) === filterValue,
      },
    ],
    [],
  );

  // Pass ALL items (including soft-deleted) to DynamicTable so its built-in
  // `Soft-deleted` boolean filter actually works. Pre-filtering at the data
  // level breaks the filter toggle — the user picks "Show soft-deleted" but
  // the items have already been stripped out upstream. Soft-deleted rows get
  // line-through styling on the title to stay visually distinct in the
  // default view.
  const tableData = items;

  const rowActions: RowAction<ForwardPlanItem>[] = [
    {
      key: 'open',
      label: (r) => (canEdit && !r.softDeleted ? 'Open' : 'View'),
      icon: Pencil,
      onClick: handleOpen,
      isLoading: (r) => openingId === r.id,
    },
    ...(canEdit
      ? ([
          {
            key: 'confirm',
            label: 'Confirm request',
            icon: CheckCircle2,
            onClick: (r: ForwardPlanItem) => handleConfirmFp(r),
            isLoading: (r: ForwardPlanItem) => confirmingId === r.id,
            isVisible: (r: ForwardPlanItem) =>
              r.status === 'Proposed' && !r.softDeleted,
          },
          {
            key: 'decline',
            label: 'Decline request',
            icon: ShieldAlert,
            isDanger: true,
            onClick: (r: ForwardPlanItem) =>
              setPendingDecline(r),
            isVisible: (r: ForwardPlanItem) =>
              r.status === 'Proposed' && !r.softDeleted,
          },
          {
            key: 'mark-decided',
            label: 'Mark as Decided',
            icon: CheckCircle2,
            onClick: (r: ForwardPlanItem) =>
              setPendingReason({ kind: 'markDecided', item: r }),
            isVisible: (r: ForwardPlanItem) =>
              r.status === 'Published' && !r.softDeleted,
          },
          {
            key: 'restore',
            label: 'Restore',
            icon: RotateCcw,
            onClick: handleRestore,
            isLoading: (r: ForwardPlanItem) => restoringId === r.id,
            isVisible: (r: ForwardPlanItem) => r.softDeleted,
          },
          {
            key: 'soft-delete',
            label: 'Soft-delete',
            icon: Trash2,
            isDanger: true,
            onClick: (r: ForwardPlanItem) =>
              setPendingReason({ kind: 'softDelete', item: r }),
            isVisible: (r: ForwardPlanItem) => !r.softDeleted,
          },
        ] as RowAction<ForwardPlanItem>[])
      : []),
    // PM withdraw — only their own Proposed items
    {
      key: 'withdraw',
      label: 'Withdraw request',
      icon: RotateCcw,
      onClick: (r: ForwardPlanItem) => handleWithdrawFp(r),
      isLoading: (r: ForwardPlanItem) => withdrawingId === r.id,
      isVisible: (r: ForwardPlanItem) =>
        r.status === 'Proposed' &&
        !r.softDeleted &&
        !!user?.uid &&
        r.requestedBy === user.uid,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
    >
      {/* Header: heading on the LEFT corner, tabs on the RIGHT corner.
          Flex row justify-between on desktop, stacked col on mobile. */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <CalendarIcon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Forward Plan
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Statutory rolling 28-day key-decision pipeline. Add items, route through
              boards, and mark decisions as they're taken.
            </p>
          </div>
        </div>

        <div className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold md:mt-1">
          {([
            { key: 'schedule' as const, label: 'Schedule', Icon: CalendarIcon },
            { key: 'list' as const, label: 'List', Icon: ListIcon },
            { key: 'calendar' as const, label: 'Calendar', Icon: CalendarIcon },
            { key: 'timeline' as const, label: 'Timeline', Icon: BarChart3 },
            { key: 'workflow' as const, label: 'Workflow', Icon: LayoutGrid },
          ]).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 transition-colors',
                viewMode === key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Draft"
          value={counts.Draft}
          icon={FileEdit}
          size="sm"
          iconBgClassName="bg-amber-100"
          iconClassName="text-amber-700"
        />
        <StatsCard
          title="Published"
          value={counts.Published}
          icon={ShieldAlert}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Decided"
          value={counts.Decided}
          icon={CheckSquare}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
        <StatsCard
          title="Soft-deleted"
          value={counts.softDeleted}
          icon={Trash}
          size="sm"
          iconBgClassName="bg-rose-100"
          iconClassName="text-rose-700"
        />
      </section>

      {/* Phase 5.5c — re-routing banner. Server flags FP items + reports
          when their linked meeting gets cancelled (Q5 = a). PM/PgM picks
          a new meeting on each. Banner sits above the Proposed banner so
          re-routing is the more urgent signal. */}
      {!loading && counts.needsRerouting > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                {counts.needsRerouting} item{counts.needsRerouting === 1 ? '' : 's'} need re-routing
              </p>
              <p className="text-[11px] text-amber-700">
                Their linked meeting was cancelled — open each item and pick a new meeting from the schedule.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5.5b — rose banner above the body when Proposed items exist.
          Click filters list to Proposed; PgM acts on each row via Confirm/Decline. */}
      {!loading && counts.Proposed > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-bold text-rose-900">
                {counts.Proposed} pending request{counts.Proposed === 1 ? '' : 's'} from PMs
              </p>
              <p className="text-[11px] text-rose-700">
                {canEdit
                  ? 'Confirm to publish to the board, or decline with a reason so the PM can pick another meeting.'
                  : 'Your Programme Manager will confirm or decline soon.'}
              </p>
            </div>
          </div>
          {viewMode !== 'list' && (
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="inline-flex h-8 items-center rounded-md bg-rose-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700"
            >
              Open list
            </button>
          )}
        </div>
      )}

      {/* View body — schedule planner / list table / calendar / timeline / workflow */}
      {loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : viewMode === 'schedule' ? (
        <SchedulePlannerView canEdit={canEdit} />
      ) : viewMode === 'list' ? (
        <DynamicTable<ForwardPlanItem>
          data={tableData}
          columns={columns}
          rowActions={rowActions}
          filters={filters}
          toolbarActions={
            canEdit ? (
              <>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpened(null);
                    setModalOpen(true);
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New FP item
                </button>
              </>
            ) : undefined
          }
          getRowId={(r) => r.id}
          searchable
          searchPlaceholder="Search by title, scheme or lead…"
          searchFields={['title', 'scheme', 'strategicLead'] as (keyof ForwardPlanItem)[]}
          headerVariant="light"
          emptyState={{
            icon: CalendarIcon,
            title: 'No Forward Plan items match',
            description: canEdit
              ? 'Add an item using the button above, or clear the filters.'
              : 'Try a different filter or clear the search.',
          }}
        />
      ) : viewMode === 'calendar' ? (
        <ForwardPlanCalendarView
          items={tableData}
          bodies={bodies}
          onOpenItem={handleOpenFromCalendar}
        />
      ) : viewMode === 'timeline' ? (
        <ForwardPlanTimelineView
          items={tableData}
          bodies={bodies}
          onOpenItem={handleOpenFromCalendar}
        />
      ) : (
        <ForwardPlanWorkflowView
          items={tableData}
          bodies={bodies}
          onOpenItem={handleOpenFromCalendar}
        />
      )}

      <ForwardPlanItemModal
        isOpen={modalOpen}
        item={opened}
        frameworkBodies={bodies}
        existingIds={items.map((i) => i.id)}
        canEdit={canEdit}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ForwardPlanImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onCommitted={() => {
          void refresh();
        }}
      />

      {/* Reason-required actions (soft-delete + mark-decided) — uses the
          shared ReasonDialog instead of window.prompt. */}
      <ReasonDialog
        open={pendingReason?.kind === 'softDelete'}
        title={`Soft-delete "${pendingReason?.item.title ?? ''}"?`}
        message="Item will be hidden from default views but kept in the audit trail. Provide a reason for the soft-delete."
        reasonLabel="Reason for soft-delete"
        reasonPlaceholder="e.g. Combined with the Brixton Hill Phase 1 GW2."
        confirmLabel="Soft-delete"
        variant="danger"
        loading={reasonBusy}
        onConfirm={handleReasonConfirm}
        onCancel={() => (reasonBusy ? null : setPendingReason(null))}
      />
      <ReasonDialog
        open={pendingReason?.kind === 'markDecided'}
        title={`Mark "${pendingReason?.item.title ?? ''}" as Decided?`}
        message="Captures the decision outcome and locks the item to the audit log."
        reasonLabel="Decision outcome (optional)"
        reasonPlaceholder="e.g. Approved · award to Galliford Try."
        confirmLabel="Mark as Decided"
        variant="success"
        reasonOptional
        loading={reasonBusy}
        onConfirm={handleReasonConfirm}
        onCancel={() => (reasonBusy ? null : setPendingReason(null))}
      />
      <ReasonDialog
        open={pendingDecline !== null}
        title={`Decline "${pendingDecline?.title ?? ''}"?`}
        message="The item flips back to Draft so the PM can pick another meeting. Reason is captured for the audit trail."
        reasonLabel="Reason for decline"
        reasonPlaceholder="e.g. May 8 DPB already at capacity — please pick June."
        confirmLabel="Decline request"
        variant="danger"
        loading={declineBusy}
        onConfirm={handleDeclineConfirm}
        onCancel={() => (declineBusy ? null : setPendingDecline(null))}
      />
    </motion.div>
  );
}

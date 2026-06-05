import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ShieldAlert,
  AlertTriangle,
  FileEdit,
  CheckCircle2,
  Lock,
  ClipboardCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import PageHeader from '../../../components/PageHeader';
import { useStore } from '../../../store/useStore';
import { isAtLeastClientAdmin, isSuperAdmin } from '../../../lib/roles';
import DynamicTable from '../../../components/table/DynamicTable';
import type { ColumnDef, FilterDef, RowAction } from '../../../components/table/types';
import { StatsCard } from '../../../components/common/StatsCard';
import { ReasonDialog } from '../components/ReasonDialog';
import {
  type Report,
  STATUS_STYLES,
} from '../components/reports/types';
import { ReportModal } from '../components/reports/ReportModal';
import { useHistoricalView } from '../../../hooks/useHistoricalView';
import { MonthPicker } from '../../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../../components/historicalReporting/HistoricalBanner';

interface PendingReason {
  kind: 'softDelete';
  item: Report;
}

export function GovernanceReportsListPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const userIsAdmin =
    isAtLeastClientAdmin(user?.role) || isSuperAdmin(user?.email, user?.role);

  //  historical view hook. When the user picks a past month
  // via the MonthPicker, the page swaps `items` for the snapshot's
  // frozen state and disables every edit affordance.
  const historicalView = useHistoricalView<{
    kind: 'governanceDoc';
    doc: Report;
  }>({ collection: 'reports' });
  const isHistorical = historicalView.isHistorical;
  const isAdmin = userIsAdmin && !isHistorical;

  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState<Report | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.governanceListReports();
      const list = ((res.items ?? []) as Report[]).sort((a, b) =>
        (a.title ?? '').localeCompare(b.title ?? ''),
      );
      setItems(list);
    } catch (e: any) {
      console.error('[ReportsListPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  //  effective items source. Switches between live `items` and
  // the historical snapshot's frozen rows based on the MonthPicker.
  const historicalItems = useMemo<Report[]>(() => {
    if (!isHistorical) return [];
    return historicalView.entries
      .map((e) => (e?.doc as Report | undefined))
      .filter((d): d is Report => !!d);
  }, [isHistorical, historicalView.entries]);
  const effectiveItems = isHistorical ? historicalItems : items;

  // ── StatsCard counts ────────────────────────────────────────────────────
  // Senior-PM stage rolls into the "In review" tile so the dashboard
  // doesn't fragment when only some templates require it.
  const counts = useMemo(() => {
    const totals = {
      Draft: 0,
      InReview: 0,
      Approved: 0,
      Sealed: 0,
      softDeleted: 0,
    };
    for (const it of effectiveItems) {
      if (it.softDeleted) {
        totals.softDeleted += 1;
        continue;
      }
      if (it.status === 'Draft') totals.Draft += 1;
      else if (
        it.status === 'InReview' ||
        it.status === 'PendingSeniorPmReview' ||
        it.status === 'AmendmentsRequested'
      )
        totals.InReview += 1;
      else if (it.status === 'Approved') totals.Approved += 1;
      else if (it.status === 'Sealed') totals.Sealed += 1;
    }
    return totals;
  }, [effectiveItems]);

  // ── Row handlers ────────────────────────────────────────────────────────
  // Two row actions on each report:
  //   • "Edit details" (pencil) → opens the metadata modal (title /
  //     template / FP item / classification / target board date)
  //   • "Open editor" (FileText) → navigates to the authoring page
  //     where Tiptap edits the section content.
  // Open the modal INSTANTLY from the cached row, then refresh in the
  // background so the form gets the freshest data without making the user
  // wait. Same UX as Linear / Notion — perceived performance over strict
  // consistency. No spinner on the pencil — the modal is already open,
  // any further loading state would just be visual noise.
  const handleEditDetails = (item: Report) => {
    setOpened(item);
    setModalOpen(true);
    void (async () => {
      try {
        const res = await api.governanceGetReport(item.id);
        if (res?.success && res.item) setOpened(res.item as Report);
      } catch (e: any) {
        console.error('[ReportsListPage] background refresh failed', e);
        // Don't toast — user is already seeing the cached data.
      }
    })();
  };

  const handleOpenEditor = (item: Report) => {
    navigate(`/governance/reports-list/${item.id}`);
  };

  const handleSaved = (saved: Report) => {
    let wasNew = false;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      wasNew = idx === -1;
      const next = [...prev];
      if (idx >= 0) next[idx] = saved;
      else next.push(saved);
      return next.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    });
    setOpened(saved);
    // Newly-created reports drop the user into the authoring page so they
    // can start drafting immediately. Edits to existing reports keep them
    // on the list (less jarring; modal just confirms the save).
    if (wasNew) {
      setModalOpen(false);
      navigate(`/governance/reports-list/${saved.id}`);
    }
  };

  const handleRestore = async (item: Report) => {
    if (restoringId) return;
    setRestoringId(item.id);
    try {
      const res = await api.governanceRestoreReport(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (res.item as Report) : i)),
      );
      toast.success('Report restored');
    } catch (e: any) {
      console.error('[ReportsListPage] restore failed', e);
      toast.error(e?.message ?? 'Restore failed.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleReasonConfirm = async (reason: string) => {
    if (!pendingReason) return;
    setReasonBusy(true);
    try {
      const res = await api.governanceSoftDeleteReport(
        pendingReason.item.id,
        reason,
      );
      setItems((prev) =>
        prev.map((i) =>
          i.id === pendingReason.item.id ? (res.item as Report) : i,
        ),
      );
      toast.success('Report soft-deleted');
      setPendingReason(null);
    } catch (e: any) {
      console.error('[ReportsListPage] soft-delete failed', e);
      toast.error(e?.message ?? 'Action failed.');
    } finally {
      setReasonBusy(false);
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────
  const columns: ColumnDef<Report>[] = [
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
      key: 'templateLabel',
      label: 'Template',
      render: (_v, row) => {
        if (!row.templateLabel) {
          return <span className="text-xs text-slate-300">—</span>;
        }
        const linked = !!row.templateId;
        return (
          <span
            className={clsx(
              'inline-flex items-start gap-1 text-xs',
              linked ? 'text-slate-700' : 'text-slate-500',
            )}
            title={
              linked
                ? row.templateLabel
                : `Label only — no real template linked. Open Edit details to pick one.`
            }
          >
            {!linked && (
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            )}
            <span>{row.templateLabel}</span>
          </span>
        );
      },
    },
    {
      key: 'flags',
      label: 'Type',
      render: (_v, row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {row.partClassification}
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
      key: 'targetBoardDate',
      label: 'Target board',
      sortable: true,
      render: (_v, row) =>
        row.targetBoardDate ? (
          <span className="text-xs text-slate-700">
            {new Date(row.targetBoardDate).toLocaleDateString('en-GB', {
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
      key: 'ownerLabel',
      label: 'Owner',
      render: (_v, row) =>
        row.ownerLabel ? (
          <span className="text-xs text-slate-700">{row.ownerLabel}</span>
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

  // ── Filters ─────────────────────────────────────────────────────────────
  const filters: FilterDef<Report>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'Draft', label: 'Draft' },
          { value: 'PendingSeniorPmReview', label: 'Senior PM review' },
          { value: 'InReview', label: 'In review' },
          { value: 'AmendmentsRequested', label: 'Amendments' },
          { value: 'Approved', label: 'Approved' },
          { value: 'Sealed', label: 'Sealed' },
          { value: 'Withdrawn', label: 'Withdrawn' },
          { value: 'Abandoned', label: 'Abandoned' },
        ],
        match: (rowValue, filterValue) => rowValue === filterValue,
      },
      {
        key: 'isHRB',
        label: 'HRB',
        type: 'select',
        options: [
          { value: 'true', label: 'HRB only' },
          { value: 'false', label: 'Non-HRB only' },
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
    ],
    [],
  );

  // Pass all items (including soft-deleted) so the filter chrome can toggle
  // visibility — same pattern as Forward Plan.
  const tableData = effectiveItems;

  // ── Row actions ─────────────────────────────────────────────────────────
  const canDeleteRow = (r: Report) =>
    isAdmin || (user?.uid && r.ownerUid === user.uid);

  const rowActions: RowAction<Report>[] = [
    {
      key: 'edit-details',
      label: (r) => (canDeleteRow(r) && !r.softDeleted ? 'Edit details' : 'View details'),
      icon: Pencil,
      onClick: handleEditDetails,
    },
    {
      key: 'open-editor',
      label: 'Open editor',
      icon: FileText,
      onClick: handleOpenEditor,
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
      isVisible: (r) => !r.softDeleted && canDeleteRow(r),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
    >
      {/* Header (same pattern as Forward Plan: heading left, controls right)*/}
      <PageHeader
        title="Reports"
        subtitle="Authored from the templates library, routed through boards, and archived on approval. Open a report to edit its sections in the authoring editor, or use the pencil to update its details."
        breadcrumbs={[{ label: 'Programme Governance' }, { label: 'Reports' }]}
        actions={
          /* month picker for historical view.*/
          <MonthPicker
            monthEnd={historicalView.monthEnd}
            availableMonths={historicalView.availableMonths}
            onChange={historicalView.setMonthEnd}
            loading={historicalView.loading}
          />
        }
      />

      {/* read-only banner appears when MonthPicker is set to a
 past month.*/}
      {isHistorical && historicalView.monthEnd && (
        <HistoricalBanner
          monthEnd={historicalView.monthEnd}
          meta={historicalView.meta}
          onExit={() => historicalView.setMonthEnd(null)}
          defaultCorrectionCollection="reports"
          emptyReason={historicalView.emptyReason}
          activatedYearMonth={historicalView.activatedYearMonth}
          surfaceLabel="reports"
        />
      )}

      {/* Stats row*/}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Draft"
          value={counts.Draft}
          icon={FileEdit}
          size="sm"
          iconBgClassName="bg-amber-100"
          iconClassName="text-amber-700"
        />
        <StatsCard
          title="In review"
          value={counts.InReview}
          icon={ClipboardCheck}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Approved"
          value={counts.Approved}
          icon={CheckCircle2}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
        <StatsCard
          title="Sealed"
          value={counts.Sealed}
          icon={Lock}
          size="sm"
          iconBgClassName="bg-emerald-200"
          iconClassName="text-emerald-800"
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

      {/* List — includes historicalView.loading in the skeleton
 condition so swapping to a past month visibly transitions through
 a loading state instead of the data popping in suddenly.*/}
      {loading || historicalView.loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : (
        <DynamicTable<Report>
          data={tableData}
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
              New report
            </button>
          }
          getRowId={(r) => r.id}
          searchable
          searchPlaceholder="Search by title, scheme or owner…"
          searchFields={['title', 'scheme', 'ownerLabel'] as (keyof Report)[]}
          headerVariant="light"
          emptyState={{
            icon: FileText,
            title: 'No reports match',
            description:
              'Create one with the New report button, or clear the filters.',
          }}
        />
      )}

      <ReportModal
        isOpen={modalOpen}
        report={opened}
        existingIds={items.map((i) => i.id)}
        canEdit={
          opened
            ? isAdmin || (user?.uid && opened.ownerUid === user.uid) || !opened
            : true
        }
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ReasonDialog
        open={pendingReason?.kind === 'softDelete'}
        title={`Soft-delete "${pendingReason?.item.title ?? ''}"?`}
        message="Item will be hidden from default views but kept in the audit trail. Provide a reason for the soft-delete."
        reasonLabel="Reason for soft-delete"
        reasonPlaceholder="e.g. Combined into the new annual review template."
        confirmLabel="Soft-delete"
        variant="danger"
        loading={reasonBusy}
        onConfirm={handleReasonConfirm}
        onCancel={() => (reasonBusy ? null : setPendingReason(null))}
      />
    </motion.div>
  );
}

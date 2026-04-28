import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ClipboardList,
  Plus,
  Pencil,
  FileText,
  AlertTriangle,
  FileEdit,
  ClipboardCheck,
  CheckCircle2,
  Lightbulb,
  CalendarDays,
  MessageSquareWarning,
  ArrowRight,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { isAtLeastClientAdmin, isSuperAdmin } from '../../lib/roles';
import DynamicTable from '../../components/table/DynamicTable';
import type { ColumnDef, FilterDef, RowAction } from '../../components/table/types';
import { StatsCard } from '../../components/common/StatsCard';
import {
  type Report,
  STATUS_STYLES,
} from '../../components/governance/reports/types';
import { ReportModal } from '../../components/governance/reports/ReportModal';
import { ReasonDialog } from '../../components/governance/ReasonDialog';

interface MyAmendment {
  _id: string;
  reportId: string;
  reportTitle: string;
  reportScheme: string;
  reportStatus: string;
  reportTargetBoardDate: string | null;
  sectionId: string | null;
  text: string;
  createdAt: string;
  authorUid: string;
}

function formatGbDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  } catch {
    return '—';
  }
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function GovernanceMyReportsPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const isAdmin =
    isAtLeastClientAdmin(user?.role) || isSuperAdmin(user?.email, user?.role);

  const [items, setItems] = useState<Report[]>([]);
  const [amendments, setAmendments] = useState<MyAmendment[]>([]);
  const [loading, setLoading] = useState(true);

  const [opened, setOpened] = useState<Report | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<{ item: Report } | null>(
    null,
  );
  const [reasonBusy, setReasonBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [reportsRes, amendsRes] = await Promise.all([
        api.governanceListReports(),
        api.governanceListMyOpenAmendments(),
      ]);
      // Keep soft-deleted rows in the table data so the built-in filter
      // can toggle them — pre-stripping breaks the filter chrome
      // (lesson #43). Stats counts exclude them; visual treatment
      // (line-through + slate) flags them in the default view.
      const all = ((reportsRes.items ?? []) as Report[]).filter(
        (r) => r.ownerUid === user?.uid,
      );
      all.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
      setItems(all);
      setAmendments((amendsRes.items ?? []) as MyAmendment[]);
    } catch (e: any) {
      console.error('[MyReportsPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load your reports.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── StatsCards ─────────────────────────────────────────────────────────
  // PM-facing tiles (different from PgM list page):
  //  • Drafting          — status === 'Draft'
  //  • With PgM           — InReview + PendingSeniorPmReview
  //  • Amendments         — AmendmentsRequested
  //  • Approved (qtr)     — Approved/Sealed in current quarter
  const counts = useMemo(() => {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qStartIso = qStart.toISOString();

    let drafting = 0;
    let withPgm = 0;
    let amendmentsCount = 0;
    let approvedThisQuarter = 0;

    for (const it of items) {
      if (it.softDeleted) continue;
      switch (it.status) {
        case 'Draft':
          drafting += 1;
          break;
        case 'InReview':
        case 'PendingSeniorPmReview':
          withPgm += 1;
          break;
        case 'AmendmentsRequested':
          amendmentsCount += 1;
          break;
        case 'Approved':
        case 'Sealed':
          if ((it.approvedAt ?? '') >= qStartIso || (it.sealedAt ?? '') >= qStartIso) {
            approvedThisQuarter += 1;
          }
          break;
        default:
          break;
      }
    }
    return { drafting, withPgm, amendmentsCount, approvedThisQuarter };
  }, [items]);

  // Upcoming deadlines: own reports with targetBoardDate in the next 30 days
  // and not already sealed/abandoned. Sort ascending.
  const upcomingDeadlines = useMemo(() => {
    return items
      .filter((r) => {
        if (r.softDeleted) return false;
        if (!r.targetBoardDate) return false;
        if (r.status === 'Sealed' || r.status === 'Abandoned') return false;
        const d = daysUntil(r.targetBoardDate);
        return d !== null && d <= 30 && d >= -3;
      })
      .sort((a, b) =>
        (a.targetBoardDate ?? '').localeCompare(b.targetBoardDate ?? ''),
      );
  }, [items]);

  // ── Briefing copy (data-driven, no AI yet — Phase 12 wires Gemini) ─────
  const briefing = useMemo(() => {
    const parts: string[] = [];
    const greeting =
      (user?.displayName as string) ||
      (user?.email ? String(user.email).split('@')[0] : 'there');
    parts.push(`Good ${timeOfDay()}, ${greeting}.`);

    if (counts.amendmentsCount > 0) {
      parts.push(
        `You have ${counts.amendmentsCount} report${
          counts.amendmentsCount === 1 ? '' : 's'
        } with amendments to address.`,
      );
    }
    if (counts.drafting > 0) {
      parts.push(
        `${counts.drafting} draft${counts.drafting === 1 ? '' : 's'} in progress.`,
      );
    }
    if (counts.withPgm > 0) {
      parts.push(
        `${counts.withPgm} with the Programme Manager for review.`,
      );
    }
    if (upcomingDeadlines[0]?.targetBoardDate) {
      const d = daysUntil(upcomingDeadlines[0].targetBoardDate);
      if (d !== null) {
        if (d < 0) {
          parts.push(
            `Earliest board date passed ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago.`,
          );
        } else if (d === 0) {
          parts.push(`Earliest board date is today.`);
        } else {
          parts.push(
            `Earliest board date in ${d} day${d === 1 ? '' : 's'} (${formatGbDate(
              upcomingDeadlines[0].targetBoardDate,
              false,
            )}).`,
          );
        }
      }
    }
    if (parts.length === 1) {
      parts.push(`No outstanding work — start a new report when you're ready.`);
    }
    return parts.join(' ');
  }, [counts, upcomingDeadlines, user?.displayName, user?.email]);

  // ── Row handlers (mirror ReportsListPage — instant-open modal) ─────────
  const handleEditDetails = (item: Report) => {
    setOpened(item);
    setModalOpen(true);
    void (async () => {
      try {
        const res = await api.governanceGetReport(item.id);
        if (res?.success && res.item) setOpened(res.item as Report);
      } catch (e: any) {
        console.error('[MyReportsPage] background refresh failed', e);
      }
    })();
  };

  const handleOpenEditor = (item: Report) => {
    navigate(`/governance/reports-list/${item.id}`);
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
      console.error('[MyReportsPage] restore failed', e);
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
      console.error('[MyReportsPage] soft-delete failed', e);
      toast.error(e?.message ?? 'Action failed.');
    } finally {
      setReasonBusy(false);
    }
  };

  const handleSaved = (saved: Report) => {
    let wasNew = false;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      wasNew = idx === -1;
      // PgM-edited reports may have ownerUid changed away from current
      // user; drop those from the list.
      if (saved.ownerUid !== user?.uid) {
        return prev.filter((i) => i.id !== saved.id);
      }
      const next = [...prev];
      if (idx >= 0) next[idx] = saved;
      else next.push(saved);
      return next.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    });
    setOpened(saved);
    if (wasNew) {
      setModalOpen(false);
      navigate(`/governance/reports-list/${saved.id}`);
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────
  const columns: ColumnDef<Report>[] = [
    {
      key: 'title',
      label: 'Report',
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
      render: (_v, row) =>
        row.templateLabel ? (
          <span className="text-xs text-slate-700">{row.templateLabel}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'targetBoardDate',
      label: 'Target board',
      sortable: true,
      render: (_v, row) => {
        if (!row.targetBoardDate)
          return <span className="text-xs text-slate-300">—</span>;
        const d = daysUntil(row.targetBoardDate);
        const overdue = d !== null && d < 0;
        const close = d !== null && d >= 0 && d <= 7;
        return (
          <div>
            <p className="text-xs text-slate-700">
              {formatGbDate(row.targetBoardDate)}
            </p>
            <p
              className={clsx(
                'text-[10px]',
                overdue
                  ? 'font-semibold text-rose-600'
                  : close
                    ? 'font-semibold text-amber-600'
                    : 'text-slate-400',
              )}
            >
              {d === null
                ? ''
                : overdue
                  ? `${Math.abs(d)}d overdue`
                  : d === 0
                    ? 'today'
                    : `in ${d}d`}
            </p>
          </div>
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
  // Per plan §11: 5 stages — All / Drafting / With PgM / Amendments / Approved.
  // Implemented as a single `stage` virtual filter that maps each chip to
  // the underlying status set. Single dropdown keeps the chrome consistent
  // with ReportsListPage + Forward Plan (lesson #43).
  const filters: FilterDef<Report>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Stage',
        type: 'select',
        options: [
          { value: 'Draft', label: 'Drafting' },
          { value: 'WithPgm', label: 'With PgM' },
          { value: 'AmendmentsRequested', label: 'Amendments' },
          { value: 'Approved', label: 'Approved' },
        ],
        match: (rowValue, filterValue) => {
          if (filterValue === 'WithPgm') {
            return rowValue === 'InReview' || rowValue === 'PendingSeniorPmReview';
          }
          if (filterValue === 'Approved') {
            return rowValue === 'Approved' || rowValue === 'Sealed';
          }
          return rowValue === filterValue;
        },
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

  // ── Row actions ─────────────────────────────────────────────────────────
  const rowActions: RowAction<Report>[] = [
    {
      key: 'edit-details',
      label: (r) => (r.softDeleted ? 'View details' : 'Edit details'),
      icon: Pencil,
      onClick: handleEditDetails,
    },
    {
      key: 'open-editor',
      label: 'Open editor',
      icon: FileText,
      onClick: handleOpenEditor,
      isVisible: (r) => !r.softDeleted,
    },
    {
      key: 'restore',
      label: 'Restore',
      icon: RotateCcw,
      onClick: handleRestore,
      isLoading: (r) => restoringId === r.id,
      isVisible: (r) => r.softDeleted,
    },
    {
      key: 'soft-delete',
      label: 'Soft-delete',
      icon: Trash2,
      isDanger: true,
      onClick: (r) => setPendingReason({ item: r }),
      // Only allow soft-delete on Drafts a PM owns. Once submitted to
      // PgM, the workflow takes over (withdraw or abandon are the
      // proper exits — soft-delete would orphan in-flight amendments).
      isVisible: (r) => !r.softDeleted && r.status === 'Draft',
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ClipboardList className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              My reports
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Your personal workspace — drafts, items with the Programme Manager,
              amendments to address, and your upcoming board dates.
            </p>
          </div>
        </div>
      </header>

      {/* Briefing card (PM variant) */}
      <section className="rounded-xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">
              Today's briefing
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">
              {briefing}
            </p>
            <p className="mt-2 text-[10px] italic text-slate-400">
              Counts only — AI summaries land with the chase engine.
            </p>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Drafting"
          value={counts.drafting}
          icon={FileEdit}
          size="sm"
          iconBgClassName="bg-amber-100"
          iconClassName="text-amber-700"
        />
        <StatsCard
          title="With PgM"
          value={counts.withPgm}
          icon={ClipboardCheck}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Amendments"
          value={counts.amendmentsCount}
          icon={MessageSquareWarning}
          size="sm"
          iconBgClassName="bg-rose-100"
          iconClassName="text-rose-700"
        />
        <StatsCard
          title="Approved this quarter"
          value={counts.approvedThisQuarter}
          icon={CheckCircle2}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
      </section>

      {/* Two-column: table on left, side panels on right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : (
            <DynamicTable<Report>
              data={items}
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
              searchPlaceholder="Search by title or scheme…"
              searchFields={['title', 'scheme'] as (keyof Report)[]}
              headerVariant="light"
              emptyState={{
                icon: ClipboardList,
                title: 'No reports yet',
                description:
                  'Click New report to start drafting a Gateway, Key Milestone or Cabinet paper.',
              }}
            />
          )}
        </div>

        {/* Side panels */}
        <aside className="space-y-4 lg:col-span-1">
          <DeadlinesPanel
            items={upcomingDeadlines}
            onOpen={handleOpenEditor}
            loading={loading}
          />
          <FeedbackPanel
            amendments={amendments}
            onOpenReport={(reportId) =>
              navigate(`/governance/reports-list/${reportId}`)
            }
            loading={loading}
          />
        </aside>
      </div>

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
        open={pendingReason !== null}
        title={`Soft-delete "${pendingReason?.item.title ?? ''}"?`}
        message="This draft will be hidden from your default view. It can be restored later from the Show soft-deleted filter."
        reasonLabel="Reason for soft-delete"
        reasonPlaceholder="e.g. Created in error · superseded by another draft."
        confirmLabel="Soft-delete"
        variant="danger"
        loading={reasonBusy}
        onConfirm={handleReasonConfirm}
        onCancel={() => (reasonBusy ? null : setPendingReason(null))}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Side-panel sub-components
// ─────────────────────────────────────────────────────────────────────────

function DeadlinesPanel({
  items,
  onOpen,
  loading,
}: {
  items: Report[];
  onOpen: (r: Report) => void;
  loading: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
          <CalendarDays className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Upcoming deadlines
        </p>
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {items.length}
        </span>
      </header>
      <div className="divide-y divide-slate-50">
        {loading && items.length === 0 ? (
          <div className="p-4">
            <div className="h-10 animate-pulse rounded bg-slate-100" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs italic text-slate-400">
            No board dates in the next 30 days.
          </p>
        ) : (
          items.map((r) => {
            const d = daysUntil(r.targetBoardDate);
            const overdue = d !== null && d < 0;
            const close = d !== null && d >= 0 && d <= 7;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-900">{r.title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {formatGbDate(r.targetBoardDate)}
                  </p>
                </div>
                <span
                  className={clsx(
                    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    overdue
                      ? 'bg-rose-100 text-rose-700'
                      : close
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {d === null
                    ? '—'
                    : overdue
                      ? `${Math.abs(d)}d over`
                      : d === 0
                        ? 'today'
                        : `${d}d`}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function FeedbackPanel({
  amendments,
  onOpenReport,
  loading,
}: {
  amendments: MyAmendment[];
  onOpenReport: (reportId: string) => void;
  loading: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
          <MessageSquareWarning className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Feedback from PgM
        </p>
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {amendments.length}
        </span>
      </header>
      <div className="divide-y divide-slate-50">
        {loading && amendments.length === 0 ? (
          <div className="p-4">
            <div className="h-12 animate-pulse rounded bg-slate-100" />
          </div>
        ) : amendments.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs italic text-slate-400">
            No outstanding amendments. Nice work.
          </p>
        ) : (
          amendments.map((a) => (
            <button
              key={a._id}
              type="button"
              onClick={() => onOpenReport(a.reportId)}
              className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  {a.reportTitle}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                  {a.text}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatGbDate(a.createdAt)}
                </p>
              </div>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-indigo-500" />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

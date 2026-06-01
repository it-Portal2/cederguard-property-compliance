// Archive & Audit.
//
// Aggregates Sealed reports + Held meetings + Published project docs
// across the workspace. Read-only surface — every state change has
// already happened upstream. Click a row → audit trail drawer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ScrollText,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  FolderClosed,
  Download,
  Activity,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import DynamicTable from '../../components/table/DynamicTable';
import type { ColumnDef, FilterDef, RowAction } from '../../components/table/types';
import { StatsCard } from '../../components/common/StatsCard';
import {
  type ArchiveItem,
  type ArchiveSummary,
  KIND_STYLES,
} from '../../components/governance/archive/types';
import { AuditTrailDrawer } from '../../components/governance/archive/AuditTrailDrawer';
import { useHistoricalView } from '../../hooks/useHistoricalView';
import { MonthPicker } from '../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../components/historicalReporting/HistoricalBanner';
import { HistoricalContentSkeleton } from '../../components/historicalReporting/HistoricalContentSkeleton';

const EMPTY_SUMMARY: ArchiveSummary = {
  total: 0,
  sealedReports: 0,
  heldMeetings: 0,
  publishedDocs: 0,
  hrbCount: 0,
};

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

export function GovernanceArchivePage() {
  const navigate = useNavigate();

  //  historical view hook is wired even though Archive is
  // an aggregator: the server endpoint accepts `asOfMonth` and
  // re-runs the query against snapshot collections. We don't read
  // entries directly here — we only need the picker state +
  // empty/loading signals. Use a lightweight collection (`reports`)
  // as the source for available-month population.
  const historicalView = useHistoricalView<any>({ collection: 'reports' });
  const isHistorical = historicalView.isHistorical;
  const asOfMonth = historicalView.monthEnd;

  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [summary, setSummary] = useState<ArchiveSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [trailItem, setTrailItem] = useState<ArchiveItem | null>(null);
  const [exporting, setExporting] = useState(false);

  // cross-surface navigation. Click an archive row → open
  // the entity in its native surface so PgMs / FOI readers can drill
  // straight to the source instead of bouncing back to the lists.
  const navigateToEntity = useCallback(
    (row: ArchiveItem) => {
      switch (row.kind) {
        case 'report':
          navigate(`/governance/reports-list/${row.id}`);
          return;
        case 'meeting':
          // Meetings tab opens the row via filter on URL hash; a deep
          // link here lands on the list with the row pre-selected.
          navigate(`/governance/meetings#${row.id}`);
          return;
        case 'projectDoc':
          navigate('/governance/project-docs');
          return;
      }
    },
    [navigate],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.governanceListArchive(
        asOfMonth ? { asOfMonth } : {},
      );
      if (res?.success) {
        setItems((res.items ?? []) as ArchiveItem[]);
        setSummary((res.summary ?? EMPTY_SUMMARY) as ArchiveSummary);
      } else {
        toast.error(res?.error ?? 'Failed to load archive.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load archive.');
    } finally {
      setLoading(false);
    }
  }, [asOfMonth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await api.governanceExportArchiveFoi();
      if (!res?.success) throw new Error(res?.error ?? 'Export failed.');
      const href = `data:${res.mimeType ?? 'text/csv'};base64,${res.fileBase64}`;
      const a = document.createElement('a');
      a.href = href;
      a.download = res.filename ?? 'archive-foi-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Exported ${res.rowCount ?? 0} rows.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<ArchiveItem>[] = [
    {
      key: 'reference',
      label: 'Reference',
      sortable: true,
      render: (_v, row) => (
        <div>
          <p className="font-mono text-[10px] text-slate-500">
            {row.reference}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-slate-900">
            {row.title}
          </p>
          {row.subtitle && (
            <p className="line-clamp-1 text-[10px] text-slate-500">
              {row.subtitle}
            </p>
          )}
        </div>
      ),
      exportValue: (_v, row) => row.title ?? '',
    },
    {
      key: 'kind',
      label: 'Type',
      sortable: true,
      render: (_v, row) => {
        const style = KIND_STYLES[row.kind];
        return (
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              style.pill,
            )}
          >
            <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
            {style.label}
          </span>
        );
      },
      exportValue: (_v, row) => row.kind,
    },
    {
      key: 'category',
      label: 'Category',
      render: (_v, row) =>
        row.category ? (
          <span className="text-xs text-slate-700">{row.category}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'decisionDate',
      label: 'Decision date',
      sortable: true,
      render: (_v, row) => (
        <span className="text-xs text-slate-700">
          {formatGbDate(row.decisionDate)}
        </span>
      ),
    },
    {
      key: 'isHRB',
      label: 'HRB',
      render: (_v, row) =>
        row.isHRB ? (
          <span
            title="Higher-Risk Building (Building Safety Act)"
            className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
          >
            <ShieldCheck className="h-3 w-3" /> HRB
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'goldenThreadHash',
      label: 'Golden Thread',
      render: (_v, row) =>
        row.goldenThreadHash ? (
          <span
            title={row.goldenThreadHash}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700"
          >
            <ShieldCheck className="h-3 w-3" />
            {row.goldenThreadHash.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
  ];

  const filters: FilterDef<ArchiveItem>[] = useMemo(
    () => [
      {
        key: 'kind',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'report', label: 'Sealed reports' },
          { value: 'meeting', label: 'Held meetings' },
          { value: 'projectDoc', label: 'Published docs' },
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
    ],
    [],
  );

  const rowActions: RowAction<ArchiveItem>[] = [
    {
      key: 'open',
      label: (row) =>
        row.kind === 'report'
          ? 'Open report'
          : row.kind === 'meeting'
            ? 'Open meeting'
            : 'Open doc',
      icon: ExternalLink,
      onClick: navigateToEntity,
    },
    {
      key: 'audit-trail',
      label: 'View audit trail',
      icon: Activity,
      onClick: (row) => setTrailItem(row),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
    >
      <PageHeader
        title="Archive & audit"
        subtitle="Immutable record of every sealed report, held meeting and published project doc. Click a row for the full audit trail. FOI export is metadata-only — Part 2 redaction is enforced inside individual report PDFs."
        breadcrumbs={[{ label: 'Programme Governance' }, { label: 'Archive' }]}
        actions={
          <div className="inline-flex items-center gap-2">
            {/* month picker drives `asOfMonth` on the aggregator endpoint.*/}
            <MonthPicker
              monthEnd={historicalView.monthEnd}
              availableMonths={historicalView.availableMonths}
              onChange={historicalView.setMonthEnd}
              loading={historicalView.loading}
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || items.length === 0 || isHistorical}
              title={
                isHistorical
                  ? 'Exit historical view to export — FOI exports always use live data.'
                  : undefined
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              FOI export (CSV)
            </button>
          </div>
        }
      />

      {isHistorical && historicalView.monthEnd && (
        <HistoricalBanner
          monthEnd={historicalView.monthEnd}
          meta={historicalView.meta}
          onExit={() => historicalView.setMonthEnd(null)}
          activatedYearMonth={historicalView.activatedYearMonth}
          surfaceLabel="archive"
        />
      )}

      {historicalView.loading && <HistoricalContentSkeleton variant="stats-grid" />}
      {!historicalView.loading && <>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Sealed reports"
          value={summary.sealedReports}
          icon={CheckCircle2}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Held meetings"
          value={summary.heldMeetings}
          icon={CalendarDays}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
        <StatsCard
          title="Published docs"
          value={summary.publishedDocs}
          icon={FolderClosed}
          size="sm"
          iconBgClassName="bg-amber-100"
          iconClassName="text-amber-700"
        />
        <StatsCard
          title="HRB items"
          value={summary.hrbCount}
          icon={ShieldCheck}
          size="sm"
          iconBgClassName="bg-rose-100"
          iconClassName="text-rose-700"
        />
      </section>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : (
        <DynamicTable<ArchiveItem>
          data={items}
          columns={columns}
          rowActions={rowActions}
          filters={filters}
          emptyState={{
            icon: ScrollText,
            title: 'Nothing archived yet',
            description:
              'When reports are sealed, meetings are held, or project docs are published, they appear here with their full audit trail.',
          }}
        />
      )}
      </>}

      <AuditTrailDrawer
        isOpen={!!trailItem}
        onClose={() => setTrailItem(null)}
        item={trailItem}
      />
    </motion.div>
  );
}

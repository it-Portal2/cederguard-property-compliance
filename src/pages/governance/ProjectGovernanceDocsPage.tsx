// Project Governance Folder.
//
// Top-level governance route scoped to the existing global
// `activeProjectId` (mirrors ComplianceTracker / RiskRegister). When
// no project is active, an inline empty state asks the user to pick
// one from the Header — no new picker is invented.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  FolderClosed,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
  FileText,
  Link2,
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
  type ProjectDoc,
  CATEGORY_LABEL,
  STATUS_STYLES,
} from '../../components/governance/projectDocs/types';
import { ProjectDocModal } from '../../components/governance/projectDocs/ProjectDocModal';
import { useHistoricalView } from '../../hooks/useHistoricalView';
import { MonthPicker } from '../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../components/historicalReporting/HistoricalBanner';

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

export function ProjectGovernanceDocsPage() {
  const user = useStore((s) => s.user);
  const activeProject = useStore((s) => s.activeProject);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const userIsAdmin =
    isAtLeastClientAdmin(user?.role) || isSuperAdmin(user?.email, user?.role);

  //  historical view hook. When the user picks a past month,
  // the page swaps live docs for the snapshot's frozen state and
  // disables every edit affordance.
  const historicalView = useHistoricalView<{
    kind: 'governanceDoc';
    doc: ProjectDoc;
  }>({ collection: 'projectGovernanceDocs' });
  const isHistorical = historicalView.isHistorical;
  const isAdmin = userIsAdmin && !isHistorical;

  const [items, setItems] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState<ProjectDoc | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectDoc | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeProjectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.governanceListProjectDocs(activeProjectId);
      const list = ((res.items ?? []) as ProjectDoc[]).sort((a, b) =>
        (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
      );
      setItems(list);
    } catch (e: any) {
      console.error('[ProjectGovernanceDocsPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load docs.');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  //  effective items source. Snapshot data is project-scoped
  // post-filter so we only show docs that belonged to the active project
  // at the snapshot point.
  const historicalItems = useMemo<ProjectDoc[]>(() => {
    if (!isHistorical) return [];
    return historicalView.entries
      .map((e) => (e?.doc as ProjectDoc | undefined))
      .filter((d): d is ProjectDoc => !!d && d.projectId === activeProjectId);
  }, [isHistorical, historicalView.entries, activeProjectId]);
  const effectiveItems = isHistorical ? historicalItems : items;

  const counts = useMemo(() => {
    let draft = 0;
    let published = 0;
    let archived = 0;
    let softDeleted = 0;
    for (const it of effectiveItems) {
      if (it.softDeleted) {
        softDeleted += 1;
        continue;
      }
      if (it.status === 'Draft') draft += 1;
      else if (it.status === 'Published') published += 1;
      else if (it.status === 'Archived') archived += 1;
    }
    return { draft, published, archived, softDeleted };
  }, [effectiveItems]);

  const handleOpen = useCallback((doc: ProjectDoc) => {
    setOpened(doc);
    setModalOpen(true);
  }, []);

  const handleSaved = useCallback((next: ProjectDoc) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === next.id);
      if (idx === -1) return [next, ...prev];
      const out = prev.slice();
      out[idx] = next;
      return out;
    });
    setOpened(next);
  }, []);

  const handleRestore = useCallback(
    async (doc: ProjectDoc) => {
      if (restoringId) return;
      setRestoringId(doc.id);
      try {
        const res = await api.governanceRestoreProjectDoc(doc.id);
        if (!res?.success) throw new Error(res?.error ?? 'Restore failed.');
        const next = res.item as ProjectDoc;
        setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
        toast.success('Doc restored.');
      } catch (e: any) {
        toast.error(e?.message ?? 'Restore failed.');
      } finally {
        setRestoringId(null);
      }
    },
    [restoringId],
  );

  const handleSoftDelete = async (reason: string) => {
    if (!pendingDelete) return;
    setReasonBusy(true);
    try {
      const res = await api.governanceSoftDeleteProjectDoc(pendingDelete.id, reason);
      if (!res?.success) throw new Error(res?.error ?? 'Action failed.');
      const next = res.item as ProjectDoc;
      setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
      toast.success('Doc soft-deleted.');
      setPendingDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Action failed.');
    } finally {
      setReasonBusy(false);
    }
  };

  const canEditRow = (d: ProjectDoc) =>
    isAdmin || (user?.uid && d.ownerUid === user.uid);

  const columns: ColumnDef<ProjectDoc>[] = [
    {
      key: 'title',
      label: 'Document',
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
          {row.summary && (
            <p className="line-clamp-1 text-[10px] text-slate-500">
              {row.summary}
            </p>
          )}
        </div>
      ),
      exportValue: (_v, row) => row.title ?? '',
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (_v, row) => (
        <span className="text-xs text-slate-600">
          {CATEGORY_LABEL[row.category] ?? row.category}
        </span>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (_v, row) =>
        row.version > 0 ? (
          <span className="text-xs font-medium text-slate-700">v{row.version}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'links',
      label: 'Links',
      render: (_v, row) => {
        const hasReport = !!row.linkedReportId;
        const hasMeeting = !!row.linkedMeetingId;
        if (!hasReport && !hasMeeting) {
          return <span className="text-xs text-slate-300">—</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1">
            {hasReport && (
              <span
                title={`Report: ${row.linkedReportId}`}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
              >
                <FileText className="h-3 w-3" /> Report
              </span>
            )}
            {hasMeeting && (
              <span
                title={`Meeting: ${row.linkedMeetingId}`}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
              >
                <Link2 className="h-3 w-3" /> Meeting
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      render: (_v, row) => (
        <span className="text-xs text-slate-700">{formatGbDate(row.updatedAt)}</span>
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
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              style.pill,
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

  const filters: FilterDef<ProjectDoc>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'Draft', label: 'Draft' },
          { value: 'Published', label: 'Published' },
          { value: 'Archived', label: 'Archived' },
        ],
        match: (rowValue, filterValue) => rowValue === filterValue,
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'DecisionLog', label: 'Decision log' },
          { value: 'ToRAcknowledgement', label: 'ToR acknowledgement' },
          { value: 'MeetingNote', label: 'Meeting note' },
          { value: 'ChangeRecord', label: 'Change record' },
          { value: 'Other', label: 'Other' },
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

  const rowActions: RowAction<ProjectDoc>[] = [
    {
      key: 'edit',
      label: (r) =>
        canEditRow(r) && !r.softDeleted && r.status === 'Draft' ? 'Edit' : 'View',
      icon: Pencil,
      onClick: handleOpen,
    },
    {
      key: 'restore',
      label: 'Restore',
      icon: RotateCcw,
      onClick: handleRestore,
      isLoading: (r) => restoringId === r.id,
      isVisible: (r) => r.softDeleted && !!canEditRow(r),
    },
    {
      key: 'soft-delete',
      label: 'Soft-delete',
      icon: Trash2,
      isDanger: true,
      onClick: (r) => setPendingDelete(r),
      isVisible: (r) => !r.softDeleted && !!canEditRow(r),
    },
  ];

  const noProject = !activeProjectId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <FolderClosed className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Project Governance
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              {activeProject
                ? `Versioned governance documents for ${activeProject.name}. Decision logs, ToR acknowledgements, meeting notes — linked to reports and meetings.`
                : 'Versioned governance documents per project. Pick a project from the Header to begin.'}
            </p>
          </div>
        </div>
        {/* month picker for historical view.*/}
        <div className="self-start md:mt-1">
          <MonthPicker
            monthEnd={historicalView.monthEnd}
            availableMonths={historicalView.availableMonths}
            onChange={historicalView.setMonthEnd}
            loading={historicalView.loading}
          />
        </div>
      </header>

      {isHistorical && historicalView.monthEnd && (
        <HistoricalBanner
          monthEnd={historicalView.monthEnd}
          meta={historicalView.meta}
          onExit={() => historicalView.setMonthEnd(null)}
        />
      )}

      {noProject ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <FolderClosed className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            No project selected
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Use the project switcher in the Header to pick a project, then return here to manage its governance documents.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Draft"
              value={counts.draft}
              icon={Pencil}
              size="sm"
              iconBgClassName="bg-amber-100"
              iconClassName="text-amber-700"
            />
            <StatsCard
              title="Published"
              value={counts.published}
              icon={CheckCircle2}
              size="sm"
              iconBgClassName="bg-emerald-100"
              iconClassName="text-emerald-700"
            />
            <StatsCard
              title="Archived"
              value={counts.archived}
              icon={FolderClosed}
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
            </div>
          ) : (
            <DynamicTable<ProjectDoc>
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
                  New doc
                </button>
              }
              emptyState={{
                icon: FolderClosed,
                title: 'No governance docs yet',
                description:
                  'Click New doc to capture a decision log, ToR acknowledgement or meeting note for this project.',
              }}
            />
          )}
        </>
      )}

      {modalOpen && activeProjectId && (
        <ProjectDocModal
          isOpen={modalOpen}
          doc={opened}
          projectId={activeProjectId}
          canEdit={!opened || (canEditRow(opened) ? true : false)}
          onClose={() => {
            setModalOpen(false);
            setOpened(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ReasonDialog
        open={!!pendingDelete}
        title="Soft-delete this document?"
        message="The doc stays in the audit log but is hidden from the default view. Restore later from the Soft-deleted filter."
        reasonPlaceholder="Reason for deletion (≥ 5 chars)"
        confirmLabel="Soft-delete"
        variant="danger"
        loading={reasonBusy}
        onCancel={() => !reasonBusy && setPendingDelete(null)}
        onConfirm={handleSoftDelete}
      />
    </motion.div>
  );
}

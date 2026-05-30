import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';
import { Shield, AlertTriangle, AlertCircle, Flame, PoundSterling, Layers } from 'lucide-react';
import { clsx } from 'clsx';
import { StatsCard } from '../components/common/StatsCard';
import { stripMarkdown } from '../lib/utils';
import { calculateMatrixScore } from '../data/riskScoringMatrix';
import DynamicTable from '../components/table/DynamicTable';
import type { ColumnDef, RowAction, FilterDef } from '../components/table/types';
import type { RiskItem } from '../store/useStore';
import {
  OPERATIONAL_CATEGORY_NAMES,
  STRATEGIC_CATEGORY_NAMES,
} from '../data/riskTaxonomy';
import PageHeader from '../components/PageHeader';

function fGBP(v: number) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

const RISK_STATUSES = ["Open", "Closed", "Managed", "Mitigated", "Tolerated"];

export function RiskAggregation() {
  const {
    risks,
    projects,
    activeProjectId,
    activeProgrammeId,
    isInitialized,
    loadProjectData,
    loadProgrammeData,
    pendingMutations,
  } = useStore();
  const isRowPending = (id: string) => pendingMutations.has(`risk:${id}`);

  // Cross-table linkage: clicking a project summary row filters the main
  // aggregation table to that project. Same sentinel value the original
  // external filter used so the rest of the logic reads identically.
  const ALL_PROJECTS = 'All Projects' as const;
  const [selectedProjectId, setSelectedProjectId] = useState<string>(ALL_PROJECTS);

  const safeRisks    = Array.isArray(risks)      ? risks      : [];
  const safeProjects = Array.isArray(projects)   ? projects   : [];

  const inProgrammeContext = !activeProjectId && !!activeProgrammeId;
  const inProjectContext   = !!activeProjectId;

  // Bug 10 + 11: Use the right category list from taxonomy based on context
  // Programme context → strategic categories; project/all → operational (12 items)
  const activeCategories = inProgrammeContext
    ? STRATEGIC_CATEGORY_NAMES
    : OPERATIONAL_CATEGORY_NAMES;

  // ── Bug 1: Trigger data load on context change ───────────────────────────
  useEffect(() => {
    if (!isInitialized) return;
    if (activeProjectId) {
      loadProjectData(activeProjectId);
    } else if (activeProgrammeId) {
      loadProgrammeData(activeProgrammeId);
    }
  }, [isInitialized, activeProjectId, activeProgrammeId]);

  // Reset selected project when context changes
  useEffect(() => {
    setSelectedProjectId(ALL_PROJECTS);
  }, [activeProjectId, activeProgrammeId]);

  // ── Base context risks ────────────────────────────────────────────────────
  const contextRisks = useMemo(() => {
    return safeRisks.filter(r => {
      if (inProjectContext) return r.projectId === activeProjectId;
      if (inProgrammeContext) {
        if (r.programmeId === activeProgrammeId) return true;
        const proj = safeProjects.find(p => p.id === r.projectId);
        return !!proj && proj.programmeId === activeProgrammeId;
      }
      return true;
    });
  }, [safeRisks, safeProjects, activeProjectId, activeProgrammeId, inProjectContext, inProgrammeContext]);

  // Pre-filter for the main table by the cross-linked project selection only.
  // Status / category / search filters are handled by DynamicTable internally.
  const filtered = useMemo(() => {
    if (selectedProjectId === ALL_PROJECTS) return contextRisks;
    return contextRisks.filter(r => r.projectId === selectedProjectId);
  }, [contextRisks, selectedProjectId]);

  // ── Bug 4: projectSummaries counts ALL risks in scope for each project ───
  const projectSummaries = useMemo(() => {
    // In programme context: all projects in that programme
    // In project context: only the active project
    // No context: all projects
    const relevantProjects = inProjectContext
      ? safeProjects.filter(p => p.id === activeProjectId)
      : inProgrammeContext
        ? safeProjects.filter(p => p.programmeId === activeProgrammeId)
        : safeProjects;

    return relevantProjects.map(p => {
      // Count risks belonging to this project, including those stamped directly
      // with programmeId but associated via project lookup
      const pRisks = contextRisks.filter(r => r.projectId === p.id);
      const open      = pRisks.filter(r => r.status === 'Open').length;
      const high      = pRisks.filter(r => (r.residualRating || 0) >= 12).length;
      const escalated = pRisks.filter(r => r.escalated).length;
      const residualALE = pRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
      const openRate = pRisks.length > 0 ? (open / pRisks.length) * 100 : 0;

      return { id: p.id, name: p.name, total: pRisks.length, open, high, escalated, residualALE, openRate };
    }).filter(p => p.total > 0);
  }, [safeProjects, contextRisks, inProjectContext, inProgrammeContext, activeProjectId, activeProgrammeId]);

  // ── Category summaries scoped to current filtered set ────────────────────
  const categorySummaries = useMemo(() => {
    // Use activeCategories so the list matches what risks in this context actually use
    return activeCategories.map(cat => {
      const cRisks = filtered.filter(r => r.category === cat);
      if (cRisks.length === 0) return null;
      const residualALE = cRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
      return { name: cat, count: cRisks.length, residualALE };
    }).filter(Boolean);
  }, [filtered, activeCategories]);

  // ── Header label ──────────────────────────────────────────────────────────
  const contextLabel = useMemo(() => {
    if (selectedProjectId !== ALL_PROJECTS) {
      return safeProjects.find(p => p.id === selectedProjectId)?.name ?? selectedProjectId;
    }
    if (inProgrammeContext) return 'Programme Portfolio';
    if (inProjectContext)   return safeProjects.find(p => p.id === activeProjectId)?.name ?? 'Project';
    return 'All Projects';
  }, [selectedProjectId, safeProjects, inProgrammeContext, inProjectContext, activeProjectId]);

  // Click summary row → toggle main-table project filter
  const handleSummaryRowClick = (projectId: string) => {
    setSelectedProjectId(prev => (prev === projectId ? ALL_PROJECTS : projectId));
  };

  // ─── Table column / row-action / filter definitions ─────────────────────
  type ProjectSummary = (typeof projectSummaries)[number];
  type CategorySummary = (typeof categorySummaries)[number];

  const projectSummaryColumns: ColumnDef<ProjectSummary>[] = [
    {
      key: 'name',
      label: 'Project',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('text-sm font-semibold truncate', selectedProjectId === row.id ? 'text-indigo-700' : 'text-slate-700')}>{row.name}</span>
          {selectedProjectId === row.id && (
            <span className="text-[10px] font-semibold text-indigo-500 uppercase shrink-0">Filtered</span>
          )}
        </div>
      ),
    },
    { key: 'total', label: 'Total', align: 'right', sortable: true, render: (_v, row) => <span className="tabular-nums font-semibold text-slate-900">{row.total}</span> },
    {
      key: 'open',
      label: 'Open',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-xs font-semibold border border-amber-200">{row.open}</span>,
    },
    {
      key: 'high',
      label: 'High',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="inline-flex px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-xs font-semibold border border-rose-200">{row.high}</span>,
    },
    {
      key: 'escalated',
      label: 'Escalated',
      align: 'center',
      sortable: true,
      render: (_v, row) =>
        row.escalated > 0 ? (
          <span className="inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold border border-red-200">{row.escalated}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    { key: 'residualALE', label: 'Residual ALE', align: 'right', sortable: true, render: (_v, row) => <span className="tabular-nums font-semibold text-slate-900">{fGBP(row.residualALE)}</span> },
    {
      key: 'openRate',
      label: 'Open Rate',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${row.openRate}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums w-10 text-right">{Math.round(row.openRate)}%</span>
        </div>
      ),
    },
  ];

  const categorySummaryColumns: ColumnDef<CategorySummary>[] = [
    {
      key: 'name',
      label: 'Category',
      sortable: true,
      render: (_v, row) => <span className="text-sm font-semibold text-slate-700">{row?.name}</span>,
    },
    { key: 'count', label: 'Count', align: 'right', sortable: true, render: (_v, row) => <span className="tabular-nums font-semibold text-slate-900">{row?.count}</span> },
    { key: 'residualALE', label: 'Residual ALE', align: 'right', sortable: true, render: (_v, row) => <span className="tabular-nums font-semibold text-slate-900">{fGBP(row?.residualALE ?? 0)}</span> },
  ];

  const aggregationColumns: ColumnDef<RiskItem>[] = [
    {
      key: 'id',
      label: 'ID',
      align: 'center',
      sortable: true,
      render: (_v, r) => <span className="text-xs font-semibold text-indigo-600">#{r.id}</span>,
    },
    {
      key: 'projectId',
      label: 'Project',
      sortable: true,
      render: (_v, r) => {
        const proj = safeProjects.find(p => p.id === r.projectId);
        const projectName = proj?.name || r.project || r.projectId || '—';
        return <span className="text-sm font-semibold text-slate-700 line-clamp-2 block max-w-[160px]">{projectName}</span>;
      },
    },
    {
      key: 'dateAdded',
      label: 'Date',
      sortable: true,
      render: (_v, r) => <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{r.dateAdded || 'N/A'}</span>,
    },
    {
      key: 'workstream',
      label: 'Workstream',
      sortable: true,
      render: (_v, r) => <span className="text-xs font-medium text-slate-800">{r.workstream || 'General'}</span>,
    },
    {
      key: 'title',
      label: 'Risk',
      sortable: true,
      render: (_v, r) => (
        <div className="flex flex-col gap-1 max-w-[260px]">
          <span className="text-sm font-semibold text-slate-800 line-clamp-2">{stripMarkdown(r.title)}</span>
          {r.desc && <span className="text-xs text-slate-500 line-clamp-2">{stripMarkdown(r.desc)}</span>}
        </div>
      ),
    },
    {
      key: 'kri',
      label: 'KRI / Owner',
      render: (_v, r) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block w-max">{r.kri || 'No KRI'}</span>
          <span className="text-xs text-slate-600">{r.owner || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      key: 'grossRating',
      label: 'Inherent',
      align: 'center',
      sortable: true,
      render: (_v, r) => {
        const grossL = r.grossL ?? 0;
        const grossI = r.grossI ?? 0;
        const grossRating = r.grossRating ?? calculateMatrixScore(grossL, grossI);
        return (
          <div className="inline-flex flex-col items-center gap-0.5">
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#3d1111] text-white text-xs font-semibold">{grossRating || '—'}</div>
            {grossL > 0 && grossI > 0 && <span className="text-[10px] text-slate-400 tabular-nums">{grossL}×{grossI}</span>}
          </div>
        );
      },
    },
    {
      key: 'residualRating',
      label: 'Residual',
      align: 'center',
      sortable: true,
      render: (_v, r) => {
        const residualL = r.residualL ?? 0;
        const residualI = r.residualI ?? 0;
        const residualRating = r.residualRating ?? calculateMatrixScore(residualL, residualI);
        return (
          <div className="inline-flex flex-col items-center gap-0.5">
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#bf3b3b] text-white text-xs font-semibold">{residualRating || '—'}</div>
            {residualL > 0 && residualI > 0 && <span className="text-[10px] text-slate-400 tabular-nums">{residualL}×{residualI}</span>}
          </div>
        );
      },
    },
    {
      key: 'riskValue',
      label: 'Score',
      align: 'center',
      sortable: true,
      render: (_v, r) => {
        const residualL = r.residualL ?? 0;
        const residualI = r.residualI ?? 0;
        const riskValue = r.residualRating ?? calculateMatrixScore(residualL, residualI);
        return (
          <span
            className={clsx(
              'inline-flex px-2 py-0.5 rounded text-xs font-semibold border tabular-nums',
              riskValue >= 16 ? 'bg-red-100 text-red-700 border-red-200' :
              riskValue >= 12 ? 'bg-rose-50 text-rose-600 border-rose-200' :
              riskValue >= 6 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                               'bg-emerald-50 text-emerald-600 border-emerald-200',
            )}
          >
            {riskValue || '—'}
          </span>
        );
      },
    },
    {
      key: 'residualALE',
      label: 'Residual ALE',
      align: 'right',
      sortable: true,
      render: (_v, r) => <span className="tabular-nums font-semibold text-slate-900">{fGBP(r.residualALE ?? 0)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      sortable: true,
      render: (_v, r) => (
        <span
          className={clsx(
            'inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase border',
            r.status === 'Open' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200',
          )}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'escalated',
      label: 'Escalated',
      align: 'center',
      render: (_v, r) =>
        r.escalated ? (
          <span className="inline-flex px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-semibold border border-rose-200">ESC</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
  ];

  const aggregationRowActions: RowAction<RiskItem>[] = [
    {
      key: 'move-to-issue',
      label: 'Move to issue',
      icon: AlertTriangle,
      isVisible: (r) => !r.convertedToIssue && r.status !== 'Closed',
      isDisabled: (r) => isRowPending(r.id),
      requireConfirm: {
        title: (r: RiskItem) => `Convert risk ${r.id} to an issue?`,
        message: 'This will close the risk and create a linked issue.',
        confirmLabel: 'Convert',
      },
      onClick: (r) => {
        useStore.getState().convertToIssue(r.id).then(
          () => toast.success('Risk converted to live issue.'),
          (err: any) => toast.error(err?.message || 'Failed to convert risk to issue.'),
        );
      },
    },
  ];

  const aggregationFilters: FilterDef<RiskItem>[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: RISK_STATUSES.map(s => ({ value: s, label: s })),
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: activeCategories.map(c => ({ value: c, label: c })),
    },
  ];

  return (
    <div className="space-y-10">

      <PageHeader
        title={`Risk Aggregation — ${contextLabel}`}
        subtitle={
          inProgrammeContext
            ? 'Consolidated view of all risks across the programme.'
            : inProjectContext
              ? 'Consolidated view of all risks for this project.'
              : 'Consolidated view of all risks across the portfolio.'
        }
        breadcrumbs={[{label:"Monitoring & Reporting"},{label:"Aggregation"}]}
      />

      {/* ─── KPI STRIP ───*/}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={Shield}
          title="Total Risks"
          value={filtered.length}
          size="sm"
          iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
          iconClassName="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          icon={AlertCircle}
          title="Open"
          value={filtered.filter(r => r.status === 'Open').length}
          size="sm"
          iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
          iconClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          icon={Flame}
          title="High/Severe"
          value={filtered.filter(r => (r.residualRating || 0) >= 12).length}
          size="sm"
          iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
          iconClassName="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          icon={PoundSterling}
          title="Residual ALE"
          value={fGBP(filtered.reduce((s, r) => s + (r.residualALE || 0), 0))}
          size="sm"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-500/10"
          iconClassName="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* ─── SUMMARY CARDS ───*/}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Summary by Project*/}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Summary by project</h3>
            {selectedProjectId !== ALL_PROJECTS && (
              <button
                onClick={() => setSelectedProjectId(ALL_PROJECTS)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Clear filter
              </button>
            )}
          </div>
          <DynamicTable<ProjectSummary>
            data={projectSummaries}
            columns={projectSummaryColumns}
            pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50] }}
            getRowId={(r) => r.id}
            onRowClick={(r) => handleSummaryRowClick(r.id)}
            rowClassName={(r) => (selectedProjectId === r.id ? 'bg-indigo-50 hover:bg-indigo-100' : '')}
            emptyState={{
              title: 'No project risk data',
              description: 'No project risk data for this context.',
              icon: Shield,
            }}
            headerVariant="light"
          />
        </div>

        {/* Summary by Category*/}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Summary by category</h3>
          <DynamicTable<CategorySummary>
            data={categorySummaries}
            columns={categorySummaryColumns}
            pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50] }}
            getRowId={(r) => r.name}
            emptyState={{
              title: 'No category data',
              description: 'No category data for current filters.',
              icon: Shield,
            }}
            headerVariant="light"
          />
        </div>
      </div>

      {/* ─── MAIN AGGREGATION TABLE ───*/}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">All aggregated risks</h2>
        <DynamicTable<RiskItem>
          data={filtered}
          columns={aggregationColumns}
          rowActions={aggregationRowActions}
          filters={aggregationFilters}
          searchable
          searchPlaceholder="Search risks..."
          searchFields={['title', 'id', 'workstream', 'desc']}
          pagination={{ enabled: true, pageSize: 15, pageSizeOptions: [15, 25, 50, 100] }}
          getRowId={(r) => r.id}
          rowClassName={(r) => (isRowPending(r.id) ? 'opacity-60 pointer-events-none' : '')}
          toolbarActions={
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
            >
              <option value={ALL_PROJECTS}>All Projects</option>
              {safeProjects
                .filter((p) => {
                  if (inProjectContext) return p.id === activeProjectId;
                  if (inProgrammeContext) return p.programmeId === activeProgrammeId;
                  return true;
                })
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          }
          emptyState={{
            title: 'No matching risks found',
            description: selectedProjectId !== ALL_PROJECTS
              ? 'Try broadening your search criteria or clear the project filter above.'
              : 'No risks have been added for this context yet.',
            icon: Shield,
          }}
          headerVariant="light"
          stickyHeader
        />
      </div>
    </div>
  );
}

// Local StatCardSmall removed — replaced by the shared StatsCard
// component with size="sm" + light-tinted icon backgrounds.

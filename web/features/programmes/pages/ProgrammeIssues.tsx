import { FileWarning, AlertCircle, Settings, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
import { useStore, type IssueItem } from '../../../store/useStore';
import { api } from '../../../lib/api';
import { isAtLeastClientAdmin } from '../../../lib/roles';
import PageActions, { type ActionItem } from '../../../components/PageActions';
import { exportContextData } from '../../../lib/exportUtils';
import DynamicTable from '../../../components/table/DynamicTable';
import type { ColumnDef } from '../../../components/table/types';
import { useHistoricalView } from '../../../hooks/useHistoricalView';
import { MonthPicker } from '../../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../../components/historicalReporting/HistoricalBanner';
import type { LegacyArraySnapshot } from '../../../../shared/types/historicalReporting';
import PageHeader from '../../../components/PageHeader';

interface ProjectIssueRow {
  id: string;
  name: string;
  pmName: string;
  issueOpen: number;
  issueEscalated: number;
  [key: string]: any;
}

export function ProgrammeIssues() {
  const { activeProgrammeId, user, issues, canManageContext, activeProgramme } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get('from') === 'initiation';
  const userRole = user?.role || user?.profile?.role;
  const isPM = !isAtLeastClientAdmin(userRole);
  const [projects, setProjects] = useState<ProjectIssueRow[]>([]);
  const [loading, setLoading] = useState(true);

  //  historical view hook. When the user picks a past month,
  // the per-project issue counts are derived from the snapshot's frozen
  // arrays instead of the live API aggregation.
  const historicalView = useHistoricalView<LegacyArraySnapshot<IssueItem>>({
    collection: 'issues',
  });
  const isHistorical = historicalView.isHistorical;

  // Data fetch — unchanged logic. Project names + PM names always come
  // from live API; only issue counts vary historically.
  useEffect(() => {
    api.clientGetProjectData().then((res: any) => {
      if (res.projects) {
        let list = res.projects;
        if (activeProgrammeId) {
          list = list.filter((p: any) => p.programmeId === activeProgrammeId);
        }
        setProjects(list);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [activeProgrammeId]);

  //  per-project counts derived from the issues snapshot.
  // Each LegacyArraySnapshot entry holds one project's array of issues at
  // month-end. Build a Map<projectId, {open, escalated}> we can merge
  // into the project list.
  const historicalCountsByProject = useMemo<Map<string, { open: number; escalated: number }>>(() => {
    const map = new Map<string, { open: number; escalated: number }>();
    if (!isHistorical) return map;
    for (const entry of historicalView.entries) {
      if (entry?.kind !== 'legacyArray' || !Array.isArray(entry.array)) continue;
      let open = 0;
      let escalated = 0;
      for (const issue of entry.array) {
        if (issue?.status !== '4. Resolved') open += 1;
        if (issue?.status === '2. Escalated') escalated += 1;
      }
      map.set(entry.projectId, { open, escalated });
    }
    return map;
  }, [isHistorical, historicalView.entries]);

  // Effective rows: when historical, replace issueOpen / issueEscalated on
  // each project with the snapshot-derived count (default 0 when a project
  // had no snapshot entry — i.e. genuinely zero issues at month-end).
  const effectiveProjects = useMemo<ProjectIssueRow[]>(() => {
    if (!isHistorical) return projects;
    return projects.map((p) => {
      const counts = historicalCountsByProject.get(p.id) ?? { open: 0, escalated: 0 };
      return { ...p, issueOpen: counts.open, issueEscalated: counts.escalated };
    });
  }, [projects, isHistorical, historicalCountsByProject]);

  // KPI totals — same logic, applied to effective rows.
  const totals = useMemo(() => ({
    open: effectiveProjects.reduce((s, p) => s + (p.issueOpen || 0), 0),
    escalated: effectiveProjects.reduce((s, p) => s + (p.issueEscalated || 0), 0),
  }), [effectiveProjects]);

  // ── Column definitions ────────────────────────────────────────────────────────

  const columns: ColumnDef<ProjectIssueRow>[] = [
    {
      key: 'name',
      label: 'Project Name',
      sortable: true,
      render: (v) => (
        <span className="text-[11px] font-semibold text-slate-800">
          {v || 'Untitled Project'}
        </span>
      ),
    },
    {
      key: 'pmName',
      label: 'Project Manager',
      render: (v) => (
        <span className="text-[11px] text-slate-600 font-medium">{v || '—'}</span>
      ),
    },
    {
      key: 'issueOpen',
      label: 'Open Issues',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="text-[11px] font-semibold text-amber-600">{v ?? 0}</span>
      ),
    },
    {
      key: 'issueEscalated',
      label: 'Escalated',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="text-[11px] font-semibold text-rose-600">{v ?? 0}</span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  const canManage = canManageContext();
  const exportCtxName = activeProgramme?.name || 'Programme';
  const pageActions: ActionItem[] = [
    { label: 'Add Issue', icon: AlertCircle, onClick: () => navigate('/risk/issues'), description: 'Log a new issue for this context.', category: 'Context Actions' },
    { label: 'Edit Profile', icon: Settings, onClick: () => navigate(`/programmes/edit/${activeProgrammeId}`), description: 'Modify programme metadata and parameters.', category: 'Context Actions' },
    { label: 'Re-run AI Analysis', icon: RefreshCw, onClick: () => navigate('/compliance/setup?type=programme&restart=true'), description: 'Restart compliance setup and re-run AI analysis.', category: 'Context Actions' },
    { label: 'Export Issues Data (Excel)', icon: FileSpreadsheet, onClick: () => exportContextData({ page: 'issues', complianceItems: [], risks: [], issues: Array.isArray(issues) ? issues : [], projects: [], contextId: activeProgrammeId || undefined, isProject: false, contextName: exportCtxName }), description: 'Download all issues register data as .xlsx.', category: 'Data Tools' },
  ];

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title="Programme Issues"
          subtitle="Track and resolve issues across all projects linked to this programme."
          breadcrumbs={[{label:"Risk Management"},{label:"Issues"}]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MonthPicker
                monthEnd={historicalView.monthEnd}
                availableMonths={historicalView.availableMonths}
                onChange={historicalView.setMonthEnd}
                loading={historicalView.loading}
              />
              <PageActions items={pageActions} canManage={canManage} />
            </div>
          }
        />
        {isHistorical && historicalView.monthEnd && (
          <HistoricalBanner
            monthEnd={historicalView.monthEnd}
            meta={historicalView.meta}
            onExit={() => historicalView.setMonthEnd(null)}
            defaultCorrectionCollection="issues"
            emptyReason={historicalView.emptyReason}
            activatedYearMonth={historicalView.activatedYearMonth}
            surfaceLabel="programme issues"
          />
        )}

        {/* KPI tiles — derived from effective rows so historical mode
 shows month-end totals, not live ones.*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white border-t-4 border-t-amber-500 border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-medium text-amber-600 mb-1 tabular-nums">{loading || historicalView.loading ? '—' : totals.open}</div>
            <div className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide">Total Open Issues</div>
          </div>
          <div className="bg-white border-t-4 border-t-red-500 border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-medium text-red-600 mb-1 tabular-nums">{loading || historicalView.loading ? '—' : totals.escalated}</div>
            <div className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide">Escalated Issues</div>
          </div>
        </div>

        {/* DynamicTable*/}
        <DynamicTable<ProjectIssueRow>
          data={effectiveProjects}
          columns={columns}
          loading={loading || historicalView.loading}
          searchable
          searchPlaceholder="Search projects..."
          searchFields={['name', 'pmName']}
          getRowId={(r) => r.id}
          emptyState={{
            title: 'No issues found.',
            description: 'No projects in this programme have open issues.',
            icon: FileWarning,
          }}
          headerVariant="light"
          stickyHeader
        />

      </div>
    </>
  );
}

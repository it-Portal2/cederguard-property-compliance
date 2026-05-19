import { FileWarning } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
import { useStore, type IssueItem } from '../store/useStore';
import { api } from '../lib/api';
import { isAtLeastClientAdmin } from '../lib/roles';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import DynamicTable from '../components/table/DynamicTable';
import type { ColumnDef } from '../components/table/types';
import { useHistoricalView } from '../hooks/useHistoricalView';
import { MonthPicker } from '../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../components/historicalReporting/HistoricalBanner';
import type { LegacyArraySnapshot } from '../types/historicalReporting';

interface ProjectIssueRow {
  id: string;
  name: string;
  pmName: string;
  issueOpen: number;
  issueEscalated: number;
  [key: string]: any;
}

export function ProgrammeIssues() {
  const { activeProgrammeId, user } = useStore();
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
        <span className="text-[11px] font-black text-slate-800">
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
        <span className="text-[11px] font-black text-amber-600">{v ?? 0}</span>
      ),
    },
    {
      key: 'issueEscalated',
      label: 'Escalated',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="text-[11px] font-black text-rose-600">{v ?? 0}</span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ServiceManagementBar />
      <div className="space-y-5 sm:space-y-6">

        {/* month picker for historical view.*/}
        <div className="flex justify-end">
          <MonthPicker
            monthEnd={historicalView.monthEnd}
            availableMonths={historicalView.availableMonths}
            onChange={historicalView.setMonthEnd}
            loading={historicalView.loading}
          />
        </div>
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
            <div className="text-2xl font-bold text-amber-600 mb-1">{loading || historicalView.loading ? '—' : totals.open}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Open Issues</div>
          </div>
          <div className="bg-white border-t-4 border-t-red-500 border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600 mb-1">{loading || historicalView.loading ? '—' : totals.escalated}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Escalated Issues</div>
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
            title: 'No projects found.',
            description: 'Projects in this programme will appear here.',
            icon: FileWarning,
          }}
          headerVariant="light"
          stickyHeader
        />

      </div>
    </>
  );
}

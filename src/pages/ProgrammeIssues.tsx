import { FileWarning } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { isAtLeastClientAdmin } from '../lib/roles';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import DynamicTable from '../components/table/DynamicTable';
import type { ColumnDef } from '../components/table/types';

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

  // Data fetch — unchanged logic
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

  // KPI totals — unchanged logic
  const totals = useMemo(() => ({
    open: projects.reduce((s, p) => s + (p.issueOpen || 0), 0),
    escalated: projects.reduce((s, p) => s + (p.issueEscalated || 0), 0),
  }), [projects]);

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
      <div className="max-w-[98%] lg:max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 space-y-5 sm:space-y-6">

        {/* KPI tiles — unchanged */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white border-t-4 border-t-amber-500 border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-amber-600 mb-1">{loading ? '—' : totals.open}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Open Issues</div>
          </div>
          <div className="bg-white border-t-4 border-t-red-500 border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600 mb-1">{loading ? '—' : totals.escalated}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Escalated Issues</div>
          </div>
        </div>

        {/* DynamicTable */}
        <DynamicTable<ProjectIssueRow>
          data={projects}
          columns={columns}
          loading={loading}
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

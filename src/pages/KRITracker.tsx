import { useStore } from '../store/useStore';
import {
  BarChart, Radar, AlertTriangle, ShieldCheck, TrendingUp,
  Layers, Clock, TrendingDown, Target, Plus, Edit2,
  Trash2, ShieldOff, Bell, ExternalLink
} from 'lucide-react';
import { StatsCard } from '../components/common/StatsCard';
import DynamicTable from '../components/table/DynamicTable';
import type { ColumnDef, RowAction } from '../components/table/types';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { useState, useMemo, useEffect } from 'react';
import { KRIModal } from '../components/KRIModal';
import { type KRI } from '../store/useStore';
import { isAtLeastPM, isAtLeastClientAdmin } from '../lib/roles';
import { KRI_METADATA, SEED_KRIS } from '../data/riskData';
import { generateId } from '../lib/utils';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';

export function KRITracker() {
  const {
    risks, projects, activeProgrammeId, activeProjectId,
    kris, addKRI, updateKRI, deleteKRI, user,
    isInitialized, loadProjectData, loadProgrammeData,
    isContextSwitching, addNotification,
  } = useStore();

  const navigate = useNavigate();

  const userRole = user?.role || (user as any)?.profile?.role;
  const canModify = isAtLeastPM(userRole);
  const canDelete = isAtLeastClientAdmin(userRole);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKri, setSelectedKri] = useState<KRI | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const safeRisks = Array.isArray(risks) ? risks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeKris = Array.isArray(kris) ? kris : [];

  // When the page mounts with a context but empty KRIs:
  //   1. Trigger a context data load (which includes fallback + auto-seed in the store).
  //   2. After the async load completes, if still empty (brand-new context with no persisted KRIs),
  //      add the 7 standard KRIs directly so the table is never blank.
  useEffect(() => {
    if (!isInitialized) return;
    if (safeKris.length > 0) return;

    const contextId = activeProjectId || activeProgrammeId;
    if (!contextId) return;

    (async () => {
      if (activeProjectId) {
        await loadProjectData(activeProjectId, false);
      } else if (activeProgrammeId) {
        await loadProgrammeData(activeProgrammeId, false);
      }
      // After the load (which auto-seeds in the store), check if kris are still empty.
      // This can happen if the async store set() hasn't caused a re-render yet — guard only.
      const storeKRIs = useStore.getState().kris;
      if (!Array.isArray(storeKRIs) || storeKRIs.length === 0) {
        // Direct state update: populate with standard KRIs (store's load already persisted them)
        useStore.setState({ kris: SEED_KRIS });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, activeProjectId, activeProgrammeId]);

  // Memo uses stable primitive IDs as deps — avoids re-running on every render
  const filteredRisks = useMemo(() => {
    return safeRisks.filter(r => {
      if (activeProjectId) return r.projectId === activeProjectId;
      if (activeProgrammeId) {
        if (r.programmeId === activeProgrammeId) return true;
        const proj = safeProjects.find(p => p.id === r.projectId);
        return !!(proj && proj.programmeId === activeProgrammeId);
      }
      return true;
    });
  // deps: stable IDs, not derived arrays
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeRisks.length, activeProjectId, activeProgrammeId, safeProjects.length]);

  const getKRIStats = (kri: KRI) => {
    const kriRisks = filteredRisks.filter(r => r.kri === kri.name);
    const total = kriRisks.length || (kri.totalRisks || 0);
    const highRisks = kriRisks.filter(r => (r.residualRating || 0) >= 12).length || (kri.highRisks || 0);

    const now = new Date();
    const overdueRisks = kriRisks.filter(r => r.status === 'Open' && r.dueDate && new Date(r.dueDate) < now).length || (kri.overdue || 0);
    const overduePct = total > 0 ? (kriRisks.length > 0 ? Math.round((overdueRisks / total) * 100) : (kri.overduePct || 0)) : 0;

    const totalAge = kriRisks.reduce((acc, r) => {
      const added = new Date(r.dateAdded || r.lastReviewDate || now);
      return acc + Math.max(0, Math.floor((now.getTime() - added.getTime()) / 86400000));
    }, 0);
    const avgAge = kriRisks.length > 0 ? Math.round(totalAge / kriRisks.length) : (kri.avgRiskAge || 0);

    const uniqueProjects = new Set(kriRisks.map(r => r.projectId).filter(Boolean)).size;
    const projectsInProg = safeProjects.filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId).length;
    const projectPct = projectsInProg > 0 ? (kriRisks.length > 0 ? Math.round((uniqueProjects / projectsInProg) * 100) : (kri.projectsPct || 0)) : 0;

    const totalResidualALE = kriRisks.reduce((s, r) => s + (r.residualALE || 0), 0) || (kri.residualExposure || 0);
    const totalGrossALE = kriRisks.reduce((s, r) => s + (r.grossALE || 0), 0);
    const reductionPct = totalGrossALE > 0 ? Math.round(((totalGrossALE - totalResidualALE) / totalGrossALE) * 100) : (kri.riskReductionPct || 0);

    const escalationCount = kriRisks.filter(r => r.escalated).length;

    const meta = KRI_METADATA[kri.name];
    let displayStatus: 'Green' | 'Yellow' | 'Red' = (kri.status as any) || 'Green';

    if (meta) {
      const val =
        meta.thresholdType === 'high_risks' ? highRisks :
        meta.thresholdType === 'overdue' ? overdueRisks :
        meta.thresholdType === 'pct_overdue' ? overduePct :
        meta.thresholdType === 'avg_age' ? avgAge :
        meta.thresholdType === 'project_pct' ? projectPct :
        meta.thresholdType === 'residual_exp' ? totalResidualALE :
        meta.thresholdType === 'reduction_pct' ? reductionPct :
        0;

      const parseAndCompare = (threshold: string, value: number) => {
        const parseUnitValue = (str: string): number => {
          const cleanStr = str.replace(/[^\d.kKmM]/g, '');
          let num = parseFloat(cleanStr);
          if (isNaN(num)) return 0;
          if (cleanStr.toLowerCase().endsWith('m')) num *= 1_000_000;
          else if (cleanStr.toLowerCase().endsWith('k')) num *= 1_000;
          return num;
        };
        const clean = threshold.trim();
        if (clean.startsWith('<=')) return value <= parseUnitValue(clean.slice(2));
        if (clean.startsWith('>=')) return value >= parseUnitValue(clean.slice(2));
        if (clean.startsWith('<'))  return value <  parseUnitValue(clean.slice(1));
        if (clean.startsWith('>'))  return value >  parseUnitValue(clean.slice(1));
        if (clean.includes('-')) {
          const [minStr, maxStr] = clean.split('-').map(s => s.trim());
          return value >= parseUnitValue(minStr) && value <= parseUnitValue(maxStr);
        }
        const fallback = parseUnitValue(clean);
        return !isNaN(fallback) && Math.abs(value - fallback) < 0.1;
      };

      if (parseAndCompare(meta.green, val)) displayStatus = 'Green';
      else if (parseAndCompare(meta.amber, val)) displayStatus = 'Yellow';
      else displayStatus = 'Red';
    }

    const programmeEscalations = kriRisks.filter(r => r.isProgrammeLevel || (r.escalated && activeProgrammeId)).length;
    if (programmeEscalations > 1 || overduePct > 50) displayStatus = 'Red';

    return {
      total, high: highRisks, overdue: overdueRisks, overduePct, avgAge,
      projectPct, residualALE: totalResidualALE, reductionPct,
      status: displayStatus, escalation: escalationCount, programmeEscalations,
      owner: kri.owner || 'Lead Auditor',
    };
  };

  const stats = useMemo(() => {
    const items = safeKris.map(kri => ({ ...kri, stats: getKRIStats(kri) }));
    const redCount = items.filter(i => i.stats.status === 'Red').length;
    const amberCount = items.filter(i => i.stats.status === 'Yellow').length;

    const totalHighRisks = filteredRisks.filter(r => (r.residualRating || 0) >= 12).length;
    const now = new Date();
    const overdueRisks = filteredRisks.filter(r => r.status === 'Open' && r.dueDate && new Date(r.dueDate) < now);
    const totalDelay = overdueRisks.reduce((acc, r) => {
      return acc + Math.floor((now.getTime() - new Date(r.dueDate!).getTime()) / 86400000);
    }, 0);
    const avgDelay = overdueRisks.length > 0 ? (totalDelay / overdueRisks.length).toFixed(1) : '0.0';

    return { items, redCount, amberCount, totalRisks: filteredRisks.length, totalHighRisks, avgDelay };
  // safeKris.length and filteredRisks trigger recalc when data actually changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeKris.length, safeKris, filteredRisks, activeProjectId, activeProgrammeId]);

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  const handleAdd = () => { setSelectedKri(null); setIsModalOpen(true); };
  const handleEdit = (kri: KRI) => { setSelectedKri(kri); setIsModalOpen(true); };

  const handleDelete = async (id: string, _name: string) => {
    if (!canDelete) return;
    setDeletingId(id);
    try {
      await deleteKRI(id);
      toast.success('KRI deleted.');
    } catch (err: any) {
      console.error('[KRITracker] delete error', err);
      toast.error(err?.message || 'Failed to delete KRI.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (data: Partial<KRI>) => {
    try {
      if (selectedKri) {
        await updateKRI(selectedKri.id, data);
        toast.success('KRI updated.');
      } else {
        await addKRI({
          ...data,
          id: generateId('KRI'),
        } as KRI);
        toast.success('KRI added.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('[KRITracker] save error', err);
      toast.error(err?.message || 'Failed to save KRI.');
    }
  };

  // ─── Skeleton loader ─────────────────────────────────────────────────────────
  const isLoading = !isInitialized || isContextSwitching;

  // ─── Table columns + row actions ─────────────────────────────────────────────
  type KriRow = (typeof stats.items)[number];

  const kriColumns: ColumnDef<KriRow>[] = [
    {
      key: 'name',
      label: 'KRI',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={clsx(
              'w-2 h-2 rounded-full shrink-0',
              row.stats.status === 'Red'
                ? 'bg-rose-500'
                : row.stats.status === 'Yellow'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500',
            )}
          />
          <span className="text-sm font-semibold text-slate-800 truncate">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {row.stats.owner[0]}
          </div>
          <span className="text-sm text-slate-700 truncate">{row.stats.owner}</span>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="tabular-nums font-semibold text-slate-900">{row.stats.total}</span>,
    },
    {
      key: 'high',
      label: 'High',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="tabular-nums font-semibold text-rose-600">{row.stats.high}</span>,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="tabular-nums text-slate-900">{row.stats.overdue}</span>,
    },
    {
      key: 'overduePct',
      label: '% Overdue',
      align: 'center',
      sortable: true,
      render: (_v, row) => (
        <div className="flex flex-col items-center gap-1">
          <span
            className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded',
              row.stats.overduePct > 30 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500',
            )}
          >
            {row.stats.overduePct}%
          </span>
          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={clsx('h-full', row.stats.overduePct > 30 ? 'bg-rose-500' : 'bg-slate-400')}
              style={{ width: `${Math.min(100, row.stats.overduePct)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'avgAge',
      label: 'Avg Age (d)',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="tabular-nums text-slate-500">{row.stats.avgAge}</span>,
    },
    {
      key: 'projectPct',
      label: '% Projects',
      align: 'center',
      sortable: true,
      render: (_v, row) => <span className="tabular-nums font-semibold text-indigo-600">{row.stats.projectPct}%</span>,
    },
    {
      key: 'residualALE',
      label: 'Exp (£)',
      align: 'right',
      sortable: true,
      render: (_v, row) => (
        <span className="tabular-nums font-semibold text-slate-900">
          £{(row.stats.residualALE / 1000).toFixed(0)}k
        </span>
      ),
    },
    {
      key: 'reductionPct',
      label: 'Reduction',
      align: 'center',
      sortable: true,
      render: (_v, row) => (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-emerald-600">{row.stats.reductionPct}%</span>
            <TrendingDown className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="w-16 h-1.5 bg-emerald-50 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, row.stats.reductionPct)}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      sortable: true,
      render: (_v, row) => (
        <span
          className={clsx(
            'font-mono inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border',
            row.stats.status === 'Red'
              ? 'bg-rose-50 text-rose-600 border-rose-100'
              : row.stats.status === 'Yellow'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100',
          )}
        >
          {row.stats.status}
        </span>
      ),
    },
    {
      key: 'escalation',
      label: 'Escalation',
      align: 'center',
      render: (_v, row) => {
        const { escalation, programmeEscalations } = row.stats;
        if (escalation === 0 && programmeEscalations === 0) return <span className="text-slate-300">—</span>;
        return (
          <div className="flex flex-col items-center gap-1">
            {escalation > 0 && (
              <div
                className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100"
                title="Project level escalations"
              >
                <AlertTriangle className="w-3 h-3" />
                <span className="text-xs font-semibold">{escalation}</span>
              </div>
            )}
            {programmeEscalations > 0 && (
              <div
                className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100"
                title="Programme level escalations"
              >
                <Target className="w-3 h-3 fill-rose-600" />
                <span className="text-xs font-semibold">{programmeEscalations}</span>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const kriRowActions: RowAction<KriRow>[] = [
    {
      key: 'view-risks',
      label: 'View linked risks',
      icon: ExternalLink,
      onClick: (row) => navigate(`/risk/register?kri=${encodeURIComponent(row.name)}`),
    },
    {
      key: 'dispatch-alert',
      label: 'Dispatch alert',
      icon: Bell,
      isVisible: () => canModify,
      onClick: (row) => {
        if (row.stats.status === 'Green') {
          toast.error('No active alerts to dispatch for this KRI.');
          return;
        }
        addNotification({
          type: 'risk',
          title: `KRI Alert: ${row.name}`,
          message: `Threshold breached. Requires immediate review by ${row.stats.owner}.`,
          time: new Date().toISOString(),
        });
        toast.success(`Alert dispatched to ${row.stats.owner}`);
      },
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: Edit2,
      isVisible: () => canModify,
      onClick: (row) => handleEdit(row),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      isDanger: true,
      isVisible: () => canDelete,
      isLoading: (row) => deletingId === row.id,
      requireConfirm: {
        title: (row: KriRow) => `Delete KRI "${row.name}"?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        isDanger: true,
      },
      onClick: (row) => handleDelete(row.id, row.name),
    },
  ];

  return (
    <div className="space-y-12">

      <PageHeader
        title="KRI Risk Tracker"
        subtitle={`Full diagnostic indicators across ${safeProjects.length} active workstream${safeProjects.length === 1 ? '' : 's'}.`}
        breadcrumbs={[{label:"Monitoring & Reporting"},{label:"KRI Tracker"}]}
        actions={
          canModify ? (
            <button
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add KRI
            </button>
          ) : undefined
        }
      />

      {/* ─── KPI CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          icon={Layers}
          title="Portfolio Risks"
          value={stats.totalRisks}
          description="Critical Density"
          iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
          iconClassName="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          icon={AlertTriangle}
          title="High Priority"
          value={stats.totalHighRisks}
          description="Immediate Action"
          iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
          iconClassName="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          icon={Clock}
          title="Avg KRI Delay"
          value={`${stats.avgDelay}d`}
          description="Overdue Mean"
          iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
          iconClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          icon={Radar}
          title="Aggregation"
          value={stats.items.length}
          description="Active Monitoring"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-500/10"
          iconClassName="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* ─── KRI TABLE ─── */}
      <DynamicTable<KriRow>
        data={stats.items}
        columns={kriColumns}
        rowActions={kriRowActions}
        pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50] }}
        searchable
        searchPlaceholder="Search KRIs..."
        searchFields={['name']}
        getRowId={(r) => r.id}
        rowClassName={(r) => (deletingId === r.id ? 'opacity-60 pointer-events-none' : '')}
        loading={isLoading}
        emptyState={{
          title: 'No KRIs configured',
          description:
            activeProjectId || activeProgrammeId
              ? 'No KRIs have been set up for this context yet. Use the Add KRI button to create your first indicator.'
              : 'Select a project or programme to view KRIs.',
          icon: ShieldOff,
        }}
        headerVariant="light"
        stickyHeader
      />

      {/* ─── STRATEGIC SUMMARY ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
        <div className="bg-[#111827] p-10 rounded-lg text-white space-y-4">
          <h3 className="text-xl font-semibold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-400" /> Compliance Delta
          </h3>
          <p className="text-sm text-slate-400 font-bold leading-relaxed ">
            Portfolio health is <strong className={clsx("font-semibold", stats.redCount > 0 ? "text-rose-400" : "text-emerald-400")}>{stats.redCount > 0 ? "Critical" : "Stable"}</strong>. 
            We are actively tracking {stats.totalRisks} mitigations with {stats.totalHighRisks} high-priority exposures affecting the current context.
          </p>
        </div>
        <div className="bg-indigo-600 p-10 rounded-lg text-white space-y-4">
          <h3 className="text-xl font-semibold tracking-tight flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-white" /> Performance Insight
          </h3>
          <p className="text-sm text-indigo-100 font-bold leading-relaxed ">
            Average overdue delay across all tracked risks is currently reading at <strong className="font-semibold text-white">{stats.avgDelay} days</strong>.
            Next statutory review cycle is scheduled for the end of Q1.
          </p>
        </div>
      </div>

      {isModalOpen && (
        <KRIModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          initialData={selectedKri}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';
import {
  Loader2,
  AlertTriangle,
  FolderKanban,
  Users,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Printer,
  HeartPulse,
  TrendingUp,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { clsx } from 'clsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router';
import { stripMarkdown } from '../../../lib/utils';
import { isAtLeastClientAdmin } from '../../../lib/roles';
import { StatsCard } from '../../../components/common/StatsCard';
import DynamicTable from '../../../components/table/DynamicTable';
import type { ColumnDef, RowAction, FilterDef } from '../../../components/table/types';

type RAG = 'Red' | 'Amber' | 'Green' | 'Grey';

const ragColors: Record<RAG, string> = {
    Red: 'bg-red-100 text-red-700 border-red-200',
    Amber: 'bg-amber-100 text-amber-700 border-amber-200',
    Green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Grey: 'bg-slate-100 text-slate-500 border-slate-200',
};
const ragDot: Record<RAG, string> = {
    Red: 'bg-red-500',
    Amber: 'bg-amber-500',
    Green: 'bg-emerald-500',
    Grey: 'bg-slate-400',
};

function ProgressBar({ pct, color = 'indigo' }: { pct: number; color?: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'from-indigo-500 to-violet-500',
        green: 'from-emerald-500 to-teal-400',
        red: 'from-red-500 to-orange-400',
    };
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full bg-gradient-to-r ${colorMap[color] || colorMap.indigo} transition-all duration-500`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className="text-[11px] font-mono font-medium text-slate-600 w-8 text-right tabular-nums">{pct}%</span>
        </div>
    );
}

export function ClientProgrammeReport() {
    const { programmes, setActiveProject, user } = useStore();
    const navigate = useNavigate();
    const userRole = user?.role || user?.profile?.role;
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // Search and filter state lives inside DynamicTable now (its built-in
    // toolbar covers Programme / RAG selects + free-text search). The KPI
    // strip and Top Risks / Top Compliance cards show portfolio-wide totals
    // so they don't need external filter state to drive them.
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [topRisks, setTopRisks] = useState<any[]>([]);
    const [topCompliance, setTopCompliance] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [projRes, risksRes, compRes] = await Promise.all([
                api.clientGetProjectData(),
                api.getData('risks').catch(() => []),
                api.getData('complianceItems').catch(() => [])
            ]);
            setProjects((projRes as any).projects || []);

            // Top portfolio risks — only OPEN risks sorted by gross rating descending.
            // Closed / mitigated / managed risks shouldn't surface as "top".
            const risks = Array.isArray(risksRes) ? risksRes : [];
            const openRisks = risks.filter((r: any) => !r.status || r.status === 'Open');
            const sortedRisks = [...openRisks].sort((a: any, b: any) => (b.grossRating || 0) - (a.grossRating || 0));
            setTopRisks(sortedRisks.slice(0, 5));

            // Critical compliance gaps — items that are APPLICABLE to the context
            // (status === 'applicable'), still OPEN (stage is not Live or Archived),
            // AND carry a High / Critical risk classification. The previous filter
            // used `c.status !== 'Complete' && c.status !== 'At Risk'` which never
            // matched anything because compliance items don't have those statuses.
            const compliance = Array.isArray(compRes) ? compRes : [];
            const gaps = compliance.filter((c: any) => {
                const applicable = !c.status || c.status === 'applicable';
                const notComplete = c.stage !== 'Live' && c.stage !== 'Archived';
                const highRisk = c.risk === 'High' || c.risk === 'Critical';
                return applicable && notComplete && highRisk;
            });
            // Sort by stage severity (Information Gap / Risk Identified first), then by domain
            gaps.sort((a: any, b: any) => {
                const stageRank: Record<string, number> = {
                    'Risk Identified': 0,
                    'Information Gap': 1,
                    'In Progress': 2,
                };
                return (stageRank[a.stage] ?? 9) - (stageRank[b.stage] ?? 9);
            });
            setTopCompliance(gaps.slice(0, 5));

            setLastSynced(new Date());
        } catch (err: any) {
            setError(err.message || 'Failed to load project data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Initial-display sort: Red → Amber → Grey → Green. DynamicTable still
    // lets users re-sort by clicking any column header.
    const sortedProjects = useMemo(() => {
        const ragOrder: Record<string, number> = { Red: 0, Amber: 1, Grey: 2, Green: 3 };
        return [...projects].sort((a, b) => (ragOrder[a.rag] ?? 4) - (ragOrder[b.rag] ?? 4));
    }, [projects]);

    // Summary stats (based on filtered list to be context-aware)
    // Portfolio-wide totals — these summarise the whole estate and don't
    // depend on the table's internal search / filter selections. The table
    // shows whichever subset the user has filtered to; the KPI strip and
    // Top Risks / Top Compliance panels always report the full picture.
    const totals = useMemo(() => {
        const pCount = projects.length;
        const avgComp = pCount ? Math.round(projects.reduce((s, p) => s + (p.compPct || 0), 0) / pCount) : 0;

        let health: RAG = 'Green';
        const redPct = pCount ? (projects.filter(p => p.rag === 'Red').length / pCount) * 100 : 0;
        const amberPct = pCount ? (projects.filter(p => p.rag === 'Amber').length / pCount) * 100 : 0;

        if (redPct > 10) health = 'Red';
        else if (amberPct > 25 || redPct > 0) health = 'Amber';
        else if (pCount === 0) health = 'Grey';

        return {
            projects: pCount,
            red: projects.filter(p => p.rag === 'Red').length,
            amber: projects.filter(p => p.rag === 'Amber').length,
            green: projects.filter(p => p.rag === 'Green').length,
            pms: new Set(projects.map(p => p.userId)).size,
            riskHigh: projects.reduce((s, p) => s + (p.riskHigh || 0), 0),
            issueOpen: projects.reduce((s, p) => s + (p.issueOpen || 0), 0),
            avgComp,
            health,
        };
    }, [projects]);

    // ── DynamicTable column definitions ─────────────────────────────────────
    type ProjectRow = (typeof projects)[number];

    const projectColumns: ColumnDef<ProjectRow>[] = [
        {
            key: 'name',
            label: 'Project',
            sortable: true,
            render: (_v, p) => (
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-slate-100 rounded shrink-0">
                        <FolderKanban className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 leading-snug truncate">{p.name || 'Untitled project'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.type || 'Custom'}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'pmName',
            label: 'Project manager',
            sortable: true,
            render: (_v, p) => (
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                        {(p.pmName || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-700 truncate">{p.pmName || 'Unassigned'}</span>
                </div>
            ),
        },
        {
            key: 'rag',
            label: 'RAG',
            align: 'center',
            sortable: true,
            render: (_v, p) => (
                <span className={clsx(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border',
                    ragColors[p.rag as RAG] || ragColors.Grey,
                )}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', ragDot[p.rag as RAG] || ragDot.Grey)} />
                    {p.rag}
                </span>
            ),
        },
        {
            key: 'compPct',
            label: 'Compliance',
            sortable: true,
            render: (_v, p) => (
                <div className="min-w-[140px]">
                    <ProgressBar
                        pct={p.compPct || 0}
                        color={(p.compPct || 0) >= 75 ? 'green' : (p.compPct || 0) >= 40 ? 'indigo' : 'red'}
                    />
                </div>
            ),
        },
        {
            key: 'riskHigh',
            label: 'High risks',
            align: 'right',
            sortable: true,
            render: (_v, p) => (
                <div className="flex flex-col items-end">
                    <span className={clsx('text-sm font-medium tabular-nums', (p.riskHigh ?? 0) > 0 ? 'text-rose-600' : 'text-slate-700')}>
                        {p.riskHigh ?? 0}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">{p.riskOpen ?? 0} total open</span>
                </div>
            ),
        },
        {
            key: 'issueOpen',
            label: 'Open issues',
            align: 'right',
            sortable: true,
            render: (_v, p) => (
                <span className={clsx('text-sm font-semibold tabular-nums', (p.issueOpen ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400')}>
                    {p.issueOpen ?? 0}
                </span>
            ),
        },
    ];

    // DynamicTable filter dropdowns — drives the table's internal filter
    // state. The KPI strip + Top cards are portfolio-wide and unaffected.
    const projectFilters: FilterDef<ProjectRow>[] = [
        {
            key: 'programmeId',
            label: 'Programme',
            type: 'select',
            options: programmes.map((pg: any) => ({ value: pg.id, label: pg.name })),
        },
        {
            key: 'rag',
            label: 'RAG',
            type: 'select',
            options: [
                { value: 'Red', label: 'Red' },
                { value: 'Amber', label: 'Amber' },
                { value: 'Green', label: 'Green' },
                { value: 'Grey', label: 'Grey' },
            ],
        },
    ];

    const projectRowActions: RowAction<ProjectRow>[] = [
        {
            key: 'view-report',
            label: 'View report',
            icon: TrendingUp,
            onClick: (p) => {
                setActiveProject(p.id);
                navigate('/reporting/project');
            },
        },
    ];

    const handleExportPDF = async () => {
        const element = document.getElementById('programme-report');
        if (!element) return;
        
        try {
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Portfolio_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error('Failed to export PDF', error);
        }
    };

    return (
        <div id="programme-report" className="space-y-6 print:p-0">
            {/* ─── HEADER BAND ─── */}
            <section className="bg-slate-900 px-6 py-8 md:px-10 md:py-10 rounded-lg print:rounded-none print:break-inside-avoid">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-2.5">
                            <Layers className="w-6 h-6 text-indigo-300" /> Programme Risk &amp; Compliance
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Aggregate portfolio performance across {totals.projects} project{totals.projects === 1 ? '' : 's'}
                            {lastSynced && ` · last synced ${lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 print:hidden">
                        <button
                            onClick={handleExportPDF}
                            disabled={loading || projects.length === 0}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/15 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="w-4 h-4" /> Export PDF
                        </button>
                        {isAtLeastClientAdmin(userRole) && (
                            <button
                                onClick={() => { useStore.getState().setActiveProgramme(null); navigate('/programmes/new'); }}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> New programme
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* ─── KPI STRIP ─── */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 print:break-inside-avoid">
                <StatsCard
                    icon={HeartPulse}
                    title="Programme health"
                    value={loading ? '…' : totals.health}
                    description={
                        totals.health === 'Red' ? 'Action required' :
                        totals.health === 'Amber' ? 'Monitor closely' :
                        totals.health === 'Green' ? 'On track' : 'Awaiting data'
                    }
                    size="lg"
                    iconBgClassName={
                        totals.health === 'Red' ? 'bg-rose-50' :
                        totals.health === 'Amber' ? 'bg-amber-50' :
                        totals.health === 'Green' ? 'bg-emerald-50' : 'bg-slate-100'
                    }
                    iconClassName={
                        totals.health === 'Red' ? 'text-rose-600' :
                        totals.health === 'Amber' ? 'text-amber-600' :
                        totals.health === 'Green' ? 'text-emerald-600' : 'text-slate-500'
                    }
                />
                <StatsCard
                    icon={FolderKanban}
                    title="Live projects"
                    value={loading ? '…' : totals.projects}
                    description={`${totals.pms} active PM${totals.pms === 1 ? '' : 's'}`}
                    size="lg"
                    iconBgClassName="bg-indigo-50"
                    iconClassName="text-indigo-600"
                />
                <StatsCard
                    icon={Activity}
                    title="Avg compliance"
                    value={loading ? '…' : `${totals.avgComp}%`}
                    size="lg"
                    iconBgClassName="bg-emerald-50"
                    iconClassName="text-emerald-600"
                    progress
                    progressValue={totals.avgComp}
                    progressClassName="bg-emerald-500"
                    progressLabel="Portfolio mean"
                />
                <StatsCard
                    icon={AlertCircle}
                    title="High risks open"
                    value={loading ? '…' : totals.riskHigh}
                    description={`${totals.issueOpen} open issue${totals.issueOpen === 1 ? '' : 's'}`}
                    size="lg"
                    iconBgClassName="bg-rose-50"
                    iconClassName="text-rose-600"
                />
            </section>

            {/* ─── ERROR ─── */}
            {!loading && error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <div className="font-medium">{error}</div>
                </div>
            )}

            {/* ─── LOADING ─── */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-lg gap-3 min-h-[280px]">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-sm font-medium text-slate-700">Syncing portfolio data…</span>
                    <span className="text-xs text-slate-500">This usually takes a few seconds.</span>
                </div>
            )}

            {/* ─── TOP RISKS + COMPLIANCE GAPS ─── */}
            {!loading && !error && (topRisks.length > 0 || topCompliance.length > 0) && (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:break-inside-avoid">
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-rose-600" />
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Top portfolio risks</h3>
                                <p className="text-xs text-slate-500">Highest gross rating, open status only</p>
                            </div>
                        </div>
                        <ul className="divide-y divide-slate-200">
                            {topRisks.length > 0 ? topRisks.map((risk, i) => (
                                <li key={risk.id || i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                    <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{stripMarkdown(risk.title || risk.name || 'Unnamed risk')}</p>
                                        <p className="text-xs text-slate-500 truncate">{stripMarkdown(risk.description || risk.desc || 'No description')}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-semibold text-rose-600 tabular-nums">{risk.grossRating || 0}</div>
                                        <div className="text-xs text-slate-500">{risk.status || 'Open'}</div>
                                    </div>
                                </li>
                            )) : (
                                <li className="px-5 py-8 text-center text-sm text-slate-500">No significant risks identified.</li>
                            )}
                        </ul>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
                            <ShieldCheck className="w-5 h-5 text-amber-600" />
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Critical compliance gaps</h3>
                                <p className="text-xs text-slate-500">High-risk items not yet Live or Archived</p>
                            </div>
                        </div>
                        <ul className="divide-y divide-slate-200">
                            {topCompliance.length > 0 ? topCompliance.map((comp, i) => (
                                <li key={comp.id || i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                    <span className="w-6 h-6 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center justify-center shrink-0">!</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{stripMarkdown(comp.req || comp.title || comp.name || 'Unnamed requirement')}</p>
                                        <p className="text-xs text-slate-500 truncate">{stripMarkdown(comp.reg || comp.framework || comp.domain || 'General')}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-medium text-amber-700">{comp.stage || comp.status || 'Pending'}</div>
                                        <div className="text-xs text-slate-500">{comp.risk || 'High'} risk</div>
                                    </div>
                                </li>
                            )) : (
                                <li className="px-5 py-8 text-center text-sm text-slate-500">No critical compliance gaps detected.</li>
                            )}
                        </ul>
                    </div>
                </section>
            )}

            {/* ─── PROJECTS TABLE ─── */}
            {!loading && !error && (
                <section className="print:break-inside-avoid">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                            <FolderKanban className="w-5 h-5 text-indigo-600" /> Portfolio projects
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> {totals.red} Red</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> {totals.amber} Amber</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {totals.green} Green</span>
                        </div>
                    </div>
                    <DynamicTable<ProjectRow>
                        data={sortedProjects}
                        columns={projectColumns}
                        rowActions={projectRowActions}
                        filters={projectFilters}
                        searchable
                        searchPlaceholder="Search project, PM, or type…"
                        searchFields={['name', 'pmName', 'type']}
                        pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50] }}
                        export={{ csv: true, filename: `programme_report_${new Date().toISOString().slice(0, 10)}` }}
                        getRowId={(p) => p.id}
                        emptyState={{
                            title: projects.length === 0 ? 'No portfolio data' : 'No results',
                            description: projects.length === 0
                                ? 'Connect Project Managers to aggregate live governance data.'
                                : 'Adjust your search or filter criteria to view specific results.',
                            icon: FolderKanban,
                        }}
                        headerVariant="light"
                    />
                </section>
            )}

            {/* ─── PM BREAKDOWN ─── */}
            {!loading && !error && projects.length > 0 && (
                <section className="bg-white rounded-lg border border-slate-200 overflow-hidden print:break-inside-avoid">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-semibold text-slate-900">Resource performance &amp; oversight</h3>
                    </div>
                    <ul className="divide-y divide-slate-200">
                        {Array.from(new Set(projects.map(p => p.userId))).map(pmUid => {
                            const pmProjects = projects.filter(p => p.userId === pmUid);
                            const pmName = pmProjects[0]?.pmName || 'Portfolio lead';
                            const pmRed = pmProjects.filter(p => p.rag === 'Red').length;
                            const pmAmber = pmProjects.filter(p => p.rag === 'Amber').length;
                            const pmGreen = pmProjects.filter(p => p.rag === 'Green').length;
                            const avgComp = Math.round(pmProjects.reduce((s, p) => s + (p.compPct || 0), 0) / pmProjects.length);
                            return (
                                <li key={pmUid as string} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="flex items-center gap-3 md:w-1/4 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                                            {pmName[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 truncate">{pmName}</p>
                                            <p className="text-xs text-slate-500">Lead manager</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-xs font-medium text-slate-500">Average governance score</span>
                                            <span className="text-xs font-semibold text-indigo-600 tabular-nums">{avgComp}%</span>
                                        </div>
                                        <ProgressBar pct={avgComp} color={avgComp >= 75 ? 'green' : avgComp >= 40 ? 'indigo' : 'red'} />
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 md:justify-end md:min-w-[200px]">
                                        <div className="text-right pr-2 border-r border-slate-200">
                                            <div className="text-sm font-semibold text-slate-900 tabular-nums">{pmProjects.length}</div>
                                            <div className="text-xs text-slate-500">Project{pmProjects.length === 1 ? '' : 's'}</div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {pmRed > 0 && <span className="w-7 h-7 inline-flex items-center justify-center rounded bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200" title="Red RAG projects">{pmRed}</span>}
                                            {pmAmber > 0 && <span className="w-7 h-7 inline-flex items-center justify-center rounded bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200" title="Amber RAG projects">{pmAmber}</span>}
                                            {pmGreen > 0 && <span className="w-7 h-7 inline-flex items-center justify-center rounded bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200" title="Green RAG projects">{pmGreen}</span>}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </div>
    );
}

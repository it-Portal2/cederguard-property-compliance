import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock, BarChart, ChevronDown, ChevronUp, FolderKanban, Users, Download, Filter, Search, Layers, ShieldAlert, HeartPulse, ScanSearch, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router';
import { stripMarkdown } from '../lib/utils';
import { isAtLeastClientAdmin } from '../lib/roles';

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
            <span className="text-xs font-bold text-slate-600 w-8 text-right">{pct}%</span>
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
    const [search, setSearch] = useState('');
    const [ragFilter, setRagFilter] = useState<RAG | 'All'>('All');
    const [programmeFilter, setProgrammeFilter] = useState('All');
    const [sortBy, setSortBy] = useState<'name' | 'rag' | 'compPct' | 'riskHigh'>('rag');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
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
            
            const risks = Array.isArray(risksRes) ? risksRes : [];
            const sortedRisks = [...risks].sort((a, b) => (b.grossRating || 0) - (a.grossRating || 0));
            setTopRisks(sortedRisks.slice(0, 5));

            const compliance = Array.isArray(compRes) ? compRes : [];
            const gaps = compliance.filter(c => c.status !== 'Complete' && c.status !== 'At Risk');
            setTopCompliance(gaps.slice(0, 5));

            setLastSynced(new Date());
        } catch (err: any) {
            setError(err.message || 'Failed to load project data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Filter + sort
    const filtered = useMemo(() => {
        let list = [...projects];
        if (ragFilter !== 'All') list = list.filter(p => p.rag === ragFilter);
        if (programmeFilter !== 'All') list = list.filter(p => p.programmeId === programmeFilter);
        if (search) list = list.filter(p =>
            (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.pmName || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.type || '').toLowerCase().includes(search.toLowerCase())
        );
        list.sort((a, b) => {
            const ragOrder: Record<string, number> = { Red: 0, Amber: 1, Grey: 2, Green: 3 };
            let cmp = 0;
            if (sortBy === 'rag') cmp = (ragOrder[a.rag] ?? 4) - (ragOrder[b.rag] ?? 4);
            else if (sortBy === 'compPct') cmp = (a.compPct || 0) - (b.compPct || 0);
            else if (sortBy === 'riskHigh') cmp = (a.riskHigh || 0) - (b.riskHigh || 0);
            else cmp = (a.name || '').localeCompare(b.name || '');
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [projects, ragFilter, programmeFilter, search, sortBy, sortDir]);

    // Summary stats (based on filtered list to be context-aware)
    const totals = useMemo(() => {
        const pCount = filtered.length;
        const avgComp = pCount ? Math.round(filtered.reduce((s, p) => s + (p.compPct || 0), 0) / pCount) : 0;

        let health: RAG = 'Green';
        const redPct = pCount ? (filtered.filter(p => p.rag === 'Red').length / pCount) * 100 : 0;
        const amberPct = pCount ? (filtered.filter(p => p.rag === 'Amber').length / pCount) * 100 : 0;

        if (redPct > 10) health = 'Red';
        else if (amberPct > 25 || redPct > 0) health = 'Amber';
        else if (pCount === 0) health = 'Grey';

        return {
            projects: pCount,
            red: filtered.filter(p => p.rag === 'Red').length,
            amber: filtered.filter(p => p.rag === 'Amber').length,
            green: filtered.filter(p => p.rag === 'Green').length,
            pms: new Set(filtered.map(p => p.userId)).size,
            riskHigh: filtered.reduce((s, p) => s + (p.riskHigh || 0), 0),
            issueOpen: filtered.reduce((s, p) => s + (p.issueOpen || 0), 0),
            avgComp,
            health
        };
    }, [filtered]);

    const handleSort = (col: typeof sortBy) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('desc'); }
    };

    const SortIcon = ({ col }: { col: typeof sortBy }) => sortBy === col
        ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline ml-0.5" /> : <ChevronUp className="w-3 h-3 inline ml-0.5" />)
        : null;

    const exportCSV = () => {
        const headers = ['Project', 'Type', 'Project Manager', 'RAG', 'Compliance %', 'Open Risks', 'High Risks', 'Escalated Risks', 'Open Issues', 'Last Activity'];
        const rows = filtered.map(p => [
            p.name || 'Untitled Project', p.type || '', p.pmName || '', p.rag,
            p.compPct, p.riskOpen, p.riskHigh, p.riskEscalated, p.issueOpen,
            p.lastActivity ? new Date(p.lastActivity).toLocaleDateString('en-GB') : 'No activity'
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `programme_report_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

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
            {/* PREMIUM STRATEGIC HEADER */}
            <div className="bg-[#111827] p-8 md:p-12 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-lg relative overflow-hidden shadow-2xl">
                {/* Abstract background element */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -mr-48 -mt-48 rounded-full pointer-events-none" />
                
                <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20">
                            <Layers className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-none">Programme Risk & Compliance: Strategic Dashboard</h1>
                            <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-[10px] mt-2">Aggregate Portfolio Performance · Confidential Insight</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button 
                        onClick={fetchData} 
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-3 bg-white/5 text-white border border-white/10 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all backdrop-blur-md disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync
                    </button>
                    <button 
                        onClick={exportCSV} 
                        disabled={loading || filtered.length === 0}
                        className="flex items-center gap-2 px-5 py-3 bg-white/5 text-white border border-white/10 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" /> CSV
                    </button>
                    <button 
                        onClick={handleExportPDF} 
                        disabled={loading || filtered.length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20"
                    >
                        <Download className="w-4 h-4" /> Export PDF
                    </button>
                    {isAtLeastClientAdmin(userRole) && (
                        <button
                            onClick={() => { useStore.getState().setActiveProgramme(null); navigate('/programmes/new'); }}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 border border-indigo-100 rounded-lg font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            New Programme
                        </button>
                    )}
                </div>
            </div>

            {/* Summary stats - 8 Tiles Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* 1. Health State */}
                <div className={clsx(
                    "border rounded-lg p-4 text-center transition-all shadow-sm",
                    totals.health === 'Green' ? "bg-emerald-50 border-emerald-100" :
                    totals.health === 'Amber' ? "bg-amber-50 border-amber-100" :
                    totals.health === 'Red' ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-200"
                )}>
                    <div className={clsx(
                        "text-2xl font-black uppercase tracking-tighter italic leading-none truncate",
                        totals.health === 'Green' ? "text-emerald-600" :
                        totals.health === 'Amber' ? "text-amber-600" :
                        totals.health === 'Red' ? "text-rose-600" : "text-slate-400"
                    )}>
                        {totals.health}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Health State</div>
                </div>

                {/* 2. Live Projects */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-black text-slate-800 leading-none">{loading ? '—' : totals.projects}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Live Projects</div>
                </div>

                {/* 3. PMs */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-black text-indigo-600 leading-none">{loading ? '—' : totals.pms}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Active PMs</div>
                </div>

                {/* 4. Avg Comp */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-black text-indigo-700 leading-none">{loading ? '—' : `${totals.avgComp}%`}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Avg Compliance</div>
                </div>

                {/* 5. Critical */}
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-black text-rose-600 leading-none">{loading ? '—' : totals.red}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Critical (Red)</div>
                </div>

                {/* 6. Warning */}
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-black text-amber-600 leading-none">{loading ? '—' : totals.amber}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Warning (Amber)</div>
                </div>

                {/* 7. High Risks */}
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 text-center shadow-sm">
                    <div className="text-2xl font-black text-rose-700 leading-none">{loading ? '—' : totals.riskHigh}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">High Risks</div>
                </div>

                {/* 8. Open Issues */}
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-center shadow-lg">
                    <div className="text-2xl font-black text-white leading-none">{loading ? '—' : totals.issueOpen}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2 text-white/50">Open Issues</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 mr-2">
                    <Filter className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                        placeholder="Search specific project, PM, or type…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <select
                        className="bg-transparent text-[11px] font-black text-slate-600 focus:outline-none cursor-pointer uppercase tracking-tighter"
                        value={programmeFilter}
                        onChange={e => setProgrammeFilter(e.target.value)}
                    >
                        <option value="All">All Programmes</option>
                        {programmes.map(pg => (
                            <option key={pg.id} value={pg.id}>{pg.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['All', 'Red', 'Amber', 'Green'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRagFilter(r)}
                            className={clsx(
                                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 border",
                                ragFilter === r 
                                    ? "bg-white shadow-sm text-slate-800 border-slate-200 scale-[1.02]" 
                                    : "text-slate-500 border-transparent hover:bg-white hover:text-indigo-600 hover:border-slate-100 hover:shadow-sm active:scale-95"
                            )}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading / Error */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-lg shadow-sm">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Synchronizing data...</span>
                </div>
            )}
            {!loading && error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <div className="font-semibold">{error}</div>
                </div>
            )}

            {/* Top Risks and Compliance Gaps */}
            {!loading && !error && (topRisks.length > 0 || topCompliance.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
                    {/* Top Portfolio Risks */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/30">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Top Portfolio Risks</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Highest gross rating</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-0 divide-y divide-slate-100 flex-1 flex flex-col">
                            {topRisks.length > 0 ? topRisks.map((risk, i) => (
                                <div key={risk.id || i} className="p-4 hover:bg-slate-50 transition-colors flex gap-4 items-center">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">#{i + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-slate-800 truncate">{stripMarkdown(risk.title || risk.name || 'Unnamed Risk')}</div>
                                        <div className="text-xs text-slate-500 truncate mt-0.5">{stripMarkdown(risk.description || 'No description provided')}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-black text-rose-600">Rating: {risk.grossRating || 0}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{risk.status || 'Open'}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-8 text-center text-slate-500 text-sm m-auto">No significant risks identified.</div>
                            )}
                        </div>
                    </div>

                    {/* Critical Compliance Gaps */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/30">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Critical Compliance Gaps</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Outstanding items requiring attention</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-0 divide-y divide-slate-100 flex-1 flex flex-col">
                            {topCompliance.length > 0 ? topCompliance.map((comp, i) => (
                                <div key={comp.id || i} className="p-4 hover:bg-slate-50 transition-colors flex gap-4 items-center">
                                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-xs font-bold text-amber-600 border border-amber-100 shrink-0">!</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-slate-800 truncate">{stripMarkdown(comp.title || comp.name || 'Unnamed Requirement')}</div>
                                        <div className="text-xs text-slate-500 truncate mt-0.5">{stripMarkdown(comp.framework || 'General Compliance')}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-bold text-amber-600">{comp.status || 'Pending'}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gap Identified</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-8 text-center text-slate-500 text-sm m-auto">No critical compliance gaps detected.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            {!loading && !error && filtered.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-700 uppercase tracking-widest">Project Control <SortIcon col="name" /></button>
                                </th>
                                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Assigned PM</th>
                                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <button onClick={() => handleSort('rag')} className="flex items-center gap-1 hover:text-slate-700 uppercase tracking-widest">RAG State <SortIcon col="rag" /></button>
                                </th>
                                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <button onClick={() => handleSort('compPct')} className="flex items-center gap-1 hover:text-slate-700 uppercase tracking-widest">Compliance % <SortIcon col="compPct" /></button>
                                </th>
                                <th className="text-right px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">Open Issues</th>
                                <th className="text-right px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden xl:table-cell">Last Sync</th>
                                <th className="text-right px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-all border-l-2 border-l-transparent hover:border-l-indigo-500">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-slate-50 rounded">
                                                <FolderKanban className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm leading-tight">{p.name || 'Untitled Project'}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{p.type || 'Custom Type'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-black italic border border-white shadow-sm">
                                                {(p.pmName || '?')[0].toUpperCase()}
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{p.pmName || 'System'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black uppercase border shadow-sm ${ragColors[p.rag as RAG] || ragColors.Grey}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${ragDot[p.rag as RAG] || ragDot.Grey}`} />
                                            {p.rag}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 min-w-[140px]">
                                        <ProgressBar pct={p.compPct || 0} color={p.compPct >= 75 ? 'green' : p.compPct >= 40 ? 'indigo' : 'red'} />
                                    </td>
                                    <td className="px-4 py-4 text-right hidden lg:table-cell">
                                        <div className="flex flex-col items-end">
                                            <span className={`font-black ${p.riskHigh > 0 ? 'text-red-500' : 'text-slate-700'}`}>{p.riskHigh ?? 0} Critical</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{p.riskOpen ?? 0} Total Active</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right hidden lg:table-cell">
                                        <span className={`text-xs font-black ${p.issueOpen > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                            {p.issueOpen ?? 0} ACTIVE
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right hidden xl:table-cell">
                                        <div className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1 uppercase tracking-tighter">
                                            <Clock className="w-3 h-3" />
                                            {p.lastActivity ? new Date(p.lastActivity).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button 
                                            onClick={() => {
                                                setActiveProject(p.id);
                                                navigate('/reporting/project');
                                            }}
                                            className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded hover:bg-indigo-100 transition-all border border-indigo-100/50"
                                        >
                                            View Report
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                        <div>Showing {filtered.length} Projects in Lifecycle</div>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" /> CRITICAL: {totals.red}</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" /> WARNING: {totals.amber}</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> COMPLIANT: {totals.green}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && filtered.length === 0 && (
                <div className="bg-white border border-slate-100 rounded-lg py-20 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                        <FolderKanban className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter">
                        {projects.length === 0 ? 'No Portfolio Data' : 'No Results Found'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-2 max-w-xs font-medium">
                        {projects.length === 0
                            ? 'Connect Project Managers to aggregate live governance data.'
                            : 'Adjust your search parameters or filter criteria to view specific results.'}
                    </p>
                </div>
            )}

            {/* PM breakdown section */}
            {!loading && !error && projects.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span className="font-black text-slate-800 text-xs uppercase tracking-widest">Resource Performance & Oversight</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {Array.from(new Set(projects.map(p => p.userId))).map(pmUid => {
                            const pmProjects = projects.filter(p => p.userId === pmUid);
                            const pmName = pmProjects[0]?.pmName || 'Portfolio Lead';
                            const pmRed = pmProjects.filter(p => p.rag === 'Red').length;
                            const pmAmber = pmProjects.filter(p => p.rag === 'Amber').length;
                            const pmGreen = pmProjects.filter(p => p.rag === 'Green').length;
                            const avgComp = Math.round(pmProjects.reduce((s, p) => s + (p.compPct || 0), 0) / pmProjects.length);
                            return (
                                <div key={pmUid as string} className="px-5 py-5 flex flex-col md:flex-row md:items-center gap-6 transition-colors hover:bg-slate-50/50">
                                    <div className="flex items-center gap-4 md:w-1/4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-black italic shadow-inner">
                                            {pmName[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-slate-900 text-sm truncate uppercase tracking-tighter">{pmName}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Manager</div>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average Governance Score</span>
                                            <span className="text-[10px] font-black text-indigo-600">{avgComp}%</span>
                                        </div>
                                        <ProgressBar pct={avgComp} color={avgComp >= 75 ? 'green' : avgComp >= 40 ? 'indigo' : 'red'} />
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 md:justify-end md:min-w-[200px]">
                                        <div className="text-right mr-2">
                                            <div className="text-xs font-black text-slate-800">{pmProjects.length}</div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Projects</div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {pmRed > 0 && <span className="w-6 h-6 flex items-center justify-center rounded bg-rose-50 text-rose-600 text-[10px] font-black border border-rose-100 shadow-sm" title="Red RAG projects">{pmRed}</span>}
                                            {pmAmber > 0 && <span className="w-6 h-6 flex items-center justify-center rounded bg-amber-50 text-amber-600 text-[10px] font-black border border-amber-100 shadow-sm" title="Amber RAG projects">{pmAmber}</span>}
                                            {pmGreen > 0 && <span className="w-6 h-6 flex items-center justify-center rounded bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100 shadow-sm" title="Green RAG projects">{pmGreen}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

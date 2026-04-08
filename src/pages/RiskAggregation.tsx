import { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  Shield, 
  BarChart, 
  AlertTriangle, 
  PoundSterling,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { stripMarkdown } from '../lib/utils';

function fGBP(v: number) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export function RiskAggregation() {
  const { risks, projects, activeProjectId, activeProgrammeId, programmes } = useStore();
  const [filter, setFilter] = useState({ project: 'All Projects', status: '', category: '', search: '' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const RISK_STATUSES = ["Open", "Closed", "Managed", "Mitigated", "Tolerated"];
  const CATEGORIES = ["Finance / Financial", "Building Safety", "Health & Safety", "Procurement", "Planning", "Environmental", "Legal / Regulatory", "Reputational", "Technical", "Operational", "Strategic"];

  const safeRisks = Array.isArray(risks) ? risks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const filtered = safeRisks.filter(r => {
    // Context filtering
    if (activeProjectId) {
      if (r.projectId !== activeProjectId) return false;
    } else if (activeProgrammeId) {
      if (r.programmeId !== activeProgrammeId) {
          const proj = safeProjects.find(p => p.id === r.projectId);
          if (!proj || proj.programmeId !== activeProgrammeId) return false;
      }
    }

    // UI Filters
    if (filter.project !== 'All Projects') {
      if (r.projectId !== filter.project && r.project !== filter.project) return false;
    }
    if (filter.status && r.status !== filter.status) return false;
    if (filter.category && r.category !== filter.category) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Aggregation Logic for Project Summary
  const projectSummaries = safeProjects.filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId).map(p => {
    const pRisks = safeRisks.filter(r => r.projectId === p.id);
    const open = pRisks.filter(r => r.status === 'Open').length;
    const high = pRisks.filter(r => (r.residualRating || 0) >= 12).length;
    const escalated = pRisks.filter(r => r.escalated).length;
    const residualALE = pRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
    const openRate = pRisks.length > 0 ? (open / pRisks.length) * 100 : 0;

    return {
      id: p.id,
      name: p.name,
      total: pRisks.length,
      open,
      high,
      escalated,
      residualALE,
      openRate
    };
  });

  // Aggregation Logic for Category Summary
  const categorySummaries = CATEGORIES.map(cat => {
    const cRisks = filtered.filter(r => r.category === cat);
    const residualALE = cRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
    if (cRisks.length === 0) return null;
    return {
      name: cat,
      count: cRisks.length,
      residualALE
    };
  }).filter(Boolean);

  return (
    <div className="max-w-full px-6 space-y-10 pb-20 bg-[#fafbfc]">
      {/* ─── HEADER (Match 15.png) ─── */}
      <div className="pt-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight flex items-center gap-3">
            Aggregation — {filter.project === 'All Projects' ? (activeProgrammeId ? 'Programme Portfolio' : 'All Projects') : safeProjects.find(p=>p.id===filter.project)?.name}
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">Consolidated view of all risks across the programme</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatCardSmall label="Total Risks" value={filtered.length} color="indigo" />
          <StatCardSmall label="Open" value={filtered.filter(r => r.status === 'Open').length} color="amber" />
          <StatCardSmall label="High/Severe" value={filtered.filter(r => (r.residualRating || 0) >= 12).length} color="rose" />
          <StatCardSmall label="Residual ALE" value={fGBP(filtered.reduce((s, r) => s + (r.residualALE || 0), 0))} color="emerald" />
        </div>
      </div>

      {/* ─── SUMMARY CARDS (Match 15.png) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Summary by Project */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-white">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Summary by Project</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-[#0f172a] text-white sticky top-0 z-10">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Project</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Total</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Open</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">High</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Escalated</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Residual ALE</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Open Rate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                        {projectSummaries.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3.5">
                                    <button 
                                        onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                                        className={clsx(
                                            "text-[11px] font-black text-slate-700 text-left transition-all",
                                            expandedRow !== p.id && "truncate block max-w-[150px]"
                                        )}
                                        title={p.name}
                                    >
                                        {p.name}
                                    </button>
                                </td>
                                <td className="px-6 py-3.5 text-right font-black text-slate-900 text-[11px]">{p.total}</td>
                                <td className="px-6 py-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-black border border-amber-200">{p.open}</span>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[10px] font-black border border-rose-200">{p.high}</span>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                    {p.escalated > 0 ? (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-black border border-red-200">!! {p.escalated}</span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-3.5 text-right font-black text-slate-900 text-[11px] tabular-nums">{fGBP(p.residualALE)}</td>
                                <td className="px-6 py-3.5 w-32">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${p.openRate}%` }} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Summary by Category */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-white">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Summary by Category</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-[#0f172a] text-white sticky top-0 z-10">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Category</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Count</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Residual ALE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                        {categorySummaries.map((c: any) => (
                            <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className="text-[11px] font-black text-slate-700">{c.name}</span>
                                </td>
                                <td className="px-6 py-4 text-right font-black text-slate-900 text-[11px]">{c.count}</td>
                                <td className="px-6 py-4 text-right font-black text-slate-900 text-[11px] tabular-nums">{fGBP(c.residualALE)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH (Match 15.png) ─── */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        <h2 className="text-xs font-black text-[#111827] uppercase tracking-[0.2em]">All Aggregated Risks</h2>
        <div className="flex flex-wrap items-center gap-3">
            <select 
                value={filter.project} 
                onChange={e => setFilter({...filter, project: e.target.value})}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-600 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
            >
                <option value="All Projects">All Projects</option>
                {safeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select 
                value={filter.status} 
                onChange={e => setFilter({...filter, status: e.target.value})}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-600 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
            >
                <option value="">All Status</option>
                {RISK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
                value={filter.category} 
                onChange={e => setFilter({...filter, category: e.target.value})}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-600 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
            >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search..." 
                    value={filter.search}
                    onChange={e => setFilter({...filter, search: e.target.value})}
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none w-48"
                />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">{filtered.length} RISKS</span>
        </div>
      </div>

      {/* ─── MAIN TABLE (Match 15.png) ─── */}
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#0f172a] text-white border-b border-indigo-500/30 sticky top-0 z-10">
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">ID</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Project</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Date Added</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Workstream</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Risk Description & Impact</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">KRI & Owner</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Inherent (PxI)</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Residual (PxI)</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Risk Value</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Status</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Escalated</th>
              <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center w-[100px] whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 italic">
            {filtered.map(r => {
                const reduction = r.grossALE && r.grossALE > 0 ? Math.round(((r.grossALE - r.residualALE) / r.grossALE) * 100) : 0;
                return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="text-[11px] font-black text-indigo-600 tracking-tighter">#{r.id}</span>
                        </td>
                        <td className="px-4 py-4">
                            {(() => {
                                const proj = safeProjects.find(p => p.id === r.projectId);
                                const displayName = proj?.name || r.project || r.projectId || '—';
                                return (
                                    <button 
                                        onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                                        className={clsx(
                                            "text-[11px] font-black text-slate-700 text-left transition-all",
                                            expandedRow !== r.id && "truncate block max-w-[150px]"
                                        )}
                                        title={displayName}
                                    >
                                        {displayName}
                                    </button>
                                );
                            })()}
                        </td>
                        <td className="px-4 py-4">
                            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{r.dateAdded || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-4">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-800">{r.workstream || 'General'}</span>
                            </div>
                        </td>
                        <td className="px-4 py-4">
                            <div className="flex flex-col gap-1 max-w-[250px]">
                                <span className="text-[11px] font-black text-slate-800 line-clamp-2">{stripMarkdown(r.title)}</span>
                                {r.desc && <span className="text-[10px] text-slate-500 line-clamp-2">{stripMarkdown(r.desc)}</span>}
                            </div>
                        </td>
                        <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block w-max">{r.kri || 'No KRI'}</span>
                                <span className="text-[10px] text-slate-600">{r.owner || 'Unassigned'}</span>
                            </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#3d1111] text-white text-[10px] font-black">
                                {r.grossRating}
                            </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#bf3b3b] text-white text-[10px] font-black">
                                {r.residualRating}
                            </div>
                        </td>
                        <td className="px-4 py-4 text-right font-black text-slate-900 text-[11px] tabular-nums">
                            {fGBP(r.residualALE)}
                        </td>
                        <td className="px-4 py-4 text-center">
                            <span className={clsx(
                                "px-2 py-0.5 rounded text-[9px] font-black uppercase border",
                                r.status === 'Open' ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-amber-50 text-amber-600 border-amber-200"
                            )}>
                                {r.status}
                            </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                            {r.escalated ? (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-black border border-rose-200 italic">! ESC</span>
                            ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2 opacity-10 group-hover:opacity-100 transition-opacity">
                                {!r.convertedToIssue && r.status !== 'Closed' && (
                                    <button onClick={() => {
                                        if (window.confirm(`Convert risk ${r.id} to an issue? This will close the risk.`)) {
                                            useStore.getState().convertToIssue(r.id);
                                        }
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-white text-amber-500 border border-amber-200 rounded-lg hover:bg-amber-50 transition-all shadow-sm" title="Move to Issue">
                                        <AlertTriangle className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-24 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-slate-200" />
            </div>
            <div>
                <h3 className="font-black text-slate-900">No matching risks found</h3>
                <p className="text-xs text-slate-400 font-medium italic">Try broadening your search criteria.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCardSmall({ label, value, color }: { label: string, value: string | number, color: string }) {
  const bgColors: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-100',
    amber: 'bg-amber-50 border-amber-100',
    rose: 'bg-rose-50 border-rose-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };
  const textColors: Record<string, string> = {
    indigo: 'text-indigo-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    emerald: 'text-emerald-700',
  };

  return (
    <div className={clsx('px-4 py-2 rounded-xl border shadow-sm flex flex-col min-w-[120px]', bgColors[color] || 'bg-white border-slate-200')}>
      <div className={clsx('text-lg font-black leading-tight', textColors[color] || 'text-slate-900')}>{value}</div>
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    </div>
  );
}

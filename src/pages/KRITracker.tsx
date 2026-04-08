import { useStore } from '../store/useStore';
import { BarChart, Radar, AlertTriangle, CheckCircle2, Info, ShieldCheck, TrendingUp, Layers, ArrowUpRight, Clock, Users, PoundSterling, TrendingDown, Target, Plus, Edit2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useMemo } from 'react';
import { KRIModal } from '../components/KRIModal';
import { type KRI } from '../store/useStore';
import { isAtLeastPM, isAtLeastClientAdmin } from '../lib/roles';
import { KRI_METADATA } from '../data/riskData';

export function KRITracker() {
    const { risks, projects, activeProgrammeId, activeProjectId, kris, addKRI, updateKRI, deleteKRI, user } = useStore();
    const userRole = user?.role || (user as any)?.profile?.role;
    const canModify = isAtLeastPM(userRole);
    const canDelete = isAtLeastClientAdmin(userRole);

    const [hoveredKri, setHoveredKri] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedKri, setSelectedKri] = useState<KRI | null>(null);

    const safeRisks = Array.isArray(risks) ? risks : [];
    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeKris = Array.isArray(kris) ? kris : [];

    const filteredRisks = safeRisks.filter(r => {
        if (activeProjectId) return r.projectId === activeProjectId;
        if (activeProgrammeId) {
            if (r.programmeId === activeProgrammeId) return true;
            const proj = safeProjects.find(p => p.id === r.projectId);
            return proj && proj.programmeId === activeProgrammeId;
        }
        return true;
    });

    const getKRIStats = (kri: KRI) => {
        const kriRisks = filteredRisks.filter(r => r.kri === kri.name);
        const total = kriRisks.length || (kri.totalRisks || 0);
        const highRisks = kriRisks.filter(r => (r.residualRating || 0) >= 12).length || (kri.highRisks || 0);
        
        // New Metrics
        const now = new Date();
        const overdueRisks = kriRisks.filter(r => r.status === 'Open' && r.dueDate && new Date(r.dueDate) < now).length || (kri.overdue || 0);
        const overduePct = total > 0 ? (kriRisks.length > 0 ? Math.round((overdueRisks / total) * 100) : (kri.overduePct || 0)) : 0;
        
        const totalAge = kriRisks.reduce((acc, r) => {
            const added = new Date(r.dateAdded || r.lastReviewDate || now);
            const age = Math.max(0, Math.floor((now.getTime() - added.getTime()) / (1000 * 60 * 60 * 24)));
            return acc + age;
        }, 0);
        const avgAge = kriRisks.length > 0 ? Math.round(totalAge / kriRisks.length) : (kri.avgRiskAge || 0);
        
        const uniqueProjects = new Set(kriRisks.map(r => r.projectId).filter(Boolean)).size;
        const projectsInProg = safeProjects.filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId).length;
        const projectPct = projectsInProg > 0 ? (kriRisks.length > 0 ? Math.round((uniqueProjects / projectsInProg) * 100) : (kri.projectsPct || 0)) : 0;
        
        const totalResidualALE = kriRisks.reduce((s, r) => s + (r.residualALE || 0), 0) || (kri.residualExposure || 0);
        const totalGrossALE = kriRisks.reduce((s, r) => s + (r.grossALE || 0), 0);
        const reductionPct = totalGrossALE > 0 ? Math.round(((totalGrossALE - totalResidualALE) / totalGrossALE) * 100) : (kri.riskReductionPct || 0);
        
        const escalationCount = kriRisks.filter(r => r.escalated).length;
        
        // Status Logic using Metadata
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
                    if (cleanStr.toLowerCase().endsWith('m')) num *= 1000000;
                    else if (cleanStr.toLowerCase().endsWith('k')) num *= 1000;
                    return num;
                };

                const clean = threshold.trim();
                if (clean.startsWith('<=')) return value <= parseUnitValue(clean.slice(2));
                if (clean.startsWith('>=')) return value >= parseUnitValue(clean.slice(2));
                if (clean.startsWith('<')) return value < parseUnitValue(clean.slice(1));
                if (clean.startsWith('>')) return value > parseUnitValue(clean.slice(1));
                if (clean.includes('-')) {
                    const [minStr, maxStr] = clean.split('-').map(s => s.trim());
                    const min = parseUnitValue(minStr);
                    const max = parseUnitValue(maxStr);
                    return value >= min && value <= max;
                }
                const fallback = parseUnitValue(clean);
                return !isNaN(fallback) && Math.abs(value - fallback) < 0.1;
            };

            if (parseAndCompare(meta.green, val)) displayStatus = 'Green';
            else if (parseAndCompare(meta.amber, val)) displayStatus = 'Yellow';
            else displayStatus = 'Red';
        }

        // Global override for critical issues
        const programmeEscalations = kriRisks.filter(r => r.isProgrammeLevel || (r.escalated && activeProgrammeId)).length;
        if (programmeEscalations > 1 || overduePct > 50) displayStatus = 'Red';

        return {
            total,
            high: highRisks,
            overdue: overdueRisks,
            overduePct,
            avgAge,
            projectPct,
            residualALE: totalResidualALE,
            reductionPct,
            status: displayStatus,
            escalation: escalationCount,
            programmeEscalations,
            owner: kri.owner || 'Lead Auditor'
        };
    };

    const stats = useMemo(() => {
        const items = safeKris.map(kri => ({ ...kri, stats: getKRIStats(kri) }));
        const redCount = items.filter(i => i.stats.status === 'Red').length;
        const amberCount = items.filter(i => i.stats.status === 'Yellow').length;
        
        // Global Metrics for KPI Cards
        const totalHighRisks = filteredRisks.filter(r => (r.residualRating || 0) >= 12).length;
        const now = new Date();
        const overdueRisks = filteredRisks.filter(r => r.status === 'Open' && r.dueDate && new Date(r.dueDate) < now);
        
        const totalDelay = overdueRisks.reduce((acc, r) => {
            const due = new Date(r.dueDate!);
            const delay = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            return acc + delay;
        }, 0);
        const avgDelay = overdueRisks.length > 0 ? (totalDelay / overdueRisks.length).toFixed(1) : '0.0';

        return {
            items,
            redCount,
            amberCount,
            totalRisks: filteredRisks.length,
            totalHighRisks,
            avgDelay
        };
    }, [filteredRisks, projects, activeProgrammeId, kris]);

    const handleAdd = () => {
        setSelectedKri(null);
        setIsModalOpen(true);
    };

    const handleEdit = (kri: KRI) => {
        setSelectedKri(kri);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this KRI?')) {
            deleteKRI(id);
        }
    };

    const handleSave = (data: Partial<KRI>) => {
        if (selectedKri) {
            updateKRI(selectedKri.id, data);
        } else {
            addKRI({
                ...data,
                id: `KRI-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            } as KRI);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="max-w-full px-8 space-y-12 pb-20 mt-4">
            {/* ─── PREMIUM HEADER ─── */}
            <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-200/50 flex items-center justify-center">
                            <BarChart className="w-8 h-8" />
                        </div>
                        <h1 className="text-4xl font-black text-[#111827] tracking-tight uppercase leading-none">KRI Risk Tracker</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-12 bg-indigo-600 rounded-full" />
                        <p className="text-[12px] text-slate-400 font-bold uppercase tracking-[0.3em] italic">Full Diagnostic Indicators</p>
                    </div>
                </div>
                
                {canModify && (
                    <div className="flex gap-4">
                        <button 
                            onClick={handleAdd}
                            className="flex items-center gap-3 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                        >
                            <Plus className="w-4 h-4" /> Add KRI
                        </button>
                        <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            {safeProjects.length} Active Workstreams
                            </span>
                        </div>
                    </div>
                )}
            </div>
            {/* ─── PREMIUM KPI CARDS ─── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Portfolio Risks', value: stats.totalRisks, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: 'Critical Density' },
                    { label: 'High Priority', value: stats.totalHighRisks, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'Immediate Action' },
                    { label: 'Avg KRI Delay', value: `${stats.avgDelay}d`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Overdue Mean' },
                    { label: 'Aggregation', value: stats.items.length, icon: Radar, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Active Monitoring' }
                ].map((card, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 group hover:scale-[1.02] transition-all duration-500 relative overflow-hidden">
                        <div className={clsx("absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 group-hover:opacity-10 transition-opacity", card.bg)} />
                        <div className="flex justify-between items-start relative z-10">
                            <div className={clsx("p-4 rounded-3xl", card.bg, card.color)}>
                                <card.icon className="w-6 h-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{card.label}</p>
                                <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{card.value}</p>
                            </div>
                        </div>
                        <div className="mt-6 flex items-center justify-between relative z-10">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider italic">{card.trend}</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── KRI PERFORMANCE TABLE (12 COLUMNS) ─── */}
            <div className="bg-white border border-slate-200 rounded-[3rem] shadow-2xl shadow-slate-200/30 overflow-hidden relative overflow-x-auto">
                <table className="w-full text-left min-w-[1400px]">
                    <thead>
                        <tr className="bg-[#0f172a] text-white border-b-2 border-indigo-500/30 sticky top-0 z-10">
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">KRI</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Owner</th>
                            <th className="px-4 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">Total Risks</th>
                            <th className="px-4 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">High Risks</th>
                            <th className="px-4 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">Overdue</th>
                            <th className="px-4 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">% Overdue</th>
                            <th className="px-4 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">Avg Age (d)</th>
                            <th className="px-4 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">% Projects</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-right whitespace-nowrap">Exp (£)</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">Reduction %</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">Status</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">Escalation</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-center w-[120px] whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                        {stats.items.map((kri) => {
                            const isHovered = hoveredKri === kri.name;
                            const s = kri.stats;

                            return (
                                <tr 
                                    key={kri.id} 
                                    className={clsx(
                                        "group transition-all duration-300",
                                        isHovered ? "bg-indigo-50/50" : "hover:bg-slate-50/20"
                                    )}
                                    onMouseEnter={() => setHoveredKri(kri.name)}
                                    onMouseLeave={() => setHoveredKri(null)}
                                >
                                    <td className="px-6 py-6 min-w-[280px]">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-2 h-2 rounded-full",
                                                s.status === 'Red' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : 
                                                (s.status === 'Yellow' || s.status === 'Amber') ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                                                "bg-emerald-500"
                                            )} />
                                            <span className="text-xs font-black text-slate-800 whitespace-nowrap uppercase">{kri.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black italic shadow-sm">
                                                {s.owner[0]}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase">{s.owner}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 text-center font-black text-slate-900 text-xs tabular-nums">{s.total}</td>
                                    <td className="px-4 py-6 text-center text-xs font-black text-rose-500 tabular-nums">{s.high}</td>
                                    <td className="px-4 py-6 text-center text-xs font-black text-slate-900 tabular-nums">{s.overdue}</td>
                                    <td className="px-4 py-6 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className={clsx(
                                                "text-[10px] font-black px-2 py-0.5 rounded",
                                                s.overduePct > 30 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"
                                            )}>{s.overduePct}%</span>
                                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={clsx("h-full transition-all duration-1000 shadow-[0_0_4px_rgba(0,0,0,0.1)]", s.overduePct > 30 ? "bg-rose-500" : "bg-slate-400")}
                                                    style={{ width: `${Math.min(100, s.overduePct)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 text-center text-xs font-bold text-slate-500 tabular-nums">{s.avgAge}</td>
                                    <td className="px-4 py-6 text-center text-xs font-black text-indigo-600 tabular-nums">{s.projectPct}%</td>
                                    <td className="px-6 py-6 text-right font-black text-slate-900 tabular-nums text-xs">
                                        £{(s.residualALE / 1000).toFixed(0)}k
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className="flex items-center gap-1.5 justify-center">
                                                <span className="text-xs font-black text-emerald-600">{s.reductionPct}%</span>
                                                <TrendingDown className="w-3 h-3 text-emerald-400" />
                                            </div>
                                            <div className="w-16 h-1.5 bg-emerald-50 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, s.reductionPct)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="flex justify-center">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                                s.status === 'Red' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                                (s.status === 'Yellow' || s.status === 'Amber') ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            )}>
                                                {s.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            {s.escalation > 0 && (
                                                <div className="flex items-center justify-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 min-w-[40px]" title="Project level escalations">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    <span className="text-[10px] font-black">{s.escalation}</span>
                                                </div>
                                            )}
                                            {s.programmeEscalations > 0 && (
                                                <div className="flex items-center justify-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 min-w-[40px]" title="Programme level risks/escalations">
                                                    <Target className="w-3 h-3 fill-rose-600" />
                                                    <span className="text-[10px] font-black">{s.programmeEscalations}</span>
                                                </div>
                                            )}
                                            {s.escalation === 0 && s.programmeEscalations === 0 && (
                                                <span className="text-slate-200 text-xs">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canModify && (
                                                <button 
                                                    onClick={() => handleEdit(kri)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Edit KRI"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button 
                                                    onClick={() => handleDelete(kri.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Delete KRI"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ─── STRATEGIC SUMMARY ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                <div className="bg-[#111827] p-10 rounded-[3rem] text-white space-y-4">
                    <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" /> Compliance Delta
                    </h3>
                    <p className="text-sm text-slate-400 font-bold leading-relaxed italic">
                        Portfolio aggregation identifies a stable correlation between active mitigations and overall KRI health. Velocity remains within statutory tolerances.
                    </p>
                </div>
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white space-y-4">
                    <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-white" /> Performance Insight
                    </h3>
                    <p className="text-sm text-indigo-100 font-bold leading-relaxed italic">
                        Average Risk Age has decreased by 12% following the implementation of Automated Discovery workflows. Next review cycle scheduled for end of Q1.
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


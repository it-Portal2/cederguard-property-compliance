import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { MilestoneManager } from '../components/MilestoneManager';
import type { ProgrammeMilestone } from '../store/useStore';
import { STAGES, DOMAINS } from '../data/complianceData';
import { Rocket, FolderKanban, AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Map, CalendarDays, BarChart3, Download } from 'lucide-react';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { format, parseISO, isWithinInterval, addDays, differenceInDays } from 'date-fns';

// ─── CSV Export Helper ───────────────────────────────────────────────────────

function exportMilestonesCSV(milestones: any[], projectName: string) {
    const headers = ['Milestone', 'RIBA Stage', 'Date', 'Status', 'Priority', 'Owner', 'Key Milestone', 'Notes'];
    const rows = milestones.map(m => [
        m.name || '',
        m.stage || '',
        m.date || '',
        m.status || '',
        m.priority || '',
        m.owner || '',
        m.isKey ? 'Yes' : 'No',
        (m.notes || '').replace(/[\n\r]/g, ' '),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-milestones-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

export function ProjectPlan() {
    const navigate = useNavigate();
    const { projects, activeProjectId, updateProject, complianceItems } = useStore();
    const safeComplianceItems = Array.isArray(complianceItems) ? complianceItems : [];
    const [activeTab, setActiveTab] = useState<'timeline' | 'milestones' | 'gantt'>('timeline');
    const [openStages, setOpenStages] = useState<Record<string, boolean>>({});

    const activeProject = Array.isArray(projects)
        ? projects.find(p => p.id === activeProjectId)
        : null;

    const milestones = (activeProject?.milestones || []) as ProgrammeMilestone[];

    const handleMilestonesChange = async (updated: ProgrammeMilestone[]) => {
        if (!activeProjectId) return;
        try {
            await updateProject(activeProjectId, { milestones: updated } as any);
        } catch {
            toast.error('Failed to save milestones. Please try again.');
        }
    };

    const toggleStage = (id: string) => {
        setOpenStages(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Milestone stats
    const total = milestones.length;
    const completed = milestones.filter(m => m.status === 'Completed').length;
    const delayed = milestones.filter(m => m.status === 'Delayed').length;
    const keyMilestones = milestones.filter(m => m.isKey);
    const upcoming = milestones.filter(m => {
        if (!m.date || m.status === 'Completed') return false;
        try {
            const d = parseISO(m.date);
            return isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 30) });
        } catch { return false; }
    });

    if (!activeProjectId || !activeProject) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-lg bg-indigo-100 flex items-center justify-center mb-5">
                    <FolderKanban className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">No Project Selected</h2>
                <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                    Please select a project from the header or create a new one to manage its milestone plan.
                </p>
                <button
                    onClick={() => navigate('/projects')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                    View All Projects <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                        <Map className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                            {activeProject.name} — Project Plan
                        </h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            RIBA-staged milestones, key deadlines, compliance timeline and audit history
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { exportMilestonesCSV(milestones, activeProject.name || 'project'); toast.success(`Exported ${milestones.length} milestones to CSV`); }}
                        disabled={milestones.length === 0}
                        className="flex items-center gap-2 text-xs font-bold text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <button
                        onClick={() => navigate('/initiate')}
                        className="text-xs font-bold text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition"
                    >
                        Edit Project Details
                    </button>
                </div>
            </div>

            {/* Milestone Stats */}
            {total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Milestones', value: total, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
                        { label: 'Completed', value: completed, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                        { label: 'Delayed', value: delayed, color: delayed > 0 ? 'text-rose-700' : 'text-emerald-700', bg: delayed > 0 ? 'bg-rose-50' : 'bg-emerald-50', border: delayed > 0 ? 'border-rose-200' : 'border-emerald-200' },
                        { label: 'Due in 30 Days', value: upcoming.length, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
                    ].map((s, i) => (
                        <div key={i} className={clsx('rounded-lg border p-4 shadow-sm', s.bg, s.border)}>
                            <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1">{s.label}</p>
                            <p className={clsx('text-2xl font-medium tabular-nums', s.color)}>{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Key Milestones banner */}
            {keyMilestones.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h3 className="font-mono text-sm font-semibold text-amber-800 uppercase tracking-wide">Key Milestones</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {keyMilestones.map(km => (
                            <div key={km.id} className="bg-white rounded-lg border border-amber-200 p-3 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={clsx(
                                        'px-1.5 py-0.5 rounded font-mono text-[10px] font-medium uppercase tracking-wide',
                                        km.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                        km.status === 'Delayed' ? 'bg-rose-100 text-rose-700' :
                                        'bg-amber-100 text-amber-700'
                                    )}>
                                        {km.status}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {km.date ? (() => { try { return format(parseISO(km.date), 'dd MMM yyyy'); } catch { return km.date; } })() : '—'}
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-slate-900">{km.name}</p>
                                {km.stage && <p className="text-[10px] text-slate-500 mt-0.5">RIBA {km.stage}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                    {[
                        { key: 'timeline', label: 'RIBA Compliance Timeline' },
                        { key: 'milestones', label: 'Project Milestones' },
                        { key: 'gantt', label: 'Gantt View' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={clsx(
                                'font-mono px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all',
                                activeTab === tab.key
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => navigate('/calendar?compare=true' + (activeProjectId ? `&projectId=${activeProjectId}` : ''))}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-all border border-indigo-200 shadow-sm"
                >
                    <CalendarDays className="w-4 h-4" />
                    Compare in Calendar
                </button>
            </div>

            {/* TAB: Project Milestones (editable by PM) */}
            {activeTab === 'milestones' && (
                <MilestoneManager
                    milestones={milestones}
                    onChange={handleMilestonesChange}
                    entityType="project"
                />
            )}

            {/* TAB: RIBA Compliance Timeline */}
            {activeTab === 'timeline' && (
                <div className="space-y-4">
                    {/* Timeline visual */}
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                            RIBA Compliance Timeline
                        </h3>
                        <div className="flex flex-nowrap overflow-x-auto pb-8 pt-4 px-2 md:pb-4 md:flex-wrap md:justify-between items-center relative custom-scrollbar snap-x snap-mandatory">
                            <div className="absolute left-0 right-0 top-1/2 -mt-2 md:mt-0 h-0.5 bg-slate-100 -z-10" />
                            {STAGES.map(st => {
                                const isActive = openStages[st.id];
                                return (
                                    <div key={st.id} className="flex flex-col items-center gap-2 cursor-pointer group shrink-0 min-w-[80px] md:min-w-0 snap-center" onClick={() => toggleStage(st.id)}>
                                        <div
                                            className={clsx(
                                                "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300",
                                                isActive ? "text-white scale-110 shadow-lg ring-4 ring-offset-2" : "bg-white hover:scale-105"
                                            )}
                                            style={{
                                                borderColor: st.color,
                                                backgroundColor: isActive ? st.color : 'white',
                                                color: isActive ? 'white' : st.color,
                                                boxShadow: isActive ? `0 10px 15px -3px ${st.color}40` : '',
                                                ringColor: isActive ? `${st.color}30` : '',
                                            } as React.CSSProperties}
                                        >
                                            {st.num}
                                        </div>
                                        <div className={clsx(
                                            "text-[10px] font-bold text-center w-16 leading-tight transition-colors",
                                            isActive ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
                                        )}>
                                            {st.riba}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stage cards */}
                    <div className="space-y-4">
                        {STAGES.map(st => {
                            const isOpen = openStages[st.id];
                            const applicableRegs = st.regs.filter(r => safeComplianceItems.some(i => i.domain === r.domain));

                            return (
                                <div key={st.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm transition-all hover:shadow-md">
                                    <div
                                        className="flex items-center gap-5 p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleStage(st.id)}
                                    >
                                        <div
                                            className="w-12 h-12 shrink-0 rounded-lg flex items-center justify-center text-xl font-semibold border-2"
                                            style={{ color: st.color, borderColor: `${st.color}30`, backgroundColor: `${st.color}10` }}
                                        >
                                            {st.num}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900 text-lg">{st.name}</h3>
                                            <p className="text-sm text-slate-500 mt-0.5">{st.desc}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                                                {applicableRegs.length} regulations
                                            </span>
                                            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-white text-slate-400">
                                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-5 bg-slate-50/50 border-t border-slate-100">
                                            {applicableRegs.map((r, idx) => {
                                                const dom = DOMAINS.find(d => d.id === r.domain);
                                                const relItems = safeComplianceItems.filter(i => i.domain === r.domain);
                                                const complete = relItems.filter(i => i.stage === "Complete").length;
                                                const pct = relItems.length ? Math.round((complete / relItems.length) * 100) : 0;

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="bg-white border border-slate-200 rounded-lg p-5 border-l-[6px] shadow-sm hover:shadow-md transition-shadow"
                                                        style={{ borderLeftColor: dom?.color || '#cbd5e1' }}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <span
                                                                    className="font-mono px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider mb-2.5 inline-block"
                                                                    style={{ backgroundColor: `${dom?.color}10`, color: dom?.color, border: `1px solid ${dom?.color}30` }}
                                                                >
                                                                    {dom?.abbr || r.domain}
                                                                </span>
                                                                <h4 className="text-sm font-bold text-slate-900 leading-tight pr-4">{r.name}</h4>
                                                            </div>
                                                            {relItems.length > 0 && (
                                                                <div className="text-right shrink-0 ml-4 pl-4 border-l border-slate-100">
                                                                    <div className="text-xl font-semibold tracking-tight" style={{ color: dom?.color }}>{pct}%</div>
                                                                    <div className="font-mono text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">{complete} / {relItems.length} Done</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-600 mb-4 leading-relaxed">{r.action}</p>
                                                        <div className="text-xs font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-100 rounded-lg px-3 py-2 inline-flex items-center gap-2 w-full sm:w-auto">
                                                            <span>🔑</span>
                                                            <span className="flex-1">{r.key}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {applicableRegs.length === 0 && (
                                                <div className="col-span-full flex flex-col items-center justify-center py-10 text-center bg-white border border-dashed border-slate-300 rounded-lg">
                                                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-2xl">🍃</div>
                                                    <h4 className="text-sm font-bold text-slate-800 mb-1">No Regulations</h4>
                                                    <p className="text-xs text-slate-500 max-w-sm">No applicable compliance regulations have been identified for this RIBA stage based on your project profile.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB: Gantt View */}
            {activeTab === 'gantt' && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-600" />
                            <h3 className="font-mono text-sm font-semibold text-slate-900 uppercase tracking-wider">Milestone Gantt Chart</h3>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide">{milestones.length} Milestones</span>
                    </div>
                    {milestones.length === 0 ? (
                        <div className="p-16 flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-2xl">📊</div>
                            <h4 className="text-sm font-bold text-slate-800 mb-1">No Milestones</h4>
                            <p className="text-xs text-slate-500 max-w-sm">Add milestones in the Project Milestones tab to see the Gantt chart.</p>
                        </div>
                    ) : (() => {
                        const datedMilestones = milestones.filter(m => m.date);
                        if (datedMilestones.length === 0) {
                            return (
                                <div className="p-16 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3 text-2xl">📅</div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-1">No Dates Set</h4>
                                    <p className="text-xs text-slate-500 max-w-sm">Set dates on your milestones to render the Gantt chart.</p>
                                </div>
                            );
                        }
                        const dates = datedMilestones.map(m => parseISO(m.date!).getTime());
                        const minDate = new Date(Math.min(...dates));
                        const maxDate = new Date(Math.max(...dates));
                        const totalSpan = Math.max(differenceInDays(maxDate, minDate), 1);
                        const stageColors: Record<string, string> = {
                            S0: '#6366f1', S1: '#8b5cf6', S2: '#a855f7', S3: '#d946ef',
                            S4: '#ec4899', S5: '#f43f5e', S6: '#f97316', S7: '#eab308',
                        };
                        const statusColors: Record<string, string> = {
                            'Completed': '#10b981',
                            'In Progress': '#3b82f6',
                            'Delayed': '#ef4444',
                            'Not Started': '#94a3b8',
                            'On Track': '#6366f1',
                        };
                        return (
                            <div className="p-6 space-y-1 overflow-x-auto">
                                {/* Header row */}
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="font-mono w-48 shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Milestone</div>
                                    <div className="font-mono flex-1 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>{format(minDate, 'dd MMM yyyy')}</span>
                                        <span>{format(maxDate, 'dd MMM yyyy')}</span>
                                    </div>
                                </div>
                                {/* Bars */}
                                {datedMilestones.sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()).map(m => {
                                    const mDate = parseISO(m.date!);
                                    const offset = differenceInDays(mDate, minDate);
                                    const leftPct = Math.min((offset / totalSpan) * 100, 100);
                                    const stageKey = (m.stage || '').split(' ')[0] || '';
                                    const barColor = statusColors[m.status || ''] || stageColors[stageKey] || '#6366f1';
                                    return (
                                        <div key={m.id} className="flex items-center gap-3 group py-1.5 hover:bg-slate-50/50 rounded-lg transition-colors">
                                            <div className="w-48 shrink-0 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 truncate" title={m.name}>{m.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {m.stage && <span className="text-[9px] font-bold text-indigo-500">{m.stage}</span>}
                                                    <span className={clsx(
                                                        'text-[9px] font-bold px-1.5 py-0.5 rounded',
                                                        m.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                                        m.status === 'Delayed' ? 'bg-rose-50 text-rose-700' :
                                                        m.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                                                        'bg-slate-50 text-slate-500'
                                                    )}>{m.status || 'Not Started'}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 relative h-7 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                                                {/* Milestone marker */}
                                                <div
                                                    className="absolute top-0 h-full rounded-lg transition-all duration-500 group-hover:brightness-110 flex items-center justify-end pr-2"
                                                    style={{
                                                        left: '0%',
                                                        width: `${Math.max(leftPct, 2)}%`,
                                                        backgroundColor: barColor,
                                                        opacity: m.status === 'Completed' ? 0.9 : 0.75,
                                                    }}
                                                >
                                                    <span className="text-[9px] font-semibold text-white/90 whitespace-nowrap drop-shadow-sm">
                                                        {format(mDate, 'dd MMM')}
                                                    </span>
                                                </div>
                                                {/* Key milestone marker */}
                                                {m.isKey && (
                                                    <div
                                                        className="absolute top-0 w-0.5 h-full bg-amber-500"
                                                        style={{ left: `${leftPct}%` }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Legend */}
                                <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-100">
                                    {Object.entries(statusColors).map(([label, color]) => (
                                        <div key={label} className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded" style={{ backgroundColor: color, opacity: 0.75 }} />
                                            <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-0.5 bg-amber-500 rounded" />
                                        <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Key Milestone</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

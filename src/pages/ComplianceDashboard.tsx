import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { DOMAINS } from '../data/complianceData';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { CheckCircle2, CircleDashed, Clock, FileWarning, TrendingUp, ScanSearch, AlertCircle, ArrowLeft, ArrowRight, ShieldCheck, Calendar, MessageSquare } from 'lucide-react';
import { InfoTooltip } from '../components/InfoTooltip';
import { isAtLeastClientAdmin, UserRole, isSuperAdmin, isAtLeastPM } from '../lib/roles';
import { stripMarkdown } from '../lib/utils';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import { useHistoricalView } from '../hooks/useHistoricalView';
import { MonthPicker } from '../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../components/historicalReporting/HistoricalBanner';
import { HistoricalContentSkeleton } from '../components/historicalReporting/HistoricalContentSkeleton';
import type { LegacyArraySnapshot } from '../types/historicalReporting';

export function ComplianceDashboard() {
    const { 
        complianceItems, 
        getActiveItems, 
        getPendingItems, 
        complianceAnalysis, 
        activeProjectId, 
        activeProgrammeId, 
        projects, 
        programmes, 
        user, 
        updateComplianceItem,
        loadProjectData,
        loadProgrammeData,
        setActiveProject,
        setActiveProgramme
    } = useStore();
    const safeComplianceItems = Array.isArray(complianceItems) ? complianceItems : [];
    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeProgrammes = Array.isArray(programmes) ? programmes : [];

    //  historical view hook. When the user picks a past month,
    // the page swaps live compliance items for the snapshot's frozen
    // state and bypasses the "setup required" gate.
    const historicalView = useHistoricalView<LegacyArraySnapshot<any>>({
        collection: 'complianceItems',
    });
    const isHistorical = historicalView.isHistorical;
    const historicalCompliance = useMemo<any[]>(() => {
        if (!isHistorical) return [];
        const out: any[] = [];
        for (const entry of historicalView.entries) {
            if (entry?.kind === 'legacyArray' && Array.isArray(entry.array)) {
                out.push(...entry.array);
            }
        }
        return out;
    }, [isHistorical, historicalView.entries]);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
    const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
    const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
    const fromInitiation = searchParams.get('from') === 'initiation';
    const [isAIInquiryOpen, setIsAIInquiryOpen] = React.useState(false);
    
    // Load data when active context changes.
    // Skip re-fetch if we already have items for this context (e.g. loaded by initStore or Tracker).
    React.useEffect(() => {
        if (!activeProjectId && !activeProgrammeId) return;
        const contextId = activeProjectId || activeProgrammeId!;
        const alreadyLoaded = safeComplianceItems.some(i =>
            activeProjectId ? i.projectId === contextId : i.programmeId === contextId
        );
        if (alreadyLoaded) return;
        if (activeProjectId) {
            loadProjectData(activeProjectId);
        } else if (activeProgrammeId) {
            loadProgrammeData(activeProgrammeId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId, activeProgrammeId]);

    // Sync URL params to store context
    React.useEffect(() => {
        const pId = searchParams.get('projectId') || searchParams.get('id');
        const prId = searchParams.get('programmeId');
        const type = searchParams.get('type');

        if (type === 'project' && pId && activeProjectId !== pId) {
            setActiveProject(pId);
        } else if (type === 'programme' && pId && activeProgrammeId !== pId) {
            setActiveProgramme(pId);
        } else if (prId && activeProgrammeId !== prId) {
            setActiveProgramme(prId);
        }
    }, [searchParams, activeProjectId, activeProgrammeId, setActiveProject, setActiveProgramme]);

    React.useEffect(() => {
        // Ensure scroll to top happens after render and DOM updates
        window.scrollTo({ top: 0, behavior: 'instant' });
        const timer = setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const activeDetails = (activeProjectId ? safeProjects.find(p => p.id === activeProjectId) : safeProgrammes.find(p => p.id === activeProgrammeId)) || {} as any;

    //  historical view bypasses the "setup required" gate;
    // we just render whatever was frozen at month-end.
    if (!isHistorical && (!activeDetails || !activeDetails.complianceSetupDone || !complianceAnalysis)) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm border-l-4 border-l-amber-500 text-center max-w-2xl mx-auto mt-12">
                <FileWarning className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-amber-900 mb-2">Compliance Setup Required</h3>
                <p className="text-amber-800 mb-6 leading-relaxed">
                    This dashboard summarizes your tailored compliance framework. To get started, you must complete the multi-phase setup to identify regulatory requirements, map accountabilities, and establish your assurance plan.
                </p>
                <div className="flex justify-center gap-4">
                  <Link 
                    to="/compliance/setup" 
                    className="inline-flex items-center px-6 py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 hover:shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Start Compliance Setup
                  </Link>
                </div>
            </div>
        );
    }

    const activeProgramme = safeProgrammes.find(p => p.id === activeProgrammeId);
    const milestones = activeProgramme?.milestones || [];

    // Use the same store selectors as ComplianceTracker so both pages always agree.
    // getActiveItems → status === 'applicable', scoped to activeProjectId / activeProgrammeId
    // getPendingItems → status === 'pending', scoped to active context
    //  when historical, derive equivalents from snapshot data
    // using the same status filters + activeProject/activeProgramme scope.
    const liveContextCompliance = getActiveItems();
    const livePendingReview = getPendingItems();
    const historicalContextCompliance = useMemo(() => {
        if (!isHistorical) return [];
        return historicalCompliance.filter((c: any) => {
            if (c.status !== 'applicable') return false;
            if (activeProjectId) return c.projectId === activeProjectId;
            if (activeProgrammeId) return c.programmeId === activeProgrammeId;
            return true;
        });
    }, [isHistorical, historicalCompliance, activeProjectId, activeProgrammeId]);
    const historicalPendingReview = useMemo(() => {
        if (!isHistorical) return [];
        return historicalCompliance.filter((c: any) => {
            if (c.status !== 'pending') return false;
            if (activeProjectId) return c.projectId === activeProjectId;
            if (activeProgrammeId) return c.programmeId === activeProgrammeId;
            return true;
        });
    }, [isHistorical, historicalCompliance, activeProjectId, activeProgrammeId]);
    const contextCompliance = isHistorical ? historicalContextCompliance : liveContextCompliance;
    const pendingReview = isHistorical ? historicalPendingReview : livePendingReview;

    // Stage values stored by ComplianceTracker:
    //   Live / Archived → "complete" for progress purposes
    //   In Progress → in-flight
    //   Information Gap / Risk Identified → open / not started
    const isComplete  = (s?: string) => s === 'Live' || s === 'Archived';
    const isOpen      = (s?: string) => s === 'Information Gap' || s === 'Risk Identified';
    const isHighRisk  = (r?: string) => r === 'High' || r === 'Critical';

    const compTotal      = contextCompliance.length;
    const compComplete   = contextCompliance.filter(i => isComplete(i.stage)).length;
    const compInProgress = contextCompliance.filter(i => i.stage === 'In Progress').length;
    const compNotStarted = contextCompliance.filter(i => isOpen(i.stage)).length;
    const compHighRisk   = contextCompliance.filter(i => isHighRisk(i.risk) && !isComplete(i.stage)).length;
    const compPct        = compTotal ? Math.round((compComplete / compTotal) * 100) : 0;

    // Match domain by both id AND label to handle legacy items stored with label strings.
    const activeDoms = DOMAINS.map(d => {
        const di = contextCompliance.filter(i => i.domain === d.id || i.domain === d.label);
        const c  = di.filter(i => isComplete(i.stage)).length;
        return {
            ...d,
            total:      di.length,
            complete:   c,
            inProgress: di.filter(i => i.stage === 'In Progress').length,
            notStarted: di.filter(i => isOpen(i.stage)).length,
            highRisk:   di.filter(i => isHighRisk(i.risk) && !isComplete(i.stage)).length,
            pct:        di.length ? Math.round((c / di.length) * 100) : 0,
        };
    }).filter(d => d.total > 0);

    // Critical = High/Critical risk AND still open (not started)
    const criticalItems = contextCompliance.filter(i => isHighRisk(i.risk) && isOpen(i.stage));

    return (
        <>
        <div className="max-w-7xl mx-auto space-y-8 px-4 md:px-0 pb-12 pb-safe">
            <ServiceManagementBar className="mb-4" />

            {/* month picker + historical banner. Placed AFTER
 ServiceManagementBar so the service status row stays the
 page's primary header signal.*/}
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
                    defaultCorrectionCollection="complianceItems"
                    emptyReason={historicalView.emptyReason}
                    activatedYearMonth={historicalView.activatedYearMonth}
                    surfaceLabel="compliance dashboard"
                />
            )}
            {historicalView.loading && <HistoricalContentSkeleton variant="stats-grid" />}
            {!historicalView.loading && <>
            {fromInitiation && (
                <div className="flex justify-start mb-6 -mt-2">
                    <Link 
                        to={activeProjectId ? '/initiate' : '/programmes/new'}
                        className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] md:text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                <StatCard title="Total Requirements" value={compTotal} icon={<CheckCircle2 className="text-indigo-500 w-5 h-5" />} />
                <StatCard title="Live / Complete" value={compComplete} icon={<CheckCircle2 className="text-emerald-500 w-5 h-5" />} color="emerald" />
                <StatCard title="In Progress" value={compInProgress} icon={<Clock className="text-amber-500 w-5 h-5" />} color="amber" />
                <StatCard title="Open / Not Started" value={compNotStarted} icon={<CircleDashed className="text-slate-400 w-5 h-5" />} color="slate" />
                <StatCard title="High Risk Open" value={compHighRisk} icon={<FileWarning className="text-red-500 w-5 h-5" />} color="red" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 hover:shadow-md transition-shadow">
                <div className="flex-1 w-full">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-700 uppercase tracking-widest text-[11px]">Overall Compliance Progress</span>
                        <span className="font-bold text-slate-700">{compPct}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${compPct}%` }} />
                    </div>
                </div>
                <Link to={`/compliance/tracker${fromInitiation ? '?from=initiation' : ''}`} className="shrink-0 px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200">
                    View Tracker
                </Link>
            </div>

            {/* Programme Milestones Summary*/}
            {activeProgrammeId && milestones.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-250">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                            <h2 className="font-bold text-slate-900">Key Programme Milestones</h2>
                        </div>
                        <Link to="/programmes/plan" className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                            View Full Plan
                        </Link>
                    </div>
                    <div className="p-5">
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {milestones.map((m) => (
                                <div key={m.id} className="min-w-[200px] p-4 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[9px] font-black text-slate-400">{m.date}</span>
                                            <span className={`w-2 h-2 rounded-full ${m.status === 'Completed' ? 'bg-emerald-500' : m.status === 'Delayed' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-xs truncate">{m.name}</h4>
                                    </div>
                                    <div className="mt-3 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {m.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced AI Inquiry Visibility*/}
            <div className="bg-linear-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 group">
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-1000"></div>
                <div className="absolute left-0 bottom-0 w-48 h-48 bg-indigo-500/50 rounded-full -ml-24 -mb-24 blur-2xl"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="max-w-2xl space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm">
                            <ScanSearch className="w-3.5 h-3.5 fill-white animate-pulse" />
                            CedarGuard AI Assistant
                        </div>
                        <h2 className="text-3xl font-black tracking-tight leading-tight italic">
                            Deep Compliance Inquiry
                        </h2>
                        <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-lg">
                            Need specific advice on regulatory hurdles or building safety standards? 
                            Ask CedarGuard AI for project-specific guidance, document requirements, or risk mitigation strategies.
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => setIsAIInquiryOpen(true)}
                        className="shrink-0 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-900 hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-3 group/btn"
                    >
                        <MessageSquare className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                        Ask CedarGuard
                    </button>
                </div>
            </div>

            {pendingReview.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-indigo-100 shrink-0">
                                <ScanSearch className="w-6 h-6 text-indigo-500 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-900 tracking-tight italic">AI Verification Queue</h2>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Action Required: Verify {pendingReview.length} New Requirements</p>
                            </div>
                        </div>
                        <Link 
                            to={`/compliance/tracker${fromInitiation ? '?from=initiation' : ''}`}
                            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2 w-fit"
                        >
                            Open Tracker <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingReview.slice(0, 3).map(item => (
                            <div key={item.id} className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase tracking-wider border border-indigo-100">
                                            {item.domain}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400">ID: {item.id.slice(0, 4)}</span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed mb-4">
                                        {stripMarkdown(item.req)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => updateComplianceItem(item.id, { status: 'applicable' })}
                                        className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors border border-emerald-200/50"
                                    >
                                        Verify
                                    </button>
                                    <button 
                                        onClick={() => updateComplianceItem(item.id, { status: 'dismissed' })}
                                        className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors border border-slate-200/50"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {pendingReview.length > 3 && (
                        <p className="text-[10px] text-indigo-400 font-bold mt-4 italic text-center uppercase tracking-widest">
                            + {pendingReview.length - 3} more items pending in tracker
                        </p>
                    )}
                </div>
            )}

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 border-b border-slate-200 pb-2">Compliance by Domain</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeDoms.map(dom => (
                        <div key={dom.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer flex flex-col gap-3" style={{ borderBottomWidth: 3, borderBottomColor: dom.color }}>
                            {/* Header: abbr + label + percentage*/}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md" style={{ backgroundColor: `${dom.color}15`, color: dom.color, border: `1px solid ${dom.color}30` }}>
                                        {dom.abbr}
                                    </span>
                                    <span className="font-bold text-slate-800 text-sm">{dom.label}</span>
                                </div>
                                <span className="font-black text-slate-700 text-sm tracking-tighter">{dom.pct}%</span>
                            </div>

                            {/* Total count*/}
                            <p className="text-[10px] text-slate-400 font-bold -mt-1">{dom.total} total requirement{dom.total !== 1 ? 's' : ''}</p>

                            {/* Progress bar*/}
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-1000 rounded-full" style={{ backgroundColor: dom.color, width: `${dom.pct}%` }} />
                            </div>

                            {/* Status breakdown with counts*/}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-emerald-50 rounded-lg py-1.5 px-1">
                                    <p className="text-base font-black text-emerald-700 leading-none">{dom.complete}</p>
                                    <p className="text-[8px] font-black text-emerald-600/60 uppercase tracking-widest mt-0.5">Live</p>
                                </div>
                                <div className="bg-amber-50 rounded-lg py-1.5 px-1">
                                    <p className="text-base font-black text-amber-700 leading-none">{dom.inProgress}</p>
                                    <p className="text-[8px] font-black text-amber-600/60 uppercase tracking-widest mt-0.5">In Progress</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg py-1.5 px-1">
                                    <p className="text-base font-black text-slate-700 leading-none">{dom.notStarted}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Open</p>
                                </div>
                            </div>

                            {/* High risk warning — clearly labelled*/}
                            {dom.highRisk > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                                    <FileWarning className="w-3 h-3 text-red-500 shrink-0" />
                                    <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">
                                        {dom.highRisk} High Risk Open
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {criticalItems.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                    <h2 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em] mb-4 border-b border-rose-200 pb-2 flex items-center gap-2">
                        <FileWarning className="w-4 h-4" /> Immediate Action Required ({criticalItems.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {criticalItems.slice(0, 6).map(item => {
                            const dom = DOMAINS.find(d => d.id === item.domain);
                            return (
                                <div key={item.id} className="bg-red-50 rounded-xl border border-red-100 p-4 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${dom?.color}20`, color: dom?.color, border: `1px solid ${dom?.color}40` }}>
                                                {dom?.abbr}
                                            </span>
                                            <span className="text-[10px] font-bold text-red-600 tracking-wider">HIGH RISK</span>
                                        </div>
                                        <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed mb-3" title={stripMarkdown(item.req)}>
                                            {stripMarkdown(item.req)}
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-red-600 font-black uppercase tracking-widest bg-white/60 p-2 rounded border border-red-50 flex items-center gap-1.5">
                                        <ScanSearch className="w-3 h-3 text-indigo-400 shrink-0" /> TRIGGER: {stripMarkdown(item.trigger)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {criticalItems.length > 6 && (
                        <p className="text-xs text-slate-500 mt-3 italic">+ {criticalItems.length - 6} more critical items unaddressed.</p>
                    )}
                </div>
            )}

            {complianceAnalysis?.keyRisks?.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 border-b border-amber-200 pb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> AI Identified Key Compliance Risks
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.isArray(complianceAnalysis.keyRisks) && complianceAnalysis.keyRisks.map((risk: string, i: number) => (
                            <div key={i} className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4 font-bold uppercase tracking-wide leading-relaxed shadow-sm flex items-start gap-2">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                {stripMarkdown(risk)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {complianceAnalysis?.regulatoryAuthorities?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                        <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-100 pb-2 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Governing Bodies & Authorities
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {Array.isArray(complianceAnalysis.regulatoryAuthorities) && complianceAnalysis.regulatoryAuthorities.map((auth: string, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100">
                                    {auth}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {complianceAnalysis?.requiredApprovals?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                        <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4 border-b border-emerald-100 pb-2 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Required Approvals & Consents
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {Array.isArray(complianceAnalysis.requiredApprovals) && complianceAnalysis.requiredApprovals.map((app: string, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">
                                    {app}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {complianceAnalysis?.criticalActions?.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-200 pb-2 flex items-center gap-2">
                        <ScanSearch className="w-4 h-4" /> AI Recommended Actions
                    </h2>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <ol className="divide-y divide-slate-100">
                            {Array.isArray(complianceAnalysis.criticalActions) && complianceAnalysis.criticalActions.map((action: string, i: number) => (
                                <li key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-indigo-50/30 transition-colors">
                                    <span className="shrink-0 w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-black">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed pt-0.5">{stripMarkdown(action)}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}
            </>}
        </div>

        {/* AI Inquiry Assistant*/}
        <AIInquiryPopup
            isOpen={isAIInquiryOpen} 
            onClose={() => setIsAIInquiryOpen(false)} 
            context="Compliance Dashboard & Regulatory Standards"
        />
        </>
    );
}

function StatCard({ title, value, icon, color = 'indigo' }: { title: string, value: number, icon: React.ReactNode, color?: string }) {
    const colors: Record<string, string> = {
        indigo: 'border-l-indigo-500 bg-white',
        emerald: 'border-l-emerald-500 bg-emerald-50/20',
        amber: 'border-l-amber-500 bg-amber-50/20',
        slate: 'border-l-slate-400 bg-slate-50',
        red: 'border-l-red-500 bg-red-50/20',
    };

    return (
        <div className={`rounded-2xl border border-slate-200 border-l-4 p-5 flex flex-col shadow-sm transition-all hover:shadow-md ${colors[color]}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</span>
                {icon}
            </div>
            <span className="text-3xl font-black text-slate-800 tracking-tight">{value}</span>
        </div>
    );
}

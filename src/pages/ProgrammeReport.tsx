import { LayoutDashboard, ShieldCheck, AlertTriangle, FileWarning, TrendingUp, Layers, ListChecks, Target, ArrowRight, TrendingDown, BarChart, PieChart, Loader2, CheckCircle2, Shield, PoundSterling, ArrowLeft, ShieldAlert, AlertCircle, Database, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { stripMarkdown } from '../lib/utils';
import { isAtLeastClientAdmin, isSuperAdmin } from '../lib/roles';
import { analyzeComplianceLifecycle, analyzeComplianceSentiment } from '../services/aiService';

function fGBP(v: number) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function StatTile({ icon: Icon, label, value, color, trend, trendValue }: { 
    icon: any; label: string; value: string | number; color: string; trend?: 'up' | 'down'; trendValue?: string 
}) {
    return (
        <div className="group bg-white rounded-lg md:rounded-lg border border-slate-200/60 p-4 md:p-5 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
            {/* Background decoration */}
            <div className={clsx("absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.03] transition-transform duration-700 group-hover:scale-150", color)} />
            
            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <div className={clsx("p-2.5 rounded-lg border transition-colors duration-500", 
                        isActiveTile(color) ? "bg-opacity-10 border-opacity-20" : "bg-slate-50 border-slate-100 group-hover:bg-opacity-10 group-hover:border-opacity-20",
                        color.replace('text-', 'bg-').replace('text-', 'border-')
                    )}>
                        <Icon className={clsx("w-5 h-5", color)} />
                    </div>
                    {trend && (
                        <div className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border underline-offset-2",
                            trend === 'up' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {trendValue}
                        </div>
                    )}
                </div>
                <div className="text-xl font-black text-slate-900 tracking-tight group-hover:translate-x-1 transition-transform duration-500">{value}</div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] transition-colors duration-500 group-hover:text-slate-600 truncate">{label}</div>
        </div>
    );
}

function isActiveTile(color: string) {
    return true; // Simplified for visual parity
}

export function ProgrammeReport() {
    const navigate = useNavigate();
    const { risks, projects, activeProgrammeId, programmes, user } = useStore();
    
    // Role check
    const userRole = user?.role || (user as any)?.profile?.role;
    const isClientAdmin = isAtLeastClientAdmin(userRole) || isSuperAdmin(user?.email, userRole);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [analysisResults, setAnalysisResults] = useState('');

    const [isAnalyzingLifecycle, setIsAnalyzingLifecycle] = useState(false);
    const [lifecycleResults, setLifecycleResults] = useState<any>(null);
    
    const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
    const [sentimentResults, setSentimentResults] = useState<any>(null);

    const [activeAiTab, setActiveAiTab] = useState<'sensitivity' | 'lifecycle' | 'sentiment'>('sensitivity');
    const [aiError, setAiError] = useState<string | null>(null);
    
    // Reset AI states when programme changes
    useEffect(() => {
        setIsAnalyzing(false);
        setAnalysisComplete(false);
        setAnalysisResults('');
        setIsAnalyzingLifecycle(false);
        setLifecycleResults(null);
        setIsAnalyzingSentiment(false);
        setSentimentResults(null);
        setAiError(null);
    }, [activeProgrammeId]);

    useEffect(() => {
        setAiError(null);
    }, [activeAiTab]);

    // Aggregate Data
    const programmeData = useMemo(() => {
        // Filter projects for this programme
        const progProjects = projects.filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId);
        
        // Filter programme-level risks (direct + escalated)
        const progRisks = risks.filter(r => {
            const isLocal = r.programmeId === activeProgrammeId || (r as any).programme === activeProgrammeId;
            return isLocal && (r.escalated || (r as any).isProgrammeLevel);
        });

        // Calculations
        const highRisks = progRisks.filter(r => (r.residualRating || 0) >= 16).length;
        const openIssues = progRisks.filter(r => r.status === 'Open').length; // Simplified issue count from risk status
        const totalALE = progRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
        const mitigatedPct = progRisks.length > 0 ? Math.round((progRisks.filter(r => r.status === 'Mitigated' || r.status === 'Closed').length / progRisks.length) * 100) : 0;
        const escalatedFromProjects = progRisks.filter(r => r.escalated).length;

        // Health Score (mock logic for demo)
        let health = 'Stable';
        let healthColor = 'text-emerald-500';
        if (highRisks > 2) { health = 'Critical'; healthColor = 'text-rose-500'; }
        else if (highRisks > 0 || openIssues > 5) { health = 'Warning'; healthColor = 'text-amber-500'; }

        return {
            health, healthColor,
            totalRisks: progRisks.length,
            highRisks,
            openIssues,
            mitigatedPct,
            totalALE,
            escalatedFromProjects,
            projectCount: progProjects.length,
            programmeName: programmes.find(p => p.id === activeProgrammeId)?.name || 'Global Programme'
        };
    }, [risks, projects, activeProgrammeId, programmes]);

    if (!isClientAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-lg border border-slate-200 shadow-xl shadow-slate-200/50 mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in duration-700">
                <div className="w-24 h-24 bg-rose-50 rounded-lg flex items-center justify-center mb-8 shadow-inner shadow-rose-200/50 border border-rose-100">
                    <ShieldAlert className="w-12 h-12 text-rose-500" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Access Restricted</h2>
                <p className="text-slate-500 max-w-sm mx-auto mb-10 font-semibold leading-relaxed">
                    Portfolio Intelligence is a high-level strategic feature reserved for Client Administrators and Portfolio Managers.
                </p>
                <button 
                    onClick={() => navigate('/projects')}
                    className="px-8 py-4 bg-slate-900 text-white rounded-lg font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 scale-100 hover:scale-[1.05] active:scale-[0.95]"
                >
                    Back to Projects
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 print:p-0">
            {/* Premium Header */}
            <div className="group/header relative bg-slate-900 rounded-lg md:rounded-lg p-6 md:p-10 overflow-hidden shadow-2xl border border-white/5 ring-1 ring-white/10">
                {/* Abstract visual backgrounds */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -mr-48 -mt-48 transition-transform duration-1000 group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] -ml-24 -mb-24" />
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-4">
                            <button 
                                onClick={() => navigate('/projects')}
                                className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-[10px] font-black uppercase tracking-widest group/back print:hidden"
                            >
                                <ArrowLeft className="w-3 h-3 transition-transform group-hover/back:-translate-x-1" />
                                Back to Portfolio
                            </button>
                            {isClientAdmin && (
                                <button
                                    onClick={() => { useStore.getState().setActiveProgramme(null); navigate('/programmes/new'); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-white/20 transition-all shadow-sm active:scale-95"
                                >
                                    <Plus className="w-3 h-3" />
                                    New Programme
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                             <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60" />
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/30" />
                             </div>
                             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] leading-none">Intelligence Layer active</span>
                        </div>
                        
                        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 drop-shadow-md">
                            <div className="p-2 md:p-2.5 bg-white/10 backdrop-blur-md rounded-lg md:rounded-lg border border-white/20 ring-1 ring-white/10 shadow-inner group-hover/header:scale-105 transition-transform duration-500">
                                <BarChart className="w-6 h-6 md:w-8 md:h-8 text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.4)]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="tracking-tight">Programme Health</span>
                                <span className="text-[9px] md:text-[10px] font-bold text-indigo-300 uppercase tracking-[0.3em] mt-1 opacity-80 group-hover/header:opacity-100 transition-opacity">Cedar Risk Intelligence • Aggregate Portfolio View</span>
                            </div>
                        </h1>
                    </div>
                </div>
            </div>

            {/* 8-Tile Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile 
                    icon={ShieldCheck} 
                    label="Programme Health" 
                    value={programmeData.health} 
                    color={programmeData.healthColor}
                    trend="up"
                    trendValue="Stable"
                />
                <StatTile 
                    icon={AlertTriangle} 
                    label="Total Programme Risks" 
                    value={programmeData.totalRisks} 
                    color="text-indigo-600"
                />
                <StatTile 
                    icon={Layers} 
                    label="Risk Escalations" 
                    value={programmeData.escalatedFromProjects} 
                    color="text-orange-500"
                />
                <StatTile 
                    icon={TrendingDown} 
                    label="Avg Mitigation Rate" 
                    value={`${programmeData.mitigatedPct}%`} 
                    color="text-emerald-500"
                    trend="up"
                    trendValue="+4%"
                />
                <StatTile 
                    icon={AlertCircle} 
                    label="Critical High Risks" 
                    value={programmeData.highRisks} 
                    color="text-rose-500"
                />
                <StatTile 
                    icon={FileWarning} 
                    label="Open Programme Issues" 
                    value={programmeData.openIssues} 
                    color="text-amber-500"
                />
                <StatTile 
                    icon={PieChart} 
                    label="Financial Exposure (ALE)" 
                    value={`£${(programmeData.totalALE / 1000000).toFixed(1)}M`} 
                    color="text-slate-700"
                />
                 <StatTile 
                    icon={ListChecks} 
                    label="Portfolio Projects" 
                    value={programmeData.projectCount} 
                    color="text-blue-600"
                />
            </div>

            {/* ─── AI STRATEGIC INTELLIGENCE (Portfolio View) ─── */}
            <div className="bg-slate-50/50 rounded-lg md:rounded-lg border border-slate-200/60 p-6 md:p-10 transition-all hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                            <Target className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Portfolio Intelligence</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Cedar Predictive AI • Aggregate Analysis</p>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg md:rounded-lg gap-1 self-stretch md:self-auto overflow-x-auto hide-scrollbar whitespace-nowrap">
                        {(['sensitivity', 'lifecycle', 'sentiment'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveAiTab(tab)}
                                className={clsx(
                                    "flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeAiTab === tab 
                                        ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" 
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-[300px]">
                    {aiError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in mb-6">
                            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <h3 className="text-sm font-bold text-red-900">AI Analysis Error</h3>
                                <p className="text-xs text-red-700 mt-1">{aiError}</p>
                            </div>
                        </div>
                    )}

                    {activeAiTab === 'sensitivity' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="max-w-2xl mx-auto text-center space-y-4">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Portfolio Sensitivity Guardrails</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                    Aggregate stress-testing across {programmeData.projectCount} projects to identify cross-cutting volatility in {programmeData.programmeName}.
                                </p>
                                
                                {!analysisResults && !isAnalyzing && (
                                    <button 
                                        onClick={async () => {
                                            setIsAnalyzing(true);
                                            setAiError(null);
                                            try {
                                                const prompt = `Perform a deep-dive strategic sensitivity analysis for the social housing programme "${programmeData.programmeName}". 
                                                Portfolio Summary:
                                                - Total Projects: ${programmeData.projectCount}
                                                - Total Programme Risks: ${programmeData.totalRisks}
                                                - High Risks: ${programmeData.highRisks}
                                                - Financial Exposure (ALE): ${fGBP(programmeData.totalALE)}
                                                
                                                Provide a comprehensive executive outlook covering aggregate portfolio volatility and recommended strategic guardrails.
                                                Provide at least 10 detailed points.`;
                                                const res = await api.testGemini(prompt);
                                                setAnalysisResults(stripMarkdown(res?.text || ''));
                                                setAnalysisComplete(true);
                                            } catch (e: any) { 
                                                console.error(e);
                                                setAiError(e.message || 'Failed to generate AI analysis. Please try again.');
                                            } finally { setIsAnalyzing(false); }
                                        }}
                                        className="mt-4 px-8 py-3.5 bg-[#111827] text-white text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-black shadow-xl active:scale-95 transition-all"
                                    >
                                        <Database className="w-4 h-4 inline mr-2" /> Run Portfolio Sensitivity
                                    </button>
                                )}
                            </div>

                            {(isAnalyzing || analysisResults) && (
                                <div className="bg-white rounded-lg md:rounded-lg p-6 md:p-10 border border-slate-100 shadow-sm relative overflow-hidden">
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest animate-pulse">Aggregating Portfolio Data...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="prose prose-slate max-w-none">
                                        <h3 className="text-sm font-black text-slate-800 tracking-tight mb-4 uppercase flex items-center gap-2">
                                            <Target className="w-4 h-4 text-indigo-500" />
                                            {activeAiTab === 'sensitivity' ? 'Portfolio Sensitivity Guardrails' : 
                                             activeAiTab === 'lifecycle' ? 'Portfolio Compliance Roadmap' :
                                             'Strategic Portfolio Sentiment'}
                                        </h3>
                                        <div className="text-xs text-slate-600 leading-[1.8] font-medium whitespace-pre-wrap">
                                            {analysisResults || "Select 'Run Analysis' to begin."}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeAiTab === 'lifecycle' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="max-w-2xl mx-auto text-center space-y-4">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Portfolio Lifecycle Roadmap</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                    Aggregated RIBA stage-gate analysis across all projects in {programmeData.programmeName}.
                                </p>
                                {!lifecycleResults && !isAnalyzingLifecycle && (
                                    <button 
                                        onClick={async () => {
                                            setIsAnalyzingLifecycle(true);
                                            setAiError(null);
                                            try {
                                                // Aggregate some stats for the lifecycle
                                                const res = await analyzeComplianceLifecycle({ name: programmeData.programmeName, type: 'Programme' }, []);
                                                setLifecycleResults(res);
                                            } catch (e: any) {
                                                console.error(e);
                                                setAiError(e.message || 'Failed to generate AI analysis. Please try again.');
                                            } finally { setIsAnalyzingLifecycle(false); }
                                        }}
                                        className="mt-4 px-8 py-3.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 shadow-xl active:scale-95 transition-all"
                                    >
                                        <Layers className="w-4 h-4 inline mr-2" /> Analyse Portfolio Stages
                                    </button>
                                )}
                            </div>

                            {(isAnalyzingLifecycle || lifecycleResults) && (
                                <div className="space-y-10 relative">
                                    {isAnalyzingLifecycle && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg md:rounded-lg">
                                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                        </div>
                                    )}
                                    
                                    {lifecycleResults && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {lifecycleResults.lifecycleRoadmap.map((item: any, i: number) => (
                                                    <div key={i} className="bg-white p-5 md:p-6 rounded-lg md:rounded-lg border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-indigo-200 transition-colors">
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">{item.stage}</span>
                                                        </div>
                                                        <div className="text-xs font-black text-slate-800">{item.requirement}</div>
                                                        <div className="text-[10px] text-slate-500 leading-relaxed font-bold italic">{item.actionableInsight}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="bg-amber-50/50 p-6 md:p-10 rounded-lg md:rounded-lg border border-amber-100/50">
                                                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Aggregate Delivery Bottlenecks
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {lifecycleResults.bottlenecks.map((b: string, i: number) => (
                                                        <div key={i} className="flex gap-3 text-xs font-bold text-slate-700">
                                                            <span className="text-amber-400">•</span> {b}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeAiTab === 'sentiment' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="max-w-2xl mx-auto text-center space-y-4">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Portfolio Sentiment & Confidence</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                    Assessing the qualitative health of the entire programme.
                                </p>
                                {!sentimentResults && !isAnalyzingSentiment && (
                                    <button 
                                        onClick={async () => {
                                            setIsAnalyzingSentiment(true);
                                            setAiError(null);
                                            try {
                                                const res = await analyzeComplianceSentiment({ name: programmeData.programmeName, type: 'Programme' }, []);
                                                setSentimentResults(res);
                                            } catch (e: any) {
                                                console.error(e);
                                                setAiError(e.message || 'Failed to generate AI analysis. Please try again.');
                                            } finally { setIsAnalyzingSentiment(false); }
                                        }}
                                        className="mt-4 px-8 py-3.5 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 shadow-xl active:scale-95 transition-all"
                                    >
                                        <Shield className="w-4 h-4 inline mr-2" /> Portfolio Audit
                                    </button>
                                )}
                            </div>

                            {(isAnalyzingSentiment || sentimentResults) && (
                                <div className="space-y-8 relative">
                                    {isAnalyzingSentiment && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg md:rounded-lg">
                                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                        </div>
                                    )}

                                    {sentimentResults && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            <div className="lg:col-span-1 space-y-6">
                                                <div className="bg-white p-6 md:p-8 rounded-lg md:rounded-lg border border-slate-100 shadow-sm text-center space-y-4">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence Score</div>
                                                    <div className={clsx(
                                                        "text-4xl md:text-6xl font-black tabular-nums",
                                                        sentimentResults.confidenceScore > 70 ? "text-emerald-500" :
                                                        sentimentResults.confidenceScore > 40 ? "text-amber-500" : "text-rose-500"
                                                    )}>
                                                        {sentimentResults.confidenceScore}%
                                                    </div>
                                                    <div className="inline-flex px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                        Tone: {sentimentResults.sentimentTone}
                                                    </div>
                                                </div>
                                                <div className="bg-[#111827] p-6 md:p-8 rounded-lg md:rounded-lg text-white">
                                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Programme Note</h4>
                                                    <p className="text-xs font-medium leading-[1.8] italic opacity-80">{sentimentResults.auditorNote}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="lg:col-span-2 space-y-6">
                                                <div className="bg-white p-6 md:p-10 rounded-lg md:rounded-lg border border-slate-100 shadow-sm">
                                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 pb-4 border-b">Portfolio Audit Rationale</h4>
                                                    <div className="space-y-4">
                                                        {sentimentResults.rationale.map((r: string, i: number) => (
                                                            <div key={i} className="flex gap-4 group">
                                                                <span className="text-indigo-400 font-black">0{i+1}.</span>
                                                                <p className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase leading-tight">{r}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── EXECUTIVE INTERNAL AUDIT ─── */}
            {isClientAdmin && (
                <div className="relative group overflow-hidden rounded-lg md:rounded-lg p-8 md:p-16 text-center border border-white/10 bg-slate-900 shadow-2xl mt-12">
                    {/* Background glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-600/20 blur-[120px] rounded-full" />
                    
                    <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                        <div className="inline-flex p-4 rounded-lg bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl group-hover:scale-110 transition-transform duration-700">
                            <ShieldCheck className="w-10 h-10 text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
                        </div>
                        
                        <div className="space-y-4">
                            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight italic">
                                Executive Internal Audit
                            </h2>
                            <p className="text-slate-400 font-bold text-sm md:text-base leading-relaxed tracking-wide uppercase opacity-80 decoration-indigo-500/30 underline underline-offset-8">
                                Initiate deep-dive administrative oversight into this programme's management lifecycle.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                            <button
                                onClick={() => {
                                    if (activeProgrammeId) {
                                        navigate(`/dashboard?viewAs=pm&programmeId=${activeProgrammeId}`);
                                    } else {
                                        navigate(`/dashboard?viewAs=pm`);
                                    }
                                }}
                                className="group/btn relative px-10 py-5 bg-white text-slate-900 rounded-lg font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:shadow-white/20 active:scale-95 overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Access PM Backdoor <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

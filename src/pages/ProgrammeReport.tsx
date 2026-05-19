import {
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  TrendingUp,
  Layers,
  ListChecks,
  Target,
  BarChart,
  PoundSterling,
  Loader2,
  Shield,
  ArrowLeft,
  ShieldAlert,
  AlertCircle,
  Database,
  Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { stripMarkdown } from '../lib/utils';
import { isAtLeastClientAdmin, isSuperAdmin } from '../lib/roles';
import { analyzeComplianceLifecycle, analyzeComplianceSentiment } from '../services/aiService';
import { StatsCard } from '../components/common/StatsCard';
import { AIErrorAlert } from '../components/AIErrorAlert';

function fGBP(v: number) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
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
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-rose-50 rounded-lg flex items-center justify-center mb-6">
                    <ShieldAlert className="w-8 h-8 text-rose-500" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Access restricted</h2>
                <p className="text-sm text-slate-500 mb-6">
                    Portfolio Intelligence is reserved for Client Administrators and Portfolio Managers.
                </p>
                <button
                    onClick={() => navigate('/projects')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                    Back to projects
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 print:p-0">
            {/* ─── HEADER BAND ─── */}
            <section className="bg-slate-900 px-6 py-8 md:px-10 md:py-10 rounded-t-lg print:rounded-none print:break-inside-avoid">
                <button
                    onClick={() => navigate('/projects')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors mb-4 print:hidden"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to portfolio
                </button>
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-2.5">
                            <BarChart className="w-6 h-6 text-indigo-300" />
                            Programme Health
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            {programmeData.programmeName} · aggregate portfolio view across {programmeData.projectCount} project{programmeData.projectCount === 1 ? '' : 's'}.
                        </p>
                    </div>
                    {isClientAdmin && (
                        <button
                            onClick={() => { useStore.getState().setActiveProgramme(null); navigate('/programmes/new'); }}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/15 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors print:hidden self-start md:self-auto"
                        >
                            <Plus className="w-4 h-4" /> New programme
                        </button>
                    )}
                </div>
            </section>

            {/* ─── KPI STRIP ─── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:break-inside-avoid">
                <StatsCard
                    icon={ShieldCheck}
                    title="Programme health"
                    value={programmeData.health}
                    size="lg"
                    iconBgClassName={
                        programmeData.health === 'Critical' ? 'bg-rose-50' :
                        programmeData.health === 'Warning' ? 'bg-amber-50' : 'bg-emerald-50'
                    }
                    iconClassName={
                        programmeData.health === 'Critical' ? 'text-rose-600' :
                        programmeData.health === 'Warning' ? 'text-amber-600' : 'text-emerald-600'
                    }
                />
                <StatsCard
                    icon={AlertTriangle}
                    title="Total programme risks"
                    value={programmeData.totalRisks}
                    size="lg"
                    iconBgClassName="bg-indigo-50"
                    iconClassName="text-indigo-600"
                />
                <StatsCard
                    icon={Layers}
                    title="Risk escalations"
                    value={programmeData.escalatedFromProjects}
                    size="lg"
                    iconBgClassName="bg-amber-50"
                    iconClassName="text-amber-600"
                />
                <StatsCard
                    icon={TrendingUp}
                    title="Avg mitigation rate"
                    value={`${programmeData.mitigatedPct}%`}
                    size="lg"
                    iconBgClassName="bg-emerald-50"
                    iconClassName="text-emerald-600"
                    progress
                    progressValue={programmeData.mitigatedPct}
                    progressClassName="bg-emerald-500"
                    progressLabel="Mitigated"
                />
                <StatsCard
                    icon={AlertCircle}
                    title="Critical high risks"
                    value={programmeData.highRisks}
                    size="lg"
                    iconBgClassName="bg-rose-50"
                    iconClassName="text-rose-600"
                />
                <StatsCard
                    icon={FileWarning}
                    title="Open programme issues"
                    value={programmeData.openIssues}
                    size="lg"
                    iconBgClassName="bg-amber-50"
                    iconClassName="text-amber-600"
                />
                <StatsCard
                    icon={PoundSterling}
                    title="Financial exposure (ALE)"
                    value={fGBP(programmeData.totalALE)}
                    size="lg"
                    highlighted
                    accentClassName="bg-slate-900"
                    titleClassName="text-slate-300"
                    valueClassName="text-white"
                    iconBgClassName="bg-white/10"
                    iconClassName="text-emerald-300"
                />
                <StatsCard
                    icon={ListChecks}
                    title="Portfolio projects"
                    value={programmeData.projectCount}
                    size="lg"
                    iconBgClassName="bg-violet-50"
                    iconClassName="text-violet-600"
                />
            </section>

            {/* ─── AI STRATEGIC INTELLIGENCE (Portfolio View) ─── */}
            <section className="bg-white rounded-lg border border-slate-200 p-6 md:p-8 shadow-sm print:break-inside-avoid">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 mb-6">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                            <Target className="w-5 h-5 text-indigo-600" /> Portfolio Intelligence
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Cedar predictive AI · aggregate analysis</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 overflow-x-auto hide-scrollbar whitespace-nowrap">
                        {(['sensitivity', 'lifecycle', 'sentiment'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveAiTab(tab)}
                                className={clsx(
                                    "px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors",
                                    activeAiTab === tab
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-[280px]">
                    {aiError && (
                        <div className="mb-6">
                            <AIErrorAlert error={aiError} />
                        </div>
                    )}

                    {activeAiTab === 'sensitivity' && (
                        <div className="space-y-6">
                            <div className="max-w-2xl text-center mx-auto space-y-3">
                                <h3 className="text-base font-semibold text-slate-900">Portfolio sensitivity guardrails</h3>
                                <p className="text-sm text-slate-500">
                                    Aggregate stress-testing across {programmeData.projectCount} project{programmeData.projectCount === 1 ? '' : 's'} to identify cross-cutting volatility in {programmeData.programmeName}.
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
                                                // api.testGemini returns { success, result } — read `result`, not `text`
                                                setAnalysisResults(stripMarkdown(res?.result || ''));
                                                setAnalysisComplete(true);
                                            } catch (e: any) {
                                                console.error(e);
                                                setAiError(e.message || 'Failed to generate AI analysis. Please try again.');
                                            } finally { setIsAnalyzing(false); }
                                        }}
                                        className="inline-flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                    >
                                        <Database className="w-4 h-4" /> Run portfolio sensitivity
                                    </button>
                                )}
                            </div>

                            {(isAnalyzing || analysisResults) && (
                                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 relative">
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                                                <span className="text-sm font-medium text-slate-700">Aggregating portfolio data…</span>
                                            </div>
                                        </div>
                                    )}
                                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                                        <Target className="w-4 h-4 text-indigo-600" />
                                        Portfolio sensitivity guardrails
                                    </h3>
                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {analysisResults || "Select 'Run analysis' to begin."}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeAiTab === 'lifecycle' && (
                        <div className="space-y-6">
                            <div className="max-w-2xl text-center mx-auto space-y-3">
                                <h3 className="text-base font-semibold text-slate-900">Portfolio lifecycle roadmap</h3>
                                <p className="text-sm text-slate-500">
                                    Aggregated RIBA stage-gate analysis across all projects in {programmeData.programmeName}.
                                </p>
                                {!lifecycleResults && !isAnalyzingLifecycle && (
                                    <button
                                        onClick={async () => {
                                            setIsAnalyzingLifecycle(true);
                                            setAiError(null);
                                            try {
                                                const res = await analyzeComplianceLifecycle({ name: programmeData.programmeName, type: 'Programme' }, []);
                                                setLifecycleResults(res);
                                            } catch (e: any) {
                                                console.error(e);
                                                setAiError(e.message || 'Failed to generate AI analysis. Please try again.');
                                            } finally { setIsAnalyzingLifecycle(false); }
                                        }}
                                        className="inline-flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                    >
                                        <Layers className="w-4 h-4" /> Analyse portfolio stages
                                    </button>
                                )}
                            </div>

                            {(isAnalyzingLifecycle || lifecycleResults) && (
                                <div className="space-y-6 relative">
                                    {isAnalyzingLifecycle && (
                                        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                        </div>
                                    )}

                                    {lifecycleResults && (
                                        <>
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {lifecycleResults.lifecycleRoadmap.map((item: any, i: number) => (
                                                    <li key={i} className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 hover:border-indigo-200 transition-colors">
                                                        <span className="inline-flex text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                            {item.stage}
                                                        </span>
                                                        <p className="text-sm font-semibold text-slate-900">{item.requirement}</p>
                                                        <p className="text-sm text-slate-500 leading-relaxed">{item.actionableInsight}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                                                <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-3">
                                                    <AlertTriangle className="w-4 h-4" /> Aggregate delivery bottlenecks
                                                </h4>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {lifecycleResults.bottlenecks.map((b: string, i: number) => (
                                                        <li key={i} className="flex gap-2 text-sm text-slate-700">
                                                            <span className="text-amber-500 shrink-0">•</span>
                                                            <span>{b}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeAiTab === 'sentiment' && (
                        <div className="space-y-6">
                            <div className="max-w-2xl text-center mx-auto space-y-3">
                                <h3 className="text-base font-semibold text-slate-900">Portfolio sentiment &amp; confidence</h3>
                                <p className="text-sm text-slate-500">
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
                                        className="inline-flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                                    >
                                        <Shield className="w-4 h-4" /> Portfolio audit
                                    </button>
                                )}
                            </div>

                            {(isAnalyzingSentiment || sentimentResults) && (
                                <div className="space-y-6 relative">
                                    {isAnalyzingSentiment && (
                                        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                                        </div>
                                    )}

                                    {sentimentResults && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            <div className="lg:col-span-1 space-y-4">
                                                <div className="bg-white p-6 rounded-lg border border-slate-200 text-center space-y-3">
                                                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Confidence score</div>
                                                    <div className={clsx(
                                                        "text-4xl md:text-5xl font-semibold tabular-nums",
                                                        sentimentResults.confidenceScore > 70 ? "text-emerald-600" :
                                                        sentimentResults.confidenceScore > 40 ? "text-amber-600" : "text-rose-600"
                                                    )}>
                                                        {sentimentResults.confidenceScore}%
                                                    </div>
                                                    <div className="inline-flex px-3 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
                                                        Tone: {sentimentResults.sentimentTone}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900 p-5 rounded-lg text-white">
                                                    <h4 className="text-xs font-medium text-indigo-300 uppercase tracking-wide mb-2">Programme note</h4>
                                                    <p className="text-sm leading-relaxed text-slate-200">{sentimentResults.auditorNote}</p>
                                                </div>
                                            </div>

                                            <div className="lg:col-span-2">
                                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                                    <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4">Portfolio audit rationale</h4>
                                                    <ol className="space-y-3">
                                                        {sentimentResults.rationale.map((r: string, i: number) => (
                                                            <li key={i} className="flex gap-3 text-sm text-slate-700">
                                                                <span className="text-indigo-600 font-semibold tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                                                                <p>{r}</p>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

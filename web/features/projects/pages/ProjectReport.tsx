import { useState, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import { getRIBALabelFull } from '../../../data/complianceData';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Building2,
  User,
  ShieldCheck,
  AlertCircle,
  PoundSterling,
  Printer,
  BarChart,
  Target,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Layers,
  Shield,
  ArrowLeft,
  Database,
  ListChecks,
  Presentation,
  Plus,
  PlusCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { stripMarkdown } from '../../../lib/utils';
import { ApiError } from '../../../lib/api';
import { analyzeComplianceLifecycle, analyzeComplianceSentiment, analyzeSensitivity } from '../../../services/aiService';
import { AIErrorAlert } from '../../../components/AIErrorAlert';
import { StatsCard } from '../../../components/common/StatsCard';
import DynamicTable from '../../../components/table/DynamicTable';
import type { ColumnDef } from '../../../components/table/types';
import type { RiskItem } from '../../../store/useStore';
import { isSuperAdmin, canCreateProject, canCreateProgramme, UserRole } from '../../../lib/roles';
import { ProjectReportTacSection } from '../../../features/technicalAssurance/components/ProjectReportTacSection';

function fGBP(v: number) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export function ProjectReport() {
  const navigate = useNavigate();
  const {
    projects,
    risks,
    complianceItems,
    programmes,
    activeProjectId,
    activeProgrammeId,
    setActiveProject,
    setActiveProgramme,
    loadProjectData,
    user
  } = useStore();

  const [searchParams, setSearchParams] = useSearchParams();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  const [isAnalyzingLifecycle, setIsAnalyzingLifecycle] = useState(false);
  const [lifecycleResults, setLifecycleResults] = useState<any>(null);

  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [sentimentResults, setSentimentResults] = useState<any>(null);

  const [activeAiTab, setActiveAiTab] = useState<'sensitivity' | 'lifecycle' | 'sentiment'>('sensitivity');
  const [aiError, setAiError] = useState<string | ApiError | null>(null);
  
  // State synchronization and AI reset
  useEffect(() => {
    const pId = searchParams.get('projectId');
    const prId = searchParams.get('programmeId');
    if (pId && activeProjectId !== pId) {
      setActiveProject(pId);
    } else if (prId && activeProgrammeId !== prId) {
      setActiveProgramme(prId);
    }

    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setAnalysisResults(null);
    setIsAnalyzingLifecycle(false);
    setLifecycleResults(null);
    setIsAnalyzingSentiment(false);
    setSentimentResults(null);
    setAiError(null);
  }, [searchParams, activeProjectId, activeProgrammeId, setActiveProject, setActiveProgramme]);

  // Load project data when activeProjectId changes (skip if already loaded)
  useEffect(() => {
    if (!activeProjectId) return;
    const alreadyLoaded = complianceItems.some(i => i.projectId === activeProjectId) &&
                          risks.some(r => r.projectId === activeProjectId);
    if (alreadyLoaded) return;
    loadProjectData(activeProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const currentProject = (Array.isArray(projects) ? projects : []).find(p => p.id === activeProjectId);
  const currentProgramme = (Array.isArray(programmes) ? programmes : []).find(p => p.id === currentProject?.programmeId);

  const projectRisks = (Array.isArray(risks) ? risks : []).filter(r => r.projectId === activeProjectId);
  // Only applicable items — matches what ComplianceDashboard and ComplianceTracker show
  const projectCompliance = (Array.isArray(complianceItems) ? complianceItems : []).filter(
    c => c.projectId === activeProjectId && c.status === 'applicable'
  );

  const totalALE = projectRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
  const highRisks = projectRisks.filter(r => (r.residualRating || 0) >= 12);

  // Valid complete stages are 'Live' and 'Archived' (not 'Complete')
  const compComplete = projectCompliance.filter(i => i.stage === 'Live' || i.stage === 'Archived').length;
  const compPct = projectCompliance.length ? Math.round((compComplete / projectCompliance.length) * 100) : 0;

  // Guard against undefined category to prevent crashes
  const categoryData = [
    { name: 'Finance', value: projectRisks.filter(r => (r.category || '').includes('Finance')).length },
    { name: 'Safety', value: projectRisks.filter(r => (r.category || '').includes('Safety')).length },
    { name: 'Legal', value: projectRisks.filter(r => (r.category || '').includes('Legal')).length },
    { name: 'Technical', value: projectRisks.filter(r => (r.category || '').includes('Technical')).length },
    { name: 'Operational', value: projectRisks.filter(r => (r.category || '').includes('Operational')).length },
  ].filter(d => d.value > 0);

  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);

  const filteredProgrammes = (Array.isArray(programmes) ? programmes : []).filter(p => {
    if (userIsSuperAdmin) return true;
    if (userRole === 'client_admin') return true; // Trust the API list
    return false;
  });

  const filteredProjects = (Array.isArray(projects) ? projects : []).filter(p => {
    if (userIsSuperAdmin) return true;
    if (userRole === 'client_admin') return true; // Trust the API list
    return p.pmId === user?.uid || p.projectManagerId === user?.uid || p.createdBy === user?.uid || p.createdBy === user?.email;  }).filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId);

  // ── Itemised risks table columns ─────────────────────────────────────────
  const riskColumns: ColumnDef<RiskItem>[] = [
    {
      key: 'id',
      label: 'Ref',
      sortable: true,
      render: (_v, r) => <span className="text-xs font-semibold text-indigo-600 tabular-nums">#{r.id}</span>,
    },
    {
      key: 'title',
      label: 'Risk',
      sortable: true,
      render: (_v, r) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 leading-snug">{stripMarkdown(r.title)}</div>
          <div className="text-xs text-slate-500 mt-0.5">{r.category}</div>
        </div>
      ),
    },
    {
      key: 'residualRating',
      label: 'Score',
      align: 'center',
      sortable: true,
      render: (_v, r) => {
        const score = r.residualRating || 0;
        return (
          <span
            className={clsx(
              'inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-semibold tabular-nums',
              score >= 16 ? 'bg-rose-100 text-rose-700' :
              score >= 12 ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700',
            )}
          >
            {score}
          </span>
        );
      },
    },
    {
      key: 'response',
      label: 'Response',
      sortable: true,
      render: (_v, r) => (
        <span className="inline-flex text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {r.response || 'Tolerate'}
        </span>
      ),
    },
    {
      key: 'residualALE',
      label: 'Residual ALE',
      align: 'right',
      sortable: true,
      render: (_v, r) => (
        <span className="text-sm font-semibold text-slate-900 tabular-nums">{fGBP(r.residualALE ?? 0)}</span>
      ),
    },
  ];

  return (
    <div className="print:p-0">
      {/* ─── HEADER BAND ─── */}
      <section className="bg-white px-6 py-8 md:px-10 md:py-10 rounded-t-lg border border-slate-200 border-b-0 print:rounded-none print:border-0 print:break-inside-avoid">
        <button
          onClick={() => navigate('/reporting/programme')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4 print:hidden"
        >
          <ArrowLeft className="w-4 h-4" /> Back to project list
        </button>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Project Risk &amp; Compliance Report
            </h1>
            <div className="flex flex-wrap gap-3 items-center">
              {(userIsSuperAdmin || userRole === 'client_admin') && (
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <select
                      value={activeProgrammeId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveProgramme(val);
                        setActiveProject('');
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          if (val) next.set('programmeId', val);
                          else next.delete('programmeId');
                          next.delete('projectId');
                          return next;
                        });
                      }}
                      className="text-sm font-medium text-indigo-700 bg-transparent border-none focus:ring-0 cursor-pointer appearance-none pr-6 truncate max-w-[14rem]"
                    >
                      <option value="">All portfolios</option>
                      {filteredProgrammes.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-indigo-500 -ml-5 pointer-events-none" />
                  </div>
                </div>
              )}
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={activeProjectId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveProject(val);
                      setSearchParams(prev => {
                        const next = new URLSearchParams(prev);
                        if (val) next.set('projectId', val);
                        else next.delete('projectId');
                        return next;
                      });
                    }}
                    className="text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer appearance-none pr-6 truncate max-w-[14rem]"
                  >
                    <option value="">{activeProgrammeId ? 'All projects in programme' : 'Select project report'}</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 -ml-5 pointer-events-none" />
                </div>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <User className="w-4 h-4 text-slate-400" />
                PM: <span className="font-medium text-slate-900">{currentProject?.manager || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            {canCreateProgramme(userRole) && (
              <Link
                to="/programmes/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> New programme
              </Link>
            )}
            {canCreateProject(userRole) && (
              <Link
                to="/initiate"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> New project
              </Link>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>
      </section>

      {/* ─── BODY ─── */}
      <div className="bg-white px-6 py-8 md:px-10 md:py-10 space-y-10 rounded-b-lg border border-slate-200 border-t-0 shadow-sm print:shadow-none print:border-0">
        {!activeProjectId ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Presentation className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">No project selected</h3>
                    <p className="text-sm text-slate-500 mt-1">Please select an active project from the dropdown above to generate the report.</p>
                </div>
            </div>
        ) : (
            <>
                {/* ─── KEY PERFORMANCE INDICATORS ─── */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:break-inside-avoid">
                    <StatsCard
                        icon={AlertCircle}
                        title="High volatility risk"
                        value={highRisks.length}
                        description="Critical risks requiring escalation"
                        size="lg"
                        iconBgClassName="bg-rose-50"
                        iconClassName="text-rose-600"
                    />
                    <StatsCard
                        icon={PoundSterling}
                        title="Financial exposure"
                        value={fGBP(totalALE)}
                        description="Residual value at risk (ALE)"
                        size="lg"
                        iconBgClassName="bg-indigo-50"
                        iconClassName="text-indigo-600"
                    />
                    <StatsCard
                        icon={ShieldCheck}
                        title="Compliance posture"
                        value={`${compPct}%`}
                        description="Statutory review completion"
                        size="lg"
                        iconBgClassName="bg-emerald-50"
                        iconClassName="text-emerald-600"
                        progress
                        progressValue={compPct}
                        progressClassName="bg-emerald-500"
                        progressLabel="Complete"
                    />
                </section>

                {/* ─── DETAILED PROJECT RISKS ─── */}
                <section className="space-y-4 print:break-inside-avoid">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                            <ListChecks className="w-5 h-5 text-indigo-600" /> Itemised project risks
                        </h2>
                        <span className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide tabular-nums">{projectRisks.length} active</span>
                    </div>

                    <DynamicTable<RiskItem>
                        data={projectRisks}
                        columns={riskColumns}
                        searchable
                        searchPlaceholder="Search risks..."
                        searchFields={['title', 'id', 'category', 'response']}
                        pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50] }}
                        getRowId={(r) => r.id}
                        emptyState={{
                            title: 'No active risks',
                            description: 'No active risks have been logged for this project.',
                            icon: Shield,
                        }}
                        headerVariant="light"
                    />
                </section>

                {/* ─── COMPLIANCE & EXPOSURE ─── */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 print:break-inside-avoid">
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5 border-b border-slate-200 pb-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" /> Compliance performance
                        </h2>
                        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
                            <ul className="divide-y divide-slate-200">
                                {projectCompliance.slice(0, 5).map((item: any, idx) => (
                                    <li key={idx} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900 leading-snug truncate">{stripMarkdown(item.req)}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                <span>{item.domain}</span>
                                                <span className="text-slate-300">·</span>
                                                <span className="text-indigo-600">{getRIBALabelFull(item.stage_link)}</span>
                                            </div>
                                        </div>
                                        <span className={clsx(
                                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium shrink-0",
                                            (item.stage === 'Live' || item.stage === 'Archived') ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                            item.stage === 'In Progress' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                            "bg-rose-50 text-rose-700 border border-rose-200"
                                        )}>
                                            <span className={clsx("w-1.5 h-1.5 rounded-full",
                                                (item.stage === 'Live' || item.stage === 'Archived') ? 'bg-emerald-500' :
                                                item.stage === 'In Progress' ? 'bg-amber-500' : 'bg-rose-500'
                                            )} />
                                            {item.stage || 'Information gap'}
                                        </span>
                                    </li>
                                ))}
                                {projectCompliance.length === 0 && (
                                    <li className="py-4 text-center text-sm text-slate-500">No compliance items assigned.</li>
                                )}
                            </ul>

                            <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-3">
                                <div className="text-center py-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-2xl font-medium text-slate-900 tabular-nums">{projectCompliance.length}</div>
                                    <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide mt-0.5">Total requirements</div>
                                </div>
                                <div className="text-center py-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-2xl font-medium text-emerald-600 tabular-nums">{compComplete}</div>
                                    <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide mt-0.5">Complete</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5 border-b border-slate-200 pb-3">
                            <BarChart className="w-5 h-5 text-indigo-600" /> Exposure by category
                        </h2>
                        <div className="bg-white border border-slate-200 rounded-lg p-5 min-h-[320px]">
                            {categoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <RechartsBarChart data={categoryData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#475569' }} width={90} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a' }} />
                                        <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                                    <BarChart className="w-10 h-10 mb-3 opacity-40" />
                                    <span className="text-sm font-medium">Insufficient chart data</span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ─── AI STRATEGIC INTELLIGENCE ─── */}
                <section className="bg-white rounded-lg border border-slate-200 p-6 md:p-8 print:break-inside-avoid">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 mb-6">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                                <Target className="w-5 h-5 text-indigo-600" /> Strategic Intelligence
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">Cedar predictive AI · multi-vector analysis</p>
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
                        {activeAiTab === 'sensitivity' && (
                            <div className="space-y-6">
                                <div className="max-w-2xl text-center mx-auto space-y-3">
                                    <h3 className="text-base font-semibold text-slate-900">Predictive sensitivity guardrails</h3>
                                    <p className="text-sm text-slate-500">
                                        Stress-testing {projectRisks.length} risk variable{projectRisks.length === 1 ? '' : 's'} and ALE exposure to identify latent volatility in {currentProject?.name}.
                                    </p>

                                    {aiError && (
                                        <div className="max-w-xl mx-auto">
                                            <AIErrorAlert
                                                error={aiError}
                                                onRetry={() => {
                                                    setIsAnalyzing(true);
                                                    setAiError(null);
                                                    analyzeSensitivity(currentProject, projectRisks, compPct, totalALE)
                                                        .then(res => { setAnalysisResults(res); setAnalysisComplete(true); })
                                                        .catch(err => {
                                                            console.error("Sensitivity check failed:", err);
                                                            setAiError(err instanceof ApiError ? err : (err.message || 'Analysis failed.'));
                                                        })
                                                        .finally(() => setIsAnalyzing(false));
                                                }}
                                            />
                                        </div>
                                    )}

                                    {projectRisks.length === 0 ? (
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-sm text-slate-600">Insufficient data — please log project risks to run sensitivity analysis.</p>
                                        </div>
                                    ) : !analysisResults && !isAnalyzing && (
                                        <button
                                            onClick={async () => {
                                                setIsAnalyzing(true);
                                                setAiError(null);
                                                try {
                                                    const res = await analyzeSensitivity(currentProject, projectRisks, compPct, totalALE);
                                                    setAnalysisResults(res);
                                                    setAnalysisComplete(true);
                                                } catch (err: any) {
                                                    console.error("Sensitivity check failed:", err);
                                                    setAiError(err instanceof ApiError ? err : (err.message || "An error occurred during analysis."));
                                                } finally { setIsAnalyzing(false); }
                                            }}
                                            className="inline-flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                        >
                                            <Database className="w-4 h-4" /> Run sensitivity analysis
                                        </button>
                                    )}
                                </div>

                                {isAnalyzing && !analysisResults && (
                                    <div className="bg-slate-50 rounded-lg p-10 border border-slate-200 min-h-[320px] flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                        <span className="text-sm font-medium text-slate-700">Processing volatility data…</span>
                                        <span className="text-xs text-slate-500">This usually takes 10–30 seconds.</span>
                                    </div>
                                )}

                                {analysisResults && (
                                    <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 relative">
                                        {isAnalyzing && (
                                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                                                    <span className="text-sm font-medium text-slate-700">Re-running analysis…</span>
                                                </div>
                                            </div>
                                        )}

                                        {analysisResults?.summary && (
                                            <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-lg border-l-4 border-indigo-500 mb-6">
                                                {stripMarkdown(analysisResults.summary)}
                                            </p>
                                        )}

                                        {Array.isArray(analysisResults?.guardrails) && analysisResults.guardrails.length > 0 && (
                                            <>
                                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Sensitivity guardrails</h4>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                                    {analysisResults.guardrails.map((g: any, i: number) => (
                                                        <li key={i} className="p-4 bg-white rounded-lg border border-slate-200 space-y-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold tabular-nums flex items-center justify-center">{i + 1}</span>
                                                                <h5 className="text-sm font-semibold text-slate-900">{stripMarkdown(g.title)}</h5>
                                                            </div>
                                                            <p className="text-sm text-slate-600 leading-relaxed">{stripMarkdown(g.details)}</p>
                                                            <p className="text-[11px] font-mono font-medium text-indigo-600 uppercase tracking-wide">{stripMarkdown(g.riskVector)}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}

                                        {analysisResults?.volatilityAnalysis && (
                                            <div className="mb-6">
                                                <h4 className="text-sm font-semibold text-slate-900 mb-2">Latent volatility analysis</h4>
                                                <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-lg border border-slate-200">
                                                    {stripMarkdown(analysisResults.volatilityAnalysis)}
                                                </p>
                                            </div>
                                        )}

                                        {Array.isArray(analysisResults?.contingencyStrategies) && analysisResults.contingencyStrategies.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Strategic contingencies</h4>
                                                <ol className="space-y-3">
                                                    {analysisResults.contingencyStrategies.map((s: any, i: number) => {
                                                        // Resilient render: AI returns objects with what/who/when/how/where/why
                                                        // (matches the schema + the prompt's WHAT/WHO/WHEN format). Fall back
                                                        // to plain-string render if a future model returns strings.
                                                        if (typeof s === 'string') {
                                                            return (
                                                                <li key={i} className="flex gap-3 text-sm text-slate-700">
                                                                    <span className="text-indigo-600 font-semibold tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                                                                    <span>{stripMarkdown(s)}</span>
                                                                </li>
                                                            );
                                                        }
                                                        return (
                                                            <li key={i} className="bg-white border border-slate-200 rounded-lg p-4">
                                                                <div className="flex items-baseline gap-2 mb-2">
                                                                    <span className="text-indigo-600 font-semibold tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                                                                    {s?.what && (
                                                                        <span className="text-sm font-semibold text-slate-900">{stripMarkdown(s.what)}</span>
                                                                    )}
                                                                </div>
                                                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-600 pl-7">
                                                                    {s?.who && <div><dt className="inline font-medium text-slate-500">Who: </dt><dd className="inline">{stripMarkdown(s.who)}</dd></div>}
                                                                    {s?.when && <div><dt className="inline font-medium text-slate-500">When: </dt><dd className="inline">{stripMarkdown(s.when)}</dd></div>}
                                                                    {s?.how && <div className="sm:col-span-2"><dt className="inline font-medium text-slate-500">How: </dt><dd className="inline">{stripMarkdown(s.how)}</dd></div>}
                                                                    {s?.where && <div><dt className="inline font-medium text-slate-500">Where: </dt><dd className="inline">{stripMarkdown(s.where)}</dd></div>}
                                                                    {s?.why && <div><dt className="inline font-medium text-slate-500">Why: </dt><dd className="inline">{stripMarkdown(s.why)}</dd></div>}
                                                                </dl>
                                                            </li>
                                                        );
                                                    })}
                                                </ol>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeAiTab === 'lifecycle' && (
                            <div className="space-y-6">
                                <div className="max-w-2xl text-center mx-auto space-y-3">
                                    <h3 className="text-base font-semibold text-slate-900">Compliance lifecycle roadmap</h3>
                                    <p className="text-sm text-slate-500">
                                        Mapping compliance obligations to RIBA stage-gates to identify transition bottlenecks and sequencing risks.
                                    </p>

                                    {aiError && (
                                        <div className="max-w-xl mx-auto">
                                            <AIErrorAlert
                                                error={aiError}
                                                onRetry={() => {
                                                    setIsAnalyzingLifecycle(true);
                                                    setAiError(null);
                                                    analyzeComplianceLifecycle(currentProject, projectCompliance)
                                                        .then(res => setLifecycleResults(res))
                                                        .catch(err => {
                                                            console.error("Lifecycle analysis failed:", err);
                                                            setAiError(err instanceof ApiError ? err : (err.message || 'Analysis failed.'));
                                                        })
                                                        .finally(() => setIsAnalyzingLifecycle(false));
                                                }}
                                            />
                                        </div>
                                    )}

                                    {projectCompliance.length === 0 ? (
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-sm text-slate-600">Insufficient data — please log compliance items to run lifecycle analysis.</p>
                                        </div>
                                    ) : !lifecycleResults && !isAnalyzingLifecycle && (
                                        <button
                                            onClick={async () => {
                                                setIsAnalyzingLifecycle(true);
                                                setAiError(null);
                                                try {
                                                    const res = await analyzeComplianceLifecycle(currentProject, projectCompliance);
                                                    setLifecycleResults(res);
                                                } catch (err: any) {
                                                    console.error("Lifecycle analysis failed:", err);
                                                    setAiError(err instanceof ApiError ? err : (err.message || "An error occurred during analysis."));
                                                } finally { setIsAnalyzingLifecycle(false); }
                                            }}
                                            className="inline-flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                        >
                                            <Layers className="w-4 h-4" /> Analyse RIBA stages
                                        </button>
                                    )}
                                </div>

                                {isAnalyzingLifecycle && !lifecycleResults && (
                                    <div className="bg-slate-50 rounded-lg p-10 border border-slate-200 min-h-[320px] flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                        <span className="text-sm font-medium text-slate-700">Mapping RIBA stage-gates…</span>
                                        <span className="text-xs text-slate-500">This usually takes 10–30 seconds.</span>
                                    </div>
                                )}

                                {lifecycleResults && (
                                    <div className="space-y-6 relative">
                                        {isAnalyzingLifecycle && (
                                            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                            </div>
                                        )}

                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {(Array.isArray(lifecycleResults?.lifecycleRoadmap) ? lifecycleResults.lifecycleRoadmap : []).map((item: any, i: number) => (
                                                <li key={i} className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 hover:border-indigo-200 transition-colors">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="inline-flex text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{item.stage}</span>
                                                        <span className="text-xs text-slate-500">Responsible: {item.responsible}</span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-900">{item.requirement}</p>
                                                    <p className="text-sm text-slate-500 leading-relaxed">{item.actionableInsight}</p>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                                            <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-3">
                                                <AlertTriangle className="w-4 h-4" /> Predicted stage-gate bottlenecks
                                            </h4>
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {(Array.isArray(lifecycleResults?.bottlenecks) ? lifecycleResults.bottlenecks : []).map((b: string, i: number) => (
                                                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                                                        <span className="text-amber-500 shrink-0">•</span>
                                                        <span>{b}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeAiTab === 'sentiment' && (
                            <div className="space-y-6">
                                <div className="max-w-2xl text-center mx-auto space-y-3">
                                    <h3 className="text-base font-semibold text-slate-900">Compliance sentiment &amp; confidence</h3>
                                    <p className="text-sm text-slate-500">
                                        Sentiment velocity analysis of the trajectory of compliance resolution and risk closure to forecast delivery confidence.
                                    </p>

                                    {aiError && (
                                        <div className="max-w-xl mx-auto">
                                            <AIErrorAlert
                                                error={aiError}
                                                onRetry={() => {
                                                    setIsAnalyzingSentiment(true);
                                                    setAiError(null);
                                                    analyzeComplianceSentiment(currentProject, projectCompliance)
                                                        .then(res => setSentimentResults(res))
                                                        .catch(err => {
                                                            console.error("Sentiment analysis failed:", err);
                                                            setAiError(err instanceof ApiError ? err : (err.message || 'Analysis failed.'));
                                                        })
                                                        .finally(() => setIsAnalyzingSentiment(false));
                                                }}
                                            />
                                        </div>
                                    )}

                                    {projectCompliance.length === 0 ? (
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-sm text-slate-600">Insufficient data — please log compliance items to run sentiment analysis.</p>
                                        </div>
                                    ) : !sentimentResults && !isAnalyzingSentiment && (
                                        <button
                                            onClick={async () => {
                                                setIsAnalyzingSentiment(true);
                                                setAiError(null);
                                                try {
                                                    const res = await analyzeComplianceSentiment(currentProject, projectCompliance);
                                                    setSentimentResults(res);
                                                } catch (err: any) {
                                                    console.error("Sentiment analysis failed:", err);
                                                    setAiError(err instanceof ApiError ? err : (err.message || "An error occurred during analysis."));
                                                } finally { setIsAnalyzingSentiment(false); }
                                            }}
                                            className="inline-flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                                        >
                                            <Shield className="w-4 h-4" /> Audit sentiment
                                        </button>
                                    )}
                                </div>

                                {isAnalyzingSentiment && !sentimentResults && (
                                    <div className="bg-slate-50 rounded-lg p-10 border border-slate-200 min-h-[320px] flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                                        <span className="text-sm font-medium text-slate-700">Auditing sentiment velocity…</span>
                                        <span className="text-xs text-slate-500">This usually takes 10–30 seconds.</span>
                                    </div>
                                )}

                                {sentimentResults && (
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
                                                        <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Confidence score</div>
                                                        <div className={clsx(
                                                            "text-4xl md:text-5xl font-medium tabular-nums",
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
                                                        <h4 className="text-[11px] font-mono font-medium text-indigo-300 uppercase tracking-wide mb-2">Auditor note</h4>
                                                        <p className="text-sm leading-relaxed text-slate-200">{sentimentResults.auditorNote}</p>
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-2">
                                                    <div className="bg-white p-6 rounded-lg border border-slate-200">
                                                        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4">Audit rationale</h4>
                                                        <ol className="space-y-3">
                                                            {(Array.isArray(sentimentResults?.rationale) ? sentimentResults.rationale : []).map((r: string, i: number) => (
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

                {/* ─── TECHNICAL ASSURANCE ─── — TAC enquiries flagged for inclusion
                    via the Cost & programme tab's "Add to PM report" button. Renders
                    nothing when zero enquiries are added on this project. */}
                {activeProjectId ? (
                    <div className="print:break-inside-avoid">
                        <ProjectReportTacSection projectId={activeProjectId} />
                    </div>
                ) : null}

                {/* ─── REPORT SIGN-OFF ─── */}
                <footer className="pt-8 border-t border-slate-200 flex flex-col md:flex-row md:items-end md:justify-between gap-6 print:break-inside-avoid">
                    <div className="flex flex-wrap gap-8">
                        <div className="space-y-3">
                            <div className="w-56 h-px bg-slate-300" />
                            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Project manager signature</div>
                        </div>
                        <div className="space-y-3">
                            <div className="w-40 h-px bg-slate-300" />
                            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Review date</div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 md:text-right">
                        Cedar Corporate Compliance — Unified reporting framework<br/>
                        Produced by CedarGuard AI on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </footer>
            </>
        )}
      </div>
    </div>
  );
}

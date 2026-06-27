import { useStore } from '../../../store/useStore';
import { isAtLeastClientAdmin } from '../../../lib/roles';
import { ApiError } from '../../../lib/api';
import { AIErrorAlert } from '../../../components/AIErrorAlert';
import { EmptyState } from '../../../components/common/EmptyState';
import { StatsCard } from '../../../components/common/StatsCard';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Printer,
  BarChart,
  Layers,
  ChevronDown,
  Calendar,
  AlertCircle,
  PoundSterling,
  Inbox,
  Plus,
  PlusCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router';
import { stripMarkdown, parseAISuggestion } from '../../../lib/utils';
import { useNavigate } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeStrategicInsights } from '../../../services/aiService';
import { resolveAiScope } from '../../../lib/aiScope';
import { getResidualScore, SEVERE_SCORE_THRESHOLD, MAJOR_SCORE_THRESHOLD } from '../../../lib/riskMetrics';


function fGBP(v: number) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export function ExecutiveReport() {
  const { risks, projects, activeProgrammeId, programmes, complianceItems, issues, setActiveProgramme, setActiveProject, user } = useStore();
  const navigate = useNavigate();
  const userRole = user?.role || (user as any)?.profile?.role;

  const safeRisks = Array.isArray(risks) ? risks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];
  const safeComplianceItems = Array.isArray(complianceItems) ? complianceItems : [];
  const safeIssues = Array.isArray(issues) ? issues : [];

  useEffect(() => {
    if (user && !isAtLeastClientAdmin(userRole)) {
      navigate('/dashboard');
    }
  }, [user, userRole, navigate]);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [aiError, setAiError] = useState<ApiError | string | null>(null);
  const [loading, setLoading] = useState(false);
  const isGeneratingRef = useRef(false);

  const getInsight = async () => {
    if (isGeneratingRef.current) return;
    if (safeRisks.length === 0 && safeComplianceItems.length === 0 && safeIssues.length === 0) {
      setAiInsight(null);
      return;
    }

    isGeneratingRef.current = true;
    setLoading(true);
    setAiError(null);
    // Programme-scoped when a programme is active, else portfolio-wide. The exec
    // summary is a balanced cross-functional view (T4 focus 'portfolio').
    const aiScope = resolveAiScope({
      activeProgrammeId,
      activeProgramme: safeProgrammes.find(p => p.id === activeProgrammeId),
    });
    try {
      const insight = await analyzeStrategicInsights({
        risks: {
          total: filteredRisks.length,
          open: openCount,
          high: highRisks.length,
          ale: totalALE
        },
        compliance: {
          total: filteredCompliance.length,
          complete: compComplete,
          pct: compPct,
          highRisk: filteredCompliance.filter(c => c.stage === 'Risk Identified' || c.stage === 'Information Gap').length
        },
        issues: {
          total: filteredIssues.length,
          open: filteredIssues.filter(i => i.status !== '4. Resolved').length,
          escalated: filteredIssues.filter(i => i.status === '2. Escalated').length
        }
      }, user, { scope: aiScope, focus: 'portfolio' });
      setAiInsight(insight);
    } catch (e: any) {
      console.error('Failed to get insight:', e);
      setAiError(e instanceof ApiError ? e : (e.message || 'Failed to generate AI insights. Please try again.'));
    } finally {
      setLoading(false);
      isGeneratingRef.current = false;
    }
  };

  // Aggregated data for the whole programme or all programmes
  const filteredRisks = safeRisks.filter(r => {
    if (!activeProgrammeId) return true;
    const proj = safeProjects.find(p => p.id === r.projectId);
    return proj?.programmeId === activeProgrammeId || r.programmeId === activeProgrammeId;
  });

  const filteredCompliance = safeComplianceItems.filter(c => {
    if (c.status === 'dismissed' || c.status === 'pending') return false;
    
    if (!activeProgrammeId) return true;
    const proj = safeProjects.find(p => p.id === c.projectId);
    return proj?.programmeId === activeProgrammeId;
  });

  const filteredIssues = safeIssues.filter(i => {
    if (!activeProgrammeId) return true;
    const proj = safeProjects.find(p => p.id === i.projectId);
    return proj?.programmeId === activeProgrammeId;
  });

  const totalALE = filteredRisks.reduce((s, r) => s + (r.residualALE || 0), 0);
  const openCount = filteredRisks.filter(r => r.status === 'Open').length;
  const highRisks = filteredRisks.filter(r => getResidualScore(r) >= MAJOR_SCORE_THRESHOLD);
  const criticalCount = filteredRisks.filter(r => getResidualScore(r) >= SEVERE_SCORE_THRESHOLD).length;

  const compComplete = filteredCompliance.filter(i => i.stage === 'Live' || i.stage === 'Archived').length;
  const compPct = filteredCompliance.length ? Math.round((compComplete / filteredCompliance.length) * 100) : 0;

  const currentProgramme = safeProgrammes.find(p => p.id === activeProgrammeId);

  // Deterministic report reference derived from the active programme.
  const reportRef = useMemo(() => {
    const seed = activeProgrammeId || 'ALL';
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return `EXE-${new Date().getFullYear()}-${1000 + (h % 9000)}`;
  }, [activeProgrammeId]);

  useEffect(() => {
    getInsight();
  }, [activeProgrammeId, filteredRisks.length]);


  return (
    <div className="print:p-0 print:bg-white" id="executive-report-container">
      {/* ─── HEADER BAND ─── */}
      <section className="bg-slate-900 px-6 py-8 md:px-10 md:py-10 rounded-t-lg print:rounded-none print:break-inside-avoid">
        <div className="flex flex-col gap-6">
          {/* Title row */}
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-indigo-500/15 text-indigo-300 rounded-lg shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
                Programme Risk &amp; Compliance — Executive one-pager
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Strategic oversight summary · {currentProgramme?.name ?? 'All programmes'} · Confidential
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center text-sm text-slate-300">
            <div className="relative flex items-center gap-2 group">
              <Layers className="w-4 h-4 text-indigo-300" />
              <select
                value={activeProgrammeId || ''}
                onChange={(e) => setActiveProgramme(e.target.value)}
                className="bg-transparent border-none text-white text-sm font-medium focus:ring-0 appearance-none pr-5 cursor-pointer"
              >
                <option value="" className="text-slate-900">All programmes</option>
                {safeProgrammes.map(p => (
                  <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-colors" />
            </div>

            <span className="hidden sm:inline text-slate-700">·</span>

            <div className="relative flex items-center gap-2 group">
              <Building2 className="w-4 h-4 text-indigo-300" />
              <select
                value=""
                onChange={(e) => {
                  setActiveProject(e.target.value);
                  navigate('/reporting/project');
                }}
                className="bg-transparent border-none text-white text-sm font-medium focus:ring-0 appearance-none pr-5 cursor-pointer"
              >
                <option value="" className="text-slate-900">Drill into project…</option>
                {safeProjects.filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId).map(p => (
                  <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-colors" />
            </div>

            <span className="hidden sm:inline text-slate-700">·</span>

            <span className="flex items-center gap-2 text-slate-400">
              <Calendar className="w-4 h-4 text-indigo-300" />
              Ref: {reportRef}
            </span>
          </div>

          {/* CTA cluster */}
          <div className="flex flex-wrap gap-2 print:hidden">
            {userRole === 'admin' && (
              <>
                <Link
                  to="/programmes/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> New programme
                </Link>
                <Link
                  to="/project/initiation"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/15 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" /> New project
                </Link>
              </>
            )}
            {userRole === 'client_admin' && (
              <Link
                to="/programmes/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> New programme
              </Link>
            )}
            {userRole !== 'client_admin' && userRole !== 'admin' && (
              <Link
                to="/project/initiation"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/15 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> New project
              </Link>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-white border border-white/15 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Printer className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>
      </section>

      {/* ─── BODY ─── */}
      <div className="bg-white px-6 py-8 md:px-10 md:py-10 space-y-10 rounded-b-lg shadow-sm print:shadow-none">

        {/* ─── KPI STRIP ─── */}
        <section className="print:break-inside-avoid">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              icon={BarChart}
              title="Total risk inventory"
              value={filteredRisks.length}
              size="lg"
              iconBgClassName="bg-slate-100 dark:bg-slate-500/10"
              iconClassName="text-slate-600 dark:text-slate-400"
            />
            <StatsCard
              icon={ShieldCheck}
              title="Active mitigations"
              value={openCount}
              size="lg"
              iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
              iconClassName="text-indigo-600 dark:text-indigo-400"
            />
            <StatsCard
              icon={AlertCircle}
              title="Critical items"
              value={criticalCount}
              size="lg"
              iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
              iconClassName="text-rose-600 dark:text-rose-400"
            />
            <StatsCard
              icon={PoundSterling}
              title="Portfolio exposure"
              value={fGBP(totalALE)}
              size="lg"
              highlighted
              accentClassName="bg-slate-900"
              titleClassName="text-slate-300"
              valueClassName="text-white"
              iconBgClassName="bg-white/10"
              iconClassName="text-emerald-300"
            />
          </div>
        </section>

        {/* ─── AI STRATEGIC OUTLOOK ─── */}
        <section className="bg-slate-900 rounded-lg p-6 md:p-10 text-white print:break-inside-avoid">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="flex-1 space-y-8 min-w-0">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[11px] font-mono font-medium uppercase tracking-wide rounded">
                    AI analysis
                  </span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-3">
                  Programme health outlook
                </h2>
                {aiError && (
                  <div className="mb-4">
                    <AIErrorAlert error={aiError} onRetry={getInsight} />
                  </div>
                )}
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-5 bg-white/10 rounded w-full" />
                    <div className="h-5 bg-white/10 rounded w-5/6" />
                  </div>
                ) : aiInsight ? (
                  <p className="text-base md:text-lg leading-relaxed text-slate-100">
                    {stripMarkdown(aiInsight?.outlook || 'Analyzing cross-functional dependencies and volatility peaks across active workstreams…')}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Inbox className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm font-medium">Awaiting analysis parameters</p>
                    <p className="text-xs text-slate-500 mt-1">Add risks or projects to generate strategic insights.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-emerald-300 text-[11px] font-mono font-medium uppercase tracking-wide flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Priority directives
                  </h3>
                  <ul className="space-y-3">
                    {(aiInsight?.strategicPriorities || ['Review critical financial exposures', 'Validate compliance evidence gaps']).map((p: string, i: number) => (
                      <li key={i} className="space-y-1">
                        {parseAISuggestion(p).map((part, pIdx) => (
                          <div key={pIdx} className="flex gap-3 text-sm text-slate-300 items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                            <div className="flex-1 min-w-0">
                              {part.label && (
                                <span className="font-semibold text-slate-100">{part.label}: </span>
                              )}
                              <span>{stripMarkdown(part.content)}</span>
                            </div>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-rose-300 text-[11px] font-mono font-medium uppercase tracking-wide flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Volatility indicators
                  </h3>
                  <ul className="space-y-3">
                    {(aiInsight?.criticalBlindspots || ['Project review velocity lag', 'Escalation response times']).map((p: string, i: number) => (
                      <li key={i} className="space-y-1">
                        {parseAISuggestion(p).map((part, pIdx) => (
                          <div key={pIdx} className="flex gap-3 text-sm text-slate-300 items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                            <div className="flex-1 min-w-0">
                              {part.label && (
                                <span className="font-semibold text-slate-100">{part.label}: </span>
                              )}
                              <span>{stripMarkdown(part.content)}</span>
                            </div>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Health gauge sidebar */}
            <div className="w-full md:w-64 lg:w-72 flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-lg text-center shrink-0">
              <div className="relative mb-4">
                <svg className="w-36 h-36 transform -rotate-90">
                  <circle cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/10" />
                  <circle
                    cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="12" fill="transparent"
                    className="text-indigo-400"
                    strokeDasharray={402.12}
                    strokeDashoffset={402.12 * (1 - (aiInsight?.healthScore || 75) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-semibold leading-none">{aiInsight?.healthScore || 75}%</span>
                </div>
              </div>
              <div className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-2">
                Health velocity
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {stripMarkdown(aiInsight?.healthRationale || 'Optimised for aggregate risk reduction against target baseline.')}
              </p>
            </div>
          </div>
        </section>

        {/* ─── CRITICAL RISK + COMPLIANCE GRID ─── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 print:break-inside-avoid">
          {/* Critical risk profile */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-500" /> Critical risk profile
              </h2>
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Top 5</span>
            </div>

            {highRisks.length === 0 ? (
              <EmptyState
                title="No critical risks"
                description="Portfolio risk profiles are currently below the critical escalation threshold."
                icon={ShieldCheck}
                className="bg-slate-50 rounded-lg py-10"
                compact
              />
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white overflow-hidden">
                {highRisks
                  .sort((a, b) => (b.residualRating || 0) - (a.residualRating || 0))
                  .slice(0, 5)
                  .map(r => {
                    const score = r.residualRating || 0;
                    const projectName = safeProjects.find(p => p.id === r.projectId)?.name || 'Portfolio';
                    return (
                      <li key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span className="text-xs font-semibold text-indigo-600 tabular-nums shrink-0 min-w-12">
                          #{r.id}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {stripMarkdown(r.title)}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{projectName}</p>
                        </div>
                        <span
                          className={clsx(
                            'inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-semibold shrink-0 tabular-nums',
                            score >= SEVERE_SCORE_THRESHOLD
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700',
                          )}
                        >
                          {score}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          {/* Compliance posture */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500" /> Compliance posture
              </h2>
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Aggregate</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatsCard
                icon={Layers}
                title="Portfolio completion"
                value={`${compPct}%`}
                size="sm"
                iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
                iconClassName="text-indigo-600 dark:text-indigo-400"
                progress
                progressValue={compPct}
                progressClassName="bg-emerald-500"
                progressLabel="Complete"
              />
              <StatsCard
                icon={Inbox}
                title="Outstanding items"
                value={filteredCompliance.length - compComplete}
                size="sm"
                iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
                iconClassName="text-amber-600 dark:text-amber-400"
              />
            </div>

            <div className="p-4 bg-slate-900 rounded-lg flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-0.5">
                  Regulatory trajectory
                </div>
                <div className="text-sm font-medium text-white">
                  {compComplete} of {filteredCompliance.length} tracked compliance requirements verified ({compPct}%) across the portfolio.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="pt-6 border-t border-slate-200 flex flex-col md:flex-row md:items-end md:justify-between gap-4 print:break-inside-avoid">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Master auditor</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">CedarGuard AI Engine</div>
            </div>
            <div>
              <div className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide">Issued</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums font-mono">
                {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          <p className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide md:text-right">
            Internal strategic assessment — Confidential
          </p>
        </footer>
      </div>
    </div>
  );
}

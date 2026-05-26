import React, { useState, useRef, useMemo } from 'react';
import { useStore, type RiskItem, type IssueItem } from '../store/useStore';
import { useHistoricalView } from '../hooks/useHistoricalView';
import { MonthPicker } from '../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../components/historicalReporting/HistoricalBanner';
import { HistoricalContentSkeleton } from '../components/historicalReporting/HistoricalContentSkeleton';
import type { LegacyArraySnapshot } from '../types/historicalReporting';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Shield, Briefcase, ArrowRight, ShieldCheck, CheckCircle2, Target, AlertTriangle, Binoculars, Loader2, AlertCircle, Flame, TrendingUp, TrendingDown, PoundSterling } from 'lucide-react';
import { clsx } from 'clsx';
import { StatsCard } from '../components/common/StatsCard';
import { Link, useSearchParams } from 'react-router';
import { stripMarkdown } from '../lib/utils';
import { analyzeStrategicInsights } from '../services/aiService';
import { differenceInMonths } from 'date-fns';
import { isAtLeastClientAdmin, isSuperAdmin, UserRole } from '../lib/roles';
import { ScanSearch, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { PremiumAIBanner } from '../components/common/PremiumAIBanner';
import { ServiceManagementBar } from '../components/ServiceManagementBar';

const PIE_COLORS: Record<string, string> = {
  Open: '#ef4444',
  Closed: '#10b981',
  Managed: '#6366f1',
  Mitigated: '#3b82f6',
  Tolerated: '#f59e0b',
  Resolved: '#10b981',
  'Implementing Fix': '#3b82f6',
  Escalated: '#ef4444',
  Investigating: '#f59e0b',
  Unassigned: '#94a3b8',
};


function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 text-white text-[11px] font-mono font-semibold uppercase tracking-wide px-4 py-2 mb-3">
      {children}
    </div>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-slate-700 text-white text-[11px] font-mono font-medium uppercase tracking-wide">
        {cols.map(c => <th key={c} className="px-3 py-2 text-left">{c}</th>)}
      </tr>
    </thead>
  );
}

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden', className)}>
      {children}
    </div>
  );
}

function MiniDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="h-40 flex items-center justify-center text-slate-300 text-xs">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#6366f1'} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any, n: any) => [v, n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RiskBadge({ label }: { label: string }) {
  const cls: Record<string, string> = {
    Insignificant: 'bg-slate-100 text-slate-600 border-slate-300',
    Minor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Moderate: 'bg-orange-100 text-orange-700 border-orange-300',
    Major: 'bg-red-100 text-red-700 border-red-300',
    Severe: 'bg-red-900 text-white border-red-900',
    MISALIGNED: 'bg-red-500 text-white border-red-600',
    ALIGNED: 'bg-emerald-500 text-white border-emerald-600',
    Pending: 'bg-slate-200 text-slate-600 border-slate-300',
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wide border', cls[label] || 'bg-slate-100 text-slate-600 border-slate-200')}>
      {label}
    </span>
  );
}

function getSeverityLabel(rating: number): string {
  if (rating >= 20) return 'Severe';
  if (rating >= 12) return 'Major';
  if (rating >= 8) return 'Moderate';
  if (rating >= 4) return 'Minor';
  return 'Insignificant';
}

function getAgeBucket(dateAdded?: string): string {
  if (!dateAdded) return '>1 Year';
  try {
    const months = differenceInMonths(new Date(), new Date(dateAdded));
    if (months < 3) return '0-3 Months';
    if (months < 6) return '3-6 Months';
    if (months < 12) return '6-12 Months';
    if (months < 24) return '>1 Year';
    return '>2 Years';
  } catch { return '>1 Year'; }
}

function StrategicInsightCard({ title, icon: Icon, children, delay = '0' }: { title: string, icon: React.ElementType, children: React.ReactNode, delay?: string }) {
  return (
    <div className={clsx(
      "bg-white/40 backdrop-blur-md border border-white/40 rounded-lg p-6 shadow-xl hover:shadow-2xl hover:bg-white/60 transition-all duration-500 group",
      `animate-in fade-in slide-in-from-bottom-4 duration-700 ${delay}`
    )}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/10 text-indigo-600 rounded-lg group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
            <Icon size={20} />
          </div>
          <h3 className="text-xs font-mono font-semibold text-slate-800 uppercase tracking-wide">{title}</h3>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/30 animate-pulse" />
      </div>
      {children}
    </div>
  );
}

const StrategicInsightItem: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex gap-3 mb-3 last:mb-0 group">
      <div className="mt-1 translate-y-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform" />
      </div>
      <p className="text-[11px] text-slate-600 leading-snug font-medium group-hover:text-indigo-950 transition-colors">
        {text}
      </p>
    </div>
  );
};

export function RiskDashboard() {
  const {
    risks, issues, projects, activeProgrammeId, activeProjectId, programmes, user,
    complianceItems, setActiveProject, setActiveProgramme,
  } = useStore();
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get('from') === 'initiation';
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
  const [strategicInsights, setStrategicInsights] = useState<{
    outlook: string;
    healthScore: number;
    healthRationale: string;
    criticalBlindspots: string[];
    strategicPriorities: string[];
    detailedSuggestions: string[];
  } | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);
  const generatingRef = useRef(false);

  //  historical view hook. When the user picks a past month
  // via the MonthPicker, the page swaps `safeRisks` for the snapshot's
  // frozen state and disables every action affordance.
  const historicalView = useHistoricalView<LegacyArraySnapshot<RiskItem>>({
    collection: 'risks',
  });
  const isHistorical = historicalView.isHistorical;
  const historicalRisks = useMemo<RiskItem[]>(() => {
    if (!isHistorical) return [];
    const out: RiskItem[] = [];
    for (const entry of historicalView.entries) {
      if (entry?.kind === 'legacyArray' && Array.isArray(entry.array)) {
        out.push(...entry.array);
      }
    }
    return out;
  }, [isHistorical, historicalView.entries]);

  const liveRisks = Array.isArray(risks) ? risks : [];
  const safeRisks = isHistorical ? historicalRisks : liveRisks;
  const safeIssues = Array.isArray(issues) ? issues : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];

  // Visibility filtering logic
  const visibleProgrammes = safeProgrammes.filter(pr => {
    if (userIsSuperAdmin) return true;
    if (userRole === 'client_admin') return true; // Trust the API filtered list
    return false;
  });

  const visibleProjects = safeProjects.filter(p => {
    if (isSuperAdmin(user?.email, userRole)) return true;
    if (userRole === 'client_admin') return true; // Trust the API filtered list
    return p.pmId === user?.uid || p.projectManagerId === user?.uid || p.createdBy === user?.uid || p.createdBy === user?.email;
  });

  const filteredRisks = safeRisks.filter(r => {
    // Bug 8 fix: use only ID fields — r.project and r.programme are name strings, not IDs
    const rProjectId = r.projectId;
    const rProgrammeId = r.programmeId;

    if (activeProjectId) return rProjectId === activeProjectId;
    if (activeProgrammeId) return rProgrammeId === activeProgrammeId;

    // Detailed visibility check for Portfolio Aggregate
    return visibleProjects.some(p => p.id === rProjectId) ||
           visibleProgrammes.some(pr => pr.id === rProgrammeId);
  });

  const filteredIssues = safeIssues.filter((i: IssueItem) => {
    if (activeProjectId) return i.projectId === activeProjectId;
    if (activeProgrammeId) return i.programmeId === activeProgrammeId;
    
    // Detailed visibility check for Portfolio Aggregate
    return visibleProjects.some(p => p.id === i.projectId) || 
           visibleProgrammes.some(pr => pr.id === i.programmeId);
  });

  const handleGenerateStrategicInsights = async () => {
    //  block AI generation while viewing a frozen snapshot.
    if (isHistorical) {
      toast.error('Switch to live data to generate fresh strategic insights.');
      return;
    }
    // Bug 6 fix: useRef double-submit guard
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGeneratingAI(true);
    setAiError(null);
    try {
      const activeProject = safeProjects.find(p => p.id === activeProjectId);
      const activeProg = safeProgrammes.find(p => p.id === activeProgrammeId);

      // Bug 4 fix: compute real compliance posture from store data
      const safeComplianceItems = Array.isArray(complianceItems) ? complianceItems : [];
      const activeCompliance = safeComplianceItems.filter(c => {
        if (activeProjectId) return c.projectId === activeProjectId && c.status === 'applicable';
        if (activeProgrammeId) return c.programmeId === activeProgrammeId && c.status === 'applicable';
        return c.status === 'applicable';
      });
      const complianceComplete = activeCompliance.filter(
        c => c.stage === 'Live' || c.stage === 'Archived'
      ).length;

      const result = await analyzeStrategicInsights({
        compliance: {
          total: activeCompliance.length,
          completed: complianceComplete,
          context: activeProject?.name || activeProg?.name || 'Portfolio',
        },
        risks: filteredRisks,
        issues: filteredIssues,
        // Bug 5 fix: filter out undefined if project not found
        // Programme context: pass only projects belonging to that programme
        projects: activeProjectId
          ? [activeProject].filter(Boolean)
          : activeProgrammeId
            ? safeProjects.filter(p => p.programmeId === activeProgrammeId)
            : safeProjects,
      }, user);
      setStrategicInsights(result);
    } catch (err: any) {
      // Bug 7 fix: console.error + toast.error
      console.error('Strategic insights generation failed:', err);
      const msg = 'Failed to generate strategic insights. Please try again.';
      setAiError(msg);
      toast.error(msg);
    } finally {
      setGeneratingAI(false);
      generatingRef.current = false;
    }
  };

  const handleResetInsights = () => {
    setStrategicInsights(null);
    setAiError(null);
  };

  React.useEffect(() => {
    const pId = searchParams.get('projectId');
    const prId = searchParams.get('programmeId');
    if (pId && activeProjectId !== pId) {
      setActiveProject(pId);
    } else if (prId && activeProgrammeId !== prId) {
      setActiveProgramme(prId);
    }
  }, [searchParams, activeProjectId, activeProgrammeId, setActiveProject, setActiveProgramme]);

  // ─── KPI calculations ───────────────────────────────────────────────────
  const totalRisks = filteredRisks.length;
  const openRisks = filteredRisks.filter(r => r.status === 'Open').length;
  const highSevere = filteredRisks.filter(r => (r.residualRating || 0) >= 12).length;
  const escalated = filteredRisks.filter(r => r.status === 'Escalated' || r.escalated).length;

  // Removed empty state screen to always show the dashboard layout for all roles.

  const getALE = (r: RiskItem, residual = true) => {
    const impact = residual ? (r.residualImpact || 0) : (r.grossImpact || 0);
    const prob = residual ? (r.residualProb || 0) : (r.grossProb || 0);
    const impV = typeof impact === 'string' ? parseFloat((impact as string).replace(/[^0-9.]/g, '')) : (impact as number);
    const probV = typeof prob === 'string' ? parseFloat((prob as string).replace(/[^0-9.]/g, '')) : (prob as number);
    return impV * (probV > 1 ? probV / 100 : probV);
  };

  const totalGrossALE = filteredRisks.reduce((s, r) => s + getALE(r, false), 0);
  const totalResidualALE = filteredRisks.reduce((s, r) => s + getALE(r, true), 0);
  const reduction = totalGrossALE > 0 ? Math.round(((totalGrossALE - totalResidualALE) / totalGrossALE) * 100) : 0;

  // ─── Residual risk severity breakdown ──────────────────────────────────
  const severityBuckets: Record<string, number> = { Insignificant: 0, Minor: 0, Moderate: 0, Major: 0, Severe: 0 };
  filteredRisks.forEach(r => { severityBuckets[getSeverityLabel(r.residualRating || 0)]++; });
  const severityRows = Object.entries(severityBuckets).map(([k, v]) => ({ label: k, count: v }));
  const severityPieData = severityRows.filter(r => r.count > 0).map(r => ({ name: r.label, value: r.count }));

  // ─── Status breakdown ───────────────────────────────────────────────────
  const statusBuckets: Record<string, number> = { Closed: 0, Managed: 0, Mitigated: 0, Open: 0, Tolerated: 0 };
  filteredRisks.forEach(r => { const k = r.status || 'Open'; statusBuckets[k] = (statusBuckets[k] || 0) + 1; });
  const statusPieData = Object.entries(statusBuckets).map(([name, value]) => ({ name, value }));

  // ─── Risk appetite alignment ────────────────────────────────────────────
  const appetiteGroups = { MISALIGNED: 0, ALIGNED: 0, Pending: 0 };
  filteredRisks.forEach(r => {
    const rating = r.residualRating || 0;
    const appetite = r.appetite || '';
    if (!appetite) { appetiteGroups.Pending++; }
    else if (rating > 15) { appetiteGroups.MISALIGNED++; }
    else { appetiteGroups.ALIGNED++; }
  });
  const appetiteBarData = [
    { name: 'Misaligned', value: appetiteGroups.MISALIGNED, fill: '#ef4444' },
    { name: 'Aligned', value: appetiteGroups.ALIGNED, fill: '#10b981' },
    { name: 'Pending', value: appetiteGroups.Pending, fill: '#94a3b8' },
  ];

  // ─── Issue status breakdown ─────────────────────────────────────────────
  const issueBuckets: Record<string, number> = {
    '4. Resolved': 0, '3. Implementing Fix': 0, '2. Escalated': 0, '1. Investigating': 0, '5. Unassigned': 0
  };
  filteredIssues.forEach((i: IssueItem) => { issueBuckets[i.status] = (issueBuckets[i.status] || 0) + 1; });
  const issuePieData = [
    { name: 'Resolved', value: issueBuckets['4. Resolved'] },
    { name: 'Implementing Fix', value: issueBuckets['3. Implementing Fix'] },
    { name: 'Escalated', value: issueBuckets['2. Escalated'] },
    { name: 'Investigating', value: issueBuckets['1. Investigating'] },
    { name: 'Unassigned', value: issueBuckets['5. Unassigned'] },
  ].filter(d => d.value > 0);

  // ─── Open risks by age ──────────────────────────────────────────────────
  const ageOrder = ['0-3 Months', '3-6 Months', '6-12 Months', '>1 Year', '>2 Years'];
  const ageBuckets: Record<string, number> = Object.fromEntries(ageOrder.map(k => [k, 0]));
  filteredRisks.filter(r => r.status === 'Open').forEach(r => {
    const bucket = getAgeBucket(r.dateAdded);
    ageBuckets[bucket]++;
  });
  const ageBarData = ageOrder.map(b => ({ name: b, value: ageBuckets[b] }));

  // ─── Programme health summary ───────────────────────────────────────────
  const healthRows = [
    { label: 'Risk Register — Open', count: openRisks, notes: `${openRisks} risks need action` },
    { label: 'Issues Log — Open', count: filteredIssues.filter((i: IssueItem) => i.status !== '4. Resolved').length, notes: `${filteredIssues.filter((i: IssueItem) => i.status === '2. Escalated').length} escalated` },
    { label: 'High/Severe Risks', count: highSevere, notes: `${highSevere} require immediate action` },
    { label: isPM ? 'Escalated for Review' : 'Escalated to Programme', count: escalated, notes: `${escalated} escalated risks` },
    { label: 'Closed / Resolved', count: filteredRisks.filter(r => r.status === 'Closed').length + filteredIssues.filter((i: IssueItem) => i.status === '4. Resolved').length, notes: 'Combined Risk/Issue closure' },
  ];

  const healthPieData = [
    { name: 'Open', value: openRisks },
    { name: 'Managed', value: filteredRisks.filter(r => r.status === 'Managed').length },
    { name: 'Mitigated', value: filteredRisks.filter(r => r.status === 'Mitigated').length },
    { name: 'Closed', value: filteredRisks.filter(r => r.status === 'Closed').length },
    { name: 'Tolerated', value: filteredRisks.filter(r => r.status === 'Tolerated').length },
  ].filter(d => d.value > 0);

  // ─── Risk category performance (RAG) ───────────────────────────────────
  const categories = [...new Set(filteredRisks.map(r => r.category).filter(Boolean))];
  const catPerf = categories.slice(0, 6).map(cat => {
    const catRisks = filteredRisks.filter(r => r.category === cat);
    const red = catRisks.filter(r => (r.residualRating || 0) >= 16).length;
    const amber = catRisks.filter(r => { const rt = r.residualRating || 0; return rt >= 8 && rt < 16; }).length;
    const green = catRisks.filter(r => (r.residualRating || 0) < 8).length;
    return { name: cat.replace('Financial', 'Finance').replace(/ \/.*/, ''), red, amber, green };
  });

  const activeProjName = safeProjects.find(p => p.id === activeProjectId)?.name || '';
  const activeProgName = safeProgrammes.find(p => p.id === activeProgrammeId)?.name || '';
  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);

  const aleData = categories.map(cat => {
    const catRisks = filteredRisks.filter(r => r.category === cat);
    return {
      name: cat.replace('Financial', 'Finance').replace(/ \/.*/, ''),
      gross: catRisks.reduce((sum, r) => sum + getALE(r, false), 0),
      residual: catRisks.reduce((sum, r) => sum + getALE(r, true), 0)
    };
  }).filter(d => d.gross > 0 || d.residual > 0).slice(0, 6);

  return (
    <>
    {/* Bug 10 fix: full-screen overlay during strategic outlook generation*/}
    {generatingAI && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin shadow-xl" />
        <div className="text-center space-y-1">
          <p className="text-white font-mono font-semibold text-xs uppercase tracking-wide">Generating Strategic Outlook</p>
          <p className="text-slate-400 text-xs font-medium">Analysing all risks, issues and compliance posture…</p>
        </div>
      </div>
    )}
    <div className="max-w-7xl mx-auto space-y-5 px-4 md:px-0 pb-12 pb-safe">
      <ServiceManagementBar className="mb-4" />

      {/* month picker for historical view. Placed AFTER
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
          defaultCorrectionCollection="risks"
          emptyReason={historicalView.emptyReason}
          activatedYearMonth={historicalView.activatedYearMonth}
          surfaceLabel="risk dashboard"
        />
      )}

      {historicalView.loading && <HistoricalContentSkeleton variant="stats-grid" />}

      {!historicalView.loading && <>


      <PremiumAIBanner
        title="Deep Risk Inquiry"
        description="Analyze project risks, identify strategic blindspots, or seek guidance on mitigation strategies. Our CedarGuard AI will scan your entire risk register to provide instant, field-specific insights."
        buttonText="Launch AI Risk Advisor"
        onAction={() => setIsAIInquiryOpen(true)}
        icon={ScanSearch}
        variant="indigo"
      />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Target size={14} className="text-amber-500 fill-amber-500" />
          Strategic Intelligence
        </h2>
        {strategicInsights && (
          <button 
            onClick={handleResetInsights}
            className="text-[11px] font-mono font-semibold text-indigo-600 uppercase tracking-wide hover:text-indigo-800 transition-colors flex items-center gap-1.5 group"
          >
            <RefreshCcw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
            Reset Analysis
          </button>
        )}
      </div>

      <PremiumAIBanner 
        title="Strategic Intelligence Engine"
        description={`Our advanced neural model is analyzing ${totalRisks} risks and ${filteredIssues.length} issues to generate cross-functional strategic insights and portfolio health metrics.`}
        buttonText={generatingAI ? "Processing Signals..." : "Generate Strategic Outlook"}
        onAction={handleGenerateStrategicInsights}
        isLoading={generatingAI}
        icon={Briefcase}
        variant="slate"
      />

      {/* Strategic Insights Results*/}
      {strategicInsights && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <StrategicInsightCard title="Portfolio Health" icon={ShieldCheck}>
            <div className="flex flex-col items-center text-center p-2">
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="58" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                  <circle 
                    cx="64" cy="64" r="58" fill="transparent" stroke="#4f46e5" strokeWidth="8" 
                    strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - strategicInsights.healthScore / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-medium text-slate-800 tabular-nums">{strategicInsights.healthScore}</span>
                  <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide">INDEX</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                "{stripMarkdown(strategicInsights.healthRationale)}"
              </p>
            </div>
          </StrategicInsightCard>

          <StrategicInsightCard title="Strategic Priorities" icon={Target} delay="delay-150">
            <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {strategicInsights.strategicPriorities.map((p: string, i: number) => (
                <StrategicInsightItem key={`priority-${i}`} text={stripMarkdown(p)} />
              ))}
            </div>
          </StrategicInsightCard>

          <StrategicInsightCard title="Blindspot Detection" icon={Binoculars} delay="delay-300">
            <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {strategicInsights.criticalBlindspots.map((b: string, i: number) => (
                <StrategicInsightItem key={`blindspot-${i}`} text={stripMarkdown(b)} />
              ))}
            </div>
          </StrategicInsightCard>

          <div className="lg:col-span-3">
            <StrategicInsightCard title="Strategic Outlook & Executive Summary" icon={Briefcase} delay="delay-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-indigo-50/50 rounded-lg p-5 border border-indigo-100/50 relative">
                  <div className="absolute -top-3 -left-3 p-2 bg-indigo-600 text-white rounded-lg shadow-lg">
                    <Target size={16} />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-semibold ">
                    {stripMarkdown(strategicInsights.outlook)}
                  </p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-mono font-semibold text-indigo-500 uppercase tracking-wide">Detailed Implementation Roadmap</h4>
                  <div className="space-y-3">
                    {strategicInsights.detailedSuggestions.slice(0, 4).map((s, i) => (
                      <div key={i} className="flex gap-3 items-start group">
                        <div className="mt-1 p-1 bg-white border border-slate-200 rounded text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <CheckCircle2 size={12} />
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug font-medium line-clamp-2 group-hover:line-clamp-none transition-all cursor-pointer">
                          {stripMarkdown(s)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </StrategicInsightCard>
          </div>
        </div>
      )}

      {aiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 animate-in fade-in zoom-in-95">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-sm font-bold">{aiError}</p>
        </div>
      )}

      {/* KPI Strip*/}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <StatsCard
          icon={Shield}
          title="Total Risks"
          value={totalRisks}
          size="sm"
          iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
          iconClassName="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          icon={AlertCircle}
          title="Open"
          value={openRisks}
          size="sm"
          iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
          iconClassName="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          icon={Flame}
          title="High / Severe"
          value={highSevere}
          size="sm"
          iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
          iconClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          icon={TrendingUp}
          title="Escalated"
          value={escalated}
          size="sm"
          iconBgClassName="bg-violet-50 dark:bg-violet-500/10"
          iconClassName="text-violet-600 dark:text-violet-400"
        />
        <StatsCard
          icon={TrendingDown}
          title="Risk Reduction"
          value={`${reduction}%`}
          size="sm"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-500/10"
          iconClassName="text-emerald-600 dark:text-emerald-400"
        />
        <StatsCard
          icon={PoundSterling}
          title="Residual ALE"
          value={fmt(totalResidualALE)}
          size="sm"
          iconBgClassName="bg-sky-50 dark:bg-sky-500/10"
          iconClassName="text-sky-600 dark:text-sky-400"
        />
      </div>

      {/* Row 1: Residual Risk Summary | Register Status | Appetite Alignment*/}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        {/* Residual Risk Summary*/}
        <DashCard>
          <SectionTitle>Residual Risk Summary</SectionTitle>
          <div className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-2 min-w-[300px]">
                <TableHeader cols={['Risk Category', 'Count', 'Notes']} />
                <tbody className="divide-y divide-slate-100">
                  {severityRows.map(r => (
                    <tr key={r.label} className="hover:bg-slate-50">
                      <td className="px-3 py-2"><RiskBadge label={r.label} /></td>
                      <td className="px-3 py-2 font-medium text-slate-800 tabular-nums">{r.count}</td>
                      <td className="px-3 py-2 text-slate-400 text-[11px]">Risks in this category</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MiniDonut data={severityPieData} />
          </div>
        </DashCard>

        {/* Risk Register Status Updates*/}
        <DashCard>
          <SectionTitle>Risk Register Status Updates</SectionTitle>
          <div className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-2 min-w-[300px]">
                <TableHeader cols={['Status', 'Count']} />
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(statusBuckets).map(([status, count]) => (
                    <tr key={status} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wide border"
                          style={{ background: (PIE_COLORS[status] || '#6366f1') + '20', color: PIE_COLORS[status] || '#6366f1', borderColor: (PIE_COLORS[status] || '#6366f1') + '40' }}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-800">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MiniDonut data={statusPieData.filter(d => d.value > 0)} />
          </div>
        </DashCard>

        {/* Risk Appetite Alignment*/}
        <DashCard>
          <SectionTitle>Risk Appetite Alignment</SectionTitle>
          <div className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-2 min-w-[300px]">
                <TableHeader cols={['Alignment', 'Count', 'Description']} />
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2"><RiskBadge label="MISALIGNED" /></td>
                    <td className="px-3 py-2 font-bold text-slate-800">{appetiteGroups.MISALIGNED}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-400">Risk exceeds stated appetite</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2"><RiskBadge label="ALIGNED" /></td>
                    <td className="px-3 py-2 font-bold text-slate-800">{appetiteGroups.ALIGNED}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-400">Risk within appetite level</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2"><RiskBadge label="Pending" /></td>
                    <td className="px-3 py-2 font-bold text-slate-800">{appetiteGroups.Pending}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-400">Appetite not yet determined</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={appetiteBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {appetiteBarData.map(d => <Cell key={d.name} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      </div>

      {/* Row 2: Issue Status | Open Risks by Age*/}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        {/* Issue Status Updates*/}
        <DashCard>
          <SectionTitle>Issue Status Updates</SectionTitle>
          <div className="p-3">
            <div className="text-[10px] text-slate-400 mb-2 font-medium">{filteredIssues.length} total issues · {filteredIssues.filter((i: IssueItem) => i.status !== '4. Resolved').length} open</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-4 min-w-[300px]">
                <TableHeader cols={['Status Category', 'Count']} />
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(issueBuckets).map(([status, count]) => (
                    <tr key={status} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5">
                        <span className="text-[11px] font-medium text-slate-700">{status}</span>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-slate-800 tabular-nums">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center mb-2">
              <MiniDonut data={issuePieData} />
            </div>
          </div>
        </DashCard>

        {/* Open Risks by Age Bucket*/}
        <DashCard>
          <SectionTitle>Open Risks by Age Bucket</SectionTitle>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[200px]">
                  <TableHeader cols={['Age Bucket', 'Open Risk Count']} />
                  <tbody className="divide-y divide-slate-100">
                    {ageOrder.map(b => (
                      <tr key={b} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{b}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-800 tabular-nums">{ageBuckets[b]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="w-full h-full flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ageBarData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-25} textAnchor="end" height={36} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="value" fill="#22c55e" radius={[2, 2, 0, 0]}>
                    {ageBarData.map((d, i) => (
                      <Cell key={i} fill={d.value > 3 ? '#ef4444' : d.value > 1 ? '#f59e0b' : '#22c55e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </DashCard>
      </div>

      {/* Row 3: Programme Health | Risk Category Performance*/}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[400ms]">
        {/* Overall {isPM || activeProjectId ? 'Project': 'Programme'} Health Summary*/}
        <DashCard>
          <SectionTitle>Overall {isPM || activeProjectId ? 'Project' : 'Programme'} Health Summary</SectionTitle>
          <div className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-4 min-w-[400px]">
                <TableHeader cols={['Status Category', 'Count', 'Critical Issues']} />
                <tbody className="divide-y divide-slate-100">
                  {healthRows.map(r => (
                    <tr key={r.label} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium text-slate-700">{r.label}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-900 tabular-nums">{r.count}</td>
                      <td className="px-3 py-1.5 text-[11px] text-slate-400">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center mb-2">
              <MiniDonut data={healthPieData} />
            </div>
          </div>
        </DashCard>

        {/* Risk Category Performance*/}
        <DashCard>
          <SectionTitle>Risk Category Performance</SectionTitle>
          <div className="p-3">
            {catPerf.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs mb-3 min-w-[350px]">
                    <thead>
                      <tr className="bg-slate-700 text-white text-[11px] font-mono font-medium uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">Risk Category</th>
                        <th className="px-3 py-2 text-center bg-red-700">Red</th>
                        <th className="px-3 py-2 text-center bg-amber-600">Amber</th>
                        <th className="px-3 py-2 text-center bg-emerald-700">Green</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {catPerf.map(c => (
                        <tr key={c.name} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-medium text-slate-700 truncate max-w-[150px]" title={c.name}>{c.name}</td>
                          <td className="px-3 py-1.5 text-center font-medium text-red-600 tabular-nums">{c.red || 0}</td>
                          <td className="px-3 py-1.5 text-center font-medium text-amber-600 tabular-nums">{c.amber || 0}</td>
                          <td className="px-3 py-1.5 text-center font-medium text-emerald-600 tabular-nums">{c.green || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={catPerf} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 10 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="red" fill="#ef4444" stackId="a" name="Red" />
                    <Bar dataKey="amber" fill="#f59e0b" stackId="a" name="Amber" />
                    <Bar dataKey="green" fill="#10b981" stackId="a" name="Green" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center py-12 text-slate-300 text-xs">No category data available</div>
            )}
          </div>
        </DashCard>
      </div>

      {/* Row 4: ALE per workstream — full width*/}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[500ms]">
        <DashCard>
        <div className="p-6">
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wide">ALE BY WORKSTREAM (IN GBP £)</h3>
            <div className="flex gap-4 text-[11px] font-mono font-medium uppercase tracking-wide">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Gross ALE</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Residual ALE</div>
            </div>
          </div>
          {aleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={aleData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `£${Math.round(v/1000)}k` : `£${v}`} />
                <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 800 }} 
                    formatter={(v: any) => [fmt(v)]} 
                />
                <Bar dataKey="gross" fill="#f43f5e" name="Gross ALE" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="residual" fill="#6366f1" name="Residual ALE" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 text-xs gap-2">
              <Shield className="w-8 h-8" />
              <span>No ALE data — add financial impact and probability to your risks</span>
              <Link to={`/risk/register${fromInitiation ? '?from=initiation' : ''}`} className="text-indigo-500 hover:underline flex items-center gap-1 font-bold">Go to Risk Register <ArrowRight className="w-3 h-3" /></Link>
            </div>
          )}
        </div>
      </DashCard>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[600ms]">
        <DashCard>
          <SectionTitle>Immediate Focus — Critical Risks</SectionTitle>
          <div className="p-3">
            {filteredRisks.filter(r => (r.residualRating || 0) >= 12).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Bug 9 fix: filter to ≥12 before sorting — prevents non-critical risks appearing here*/}
                {filteredRisks.filter(r => (r.residualRating || 0) >= 12).sort((a, b) => (b.residualRating || 0) - (a.residualRating || 0)).slice(0, 6).map(r => (
                  <div key={r.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all bg-slate-50 hover:bg-white">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-[11px] font-mono font-medium text-slate-400 whitespace-nowrap tabular-nums">{r.id}</span>
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-mono font-medium tabular-nums', (r.residualRating || 0) >= 16 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                        Score: {r.residualRating || 0}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-2" title={stripMarkdown(r.title)}>
                      {stripMarkdown(r.title || '')}
                      {(r.status === 'Escalated' || r.escalated) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{stripMarkdown(r.desc || '')}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400">{r.category}</span>
                      <div className="flex items-center gap-1.5">
                        {(r.status === 'Escalated' || r.escalated) && (
                          <span className="text-[10px] font-mono font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase tracking-wide border border-purple-100">
                            Escalated
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide">{r.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-slate-300 gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                <p className="text-xs">No critical risks — safe zone</p>
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link to={`/risk/register${fromInitiation ? '?from=initiation' : ''}`} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View Full Register <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </DashCard>
      </div>
    </>}
    </div>

    <AIInquiryPopup
      isOpen={isAIInquiryOpen} 
      onClose={() => setIsAIInquiryOpen(false)} 
      context={`Risk Dashboard Analysis for ${activeProgName || activeProjName || 'Portfolio'}. Risks: ${totalRisks}, Issues: ${filteredIssues.length}, High/Severe: ${highSevere}, Escalated: ${escalated}, Potential Loss: ${fmt(totalResidualALE)}`}
    />
    </>
  );
}

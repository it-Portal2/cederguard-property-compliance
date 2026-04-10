import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { DOMAINS, STAGES, getRIBALabelFull } from '../data/complianceData';
import { useNavigate, useSearchParams } from 'react-router';
import { Building2, User, ShieldCheck, AlertCircle, PoundSterling, Download, BarChart, Target, ChevronDown, Loader2, ArrowRight, AlertTriangle, Layers, Shield, ArrowLeft, Database, ListChecks, Presentation, Plus, PlusCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router';
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { stripMarkdown } from '../lib/utils';
import { api, ApiError } from '../lib/api';
import { analyzeComplianceLifecycle, analyzeComplianceSentiment, analyzeSensitivity } from '../services/aiService';
import { AIErrorAlert } from '../components/AIErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { isSuperAdmin, isAtLeastClientAdmin, canCreateProject, canCreateProgramme, UserRole } from '../lib/roles';

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

  return (
    <div className="max-w-6xl mx-auto pb-20 print:p-0">
      {/* ─── HEADER (Match 16.png) ─── */}
      <div className="bg-white p-6 md:p-10 flex flex-col lg:flex-row justify-between items-start gap-8 rounded-t-[2rem] md:rounded-t-[3rem] print:rounded-none">
        <div className="space-y-6">
            <button 
                onClick={() => navigate('/reporting/programme')}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors text-[10px] font-black uppercase tracking-widest mb-4 group/back print:hidden"
            >
                <ArrowLeft className="w-3 h-3 transition-transform group-hover/back:-translate-x-1" />
                Back to Project List
            </button>
            <h1 className="text-2xl md:text-4xl font-black text-[#111827] tracking-tighter uppercase leading-[0.9] flex flex-col">
                <span>Project Risk &</span>
                <span className="text-[#111827]">Compliance Report</span>
            </h1>

            <div className="flex flex-wrap gap-4 md:gap-8 items-center">
                {/* Programme Selector for Client Admin/Admin */}
                {(userIsSuperAdmin || userRole === 'client_admin') && (
                  <div className="relative group w-full md:max-w-sm">
                    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-white transition-all cursor-pointer shadow-sm">
                        <Layers className="w-4 h-4 text-indigo-500 shrink-0 group-hover:text-indigo-600 transition-colors" />
                        <div className="relative flex-1 min-w-0">
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
                                className="text-[11px] font-black text-indigo-700 uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer appearance-none pr-8 w-full truncate"
                            >
                                <option value="">All Portfolios</option>
                                {filteredProgrammes.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-indigo-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-600 transition-all" />
                        </div>
                    </div>
                  </div>
                )}

                {/* Project Selector */}
                <div className="relative group w-full md:max-w-sm">
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-white transition-all cursor-pointer shadow-sm">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-indigo-500 transition-colors" />
                        <div className="relative flex-1 min-w-0">
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
                                className="text-[11px] font-black text-slate-700 uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer appearance-none pr-8 w-full truncate"
                            >
                                <option value="">{activeProgrammeId ? 'All Projects in Programme' : 'Select Project Report'}</option>
                                {filteredProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-all" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:border-l md:border-slate-200 md:pl-8">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                        PM: <span className="text-slate-900">{currentProject?.manager || 'Unassigned'}</span>
                    </span>
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto print:hidden items-center">
            {canCreateProgramme(userRole) && (
              <Link 
                to="/programmes/new"
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={14} />
                New Programme
              </Link>
            )}

            {canCreateProject(userRole) && (
              <Link 
                to="/initiate"
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
              >
                <PlusCircle size={14} />
                New Project
              </Link>
            )}

            <button onClick={() => window.print()} className="flex items-center justify-center gap-3 px-8 py-3.5 bg-[#111827] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95">
                <Download className="w-4 h-4" /> Export Report
            </button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-10 pt-0 space-y-12 rounded-b-[2rem] md:rounded-b-[3rem] shadow-sm print:shadow-none italic font-medium">
        <div className="h-2 bg-[#111827] rounded-full w-full mb-12 opacity-10" />

        {!activeProjectId ? (
            <div className="py-20 text-center flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                    <Presentation className="w-10 h-10 text-slate-200" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900">No Project Data to Visualize</h3>
                    <p className="text-sm text-slate-400 font-bold mt-1">Please select an active project from the dropdown above to generate the report.</p>
                </div>
            </div>
        ) : (
            <>
                {/* ─── KEY PERFORMANCE INDICATORS ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    <div className="bg-rose-50/50 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-rose-100/50 flex flex-col justify-between min-h-[160px] md:min-h-[200px] shadow-sm">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-white rounded-2xl shadow-sm">
                                <AlertCircle className="w-6 h-6 text-rose-500" />
                            </div>
                            <div className="text-3xl md:text-4xl font-black text-[#111827] tracking-tighter tabular-nums">{highRisks.length}</div>
                        </div>
                        <div className="mt-8">
                            <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">High Volatility Risk</div>
                            <div className="text-sm font-black text-slate-800">Critical risks requiring escalation</div>
                        </div>
                    </div>

                    <div className="bg-indigo-50/50 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-indigo-100/50 flex flex-col justify-between min-h-[160px] md:min-h-[200px] shadow-sm">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-white rounded-2xl shadow-sm">
                                <PoundSterling className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div className="text-3xl md:text-4xl font-black text-[#111827] tracking-tighter tabular-nums">{fGBP(totalALE)}</div>
                        </div>
                        <div className="mt-8">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Financial Exposure</div>
                            <div className="text-sm font-black text-slate-800">Residual value at risk (ALE)</div>
                        </div>
                    </div>

                    <div className="bg-emerald-50/50 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-emerald-100/50 flex flex-col justify-between min-h-[160px] md:min-h-[200px] shadow-sm">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-white rounded-2xl shadow-sm">
                                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div className="text-3xl md:text-4xl font-black text-[#111827] tracking-tighter tabular-nums">{compPct}%</div>
                        </div>
                        <div className="mt-8">
                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Compliance Posture</div>
                            <div className="text-sm font-black text-slate-800">Statutory review completion status</div>
                        </div>
                    </div>
                </div>

                {/* ─── DETAILED PROJECT RISKS ─── */}
                <div className="space-y-6 pt-6">
                    <div className="flex justify-between items-end border-b pb-4">
                        <h2 className="text-xl font-black text-[#111827] flex items-center gap-3">
                            <ListChecks className="w-6 h-6 text-indigo-500" /> Itemised Project Risks
                        </h2>
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Showing {projectRisks.length} active risks</div>
                    </div>

                    <div className="border border-slate-100 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[800px] lg:min-w-0">
                            <thead className="bg-[#111827] text-white text-[9px] font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-5">Ref</th>
                                    <th className="px-8 py-5">Risk Description</th>
                                    <th className="px-8 py-5 text-center">Score</th>
                                    <th className="px-8 py-5">Response</th>
                                    <th className="px-8 py-5 text-right">Residual ALE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {projectRisks.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No active risks logged for this project</td>
                                    </tr>
                                ) : projectRisks.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-8 py-5 font-black text-indigo-600 text-[11px]">#{r.id}</td>
                                        <td className="px-8 py-5">
                                            <div className="text-xs font-black text-slate-800 leading-relaxed mb-0.5">{stripMarkdown(r.title)}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{r.category}</div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={clsx(
                                                "inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black",
                                                (r.residualRating || 0) >= 16 ? "bg-rose-100 text-rose-700" :
                                                (r.residualRating || 0) >= 12 ? "bg-orange-100 text-orange-700" :
                                                "bg-emerald-100 text-emerald-700"
                                            )}>
                                                {r.residualRating || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                                                {r.response || 'Tolerate'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums text-xs">{fGBP(r.residualALE)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>

                {/* ─── COMPLIANCE & EXPOSURE ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-6">
                    {/* Compliance Progress */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-[#111827] flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-emerald-600" /> Compliance Performance
                        </h2>
                        <div className="bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-sm space-y-8">
                            {/* Compliance Items Overview */}
                            <div className="space-y-4">
                                {projectCompliance.slice(0, 5).map((item: any, idx) => (
                                    <div key={idx} className="flex items-center justify-between group">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 leading-tight">{stripMarkdown(item.req)}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.domain}</span>
                                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest border-l border-slate-200 pl-2">{getRIBALabelFull(item.stage_link)}</span>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                            (item.stage === 'Live' || item.stage === 'Archived') ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                            item.stage === 'In Progress' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                            "bg-rose-50 text-rose-600 border border-rose-100"
                                        )}>
                                            <div className={clsx("w-1.5 h-1.5 rounded-full",
                                                (item.stage === 'Live' || item.stage === 'Archived') ? 'bg-emerald-500' :
                                                item.stage === 'In Progress' ? 'bg-amber-500' : 'bg-rose-500'
                                            )} />
                                            {item.stage || 'Information Gap'}
                                        </div>
                                    </div>
                                ))}
                                {projectCompliance.length === 0 && (
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-4">No compliance items assigned</p>
                                )}
                            </div>

                            <div className="pt-8 border-t border-slate-50 flex gap-6">
                                <div className="flex-1 text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="text-2xl font-black text-[#111827]">{projectCompliance.length}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Req.</div>
                                </div>
                                <div className="flex-1 text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="text-2xl font-black text-emerald-600">{compComplete}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Complete</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exposure Chart */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-[#111827] flex items-center gap-3">
                            <BarChart className="w-6 h-6 text-indigo-500" /> Exposure by Category
                        </h2>
                        <div className="bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-sm h-full max-h-[460px]">
                            {categoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <RechartsBarChart data={categoryData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tick={{fontSize: 10, fontWeight: 900, fill: '#64748b', textTransform: 'uppercase'}} width={100} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{fontSize: 10, borderRadius: 16, border: 'none', fontWeight: 800, color: '#111827'}} />
                                        <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24} />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <BarChart className="w-12 h-12 mb-4 opacity-20" />
                                    <span className="text-xs font-black uppercase tracking-widest">Insufficient Chart Data</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── AI STRATEGIC INTELLIGENCE (New Tabbed Interface) ─── */}
                <div className="bg-slate-50/50 rounded-[2rem] md:rounded-[3rem] border border-slate-200/60 p-6 md:p-10 mt-12 transition-all hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Strategic Intelligence</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Cedar Predictive AI • Multi-Vector Analysis</p>
                            </div>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl gap-1 self-stretch md:self-auto overflow-x-auto hide-scrollbar whitespace-nowrap">
                            {(['sensitivity', 'lifecycle', 'sentiment'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveAiTab(tab)}
                                    className={clsx(
                                        "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
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
                        {activeAiTab === 'sensitivity' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="max-w-2xl mx-auto text-center space-y-4">
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Predictive Sensitivity Guardrails</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                        Cedar stress-tests {projectRisks.length} risk variables and ALE exposure to identify latent volatility in {currentProject?.name}.
                                    </p>
                                    
                                    {aiError && (
                                        <div className="mt-4 max-w-xl mx-auto">
                                            <AIErrorAlert 
                                                error={aiError} 
                                                onRetry={() => {
                                                    setIsAnalyzing(true);
                                                    setAiError(null);
                                                    analyzeSensitivity(currentProject, projectRisks, compPct, totalALE)
                                                        .then(res => {
                                                            setAnalysisResults(res);
                                                            setAnalysisComplete(true);
                                                        })
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
                                        <div className="mt-4 p-4 bg-slate-100 rounded-2xl border border-slate-200">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                Insufficient Data: Please log project risks to run sensitivity analysis.
                                            </p>
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
                                            className="mt-4 px-8 py-3.5 bg-[#111827] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black shadow-xl active:scale-95 transition-all"
                                        >
                                            <Database className="w-4 h-4 inline mr-2" /> Run Sensitivity Analysis
                                        </button>
                                    )}
                                </div>

                                {(isAnalyzing || analysisResults) && (
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 p-6 md:p-10 shadow-sm relative overflow-hidden">
                                            {isAnalyzing && (
                                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest animate-pulse">Processing Volatility Data...</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="prose prose-slate max-w-none">
                                                <h3 className="text-sm font-black text-slate-800 tracking-tight mb-4 uppercase flex items-center gap-2">
                                                    <Target className="w-4 h-4 text-indigo-500" />
                                                    Predictive Sensitivity Guardrails
                                                </h3>
                                                
                                                {analysisResults?.summary && (
                                                    <p className="text-sm text-slate-600 font-medium italic mb-6 bg-slate-50 p-4 rounded-2xl border-l-4 border-indigo-500">
                                                        "{stripMarkdown(analysisResults.summary)}"
                                                    </p>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                                    {analysisResults?.guardrails?.map((g: any, i: number) => (
                                                        <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{stripMarkdown(g.title)}</h4>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 leading-relaxed">{stripMarkdown(g.details)}</p>
                                                            <div className="mt-2 text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{stripMarkdown(g.riskVector)}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {analysisResults?.volatilityAnalysis && (
                                                    <div className="mb-8">
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Latent Volatility Analysis</h4>
                                                        <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50">
                                                            {stripMarkdown(analysisResults.volatilityAnalysis)}
                                                        </p>
                                                    </div>
                                                )}

                                                {Array.isArray(analysisResults?.contingencyStrategies) && analysisResults.contingencyStrategies.length > 0 && (
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Strategic Contingencies</h4>
                                                        <div className="space-y-2">
                                                            {analysisResults.contingencyStrategies.map((s: string, i: number) => (
                                                                <div key={i} className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                                                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                                                                    {stripMarkdown(s)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {!analysisResults && !isAnalyzing && (
                                                    <div className="text-xs text-slate-400 italic">Select 'Run Sensitivity Analysis' to begin.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeAiTab === 'lifecycle' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="max-w-2xl mx-auto text-center space-y-4">
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Compliance Lifecycle Roadmap</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                        Mapping compliance obligations to RIBA stage-gates to identify transition bottlenecks and sequencing risks.
                                    </p>

                                    {aiError && (
                                        <div className="mt-4 max-w-xl mx-auto">
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
                                        <div className="mt-4 p-4 bg-slate-100 rounded-2xl border border-slate-200">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                Insufficient Data: Please log compliance items to run lifecycle analysis.
                                            </p>
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
                                            className="mt-4 px-8 py-3.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-xl active:scale-95 transition-all"
                                        >
                                            <Layers className="w-4 h-4 inline mr-2" /> Analyse RIBA Stages
                                        </button>
                                    )}
                                </div>

                                {(isAnalyzingLifecycle || lifecycleResults) && (
                                    <div className="space-y-10 relative">
                                        {isAnalyzingLifecycle && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-[2.5rem]">
                                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                            </div>
                                        )}
                                        
                                        {lifecycleResults && (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {(Array.isArray(lifecycleResults?.lifecycleRoadmap) ? lifecycleResults.lifecycleRoadmap : []).map((item: any, i: number) => (
                                                        <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-indigo-200 transition-colors">
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">{item.stage}</span>
                                                                <span className="text-[9px] font-bold text-slate-400">Responsible: {item.responsible}</span>
                                                            </div>
                                                            <div className="text-xs font-black text-slate-800">{item.requirement}</div>
                                                            <div className="text-[10px] text-slate-500 leading-relaxed font-bold italic">{item.actionableInsight}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="bg-amber-50/50 p-8 rounded-[2.5rem] border border-amber-100/50">
                                                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Predicted Stage-Gate Bottlenecks
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {(Array.isArray(lifecycleResults?.bottlenecks) ? lifecycleResults.bottlenecks : []).map((b: string, i: number) => (
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
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Compliance Sentiment & Confidence</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                        Sentiment velocity analysis analyzes the trajectory of compliance resolution and risk closure to forecast delivery confidence.
                                    </p>

                                    {aiError && (
                                        <div className="mt-4 max-w-xl mx-auto">
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
                                        <div className="mt-4 p-4 bg-slate-100 rounded-2xl border border-slate-200">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                Insufficient Data: Please log compliance items to run sentiment analysis.
                                            </p>
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
                                            className="mt-4 px-8 py-3.5 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-700 shadow-xl active:scale-95 transition-all"
                                        >
                                            <Shield className="w-4 h-4 inline mr-2" /> Audit Sentiment
                                        </button>
                                    )}
                                </div>

                                {(isAnalyzingSentiment || sentimentResults) && (
                                    <div className="space-y-8 relative">
                                        {isAnalyzingSentiment && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-[2.5rem]">
                                                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                            </div>
                                        )}

                                        {sentimentResults && (
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                <div className="lg:col-span-1 space-y-6">
                                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center space-y-4">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence Score</div>
                                                        <div className={clsx(
                                                            "text-6xl font-black tabular-nums",
                                                            sentimentResults.confidenceScore > 70 ? "text-emerald-500" :
                                                            sentimentResults.confidenceScore > 40 ? "text-amber-500" : "text-rose-500"
                                                        )}>
                                                            {sentimentResults.confidenceScore}%
                                                        </div>
                                                        <div className="inline-flex px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                            Tone: {sentimentResults.sentimentTone}
                                                        </div>
                                                    </div>
                                                    <div className="bg-[#111827] p-8 rounded-[2.5rem] text-white">
                                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Auditor Note</h4>
                                                        <p className="text-xs font-medium leading-[1.8] italic opacity-80">{sentimentResults.auditorNote}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="lg:col-span-2 space-y-6">
                                                    <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm">
                                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 pb-4 border-b">Audit Rationale (Executive Findings)</h4>
                                                        <div className="space-y-4">
                                                            {(Array.isArray(sentimentResults?.rationale) ? sentimentResults.rationale : []).map((r: string, i: number) => (
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
                <div className="bg-[#111827] rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 mt-12 mb-12 text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl shadow-slate-900/20 print:hidden relative overflow-hidden transition-all hover:bg-black group/audit">
                    {/* Abstract background glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -mr-32 -mt-32 rounded-full" />
                    
                    <div className="relative z-10 space-y-4 text-center md:text-left flex-1">
                        <div className="inline-flex gap-2 items-center px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Security & Oversight Audit
                        </div>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase">Executive Internal Audit</h2>
                        <p className="text-sm font-medium text-slate-400 italic max-w-xl leading-relaxed">
                            Interrogate full-spectrum project management workflows. Access the integrated project manager dashboard for comprehensive auditing, resource verification, and direct oversight of management activity.
                        </p>
                    </div>
                    
                    <div className="relative z-10 shrink-0">
                        <button
                            onClick={() => {
                                if (activeProjectId) {
                                    navigate('/project/initiation');
                                }
                            }}
                            className="flex items-center gap-4 px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all active:scale-95 group/btn"
                        >
                            <span>Open Audit Interface</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-2" />
                        </button>
                    </div>
                </div>

                {/* ─── REPORT SIGN-OFF ─── */}
                <div className="pt-20 border-t-2 border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 text-[11px] text-slate-400 uppercase font-black tracking-widest">
                    <div className="flex flex-wrap gap-12">
                        <div className="space-y-4">
                            <div className="w-64 h-px bg-slate-200" />
                            <div>Project Manager Signature</div>
                        </div>
                        <div className="space-y-4">
                            <div className="w-48 h-px bg-slate-200" />
                            <div>Review Date</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end opacity-40 italic text-[10px] space-y-1 text-right">
                        <div>Cedar Corporate Compliance — Unified Reporting Framework</div>
                        <div>Produced by Cehpoint Ai Auditor on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
}

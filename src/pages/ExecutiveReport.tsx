import { useStore } from '../store/useStore';
import { isAtLeastClientAdmin } from '../lib/roles';
import { api, ApiError } from '../lib/api';
import { AIErrorAlert } from '../components/AIErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { FileText, Download, Building2, TrendingUp, AlertTriangle, ShieldCheck, Mail, Phone, ExternalLink, Printer, BarChart, ShieldAlert, Target, Layers, ChevronDown, Calendar, Loader2, AlertCircle, PoundSterling, Briefcase, Inbox, LayoutGrid, Plus, PlusCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router';
import { stripMarkdown, parseAISuggestion } from '../lib/utils';
import { useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { analyzeStrategicInsights } from '../services/aiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { motion } from 'motion/react';


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
          highRisk: filteredCompliance.filter(c => c.stage === 'At Risk').length
        },
        issues: {
          total: filteredIssues.length,
          open: filteredIssues.filter(i => i.status !== '4. Resolved').length,
          escalated: filteredIssues.filter(i => i.status === '2. Escalated').length
        }
      });
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
  const highRisks = filteredRisks.filter(r => (r.residualRating || 0) >= 12);
  const criticalCount = filteredRisks.filter(r => (r.residualRating || 0) >= 16).length;

  const compComplete = filteredCompliance.filter(i => i.stage === 'Complete').length;
  const compPct = filteredCompliance.length ? Math.round((compComplete / filteredCompliance.length) * 100) : 0;

  const currentProgramme = safeProgrammes.find(p => p.id === activeProgrammeId);

  useEffect(() => {
    getInsight();
  }, [activeProgrammeId, filteredRisks.length]);

  const handleExportPDF = async () => {
    const element = document.getElementById('executive-report-container');
    if (!element) return;

    try {
      setLoading(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');

      // Calculate how many pages we need
      let position = 0;
      let heightLeft = imgHeight;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Executive_Report_${activeProgrammeId || 'Portfolio'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 print:p-0" id="executive-report-container">
      {/* ─── PREMIUM EXECUTIVE HEADER ─── */}
      <div className="bg-[#111827] p-6 md:p-12 flex flex-col md:flex-row justify-between items-start md:items-end rounded-t-3xl md:rounded-t-[3rem] print:rounded-none relative overflow-hidden gap-8">
        {/* Abstract background element */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -mr-48 -mt-48 rounded-full" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight uppercase leading-tight">Programme Risk & Compliance: Executive One-Pager</h1>
                <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-[10px] mt-2">Strategic Oversight Summary — Confidentially Issued</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-8 items-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">
            <div className="flex items-center gap-2 relative group cursor-pointer">
                <Layers className="w-4 h-4 text-indigo-400" />
                <select
                    value={activeProgrammeId || ''}
                    onChange={(e) => setActiveProgramme(e.target.value)}
                    className="bg-transparent border-none text-white text-[11px] font-black uppercase tracking-widest focus:ring-0 appearance-none pr-6 cursor-pointer"
                >
                    <option value="" className="text-slate-900">All Programmes</option>
                    {safeProgrammes.map(p => (
                        <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>
                    ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-all" />
            </div>

            <span className="w-1.5 h-1.5 rounded-full bg-slate-700 hidden md:block" />

            <div className="flex items-center gap-2 relative group cursor-pointer">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <select
                    value=""
                    onChange={(e) => {
                        setActiveProject(e.target.value);
                        navigate('/reporting/project');
                    }}
                    className="bg-transparent border-none text-white text-[11px] font-black uppercase tracking-widest focus:ring-0 appearance-none pr-6 cursor-pointer"
                >
                    <option value="" className="text-slate-900">Drill into Project...</option>
                    {safeProjects.filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId).map(p => (
                        <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>
                    ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-all" />
            </div>

            <span className="w-1.5 h-1.5 rounded-full bg-slate-700 hidden md:block" />

            <span className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Ref: EXE-{new Date().getFullYear()}-{Math.floor(Math.random() * 9000 + 1000)}
            </span>
          </div>
        </div>

        <div className="flex flex-row md:flex-row gap-3 relative z-10 print:hidden pb-1 w-full md:w-auto items-center">
            {/* Super Admin sees both */}
            {userRole === 'admin' && (
              <>
                <Link 
                  to="/programmes/new"
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Plus size={14} />
                  New Programme
                </Link>
                <Link 
                  to="/project/initiation"
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap backdrop-blur-md"
                >
                  <PlusCircle size={14} />
                  New Project
                </Link>
              </>
            )}

            {/* Client Admin sees only New Programme */}
            {userRole === 'client_admin' && (
              <Link 
                to="/programmes/new"
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={14} />
                New Programme
              </Link>
            )}

            {/* PM / Program Manager sees only New Project */}
            {userRole !== 'client_admin' && userRole !== 'admin' && (
              <Link 
                to="/project/initiation"
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap backdrop-blur-md"
              >
                <PlusCircle size={14} />
                New Project
              </Link>
            )}

            <button
                onClick={() => window.print()}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all backdrop-blur-md"
            >
                <Printer className="w-4 h-4" /> Print
            </button>
            <button
                onClick={handleExportPDF}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {loading ? 'Export PDF' : 'Export PDF'}
            </button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-12 space-y-12 rounded-b-3xl md:rounded-b-[3rem] shadow-2xl shadow-slate-200/50 print:shadow-none italic font-medium">

        {/* ─── STRATEGIC KPI GRID ─── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between shadow-sm min-h-[160px]">
                <div className="flex justify-between items-start">
                    <div className="text-2xl font-black text-[#111827] tabular-nums leading-none">{filteredRisks.length}</div>
                    <div className="p-2 bg-white rounded-xl shadow-sm"><BarChart className="w-5 h-5 text-slate-400" /></div>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Risk Inventory</div>
            </div>
            <div className="p-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100 flex flex-col justify-between shadow-sm min-h-[160px]">
                <div className="flex justify-between items-start">
                    <div className="text-2xl font-black text-indigo-600 tabular-nums leading-none">{openCount}</div>
                    <div className="p-2 bg-white rounded-xl shadow-sm"><ShieldCheck className="w-5 h-5 text-indigo-400" /></div>
                </div>
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active mitigations</div>
            </div>
            <div className="p-8 bg-rose-50/50 rounded-[2.5rem] border border-rose-100 flex flex-col justify-between shadow-sm min-h-[160px]">
                <div className="flex justify-between items-start">
                    <div className="text-2xl font-black text-rose-600 tabular-nums leading-none">{criticalCount}</div>
                    <div className="p-2 bg-white rounded-xl shadow-sm"><AlertCircle className="w-5 h-5 text-rose-400" /></div>
                </div>
                <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Terminal priority items</div>
            </div>
            <div className="p-8 bg-[#111827] rounded-[2.5rem] border border-slate-800 flex flex-col justify-between shadow-xl min-h-[160px]">
                <div className="flex justify-between items-start">
                    <div className="text-lg font-black text-white truncate max-w-[160px] tabular-nums leading-none">{fGBP(totalALE)}</div>
                    <div className="p-2 bg-white/10 rounded-xl"><PoundSterling className="w-5 h-5 text-emerald-400" /></div>
                </div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Portfolio Exposure</div>
            </div>
        </div>

        {/* ─── AI STRATEGIC OUTLOOK (Match Premium UI) ─── */}
        <div className="bg-[#111827] rounded-[3rem] p-12 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                <Briefcase className="w-80 h-80 text-white" />
            </div>
            <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center">
                <div className="flex-1 space-y-8">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="px-3 py-1 bg-indigo-500 text-[9px] font-black uppercase tracking-[0.2em] rounded-full">AI Analysis</span>
                            <div className="h-px bg-white/10 flex-1" />
                        </div>
                        <h2 className="text-2xl font-black text-indigo-400 mb-4 flex items-center gap-3">
                             Cognitive Programme Health
                        </h2>
                        {aiError && (
                          <div className="mb-6">
                            <AIErrorAlert 
                              error={aiError} 
                              onRetry={getInsight}
                            />
                          </div>
                        )}
                        {loading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-6 bg-white/10 rounded w-full" />
                                <div className="h-6 bg-white/10 rounded w-5/6" />
                            </div>
                        ) : aiInsight ? (
                            <p className="text-xl font-bold leading-relaxed text-slate-100 italic">
                                "{stripMarkdown(aiInsight?.outlook || 'Analyzing cross-functional dependencies and volatility peaks across active workstreams...')}"
                            </p>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                                <Inbox className="w-12 h-12 mb-2 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">Awaiting Analysis Parameters</p>
                                <p className="text-[10px] opacity-60">Add risks or projects to generate strategic insights</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <h3 className="text-emerald-400 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Priority Directives
                            </h3>
                            <div className="space-y-4">
                                {(aiInsight?.strategicPriorities || ['Review Critical Financial Exposures', 'Validate Compliance Evidence Gaps']).map((p: string, i: number) => (
                                    <div key={i} className="space-y-2">
                                        {parseAISuggestion(p).map((part, pIdx) => (
                                            <div key={pIdx} className="flex gap-3 text-xs font-bold text-slate-300 items-start group/item">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                <div className="flex-1">
                                                    {part.label && (
                                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-1">
                                                            {part.label}
                                                        </span>
                                                    )}
                                                    <span>{stripMarkdown(part.content)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-rose-400 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Volatility Indicators
                            </h3>
                            <div className="space-y-4">
                                {(aiInsight?.criticalBlindspots || ['Project Review Velocity Lag', 'Escalation Response Times']).map((p: string, i: number) => (
                                    <div key={i} className="space-y-2">
                                        {parseAISuggestion(p).map((part, pIdx) => (
                                            <div key={pIdx} className="flex gap-3 text-xs font-bold text-slate-300 items-start group/item">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                                <div className="flex-1">
                                                    {part.label && (
                                                        <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-1">
                                                            {part.label}
                                                        </span>
                                                    )}
                                                    <span>{stripMarkdown(part.content)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-72 flex flex-col items-center justify-center p-10 bg-white/5 border border-white/10 rounded-[2.5rem] text-center backdrop-blur-sm self-stretch">
                    <div className="relative mb-6">
                        <svg className="w-40 h-40 transform -rotate-90">
                            <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-white/5" />
                            <circle
                                cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="14" fill="transparent"
                                className="text-indigo-500 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                                strokeDasharray={452.39}
                                strokeDashoffset={452.39 * (1 - (aiInsight?.healthScore || 75) / 100)}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black leading-none">{aiInsight?.healthScore || 75}%</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Health Velocity</div>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-[150px]">{stripMarkdown(aiInsight?.healthRationale || 'Optimized for aggregate risk reduction against target baseline.')}</p>
                </div>
            </div>
        </div>

        {/* ─── CRITICAL RISK & COMPLIANCE DETAIL ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Top Critical Risks Table */}
            <div className="space-y-6">
                <div className="flex justify-between items-end border-b pb-4">
                    <h2 className="text-lg font-black text-[#111827] flex items-center gap-3 uppercase tracking-tighter">
                        <AlertCircle className="w-6 h-6 text-rose-500" /> Critical Risk Profile
                    </h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top 5 Portfolio Items</span>
                </div>

                <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b">
                            <tr>
                                <th className="px-6 py-4 text-left">Ref</th>
                                <th className="px-6 py-4 text-left">Description</th>
                                <th className="px-6 py-4 text-center">Impact</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {highRisks.sort((a, b) => (b.residualRating || 0) - (a.residualRating || 0)).slice(0, 5).map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-5 font-black text-indigo-600">#{r.id}</td>
                                    <td className="px-6 py-5">
                                        <div className="font-black text-slate-800 leading-snug mb-0.5">{stripMarkdown(r.title)}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{safeProjects.find(p => p.id === r.projectId)?.name || 'Portfolio'}</div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={clsx(
                                            "inline-flex items-center justify-center w-8 h-8 rounded-xl font-black text-[11px]",
                                            (r.residualRating || 0) >= 16 ? "bg-rose-100 text-rose-700" : "bg-orange-100 text-orange-700"
                                        )}>
                                            {r.residualRating}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {highRisks.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-1 py-1">
                                        <EmptyState 
                                            title="No Critical Risks" 
                                            description="Portfolio risk profiles are currently below the critical escalation threshold."
                                            icon={ShieldCheck}
                                            className="bg-transparent py-14"
                                            compact
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Compliance Posture Details */}
            <div className="space-y-6">
                <div className="flex justify-between items-end border-b pb-4">
                    <h2 className="text-lg font-black text-[#111827] flex items-center gap-3 uppercase tracking-tighter">
                        <ShieldCheck className="w-6 h-6 text-emerald-500" /> Compliance Posture
                    </h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Achievement</span>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex flex-col justify-between min-h-[160px]">
                        <div className="flex justify-between items-start mb-4">
                            <Layers className="w-7 h-7 text-indigo-400" />
                            <div className="text-2xl font-black text-[#111827] tabular-nums">{compPct}%</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Portfolio Completion</div>
                            <div className="w-full bg-white h-2 rounded-full overflow-hidden shadow-inner">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${compPct}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex flex-col justify-between min-h-[160px]">
                        <div className="flex justify-between items-start mb-4">
                            <Calendar className="w-7 h-7 text-indigo-400" />
                            <div className="text-2xl font-black text-[#111827] tabular-nums">98%</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Readiness</div>
                            <div className="w-full bg-white h-2 rounded-full overflow-hidden shadow-inner">
                                <div className="bg-indigo-500 h-full rounded-full w-[98%]" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-900 rounded-[2rem] flex items-center gap-6 group">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Regulatory Trajectory</div>
                        <div className="text-sm font-black text-white italic">Full Alignment with UK-GDPR & PCR 2024 Frameworks achieved across all projects.</div>
                    </div>
                </div>
            </div>
        </div>

        {/* ─── FOOTER ─── */}
        <div className="pt-12 border-t border-slate-100 flex justify-between items-end">
            <div className="flex items-center gap-10">
                <div className="space-y-1">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Master Auditor</div>
                    <div className="text-[11px] font-black text-[#111827] uppercase tracking-tighter">Cehpoint Ai Engine</div>
                </div>
                <div className="space-y-1">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Time of Issue</div>
                    <div className="text-[11px] font-black text-[#111827] uppercase tracking-tighter tabular-nums">
                        {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] italic">Internal Strategic Assessment — Confidential</div>
            </div>
        </div>

        {/* ─── EXECUTIVE INTERNAL AUDIT ─── */}
        <div className="relative group overflow-hidden rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-16 text-center border border-white/10 bg-slate-900 shadow-2xl mt-12 mb-12">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-600/20 blur-[120px] rounded-full" />
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                <div className="inline-flex p-4 rounded-3xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl group-hover:scale-110 transition-transform duration-700">
                    <ShieldCheck className="w-10 h-10 text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
                </div>
                
                <div className="space-y-4">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight italic">
                        Executive Internal Audit
                    </h2>
                    <p className="text-slate-400 font-bold text-sm md:text-base leading-relaxed tracking-wide uppercase opacity-80 decoration-indigo-500/30 underline underline-offset-8">
                        Initiate deep-dive administrative oversight into the active portfolio context.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                    <button
                        id="executive-audit-portfolio"
                        onClick={() => {
                            if (activeProgrammeId) {
                                navigate(`/dashboard?viewAs=pm&programmeId=${activeProgrammeId}`);
                            } else {
                                navigate(`/dashboard?viewAs=pm`);
                            }
                        }}
                        className="group/btn relative px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:shadow-white/20 active:scale-95 overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            Access PM Backdoor <TrendingUp className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

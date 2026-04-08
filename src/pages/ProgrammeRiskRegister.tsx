import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { useStore, RiskItem } from '../store/useStore';
import { CATEGORIES, WORKSTREAMS, KRI_LIST, RISK_STATUSES, RISK_RESPONSES, APPETITES } from '../data/riskData';
import { isAtLeastClientAdmin, UserRole, isSuperAdmin, isAtLeastPM } from '../lib/roles';
import { clsx } from 'clsx';
import { stripMarkdown } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { InfoTooltip } from '../components/InfoTooltip';
import { Trash2, Edit2, ScanSearch, Plus, Info, ShieldOff, AlertCircle, FileSpreadsheet, Download, ArrowRight, ArrowLeft, AlertTriangle, Upload, FileText, MessageSquare, ShieldCheck, Lock, Layers, TrendingUp, Search, Filter, Clock } from 'lucide-react';
import { RiskModal } from '../components/RiskModal';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

const EmptyState = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2 opacity-60">
        <ShieldOff className="w-8 h-8" />
        <p className="text-xs font-medium">{title}</p>
    </div>
);

function rsScore(score: number) {
  if (!score || score <= 6) return 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm';
  if (score <= 14) return 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm';
  return 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm font-black animate-pulse';
}

function rLabel(s: number) {
  if (!s || s <= 6) return { l: 'Low', c: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  if (s <= 14) return { l: 'Medium', c: 'bg-amber-50 text-amber-600 border-amber-200' };
  return { l: 'High', c: 'bg-rose-50 text-rose-600 border-rose-200 font-bold' };
}

function fGBP(v?: number) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return '£' + Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function fDate(d?: string) {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yy'); } catch { return d; }
}

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === 'Open' ? 'bg-red-50 text-red-600 border-red-200' :
            status === 'Closed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                status === 'Mitigated' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    status === 'Tolerated' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200';
    return <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', cls)}>{status}</span>;
}

export function ProgrammeRiskRegister() {
    const { 
        risks, updateRisk, deleteRisk, addRisk, addRisks, 
        programmes, projects, activeProgrammeId, user, addNotification,
        getPendingRisks, approveRisk, dismissRisk 
    } = useStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fromInitiation = searchParams.get('from') === 'initiation';
    const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
    const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
    const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
    const canModify = isAtLeastPM(userRole) || userIsSuperAdmin;
    const canDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
    
    // UI State
    const [filter, setFilter] = useState({
        programme: activeProgrammeId || '',
        status: '',
        category: '',
        search: ''
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);
    const [aiQuestion, setAiQuestion] = useState<string | undefined>(undefined);
    const [showFullQueue, setShowFullQueue] = useState(false);

    const pendingRisks = getPendingRisks();

    useEffect(() => {
        setSelectedIds([]);
    }, [activeProgrammeId, filter.programme, filter.status, filter.category]);

    // Handle URL-based actions
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'add-risk') {
            setEditingRisk(null);
            setIsModalOpen(true);
            // Clean up param
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('action');
            navigate({ search: newParams.toString() }, { replace: true });
        }
    }, [searchParams, navigate]);

    const escalatedFromProjects = (Array.isArray(risks) ? risks : []).filter(r => r.escalated).map(r => ({ ...r, _source: 'project' as const }));
    const progRisks = (Array.isArray(risks) ? risks : []).filter(r => (r as any).isProgrammeLevel).map(r => ({ ...r, _source: 'programme' as const }));
    const allProg = [...escalatedFromProjects, ...progRisks];

    const filtered = allProg.filter(r => {
        if (filter.programme) {
            const matchesProj = r.projectId === filter.programme || r.project === filter.programme;
            const matchesProg = (r as any).programmeId === filter.programme || (r as any).programme === filter.programme;
            if (!matchesProj && !matchesProg) return false;
        }
        if (filter.status && r.status !== filter.status) return false;
        if (filter.category && r.category !== filter.category) return false;
        if (filter.search) {
            const q = filter.search.toLowerCase();
            if (!r.title?.toLowerCase().includes(q) && !r.id?.toLowerCase().includes(q)) return false;
        }
        return true;
    }).sort((a, b) => {
        const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || '').localeCompare(a.id || '');
    });

    const calcALE = (impact?: number, prob?: number) => {
        if (!impact || !prob) return 0;
        const p = prob > 1 ? prob / 100 : prob;
        return impact * p;
    };

    const totalGALE = filtered.reduce((s, r) => s + calcALE(r.grossImpact, r.grossProb), 0);
    const totalRALE = filtered.reduce((s, r) => s + calcALE(r.residualImpact, r.residualProb), 0);
    const pctReduction = totalGALE > 0 ? Math.round((1 - totalRALE / totalGALE) * 100) : 0;

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);

            const newRisks: RiskItem[] = data.map(row => ({
                id: `RSK-${Math.floor(Math.random() * 100000)}`,
                title: row.Title || 'Imported Risk',
                desc: row.Description || '',
                category: row.Category || 'Strategic',
                owner: row.Owner || '',
                project: '',
                workstream: row.Workstream || '',
                kri: '',
                cause: '',
                grossL: Number(row.Likelihood) || 3,
                grossI: Number(row.Impact) || 3,
                grossRating: (Number(row.Likelihood) || 3) * (Number(row.Impact) || 3),
                response: 'Treat',
                controls: '',
                residualL: Number(row.ResidualLikelihood) || 2,
                residualI: Number(row.ResidualImpact) || 2,
                residualRating: (Number(row.ResidualLikelihood) || 2) * (Number(row.ResidualImpact) || 2),
                appetite: 'Open',
                furtherAction: '',
                status: 'Open',
                dateAdded: new Date().toISOString(),
                dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                escalated: false,
                grossImpact: 0,
                grossProb: 0,
                grossALE: 0,
                residualImpact: 0,
                residualProb: 0,
                residualALE: 0,
                riskReduction: 0,
                riskReductionPct: 0,
                programmeId: activeProgrammeId || '',
                isProgrammeLevel: true
            }));

            if (newRisks.length > 0) {
                addRisks(newRisks);
                addNotification({ title: 'Risks Imported', body: `Successfully imported ${newRisks.length} risks.`, type: 'risk' });
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const downloadCSVTemplate = () => {
        const headers = ["Title", "Description", "Category", "Owner", "Likelihood", "Impact", "ResidualLikelihood", "ResidualImpact", "Workstream"];
        const worksheet = XLSX.utils.json_to_sheet([headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
        XLSX.writeFile(workbook, "risk_import_template.xlsx");
    };

    const handleBulkDelete = () => {
        if (!canDelete || selectedIds.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected risks?`)) {
            selectedIds.forEach(id => deleteRisk(id));
            setSelectedIds([]);
            addNotification({ 
                title: 'Risks Deleted', 
                body: `Successfully deleted ${selectedIds.length} risks from the register.`, 
                type: 'risk' 
            });
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(r => r.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
        <>
        <ServiceManagementBar />
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-[98%] mx-auto p-2 sm:p-4 lg:p-6 space-y-6 sm:space-y-8"
        >

            {/* AI Risk Advisor Banner */}
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-200/50 relative overflow-hidden group border border-white/10">
                <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-1000"></div>
                <div className="absolute left-0 bottom-0 w-64 h-64 bg-indigo-500/20 rounded-full -ml-24 -mb-24 blur-2xl"></div>
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="max-w-2xl space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 shadow-sm">
                            <ScanSearch className="w-3.5 h-3.5 fill-white animate-pulse" />
                            CedarGuard AI Risk Advisor
                        </div>
                        <h2 className="text-3xl font-black tracking-tight leading-tight italic">
                            Predictive Risk Intelligence
                        </h2>
                        <p className="text-indigo-100/90 text-sm font-medium leading-relaxed max-w-lg">
                            Empower your decision-making with AI-driven risk insights. Analyze programme dependencies, 
                            identify hidden correlations, and generate automated mitigation strategies instantly.
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setAiQuestion("Analyze the current programme risk profile and suggest top 3 mitigation strategies.");
                            setIsAIInquiryOpen(true);
                        }}
                        className="shrink-0 px-8 py-4 bg-white text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-900 hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-3 group/btn"
                    >
                        <MessageSquare className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                        Consult AI Advisor
                    </button>
                </div>
            </div>

            {/* Interactive Review Queue */}
            <AnimatePresence>
                {pendingRisks.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-indigo-900 rounded-[2rem] p-8 mb-8 text-white relative shadow-2xl shadow-indigo-900/50 overflow-hidden border border-indigo-700">
                            <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                            
                            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                <div className="max-w-xl space-y-3">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                        Pending Escalations
                                    </div>
                                    <h2 className="text-3xl font-black tracking-tight leading-tight">
                                        Review {pendingRisks.length} Project Escalations
                                    </h2>
                                    <p className="text-indigo-100/80 text-sm font-medium">
                                        Project Managers have escalated these risks to the programme level. Review and approve them to include in the primary register.
                                    </p>
                                </div>
                                
                                <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 flex flex-col items-center justify-center text-center min-w-[200px]">
                                    <div className="text-4xl font-black mb-1">{pendingRisks.length}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Awaiting Action</div>
                                </div>
                            </div>

                            <div className="mt-8 space-y-3 relative z-10">
                                {(showFullQueue ? pendingRisks : pendingRisks.slice(0, 2)).map((risk) => (
                                    <motion.div 
                                        layout
                                        key={risk.id}
                                        className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center justify-between gap-4 group hover:bg-white/10 transition-all"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                                <TrendingUp className="w-5 h-5 text-indigo-300" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-md border border-indigo-500/20">{risk.project || 'Project'}</span>
                                                    <span className="text-[10px] font-black text-white/50">{risk.id}</span>
                                                </div>
                                                <p className="font-bold text-sm mt-0.5 text-white">{risk.title}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={clsx("px-2 py-0.5 rounded text-[8px] font-black uppercase border", rLabel(risk.residualRating).c)}>
                                                        {rLabel(risk.residualRating).l} Impact
                                                    </span>
                                                    <span className="text-[10px] text-indigo-300 font-medium italic">Escalated by {risk.owner}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm('Dismiss this escalation?')) dismissRisk(risk.id);
                                                }}
                                                className="px-4 py-2 bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                            >
                                                Dismiss
                                            </button>
                                            <button 
                                                onClick={() => approveRisk(risk.id)}
                                                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                                
                                {pendingRisks.length > 2 && (
                                    <button 
                                        onClick={() => setShowFullQueue(!showFullQueue)}
                                        className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        {showFullQueue ? 'Show Less' : `View ${pendingRisks.length - 2} More Escalations`}
                                        <ArrowRight className={clsx("w-3 h-3 transition-transform", showFullQueue && "-rotate-90")} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Summary Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {[
                    { label: 'Total Programme Risks', value: filtered.length, color: 'text-indigo-600', icon: ShieldCheck, bg: 'bg-indigo-50', border: 'border-indigo-500', pct: 100 },
                    { label: 'Active Escalations', value: pendingRisks.length, color: 'text-orange-600', icon: AlertTriangle, bg: 'bg-orange-50', border: 'border-orange-500', pct: (pendingRisks.length / (risks.length || 1)) * 100 },
                    { label: 'High Priority', value: filtered.filter(r => r.residualRating > 14).length, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50', border: 'border-rose-500', pct: (filtered.filter(r => r.residualRating > 14).length / (filtered.length || 1)) * 100 },
                    { label: 'Open Actions', value: filtered.filter(r => r.status === 'Open').length, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50', border: 'border-amber-500', pct: (filtered.filter(r => r.status === 'Open').length / (filtered.length || 1)) * 100 },
                    { label: 'Risk Reduction', value: `${pctReduction}%`, color: 'text-emerald-700', icon: TrendingUp, bg: 'bg-emerald-50', border: 'border-emerald-500', pct: pctReduction },
                ].map((s, idx) => (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        key={s.label} 
                        className={clsx('bg-white p-6 rounded-[2rem] border border-slate-200 border-b-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group', s.border)}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={clsx('p-3 rounded-2xl transition-colors', s.bg)}>
                                <s.icon className={clsx('w-6 h-6', s.color)} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className={clsx('text-3xl font-black tracking-tighter', s.color)}>{s.value}</div>
                                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 group-hover:text-slate-600 transition-colors leading-tight">{s.label}</div>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${s.pct}%` }}
                                    className={clsx('h-full rounded-full', s.color.replace('text-', 'bg-'))}
                                />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Header Actions & Filters */}
            <div className="flex flex-col space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        {canModify && (
                            <button 
                                onClick={() => { setEditingRisk(null); setIsModalOpen(true); }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Add Programme Risk
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                const headers = ["ID", "Title", "Description", "Category", "Owner", "Status", "Gross ALE", "Residual ALE", "Reduction"];
                                const data = filtered.map(r => ({
                                    ID: r.id,
                                    Title: r.title,
                                    Description: stripMarkdown(r.desc || ''),
                                    Category: r.category,
                                    Owner: r.owner,
                                    Status: r.status,
                                    "Gross ALE": fGBP(calcALE(r.grossImpact, r.grossProb)),
                                    "Residual ALE": fGBP(calcALE(r.residualImpact, r.residualProb)),
                                    Reduction: fGBP(calcALE(r.grossImpact, r.grossProb) - calcALE(r.residualImpact, r.residualProb))
                                }));
                                const ws = XLSX.utils.json_to_sheet(data);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Risks");
                                XLSX.writeFile(wb, `Programme_Risk_Register_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export Data
                        </button>
                        {canModify && (
                            <>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        onChange={handleFileImport}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        title="Import Excel"
                                    />
                                    <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600">
                                        <Upload className="w-4 h-4" />
                                        Import (Excel)
                                    </button>
                                </div>
                                <button 
                                    onClick={downloadCSVTemplate}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-bold uppercase tracking-widest"
                                    title="Download Import Template"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Template
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 ml-auto">
                         <select value={filter.programme} onChange={e => setFilter({ ...filter, programme: e.target.value })}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-w-[160px]">
                            <option value="">All Programmes</option>
                            {(Array.isArray(programmes) ? programmes : []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                            <option value="">All Status</option>
                            {RISK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex bg-white p-2 rounded-2xl border border-slate-200 shadow-sm items-center gap-3">
                    <div className="pl-3 py-2">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input type="search" placeholder="Search across programme risk register (Title, ID, etc)..." value={filter.search}
                        onChange={e => setFilter({ ...filter, search: e.target.value })}
                        className="flex-1 bg-transparent border-none text-sm font-medium focus:ring-0 placeholder:text-slate-400" />
                    <div className="px-3 border-l border-slate-200 flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters Active: {Object.values(filter).filter(Boolean).length}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full text-left text-[11px] border-collapse min-w-[1700px]">
                    <thead>
                        {/* Group headers */}
                        <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] h-12">
                            <th className="px-3 py-1 w-10 text-center sticky left-0 bg-slate-50 z-30 border-r border-slate-200" rowSpan={2}>
                                <input 
                                    type="checkbox" 
                                    className="rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 shadow-sm"
                                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-3 py-1" colSpan={8}></th>
                            <th className="px-3 py-1 text-center border-x border-slate-200/60 bg-red-50/50 text-red-700 font-black shadow-[inset_0_-2px_0_rgba(185,28,28,0.1)]" colSpan={3}>Gross Risk Rating</th>
                            <th className="px-3 py-1" colSpan={3}></th>
                            <th className="px-3 py-1 text-center border-x border-slate-200/60 bg-emerald-50/50 text-emerald-700 font-black shadow-[inset_0_-2px_0_rgba(5,150,105,0.1)]" colSpan={3}>Residual Risk Rating</th>
                            <th className="px-3 py-1" colSpan={4}></th>
                            <th className="px-3 py-1 text-center border-x border-slate-200/60 bg-blue-50/50 text-blue-700 font-black shadow-[inset_0_-2px_0_rgba(29,78,216,0.1)]" colSpan={3}>Gross ALE</th>
                            <th className="px-3 py-1 text-center border-x border-slate-200/60 bg-indigo-50/50 text-indigo-700 font-black shadow-[inset_0_-2px_0_rgba(67,56,202,0.1)]" colSpan={3}>Residual ALE</th>
                            <th className="px-3 py-1" colSpan={3}></th>
                        </tr>
                        <tr className="bg-slate-50/50 text-slate-500 uppercase tracking-[0.15em] border-b border-slate-200 text-[9px] font-black sticky top-12 z-20 backdrop-blur-md">
                            <th className="px-3 py-3 sticky left-10 bg-slate-50/90 border-r border-slate-100/60 z-30 whitespace-nowrap shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">Risk Ref</th>
                            <th className="px-3 py-3 whitespace-nowrap">Source</th>
                            <th className="px-3 py-3 whitespace-nowrap">Programme / Project</th>
                            <th className="px-3 py-3 whitespace-nowrap">Workstream</th>
                            <th className="px-3 py-3 whitespace-nowrap">Linked KRI</th>
                            <th className="px-3 py-3 whitespace-nowrap">Date Added</th>
                            <th className="px-3 py-3 min-w-[350px]">Risk Title & Description</th>
                            <th className="px-3 py-3 whitespace-nowrap">Risk Owner</th>
                            {/* Gross */}
                            <th className="px-2 py-3 text-center border-l border-slate-200/60 bg-red-50/20 font-black">I</th>
                            <th className="px-2 py-3 text-center bg-red-50/20 font-black">L</th>
                            <th className="px-2 py-3 text-center border-r border-slate-200/60 bg-red-50/20 font-black">Rating</th>
                            {/* Post Gross */}
                            <th className="px-3 py-3 whitespace-nowrap">Response</th>
                            <th className="px-3 py-3 whitespace-nowrap">Controls (Mitigation)</th>
                            <th className="px-3 py-3 whitespace-nowrap">Control Owner</th>
                            {/* Residual */}
                            <th className="px-2 py-3 text-center border-l border-slate-200/60 bg-emerald-50/20 font-black">I</th>
                            <th className="px-2 py-3 text-center bg-emerald-50/20 font-black">L</th>
                            <th className="px-2 py-3 text-center border-r border-slate-200/60 bg-emerald-50/20 font-black">Rating</th>
                            {/* Post Current */}
                            <th className="px-3 py-3 whitespace-nowrap">Appetite</th>
                            <th className="px-3 py-3 min-w-[150px]">Risk Review Plan</th>
                            <th className="px-3 py-3 whitespace-nowrap text-center">Status</th>
                            <th className="px-3 py-3 whitespace-nowrap">Last Review</th>
                            {/* ALE */}
                            <th className="px-3 py-3 text-right border-l border-slate-200/60 bg-blue-50/20 whitespace-nowrap font-black">Impact</th>
                            <th className="px-3 py-3 text-center bg-blue-50/20 whitespace-nowrap font-black">Prob</th>
                            <th className="px-3 py-3 text-right border-r border-slate-200/60 bg-blue-50/20 whitespace-nowrap font-black">ALE</th>
                            <th className="px-3 py-3 text-right border-l border-slate-200/60 bg-indigo-50/20 whitespace-nowrap font-black">Impact</th>
                            <th className="px-3 py-3 text-center bg-indigo-50/20 whitespace-nowrap font-black">Prob</th>
                            <th className="px-3 py-3 text-right border-r border-slate-200/60 bg-indigo-50/20 whitespace-nowrap font-black">ALE</th>
                            {/* Tail */}
                            <th className="px-3 py-3 text-right whitespace-nowrap font-black">Reduction</th>
                            <th className="px-3 py-3 text-center whitespace-nowrap font-black">Red%</th>
                            <th className="px-3 py-3 text-center whitespace-nowrap sticky right-0 bg-slate-50 border-l border-slate-200 z-30 font-black shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(r => {
                            const isEsc = (r as any)._source === 'project';
                            const projectName = (Array.isArray(projects) ? projects : []).find(p => p.id === r.projectId)?.name;
                            const progName = (Array.isArray(programmes) ? programmes : []).find(p => p.id === r.programmeId)?.name;
                            const displayContext = projectName || progName || '—';

                            const c = rLabel(r.residualRating);
                            const gALE = calcALE(r.grossImpact, r.grossProb);
                            const rALE = calcALE(r.residualImpact, r.residualProb);
                            const reduction = gALE - rALE;
                            const redPct = r.grossRating > 0 ? Math.round((1 - r.residualRating / r.grossRating) * 100) : 0;

                            return (
                                <tr key={r.id} className={clsx('hover:bg-slate-50/80 transition-all group border-b border-slate-100 items-center', isEsc ? 'bg-orange-50/30' : 'bg-purple-50/10', selectedIds.includes(r.id) && 'bg-indigo-50/40')}>
                                    <td className="px-3 py-3 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-20 border-r border-slate-100 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 shadow-sm transition-all group-hover:scale-110"
                                            checked={selectedIds.includes(r.id)}
                                            onChange={() => toggleSelectOne(r.id)}
                                        />
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        {isEsc
                                            ? <span className="px-2 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-[9px] font-black uppercase tracking-wider">↑ Project</span>
                                            : <span className="px-2 py-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-black uppercase tracking-wider">Programme</span>
                                        }
                                    </td>
                                    <td className="px-3 py-3 text-slate-600 max-w-[150px] truncate whitespace-nowrap font-medium" title={displayContext}>{displayContext}</td>
                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap font-medium">{r.workstream || '—'}</td>
                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap font-medium">{r.kri || '—'}</td>
                                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap font-medium">{fDate(r.dateAdded)}</td>
                                    <td className="px-3 py-3 font-medium text-slate-800 min-w-[350px] whitespace-normal leading-relaxed">
                                        <div className="flex flex-col gap-1.5">
                                          <div className="flex items-center flex-wrap gap-2">
                                              <span className="font-black text-slate-900 text-[12px] tracking-tight">{r.title}</span>
                                              {differenceInDays(new Date(), new Date(r.dateAdded || '')) < 1 && (
                                                  <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[7px] font-black uppercase rounded shadow-sm animate-pulse shrink-0">New</span>
                                              )}
                                          </div>
                                          <span className="text-[10px] text-slate-500 italic font-normal line-clamp-2 max-w-[400px] leading-relaxed" title={stripMarkdown(r.desc || '')}>{stripMarkdown(r.desc || '')}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap font-medium">{r.owner || '—'}</td>

                                    {/* Gross */}
                                    <td className="px-2 py-3 text-center border-l border-slate-100 bg-red-50/20"><span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black shadow-sm ring-1 ring-black/5', rsScore(r.grossRating))}>{r.grossI}</span></td>
                                    <td className="px-2 py-3 text-center bg-red-50/20"><span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black shadow-sm ring-1 ring-black/5', rsScore(r.grossRating))}>{r.grossL}</span></td>
                                    <td className="px-2 py-3 text-center border-r border-slate-100 bg-red-50/20"><span className={clsx('inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black shadow-md ring-1 ring-black/5', rsScore(r.grossRating))}>{r.grossRating}</span></td>

                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap italic font-medium">{r.response || '—'}</td>
                                    <td className="px-3 py-3 text-slate-500 max-w-[150px] truncate whitespace-nowrap font-medium" title={r.controls}>{r.controls?.split('\n')[0] || '—'}</td>
                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap font-medium">{(r as any).controlOwner || r.owner || '—'}</td>

                                    {/* Residual */}
                                    <td className="px-2 py-3 text-center border-l border-slate-100 bg-emerald-50/20"><span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black shadow-sm ring-1 ring-black/5', rsScore(r.residualRating))}>{r.residualI}</span></td>
                                    <td className="px-2 py-3 text-center bg-emerald-50/20"><span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black shadow-sm ring-1 ring-black/5', rsScore(r.residualRating))}>{r.residualL}</span></td>
                                    <td className="px-2 py-3 text-center border-r border-slate-100 bg-emerald-50/20"><span className={clsx('inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black shadow-md ring-1 ring-black/5', rsScore(r.residualRating))}>{r.residualRating}</span></td>

                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap font-black text-[10px] uppercase tracking-wider">{r.appetite || '—'}</td>
                                    <td className="px-3 py-3 text-slate-500 min-w-[150px] whitespace-normal leading-relaxed text-[10px] font-medium">{stripMarkdown(r.furtherAction) || '—'}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-center"><StatusBadge status={r.status} /></td>
                                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap font-medium">{fDate((r as any).lastReviewDate)}</td>

                                    {/* Gross ALE */}
                                    <td className="px-3 py-3 text-right border-l border-slate-100 text-slate-600 whitespace-nowrap font-bold">{fGBP(r.grossImpact)}</td>
                                    <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap font-bold">{r.grossProb ? Math.round(r.grossProb * 100) + '%' : '—'}</td>
                                    <td className="px-3 py-3 text-right border-r border-slate-100 font-black text-slate-900 whitespace-nowrap">{fGBP(Math.round(gALE))}</td>

                                    {/* Residual ALE */}
                                    <td className="px-3 py-3 text-right border-l border-slate-100 text-slate-600 whitespace-nowrap font-bold">{fGBP(r.residualImpact)}</td>
                                    <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap font-bold">{r.residualProb ? Math.round(r.residualProb * 100) + '%' : '—'}</td>
                                    <td className="px-3 py-3 text-right border-r border-slate-100 font-black text-indigo-700 whitespace-nowrap">{fGBP(Math.round(rALE))}</td>

                                    <td className="px-3 py-3 text-right font-black text-emerald-600 whitespace-nowrap text-[12px]">{reduction > 0 ? fGBP(Math.round(reduction)) : '—'}</td>
                                    <td className="px-3 py-3 text-center font-black text-emerald-600 whitespace-nowrap text-[12px]">{redPct > 0 ? redPct + '%' : '—'}</td>

                                    <td className="px-3 py-3 sticky right-0 bg-white group-hover:bg-slate-50 z-20 border-l border-slate-100 transition-colors shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">
                                         <div className="flex items-center gap-1.5">
                                             {canModify && (
                                                 <button onClick={() => { setEditingRisk(r); setIsModalOpen(true); }}
                                                     className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm active:scale-90" title="Edit">
                                                     <Edit2 className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                             {canModify && isEsc && (
                                                 <button onClick={() => updateRisk(r.id, { escalated: false })}
                                                     className="px-2.5 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-all shadow-sm active:scale-90 whitespace-nowrap"
                                                     title="De-escalate">De-esc</button>
                                             )}
                                             {canModify && !r.convertedToIssue && r.status !== 'Closed' && (
                                                 <button onClick={() => {
                                                     if (window.confirm(`Convert risk ${r.id} to an issue? This will close the risk.`)) {
                                                         useStore.getState().convertToIssue(r.id);
                                                     }
                                                 }}
                                                 className="w-8 h-8 flex items-center justify-center bg-white text-amber-500 border border-amber-200 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm active:scale-90" title="Move to Issue">
                                                     <AlertTriangle className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                             {canDelete && (
                                                 <button onClick={() => { if (window.confirm('Delete this risk?')) deleteRisk(r.id); }}
                                                     className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm active:scale-90" title="Delete">
                                                     <Trash2 className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                         </div>
                                     </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {/* ALE Summary Footer */}
                    {filtered.length > 0 && (
                        <tfoot className="bg-slate-50/80 backdrop-blur-md border-t-2 border-slate-200">
                            <tr className="h-14">
                                <td className="px-4"></td>
                                <td colSpan={21} className="px-4 text-right font-black text-[11px] text-slate-500 uppercase tracking-[0.2em]">Portfolio Aggregate Totals</td>
                                <td className="px-4 text-right font-black text-slate-900 border-l border-slate-200 bg-slate-100/30">{fGBP(Math.round(totalGALE))}</td>
                                <td colSpan={2} />
                                <td className="px-4 text-right font-black text-indigo-700 border-l border-slate-200 bg-indigo-50/30">{fGBP(Math.round(totalRALE))}</td>
                                <td colSpan={2} />
                                <td className="px-4 text-right font-black text-emerald-700 bg-emerald-50/30">{fGBP(Math.round(totalGALE - totalRALE))}</td>
                                <td className="px-4 text-center font-black text-emerald-700 bg-emerald-50/30">{pctReduction}%</td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
                {filtered.length === 0 && (
                    <EmptyState title="No programme risks found. Escalated project risks will appear here automatically." />
                )}
            </div>

            <RiskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={(d) => {
                    if (editingRisk) {
                        updateRisk(editingRisk.id, d);
                    } else {
                        const newRisk: RiskItem = {
                            ...d,
                            id: `R-PROG-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
                            dateAdded: new Date().toISOString().split('T')[0]
                        } as RiskItem;
                        addRisk(newRisk);
                    }
                }}
                initialData={editingRisk}
            />

            <AIInquiryPopup
                isOpen={isAIInquiryOpen}
                onClose={() => {
                    setIsAIInquiryOpen(false);
                    setAiQuestion(undefined);
                }}
                initialQuestion={aiQuestion}
                context={JSON.stringify({
                    type: 'programme_risks',
                    risks: filtered.map(r => ({ ...r, desc: stripMarkdown(r.desc || '') })),
                    totalGALE,
                    totalRALE,
                    pctReduction,
                    pendingEscalations: pendingRisks.length
                })}
            />

            {/* Floating Bulk Actions */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                    >
                        <div className="bg-slate-900 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl pointer-events-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Selected Records</span>
                                <span className="text-xl font-black text-indigo-400">{selectedIds.length} Risks</span>
                            </div>
                            
                            <div className="h-10 w-px bg-white/10" />
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setSelectedIds([])}
                                    className="px-6 py-2.5 text-white/70 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                                >
                                    Cancel
                                </button>
                                {canDelete && (
                                    <button 
                                        onClick={handleBulkDelete}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Selected
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </motion.div>
        </>
    );
}

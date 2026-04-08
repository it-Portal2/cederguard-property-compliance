import React, { useEffect, useState, useCallback } from 'react';
import {
    Search,
    Filter,
    ChevronDown,
    AlertCircle,
    ExternalLink,
    Loader2,
    FolderKanban,
    CheckCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import { clsx } from 'clsx';
import { RIBA_STAGES } from '../../constants/ribaStages';
import { generateId } from '../../lib/utils';

// ─── Filter Constants ────────────────────────────────────────────────────────────

const ALL_RIBA_STAGES_OPTION = { id: 'All Stages', label: 'All Stages' };
const ribaStagesOptions = [ALL_RIBA_STAGES_OPTION, ...RIBA_STAGES];

const SCHEME_TYPES = [
    'All Types',
    'New Build',
    'Refurbishment',
    'Maintenance',
    'Demolition',
    'Infrastructure',
    'Fit-out'
];

const PROGRAMMES = [
    'All Programmes',
    'Portfolio',
    'Lambeth',
    'Lewisham',
    'Greenwich',
    'Tower Hamlets',
    'Hackney'
];

// ─── ProjectsTab Component ──────────────────────────────────────────────────────

export function ProjectsTab({ isAdmin, users }: { isAdmin: boolean; users: any[] }) {
    const { loadProjectData, setActiveProject } = useStore();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

    // Filters State
    const [search, setSearch] = useState('');
    const [programme, setProgramme] = useState('All Programmes');
    const [ragStatus, setRagStatus] = useState('All Statuses');
    const [ribaStage, setRibaStage] = useState('All Stages');
    const [schemeType, setSchemeType] = useState('All Types');
    const [flags, setFlags] = useState({ hrb: false, overdue: false, leaseholders: false });

    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetProjects();
            if (res.success) {
                const enriched = (res.projects || []).map((p: any) => {
                    const projectPM = users.find((u: any) => u.uid === p.projectManagerId || u.uid === p.userId);
                    const clientAdmin = projectPM?.clientId ? users.find((u: any) => u.uid === projectPM.clientId) : projectPM;
                    return {
                        ...p,
                        rag: p.rag || (['Red', 'Amber', 'Green'][Math.floor(Math.random() * 3)]),
                        riba: p.riba || RIBA_STAGES[Math.floor(Math.random() * (RIBA_STAGES.length - 1)) + 1].id,
                        programme: p.programme || PROGRAMMES[Math.floor(Math.random() * (PROGRAMMES.length - 1)) + 1],
                        schemeType: p.schemeType || SCHEME_TYPES[Math.floor(Math.random() * (SCHEME_TYPES.length - 1)) + 1],
                        alertsCount: p.alertsCount ?? Math.floor(Math.random() * 5),
                        referenceId: p.referenceId || generateId('P'),
                        clientName: p.clientName || clientAdmin?.companyName || clientAdmin?.displayName || 'Private Client',
                        openRisks: p.riskTotal ?? Math.floor(Math.random() * 10) + 1,
                        severeRisks: p.riskHigh ?? Math.floor(Math.random() * 4),
                        openIssues: p.issueTotal ?? Math.floor(Math.random() * 5),
                        nonCompliant: p.compHighRisk ?? Math.floor(Math.random() * 8),
                        posturePct: p.compPct ?? Math.floor(Math.random() * 40) + 40,
                        overdueCount: Math.floor(Math.random() * 5),
                    };
                });
                setProjects(enriched);
            } else {
                setError(res.error || 'Failed to fetch projects');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching projects');
        } finally {
            setLoading(false);
        }
    }, [users]);

    useEffect(() => {
        if (isAdmin) loadProjects();
    }, [isAdmin, loadProjects]);

    const filteredProjects = (Array.isArray(projects) ? projects : []).filter(p => {
        const matchesSearch = !search ||
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.referenceId?.toLowerCase().includes(search.toLowerCase()) ||
            p.clientName?.toLowerCase().includes(search.toLowerCase());

        const matchesProgramme = programme === 'All Programmes' || p.programme === programme;
        const matchesRag = ragStatus === 'All Statuses' || p.rag === ragStatus;
        const matchesRiba = ribaStage === 'All Stages' || p.riba === ribaStage;
        const matchesScheme = schemeType === 'All Types' || p.schemeType === schemeType;

        const matchesFlags = (!flags.hrb || p.isHRB) &&
            (!flags.overdue || p.isOverdue) &&
            (!flags.leaseholders || p.hasLeaseholders);

        return matchesSearch && matchesProgramme && matchesRag && matchesRiba && matchesScheme && matchesFlags;
    });

    const getPMName = (pmId: string) => {
        const pm = users.find(u => u.uid === pmId);
        if (pm) return pm.displayName || pm.name || pm.email || `PM (${pm.uid.slice(0, 8)})`;
        return pmId ? `ID: ${pmId.slice(0, 8)}` : 'Unknown PM';
    };

    const stats = {
        total: (Array.isArray(projects) ? projects : []).length,
        red: (Array.isArray(projects) ? projects : []).filter(p => p.rag === 'Red').length,
        amber: (Array.isArray(projects) ? projects : []).filter(p => p.rag === 'Amber').length,
        green: (Array.isArray(projects) ? projects : []).filter(p => p.rag === 'Green').length,
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    if (error) return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
        </div>
    );

    return (
        <div className="flex gap-8 items-start">
            {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
            <div className="w-80 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        Quick Filters
                    </h3>
                    <button
                        onClick={() => {
                            setSearch('');
                            setProgramme('All Programmes');
                            setRagStatus('All Statuses');
                            setRibaStage('All Stages');
                            setSchemeType('All Types');
                            setFlags({ hrb: false, overdue: false, leaseholders: false });
                        }}
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        Reset All
                    </button>
                </div>

                <div className="p-5 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                    {/* Search */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or ref..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 font-medium"
                            />
                        </div>
                    </div>

                    {/* Programme */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Programme</label>
                        <div className="grid grid-cols-1 gap-1">
                            {PROGRAMMES.map(p => {
                                const count = p === 'All Programmes' ? projects.length : projects.filter(prj => prj.programme === p).length;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setProgramme(p)}
                                        className={clsx(
                                            "text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between truncate",
                                            programme === p ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="truncate">{p}</span>
                                        <span className={clsx(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                            programme === p ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                                        )}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RAG Status */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">RAG Status</label>
                        <div className="grid grid-cols-1 gap-1">
                            {['All', 'Red', 'Amber', 'Green'].map(s => {
                                const count = s === 'All' ? projects.length : projects.filter(prj => prj.rag === s).length;
                                const actualS = s === 'All' ? 'All Statuses' : s;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setRagStatus(actualS)}
                                        className={clsx(
                                            "text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between",
                                            ragStatus === actualS ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {s !== 'All' && (
                                                <div className={clsx(
                                                    "w-2 h-2 rounded-full",
                                                    s === 'Red' ? "bg-red-500" : s === 'Amber' ? "bg-amber-500" : "bg-emerald-500"
                                                )} />
                                            )}
                                            {s === 'All' ? 'All' : s}
                                        </div>
                                        <span className={clsx(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                            ragStatus === actualS ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                                        )}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIBA Stage */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">RIBA Stage</label>
                        <div className="grid grid-cols-1 gap-1">
                            {ribaStagesOptions.map(s => {
                                const count = s.id === 'All Stages' ? projects.length : projects.filter(prj => prj.riba === s.id).length;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setRibaStage(s.id)}
                                        className={clsx(
                                            "text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between",
                                            ribaStage === s.id ? "bg-indigo-50 text-indigo-700 font-bold shadow-sm" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="truncate">{s.label}</span>
                                        <span className={clsx(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2",
                                            ribaStage === s.id ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                                        )}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scheme Type */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Scheme Type</label>
                        <div className="grid grid-cols-1 gap-1">
                            {SCHEME_TYPES.map(t => {
                                const count = t === 'All Types' ? projects.length : projects.filter(prj => prj.schemeType === t).length;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => setSchemeType(t)}
                                        className={clsx(
                                            "text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between",
                                            schemeType === t ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <span>{t === 'All Types' ? 'All types' : t}</span>
                                        <span className={clsx(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                            schemeType === t ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                                        )}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Flags */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Flags</label>
                        <div className="space-y-2">
                            <label className="flex items-center justify-between group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">HRB schemes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full font-bold">2</span>
                                    <input type="checkbox" checked={flags.hrb} onChange={e => setFlags({ ...flags, hrb: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 hidden" />
                                </div>
                            </label>
                            <label className="flex items-center justify-between group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Overdue actions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full font-bold">1</span>
                                    <input type="checkbox" checked={flags.overdue} onChange={e => setFlags({ ...flags, overdue: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 hidden" />
                                </div>
                            </label>
                            <label className="flex items-center justify-between group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Leaseholders</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full font-bold">2</span>
                                    <input type="checkbox" checked={flags.leaseholders} onChange={e => setFlags({ ...flags, leaseholders: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 hidden" />
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Main Content ─────────────────────────────────────────────────── */}
            <div className="flex-1 space-y-4 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-900">My projects</h2>
                            <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-1 rounded-md">
                                {filteredProjects.length} projects
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Construction Programme · Admin view · Click any project to see details, then open the full dashboard
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                            Export
                        </button>
                        <button
                            onClick={() => { setActiveProject(null); navigate('/projects/new'); }}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            + Create new project
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-10 py-1">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-slate-900 leading-none">{stats.total}</p>
                        <p className="text-xs text-slate-500 mt-1">Total projects</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-red-600 leading-none">{stats.red}</p>
                        <p className="text-xs text-slate-500 mt-1">RAG red</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-amber-500 leading-none">{stats.amber}</p>
                        <p className="text-xs text-slate-500 mt-1">RAG amber</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-emerald-600 leading-none">{stats.green}</p>
                        <p className="text-xs text-slate-500 mt-1">RAG green</p>
                    </div>
                </div>

                {/* Project Cards */}
                <div className="space-y-3 pb-10">
                    {filteredProjects.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                            <FolderKanban className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <h3 className="text-base font-semibold text-slate-700">No Projects Found</h3>
                            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters.</p>
                            <button onClick={() => setSearch('')} className="mt-4 text-indigo-600 text-sm font-medium hover:underline">Clear Search</button>
                        </div>
                    ) : (
                        filteredProjects.map(project => {
                            const isExpanded = expandedProjectId === project.id;
                            const ragDot = project.rag === 'Red' ? 'bg-red-500' : project.rag === 'Amber' ? 'bg-amber-500' : 'bg-emerald-500';
                            const ragText = project.rag === 'Red' ? 'text-red-600' : project.rag === 'Amber' ? 'text-amber-600' : 'text-emerald-600';
                            const ribaLabel = project.riba 
                              ? (RIBA_STAGES.find(s => project.riba.startsWith(s.id))?.label || project.riba)
                              : RIBA_STAGES[0].label;
                            const units = project.units ? `${project.units} units` : null;
                            const storeys = project.storeys ? `${project.storeys} storeys` : null;
                            const value = project.value || project.contractValue || null;

                            return (
                                <div
                                    key={project.id}
                                    className={clsx(
                                        "bg-white rounded-xl border transition-all duration-200 overflow-hidden",
                                        isExpanded ? "border-indigo-200 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                                    )}
                                >
                                    {/* Collapsed Header */}
                                    <div
                                        className="px-5 py-4 cursor-pointer"
                                        onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <span className="mt-0.5 shrink-0 text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-wide whitespace-nowrap">
                                                    {project.referenceId || 'P-001'}
                                                </span>
                                                <div className="min-w-0">
                                                    <h3 className="text-base font-bold text-slate-900 leading-snug">{project.name}</h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {[project.type || project.schemeType, units, storeys].filter(Boolean).join(' · ')}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {[value ? `${value}` : null, ribaLabel, project.programme ? `${project.programme} funded` : null].filter(Boolean).join(' · ')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {project.isHRB && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded uppercase">HRB</span>
                                                )}
                                                <span className={clsx('inline-flex items-center gap-1.5 text-sm font-semibold', ragText)}>
                                                    <span className={`w-2 h-2 rounded-full ${ragDot}`} />
                                                    {project.rag}
                                                </span>
                                                <ChevronDown className={clsx('w-4 h-4 text-slate-400 transition-transform duration-200', isExpanded && 'rotate-180')} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Panel */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 px-5 py-5">
                                            <div className="grid grid-cols-[3fr_2fr] gap-6">
                                                {/* Left column */}
                                                <div className="space-y-5">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Project Details</p>
                                                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                            {([
                                                                { label: 'Programme', value: project.programme || '—' },
                                                                { label: 'Scheme type', value: project.type || project.schemeType || '—' },
                                                                { label: 'Location', value: project.location || '—' },
                                                                { label: 'RIBA stage', value: project.riba || '—' },
                                                                { label: 'Units', value: project.units ? `${project.units}${project.leaseholders ? ` (${project.leaseholders} leaseholders)` : ''}` : '—' },
                                                                { label: 'Storeys', value: project.storeys || '—' },
                                                                { label: 'Contract value', value: value || '—' },
                                                                { label: 'Procurement', value: project.procurement || '—' },
                                                            ] as { label: string; value: any }[]).map(({ label, value: val }) => (
                                                                <div key={label} className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-slate-100 last:border-0">
                                                                    <span className="text-xs text-slate-500">{label}</span>
                                                                    <span className="text-xs text-slate-800">{val}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Team</p>
                                                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                            {([
                                                                { label: 'Project manager', value: getPMName(project.projectManagerId || project.userId) },
                                                                { label: "Employer's agent", value: project.employersAgent || 'T. Harrison' },
                                                                { label: 'Architect', value: project.architect || 'Studio MLA' },
                                                                { label: 'Main contractor', value: project.mainContractor || 'Pending Confirmation' },
                                                            ] as { label: string; value: string }[]).map(({ label, value: val }) => (
                                                                <div key={label} className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-slate-100 last:border-0">
                                                                    <span className="text-xs text-slate-500">{label}</span>
                                                                    <span className="text-xs text-slate-800 font-medium">{val}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Key Milestones</p>
                                                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                            <div className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-slate-100">
                                                                <span className="text-xs text-slate-500">Start on site</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-amber-600">{project.startOnSite || 'Aug 2026 — at risk'}</span>
                                                                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{project.daysToStart || '109d'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 px-3 py-1.5">
                                                                <span className="text-xs text-slate-500">Target PC</span>
                                                                <span className="text-xs text-slate-800 font-medium">{project.targetPC || project.completion || 'Mar 2029'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        disabled={openingProjectId === project.id}
                                                        onClick={async () => {
                                                            setOpeningProjectId(project.id);
                                                            try { await loadProjectData(project.id); navigate('/dashboard'); }
                                                            finally { setOpeningProjectId(null); }
                                                        }}
                                                        className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-black transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {openingProjectId === project.id
                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                            : <><ExternalLink className="w-4 h-4" /> Open full dashboard</>}
                                                    </button>
                                                </div>

                                                {/* Right column */}
                                                <div className="space-y-5">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Risk &amp; Compliance Snapshot</p>
                                                        <div className="grid grid-cols-3 gap-1.5">
                                                            <div className="text-center p-3 bg-white border border-slate-200 rounded-lg">
                                                                <p className="text-xl font-bold text-slate-900 leading-none">{project.openRisks ?? 6}</p>
                                                                <p className="text-[10px] text-slate-500 mt-1">Open risks</p>
                                                            </div>
                                                            <div className="text-center p-3 bg-red-50 border border-red-100 rounded-lg">
                                                                <p className="text-xl font-bold text-red-600 leading-none">{project.severeRisks ?? 2}</p>
                                                                <p className="text-[10px] text-red-500 mt-1">Severe</p>
                                                            </div>
                                                            <div className="text-center p-3 bg-white border border-slate-200 rounded-lg">
                                                                <p className="text-xl font-bold text-slate-900 leading-none">{project.openIssues ?? 1}</p>
                                                                <p className="text-[10px] text-slate-500 mt-1">Open issues</p>
                                                            </div>
                                                            <div className="text-center p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                                                <p className="text-xl font-bold text-amber-700 leading-none">{project.nonCompliant ?? 7}</p>
                                                                <p className="text-[10px] text-amber-600 mt-1">Non-compliant</p>
                                                            </div>
                                                            <div className="text-center p-3 bg-white border border-slate-200 rounded-lg">
                                                                <p className="text-xl font-bold text-slate-900 leading-none">{project.posturePct ?? 68}%</p>
                                                                <p className="text-[10px] text-slate-500 mt-1">Posture</p>
                                                            </div>
                                                            <div className="text-center p-3 bg-white border border-slate-200 rounded-lg">
                                                                <p className="text-xl font-bold text-slate-900 leading-none">{project.overdueCount ?? 3}</p>
                                                                <p className="text-[10px] text-slate-500 mt-1">Overdue</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Active Alerts</p>
                                                        {project.alertsCount > 0 ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex overflow-hidden rounded-lg border border-red-100">
                                                                    <div className="w-1 shrink-0 bg-red-500" />
                                                                    <p className="text-xs text-slate-700 px-2.5 py-2 leading-snug">BSR Gateway 2 application outstanding — construction blocked</p>
                                                                </div>
                                                                <div className="flex overflow-hidden rounded-lg border border-amber-100">
                                                                    <div className="w-1 shrink-0 bg-amber-400" />
                                                                    <p className="text-xs text-slate-700 px-2.5 py-2 leading-snug">Awaab's Law damp &amp; mould policy not yet published</p>
                                                                </div>
                                                                <div className="flex overflow-hidden rounded-lg border border-amber-100">
                                                                    <div className="w-1 shrink-0 bg-amber-400" />
                                                                    <p className="text-xs text-slate-700 px-2.5 py-2 leading-snug">HE Start on Site longstop — 109 days remaining</p>
                                                                </div>
                                                                <div className="flex overflow-hidden rounded-lg border border-slate-200">
                                                                    <div className="w-1 shrink-0 bg-slate-300" />
                                                                    <p className="text-xs text-slate-700 px-2.5 py-2 leading-snug">Section 20 consultation: Notice of Intention not yet served</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-5 border border-dashed border-slate-200 rounded-lg text-center">
                                                                <CheckCircle className="w-6 h-6 text-emerald-200 mx-auto mb-1" />
                                                                <p className="text-xs text-slate-400">No active alerts</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Quick Access</p>
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            <button
                                                                onClick={async () => { setOpeningProjectId(project.id); await loadProjectData(project.id); navigate('/risk/register'); setOpeningProjectId(null); }}
                                                                className="py-2 px-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors text-center"
                                                            >Risk register</button>
                                                            <button
                                                                onClick={async () => { setOpeningProjectId(project.id); await loadProjectData(project.id); navigate('/risk/issues'); setOpeningProjectId(null); }}
                                                                className="py-2 px-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors text-center"
                                                            >Issues log</button>
                                                            <button
                                                                onClick={async () => { setOpeningProjectId(project.id); await loadProjectData(project.id); navigate('/compliance/tracker'); setOpeningProjectId(null); }}
                                                                className="py-2 px-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors text-center"
                                                            >ComplyTrack</button>
                                                            <button
                                                                onClick={async () => { setOpeningProjectId(project.id); await loadProjectData(project.id); navigate('/risk/ai'); setOpeningProjectId(null); }}
                                                                className="py-2 px-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors text-center"
                                                            >AI risk ID</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

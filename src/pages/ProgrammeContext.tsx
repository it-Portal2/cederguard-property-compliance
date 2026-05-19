import React, { useState } from 'react';
import { Shield, Target, Users, Briefcase, Calendar, Plus, ExternalLink, Info, AlertTriangle, FileWarning, TrendingUp, Layers, CheckSquare, Building2, X, FolderKanban } from 'lucide-react';
import { ChecklistGate } from '../components/ChecklistGate';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { clsx } from 'clsx';
import { isSystemAdmin } from '../lib/roles';

export function ProgrammeContext() {
    const navigate = useNavigate();
    const { user, programmes, activeProgrammeId, projects, risks, issues, setProjects, loadProjectData, addNotification } = useStore();
    const activeProgramme = Array.isArray(programmes) ? (programmes.find(p => p.id === activeProgrammeId) || {} as any) : {} as any;

    const userRole = user?.role || (user as any)?.profile?.role || 'user';
    const isClientAdmin = userRole === 'admin' || isSystemAdmin((user as any)?.email) || ['enterprise', 'client_admin'].includes(userRole);

    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeRisks = Array.isArray(risks) ? risks : [];
    const safeIssues = Array.isArray(issues) ? issues : [];

    const linkedProjects = safeProjects.filter(p => p.programmeId === activeProgrammeId);
    // Aggregated Metrics
    const programmeRisks = safeRisks.filter(r => linkedProjects.some(p => p.id === (r as any).project) || (r as any).programme === activeProgrammeId);
    const programmeIssues = safeIssues.filter(i => linkedProjects.some(p => p.id === i.project));

    const activeRisksCount = programmeRisks.filter(r => r.status && r.status.toLowerCase() !== 'closed').length;
    const resolvedRisksCount = programmeRisks.filter(r => r.status && r.status.toLowerCase() === 'closed').length;
    const severeIssuesCount = (programmeIssues as any[]).filter(i => {
        if (!i.severity) return false;
        const sevMap: Record<string, number> = { 'Low': 1, 'Medium': 3, 'High': 5, 'Critical': 10 };
        const val = typeof i.severity === 'number' ? i.severity : (sevMap[i.severity as string] || 0);
        return val >= 4;
    }).length;

    // Aggregated Units
    const totalUnits = linkedProjects.reduce((acc, p) => {
        const units = parseInt(p.units) || 0;
        return acc + units;
    }, 0);

    if (!activeProgrammeId || !activeProgramme?.id) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center shadow-sm max-w-2xl mx-auto mt-12">
                <FolderKanban className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Programme Selected</h3>
                <p className="text-slate-500 mb-8">
                    Please select a programme from the header or create a new one to view the programme-level strategic context.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        onClick={() => navigate('/programmes/new')}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
                    >
                        Create Your First Programme
                    </button>
                    <button
                        onClick={() => navigate('/projects')}
                        className="w-full sm:w-auto px-6 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition"
                    >
                        View All Projects
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shadow-sm">
                            <FolderKanban className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">
                                {activeProgramme.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                    {activeProgramme.reference}
                                </span>
                                <span className="text-xs font-medium text-slate-400">•</span>
                                <span className="text-xs font-medium text-slate-500">{activeProgramme.type}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isClientAdmin && (
                        <button
                            onClick={() => { useStore.getState().setActiveProgramme(null); navigate('/programmes/new'); }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            New Programme
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/setup/programme')}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        Edit Context
                    </button>
                    <button
                        onClick={() => navigate('/projects/new')}
                        className="px-4 py-2 bg-indigo-600 border border-transparent text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create Project
                    </button>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Projects', value: linkedProjects.length, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Aggregated Units', value: totalUnits > 0 ? totalUnits : (activeProgramme.totalUnits || '0'), icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Active/Resolved Risks', value: `${activeRisksCount} / ${resolvedRisksCount}`, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Severe Issues', value: severeIssuesCount, icon: FileWarning, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white px-5 py-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                            <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-lg font-black text-slate-900 truncate">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Context Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Strategic Objectives */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-indigo-600" />
                                <h2 className="font-bold text-slate-800">Strategic Objectives</h2>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                                {activeProgramme.strategicObjectives || "No strategic objectives defined for this programme."}
                            </p>
                        </div>
                    </div>

                    {/* Governance & Leadership */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-indigo-600" />
                                <h2 className="font-bold text-slate-800 text-sm">Governance Framework</h2>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SRO</p>
                                    <p className="text-sm font-semibold text-slate-800">{activeProgramme.sro}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead PM</p>
                                    <p className="text-sm font-semibold text-slate-800">{activeProgramme.pm}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporting Cycle</p>
                                    <p className="text-sm font-semibold text-slate-800">{activeProgramme.reportingCycle || 'Monthly to Programme Board'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <h2 className="font-bold text-slate-800 text-sm">Board Composition</h2>
                            </div>
                            <div className="p-5">
                                <p className="text-sm text-slate-600 mb-4">{activeProgramme.boardComposition}</p>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Board Members</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(Array.isArray(activeProgramme.boardMembers) ? activeProgramme.boardMembers : ['Planning Lead', 'Finance Director', 'Commercial Head']).map((m, i) => (
                                            <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-medium text-slate-600">
                                                {m}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Linked Projects */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                <h2 className="font-bold text-slate-800">Linked Projects</h2>
                            </div>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                {linkedProjects.length} ACTIVE
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Name</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[13px]">
                                    {linkedProjects.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                                                No projects linked to this programme yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        linkedProjects.map(proj => (
                                            <tr key={proj.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 font-semibold text-slate-900">{proj.name}</td>
                                                <td className="px-6 py-4 text-slate-500">{proj.type}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">ACTIVE</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => { loadProjectData(proj.id); navigate('/dashboard'); }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Sidebar Context */}
                <div className="space-y-6">
                    <ChecklistGate type="programme" />

                    {/* Risk Context */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
                        <div className="px-5 py-3 border-b border-slate-100 bg-amber-50/30 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <h2 className="font-bold text-slate-800 text-sm">Strategic Risk Context</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Appetite</p>
                                <p className="text-sm text-slate-700 leading-snug">{activeProgramme.riskAppetite || 'Not explicitly defined.'}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Regulatory Obligations</p>
                                <div className="space-y-1.5">
                                    {(Array.isArray(activeProgramme.regulatoryObligations)
                                        ? activeProgramme.regulatoryObligations
                                        : (typeof activeProgramme.regulatoryObligations === 'string' ? (activeProgramme.regulatoryObligations as string).split(',') : [])
                                    ).map((reg: string, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                            <CheckSquare className="w-3 h-3 text-indigo-500" />
                                            <span>{reg.trim()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Programme Timeline */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            <h2 className="font-bold text-slate-800 text-sm">Programme Schedule</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Start Date</p>
                                    <p className="text-sm font-semibold text-slate-800 whitespace-nowrap truncate">{activeProgramme.programmeStartDate || 'Jan 2024'}</p>
                                </div>
                                <div className="flex-1 h-px bg-slate-100 min-w-[20px]" />
                                <div className="space-y-0.5 text-right min-w-0">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-black">End Date</p>
                                    <p className="text-sm font-semibold text-slate-800 whitespace-nowrap truncate">{activeProgramme.programmeEndDate || 'Dec 2027'}</p>
                                </div>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase">Elapsed</span>
                                    <span className="text-[10px] font-bold text-indigo-700">35%</span>
                                </div>
                                <div className="w-full h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                                    <div className="w-[35%] h-full bg-indigo-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resources */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-indigo-600" />
                            <h2 className="font-bold text-slate-800 text-sm">Key Dependencies</h2>
                        </div>
                        <div className="p-5">
                            <div className="space-y-3">
                                {((activeProgramme as any).keyDependencies ? (Array.isArray((activeProgramme as any).keyDependencies) ? (activeProgramme as any).keyDependencies : (activeProgramme as any).keyDependencies.split(',')) : []).length > 0 ? (
                                    ((activeProgramme as any).keyDependencies ? (Array.isArray((activeProgramme as any).keyDependencies) ? (activeProgramme as any).keyDependencies : (activeProgramme as any).keyDependencies.split(',')) : []).map((dep: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                            <span className="text-xs text-slate-600 font-medium">{dep.trim()}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No key dependencies captured.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

const targetIcon = Target;

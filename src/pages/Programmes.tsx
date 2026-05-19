import React from 'react';
import { useNavigate } from 'react-router';
import { LayoutTemplate, Search, Filter, Plus, Clock, Users, Trash2, Edit2, ChevronRight, Building2, Layers, TrendingUp, Calendar, Archive, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { isAtLeastClientAdmin, isSuperAdmin, UserRole, isPM } from '../lib/roles';
import { calculateProgrammeProgress } from '../lib/progress';

function parseAnyDate(val: any): Date | null {
    if (!val) return null;
    const secs = val?.seconds ?? val?._seconds;
    if (typeof secs === 'number' && secs > 0) return new Date(secs * 1000);
    if (typeof val === 'string' && val.trim()) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
    }
    if (typeof val === 'number' && val > 0) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

export function Programmes() {
    const navigate = useNavigate();
    const { programmes, setActiveProgramme, setActiveProject, activeProgrammeId, projects, deleteProgramme, archiveProgramme, unarchiveProgramme, loadProgrammeData, user, addNotification } = useStore();
    const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
    const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
    const canManage = isAtLeastClientAdmin(userRole) || userIsSuperAdmin;
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showArchived, setShowArchived] = React.useState(false);

    const filteredProgrammes = (Array.isArray(programmes) ? programmes : [])
        .filter(p => {
            if (userIsSuperAdmin) return true;
            if (userRole === 'client_admin') return true;
            if (isPM(userRole)) {
                // Return true if PM is assigned to the programme OR belongs to the same organization
                return p.pm === user?.email || 
                       p.pm === user?.uid || 
                       p.userId === user?.uid ||
                       (user?.profile?.clientId && p.clientId === user.profile.clientId);
            }
            return false;
        })
        .filter(p => !!p.isArchived === showArchived)
        .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.reference.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            // Sort by status - Drafts first
            if (a.status === 'Draft' && b.status !== 'Draft') return -1;
            if (a.status !== 'Draft' && b.status === 'Draft') return 1;

            // Then sort by createdAt descending
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

    const getProjectCount = (programmeId: string) => {
        if (!Array.isArray(projects)) return 0;
        return projects.filter(p => p.programmeId === programmeId).length;
    };

    const handleDeleteProgramme = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to PERMANENTLY delete programme "${name}"? This action cannot be undone.`)) {
            await deleteProgramme(id);
            addNotification({
                title: 'Programme Deleted',
                body: `Programme "${name}" has been permanently deleted.`,
                type: 'system'
            });
        }
    };

    const handleArchiveProgramme = async (e: React.MouseEvent, id: string, name: string, isArchived?: boolean) => {
        e.stopPropagation();
        if (isArchived) {
            if (window.confirm(`Restore programme "${name}" to active status?`)) {
                await unarchiveProgramme(id);
                addNotification({
                    title: 'Programme Restored',
                    body: `Programme "${name}" has been restored.`,
                    type: 'system'
                });
            }
        } else {
            if (window.confirm(`Archive programme "${name}"? It will be hidden from main dashboards but preserved for history.`)) {
                await archiveProgramme(id);
                addNotification({
                    title: 'Programme Archived',
                    body: `Programme "${name}" has been archived.`,
                    type: 'system'
                });
            }
        }
    };

    const handleEditProgramme = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        navigate(`/programmes/edit/${id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <LayoutTemplate className="w-6 h-6 text-indigo-600" />
                        </div>
                        Programmes
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Manage and monitor your high-level programme contexts.</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => { setActiveProgramme(null); setActiveProject(null); navigate('/programmes/new'); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-4 h-4" />
                        New Programme
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search programmes by name or reference..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {canManage && (
                    <div className="mt-4 flex items-center gap-4 pt-4 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div 
                                onClick={() => setShowArchived(!showArchived)}
                                className={clsx(
                                    "w-10 h-5 rounded-full relative transition-all duration-300",
                                    showArchived ? "bg-amber-500" : "bg-slate-200"
                                )}
                            >
                                <div className={clsx(
                                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
                                    showArchived ? "left-6" : "left-1"
                                )} />
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-amber-600 transition-colors">
                                Show Archived Programmes
                            </span>
                        </label>
                    </div>
                )}
            </div>

            {/* Programme Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProgrammes.length === 0 ? (
                    <div className="col-span-full bg-white rounded-lg border border-dotted border-slate-300 p-12 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                            <div className="p-4 bg-slate-50 rounded-full mb-4">
                                <LayoutTemplate className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">No programmes found</h3>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                There are no programmes matching your criteria. Programmes help you group related projects together for better oversight.
                            </p>
                                {canManage && (
                                    <button
                                        onClick={() => { setActiveProgramme(null); navigate('/programmes/new'); }}
                                        className="mt-6 text-indigo-600 font-bold text-sm hover:text-indigo-700 flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Your First Programme
                                    </button>
                                )}
                        </div>
                    </div>
                ) : (
                    filteredProgrammes.map(programme => (
                        <div
                            key={programme.id}
                            className={`group bg-white rounded-lg border transition-all duration-300 hover:shadow-lg overflow-hidden ${activeProgrammeId === programme.id
                                ? 'border-indigo-500 ring-1 ring-indigo-500/20'
                                : 'border-slate-200 hover:border-indigo-200'
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <LayoutTemplate className="w-5 h-5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {programme.status === 'Draft' && (
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase tracking-wider">
                                                Draft
                                            </span>
                                        )}
                                        {programme.isArchived && (
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase tracking-wider">
                                                Archived
                                            </span>
                                        )}
                                        {activeProgrammeId === programme.id && !programme.isArchived && (
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase tracking-wider">
                                                Active
                                            </span>
                                        )}
                                        <button
                                            onClick={() => { loadProgrammeData(programme.id); navigate('/risk/programme-context'); }}
                                            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 pb-4">
                                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1" title={programme.name}>
                                        {programme.name}
                                    </h3>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            {programme.reference}
                                        </p>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canManage && (
                                                <>
                                                    <button
                                                        onClick={(e) => handleEditProgramme(e, programme.id)}
                                                        className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-slate-400"
                                                        title="Edit Programme"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleArchiveProgramme(e, programme.id, programme.name, programme.isArchived)}
                                                        className={clsx(
                                                            "p-1 rounded transition-colors text-slate-400",
                                                            programme.isArchived ? "hover:text-emerald-600 hover:bg-emerald-50" : "hover:text-amber-600 hover:bg-amber-50"
                                                        )}
                                                        title={programme.isArchived ? "Unarchive Programme" : "Archive Programme"}
                                                    >
                                                        {programme.isArchived ? <RefreshCw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteProgramme(e, programme.id, programme.name)}
                                                        className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors text-slate-400"
                                                        title="Delete Programme"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Layers className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Projects</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">{getProjectCount(programme.id)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Value</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">{programme.totalValue || 'Not Set'}</p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        {calculateProgrammeProgress(programme).pillars.map((pillar, i) => (
                                                <div 
                                                    key={i}
                                                    className={clsx(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        pillar.status === 'complete' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-200"
                                                    )}
                                                    title={pillar.label}
                                                />
                                        ))}
                                        <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Setup Status</span>
                                    </div>
                                    <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                        {calculateProgrammeProgress(programme).percentage}%
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-slate-500 whitespace-nowrap">
                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                        <span className="text-xs truncate">{programme.programmeStartDate || 'Jan 24'}</span>
                                    </div>
                                    {(() => {
                                        const updated = parseAnyDate(programme.updatedAt);
                                        if (!updated) return null;
                                        return (
                                            <div className="flex items-center gap-1 text-slate-400 whitespace-nowrap border-l border-slate-200 pl-3">
                                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                                <span className="text-xs truncate">Updated {updated.toLocaleDateString()}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <button
                                    onClick={() => { loadProgrammeData(programme.id); navigate('/risk/programme-context'); }}
                                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:gap-2 transition-all"
                                >
                                    Select
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

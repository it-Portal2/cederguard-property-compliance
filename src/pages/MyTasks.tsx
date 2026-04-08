import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, Clock, CheckCircle2, AlertCircle, MoreVertical, Calendar, CheckSquare, Pencil, Trash2, X, Info, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useStore, TaskItem, ComplianceItem } from '../store/useStore';
import { clsx } from 'clsx';

const EmptyState = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2 opacity-60">
        <Info className="w-8 h-8" />
        <p className="text-xs font-medium">{title}</p>
    </div>
);

export function MyTasks() {
    const navigate = useNavigate();
    const { user, tasks, complianceItems, addTask, updateTask, deleteTask, updateComplianceItem, projects, programmes } = useStore();
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentTask, setCurrentTask] = useState<Partial<TaskItem>>({});
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Filters
    const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'compliance' | 'risk_review' | 'issue_deadline'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'upcoming' | 'completed'>('all');
    const [contextFilter, setContextFilter] = useState<string>('all');

    const toggleSelectAll = () => {
        if (selectedIds.length === allItems.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(allItems.map(i => i.id));
        }
    };

    const toggleSelectOne = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        const tasksToDelete = allItems.filter(i => i.type === 'task' && selectedIds.includes(i.id));
        if (tasksToDelete.length === 0) return;
        
        if (window.confirm(`Are you sure you want to delete ${tasksToDelete.length} selected tasks?`)) {
            tasksToDelete.forEach(t => deleteTask(t.id));
            setSelectedIds(prev => prev.filter(id => !tasksToDelete.find(t => t.id === id)));
        }
    };

    // Merge manual tasks, actionable compliance items, risk reviews, and issue deadlines
    const allItems = useMemo(() => {
        const userId = user?.id || user?.uid || user?.email;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Manual tasks - strict owner filter
        const manualTasks = (Array.isArray(tasks) ? tasks : [])
            .filter(t => {
                const isOwner = userId && (t.owner === userId || t.owner === user?.email || t.owner === user?.uid);
                return isOwner;
            })
            .map(t => ({ ...t, type: 'task' as const }));

        // 2. Compliance Tracker Items
        const compActions = (Array.isArray(complianceItems) ? complianceItems : [])
            .filter(c => {
                // Only show if user is owner / PM
                const isOwner = !userId || c.owners?.includes(userId) || c.pmId === userId || c.userId === userId;
                if (!isOwner) return false;

                // Only show actionable items (not Live or Archived)
                return (c.dueDate || c.stage === 'In Progress') && c.stage !== 'Live' && c.stage !== 'Archived';
            })
            .map(c => ({
                id: c.id,
                title: c.req || c.name || 'Compliance Action',
                description: `${c.reg || 'General Regulation'} - ${c.auth || 'Authority'}`,
                status: (c.stage === 'In Progress' ? 'In Progress' : (c.status === 'applicable' ? 'Pending' : (c.status === 'closed' || c.stage === 'Live' ? 'Completed' : c.status))) as TaskItem['status'],
                priority: (c.risk === 'Critical' || c.risk === 'High' ? 'High' : c.risk === 'Low' ? 'Low' : 'Medium') as TaskItem['priority'],
                dueDate: c.dueDate || 'No date set',
                completedAt: c.completedAt,
                projectName: c.projectName,
                projectId: c.projectId,
                isProgrammeLevel: c.isProgrammeLevel,
                programmeId: c.programmeId,
                type: 'compliance' as const,
                original: c
            }));

        // 3. Risk Review Dates
        const { risks, issues } = useStore.getState();
        const riskReviews = (Array.isArray(risks) ? risks : [])
            .filter(r => {
                const isOwner = !userId || r.owner === userId || r.owner === user?.email;
                return isOwner && r.nextReview && r.status !== 'Closed';
            })
            .map(r => ({
                id: `REV-${r.id}`,
                title: `Risk Review needed: ${r.title || r.desc}`,
                description: `ID: ${r.id} - ${r.category}`,
                status: 'Pending' as TaskItem['status'],
                priority: (r.priority === 'High' || r.impact === 'Critical' ? 'High' : 'Medium') as TaskItem['priority'],
                dueDate: r.nextReview!,
                projectName: r.projectName,
                projectId: r.projectId,
                isProgrammeLevel: r.isProgrammeLevel,
                programmeId: r.programmeId,
                type: 'risk_review' as const,
                original: r
            }));

        // 4. Issue Deadlines
        const issueDeadlines = (Array.isArray(issues) ? issues : [])
            .filter(i => {
                const isOwner = !userId || i.owner === userId || i.owner === user?.email || i.controlOwner === userId;
                return isOwner && i.deadline && i.status !== '4. Resolved';
            })
            .map(i => ({
                id: `DL-${i.id}`,
                title: `Issue Deadline: ${i.title || i.desc}`,
                description: `ID: ${i.id} - ${i.category || 'General'}`,
                status: (i.status === 'Resolved' || i.status === '4. Resolved' ? 'Completed' : (i.status === '2. Escalated' ? 'In Progress' : 'Pending')) as TaskItem['status'],
                priority: (i.severity === 'Critical' || i.severity === 'High' || i.priority >= 4 ? 'High' : 'Medium') as TaskItem['priority'],
                dueDate: i.deadline!,
                completedAt: i.completedAt, // Use if available
                projectName: i.projectName,
                projectId: i.projectId,
                isProgrammeLevel: i.isProgrammeLevel,
                programmeId: (i as any).programmeId,
                type: 'issue_deadline' as const,
                original: i
            }));

        const combined = [...manualTasks, ...compActions, ...riskReviews, ...issueDeadlines];

        // Apply filters
        return combined.filter(item => {
            // Search filter
            const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                item.description?.toLowerCase().includes(search.toLowerCase()) ||
                item.projectName?.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;

            // Type filter
            if (typeFilter !== 'all' && item.type !== typeFilter) return false;

            // Context filter (Project/Programme)
            if (contextFilter !== 'all' && item.projectId !== contextFilter && item.programmeId !== contextFilter) return false;

            // Status/Timeline filter
            if (statusFilter !== 'all') {
                if (statusFilter === 'completed') return item.status === 'Completed';
                if (item.status === 'Completed') return false; // Hide completed in other timeline views

                const itemDate = item.dueDate !== 'No date set' ? new Date(item.dueDate) : null;
                if (!itemDate) return statusFilter === 'upcoming'; // Or show in upcoming if no date

                const diffDays = Math.ceil((itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (statusFilter === 'overdue') return diffDays < 0;
                if (statusFilter === 'today') return diffDays === 0;
                if (statusFilter === 'week') return diffDays >= 0 && diffDays <= 7;
                if (statusFilter === 'upcoming') return diffDays > 7;
            }

            return true;
        }).sort((a, b) => {
            // Completed at the bottom
            if (a.status === 'Completed' && b.status !== 'Completed') return 1;
            if (a.status !== 'Completed' && b.status === 'Completed') return -1;

            // Then by due date
            if (a.dueDate === 'No date set') return 1;
            if (b.dueDate === 'No date set') return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }, [tasks, complianceItems, search, typeFilter, statusFilter, contextFilter, user]);

    // KPI Calculation
    const kpis = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);

        const active = allItems.filter(i => i.status !== 'Completed');
        const overdue = active.filter(i => i.dueDate !== 'No date set' && new Date(i.dueDate) < today);
        const dueToday = active.filter(i => i.dueDate !== 'No date set' && new Date(i.dueDate).toDateString() === today.toDateString());
        
        const completedThisWeek = allItems.filter(i => {
            if (i.status !== 'Completed') return false;
            if (!i.completedAt) return true; // Fallback for old data: count all completed if no date
            const date = new Date(i.completedAt);
            return date >= lastWeek;
        });

        return {
            overdue: overdue.length,
            dueToday: dueToday.length,
            completed: completedThisWeek.length
        };
    }, [allItems]);


    const criticalAlerts = useMemo(() => {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        return allItems.filter(item => {
            if (item.status === 'Completed') return false;
            if (item.dueDate === 'No date set') return false;
            const due = new Date(item.dueDate);
            return due <= nextWeek;
        });
    }, [allItems]);

    const openAddModal = () => {
        setModalMode('add');
        setCurrentTask({
            title: '',
            priority: 'Medium',
            dueDate: new Date().toISOString().split('T')[0],
            description: '',
            status: 'Pending'
        });
        setShowModal(true);
    };

    const openEditModal = (task: any) => {
        if (task.type === 'compliance') return; // Compliance items edited in tracker
        setModalMode('edit');
        setCurrentTask(task);
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTask.title?.trim()) return;

        if (modalMode === 'add') {
            const task: TaskItem = {
                id: `T-${Date.now()}`,
                title: currentTask.title,
                description: currentTask.description || '',
                status: 'Pending',
                priority: currentTask.priority as any || 'Medium',
                dueDate: currentTask.dueDate || new Date().toISOString().split('T')[0],
            };
            addTask(task);
        } else if (modalMode === 'edit' && currentTask.id) {
            updateTask(currentTask.id, currentTask);
        }

        setShowModal(false);
        setCurrentTask({});
    };

    const toggleComplete = (item: any) => {
        if (item.type === 'compliance') {
            updateComplianceItem(item.id, {
                stage: item.status === 'Completed' ? 'In Progress' : 'Live'
            });
        } else {
            updateTask(item.id, {
                status: item.status === 'Completed' ? 'Pending' : 'Completed'
            });
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* KPI Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                    <div>
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Overdue Actions</p>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tighter">{kpis.overdue}</h4>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                    <div>
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Due Today</p>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tighter">{kpis.dueToday}</h4>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                    <div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Closed (Last 7d)</p>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tighter">{kpis.completed}</h4>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                    >
                        <option value="all">All Timelines</option>
                        <option value="overdue">Overdue</option>
                        <option value="today">Due Today</option>
                        <option value="week">Due This Week</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                    >
                        <option value="all">All Sources</option>
                        <option value="task">Manual Tasks</option>
                        <option value="compliance">Compliance</option>
                        <option value="risk_review">Risk Reviews</option>
                        <option value="issue_deadline">Issue Deadlines</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                        value={contextFilter}
                        onChange={e => setContextFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer max-w-[150px]"
                    >
                        <option value="all">Project/Programme</option>
                        <optgroup label="Programmes">
                            {programmes.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Projects">
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                <div className="h-6 w-px bg-slate-200 ml-auto hidden md:block"></div>

                <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search workspace..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Task List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Action Register</span>
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left duration-300">
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                    {selectedIds.length} Selected
                                </span>
                                {allItems.some(i => i.type === 'task' && selectedIds.includes(i.id)) && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="text-rose-600 hover:text-rose-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> Bulk Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {allItems.length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-400">
                            <tr>
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={selectedIds.length > 0 && selectedIds.length === allItems.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4 text-left">Source</th>
                                <th className="p-4 text-left">Action Item</th>
                                <th className="p-4 text-left w-32">Due Date</th>
                                <th className="p-4 text-left w-24">Priority</th>
                                <th className="p-4 text-left w-32">Status</th>
                                <th className="p-4 text-right w-32">Manage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allItems.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => item.type === 'task' ? openEditModal(item) : null}>
                                    <td className="p-4" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={selectedIds.includes(item.id)}
                                            onClick={e => toggleSelectOne(item.id, e)}
                                            onChange={() => {}}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {item.type === 'compliance' ? (
                                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                            ) : (
                                                <CheckSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                                            )}
                                            <div className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[120px]">
                                                {item.projectName || 'Programme'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className={clsx(
                                            "font-semibold text-slate-800",
                                            item.status === 'Completed' && "line-through opacity-50"
                                        )}>{item.title}</div>
                                        {item.description && (
                                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 italic" title={item.description}>{item.description}</div>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-600 text-[11px] font-medium text-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                            {item.dueDate}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={clsx('px-2 py-0.5 rounded-full text-[9px] font-black uppercase border',
                                            item.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                item.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                        )}>{item.priority}</span>
                                    </td>
                                    <td className="p-4 w-32">
                                        {(() => {
                                            const isOverdue = item.status !== 'Completed' && item.dueDate !== 'No date set' && new Date(item.dueDate) < new Date(new Date().setHours(0,0,0,0));
                                            return (
                                                <span className={clsx('px-2 py-0.5 rounded-full text-[9px] font-black uppercase border whitespace-nowrap',
                                                    item.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.1)]' :
                                                                'bg-slate-50 text-slate-400 border-slate-200'
                                                )}>
                                                    {isOverdue ? 'Overdue' : item.status}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-2 pr-2">
                                            <button
                                                onClick={() => toggleComplete(item)}
                                                className={clsx('p-2 rounded-xl transition-all border shadow-sm',
                                                    item.status === 'Completed' 
                                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                                        : 'text-slate-400 bg-white border-slate-200 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                                                )}
                                                title={item.status === 'Completed' ? 'Re-open' : 'Complete'}
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                            {item.type === 'task' && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                                        className="p-2 text-slate-400 bg-white border border-slate-200 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
                                                        title="Edit task"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteTask(item.id); }}
                                                        className="p-2 text-slate-400 bg-white border border-slate-200 rounded-xl hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all shadow-sm"
                                                        title="Delete task"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {item.type === 'compliance' && (
                                                 <button
                                                     onClick={(e) => { e.stopPropagation(); navigate('/compliance'); }}
                                                     className="p-2 text-slate-400 bg-white border border-slate-200 rounded-xl hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
                                                     title="Go to Compliance Tracker"
                                                 >
                                                     <ExternalLink className="w-4 h-4" />
                                                 </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <EmptyState title="No active items in your workspace. Add a new task or review compliance requirements to get started." />
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                                {modalMode === 'add' ? 'Create Workspace Task' : 'Edit Task'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Task Title</label>
                                <input
                                    type="text"
                                    autoFocus
                                    required
                                    value={currentTask.title || ''}
                                    onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                                    placeholder="What needs to be done?"
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description / Notes</label>
                                <textarea
                                    value={currentTask.description || ''}
                                    onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                                    placeholder="Add context, links, or reminders..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all shadow-inner"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Priority Level</label>
                                    <select
                                        value={currentTask.priority || 'Medium'}
                                        onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High Priority</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Due Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={currentTask.dueDate || ''}
                                        onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 tracking-widest"
                                >
                                    {modalMode === 'add' ? 'Add To Workspace' : 'Update Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

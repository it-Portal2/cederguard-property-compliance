import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Edit2, CheckCircle2, Circle, AlertCircle, Save, X, History, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { ProgrammeMilestone, MilestoneHistory, useStore } from '../store/useStore';
import { format, parseISO, isValid } from 'date-fns';
import { RIBA_STAGES, getRIBALabel } from '../constants/ribaStages';

interface MilestoneManagerProps {
    milestones: ProgrammeMilestone[];
    onChange: (milestones: ProgrammeMilestone[]) => void;
    entityType?: 'project' | 'programme';
}

export const MilestoneManager: React.FC<MilestoneManagerProps> = ({ milestones = [], onChange, entityType = 'project' }) => {
    const safeMilestones = Array.isArray(milestones) ? milestones : [];
    const { user } = useStore();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
    const [newMilestone, setNewMilestone] = useState<Partial<ProgrammeMilestone>>({ 
        status: 'Pending',
        isKey: false,
        stage: 'S2' // Default to S2 Concept Design
    });

    // Mandatory comment state
    const [pendingUpdate, setPendingUpdate] = useState<{
        id: string;
        updates: Partial<ProgrammeMilestone>;
        originalDate: string;
    } | null>(null);
    const [comment, setComment] = useState('');
    const [editForm, setEditForm] = useState<Partial<ProgrammeMilestone>>({});
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleAdd = () => {
        if (!newMilestone.name || !newMilestone.date) return;
        
        const milestone: ProgrammeMilestone = {
            id: Date.now().toString(),
            name: newMilestone.name as string,
            date: newMilestone.date,
            status: newMilestone.status as 'Pending' | 'Completed' | 'Delayed' | 'In Progress',
            description: newMilestone.description || '',
            stage: newMilestone.stage,
            isKey: newMilestone.isKey || false,
            history: [],
            updatedBy: user?.profile?.name || 'Unknown',
            category: 'General',
            historicalUpdates: []
        };

        onChange([...safeMilestones, milestone]);
        setNewMilestone({ status: 'Pending', isKey: false, stage: 'S2' });
        setIsAdding(false);
    };

    const handleUpdate = (id: string, updates: Partial<ProgrammeMilestone>) => {
        const milestone = safeMilestones.find(m => m.id === id);
        if (!milestone) return;

        // Check if date changed
        if (updates.date && updates.date !== milestone.date) {
            setPendingUpdate({ id, updates, originalDate: milestone.date });
            setComment('');
            return;
        }

        performUpdate(id, updates);
    };

    const performUpdate = (id: string, updates: Partial<ProgrammeMilestone>, updateComment?: string) => {
        const updatedMilestones = safeMilestones.map(m => {
            if (m.id === id) {
                const newHistory: MilestoneHistory[] = [...(m.history || [])];
                
                if (updateComment && updates.date) {
                    newHistory.unshift({
                        id: Date.now().toString(),
                        date: updates.date,
                        comment: updateComment,
                        updatedAt: new Date().toISOString(),
                        updatedBy: user?.email || 'System'
                    });
                }

                return { ...m, ...updates, history: newHistory };
            }
            return m;
        });

        onChange(updatedMilestones);
        setEditingId(null);
        setPendingUpdate(null);
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = () => {
        if (!deleteConfirmId) return;
        onChange(safeMilestones.filter(m => m.id !== deleteConfirmId));
        setDeleteConfirmId(null);
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'Completed': return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            case 'Delayed': return { bg: 'bg-rose-100', text: 'text-rose-700', icon: <AlertCircle className="w-3.5 h-3.5" /> };
            default: return { bg: 'bg-slate-100', text: 'text-slate-600', icon: <Circle className="w-3.5 h-3.5" /> };
        }
    };

    const sortedMilestones = [...milestones].sort((a, b) => {
        const aTime = a.date && isValid(parseISO(a.date)) ? parseISO(a.date).getTime() : Infinity;
        const bTime = b.date && isValid(parseISO(b.date)) ? parseISO(b.date).getTime() : Infinity;
        return aTime - bTime;
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">{entityType === 'programme' ? 'Programme' : 'Project'} Milestones</h3>
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">RIBA Stages & Key Deadlines</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Milestone
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Milestone Name</label>
                            <input
                                autoFocus
                                type="text"
                                value={newMilestone.name || ''}
                                onChange={e => setNewMilestone(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="e.g. Planning Phase Complete"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Target Date</label>
                            <input
                                type="date"
                                value={newMilestone.date || ''}
                                onChange={e => setNewMilestone(prev => ({ ...prev, date: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">RIBA Stage</label>
                            <select
                                value={newMilestone.stage || 'S2'}
                                onChange={e => setNewMilestone(prev => ({ ...prev, stage: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            >
                                {RIBA_STAGES.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 mt-auto pb-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={clsx(
                                    "p-1.5 rounded-lg border transition-all",
                                    newMilestone.isKey ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-slate-400 group-hover:border-slate-300"
                                )}>
                                    <Star className={clsx("w-4 h-4", newMilestone.isKey && "fill-amber-500")} />
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={newMilestone.isKey || false}
                                    onChange={e => setNewMilestone(prev => ({ ...prev, isKey: e.target.checked }))}
                                />
                                <span className={clsx("text-[10px] font-black uppercase tracking-widest", newMilestone.isKey ? "text-amber-700" : "text-slate-500")}>
                                    Key Milestone
                                </span>
                            </label>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description (Optional)</label>
                            <input
                                type="text"
                                value={newMilestone.description || ''}
                                onChange={e => setNewMilestone(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Brief details about this milestone"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!newMilestone.name || !newMilestone.date}
                            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                            <Save className="w-3.5 h-3.5" />
                            Save Milestone
                        </button>
                    </div>
                </div>
            )}

            {sortedMilestones.length === 0 && !isAdding ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500 text-center">No milestones mapped yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sortedMilestones.map(m => {
                        const isEditing = editingId === m.id;
                        const statusConfig = getStatusConfig(m.status);
                        const isExpanded = expandedHistoryId === m.id;

                        if (isEditing) {
                            return (
                                <div key={m.id} className="bg-white border-2 border-indigo-500 rounded-xl p-4 shadow-sm relative">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Name</label>
                                            <input
                                                type="text"
                                                value={editForm.name || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Date</label>
                                            <input
                                                type="date"
                                                value={editForm.date || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Stage</label>
                                            <select
                                                value={editForm.stage || 'S2'}
                                                onChange={e => setEditForm(prev => ({ ...prev, stage: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            >
                                                {RIBA_STAGES.map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
                                            <select
                                                value={editForm.status || 'Pending'}
                                                onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as ProgrammeMilestone['status'] }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Delayed">Delayed</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                                            <input
                                                type="text"
                                                value={editForm.description || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                placeholder="Description"
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.isKey || false}
                                                    onChange={e => setEditForm(prev => ({ ...prev, isKey: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Key Milestone</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-[11px] font-bold text-slate-500">Cancel</button>
                                        <button
                                            onClick={() => handleUpdate(m.id, editForm)}
                                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5"
                                        >
                                            <Save className="w-3.5 h-3.5" /> Save
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={m.id} className="flex flex-col gap-0.5 animate-in fade-in slide-in-from-left-2 transition-all">
                                <div className="bg-white border border-slate-200 rounded-xl p-3 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-slate-300 transition-colors group relative overflow-hidden">
                                    {m.isKey && (
                                        <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center translate-x-1 -translate-y-1">
                                            <div className="w-full h-full bg-amber-100 rotate-45 flex items-center justify-center">
                                                <Star className="w-2.5 h-2.5 text-amber-600 fill-amber-600 -rotate-45 -translate-x-1 translate-y-1" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 border border-black/5", statusConfig.bg, statusConfig.text)}>
                                            <span className="text-[10px] font-black uppercase leading-none">{m.stage || 'S?'}</span>
                                            <Calendar className="w-3 h-3 mt-0.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-900 truncate">{m.name}</h4>
                                                <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase rounded border border-slate-100 italic">
                                                    {getRIBALabel(m.stage || 'S2')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[11px] text-slate-600 font-bold bg-slate-50 px-1.5 rounded">
                                                    {m.date && isValid(parseISO(m.date)) ? format(parseISO(m.date), 'dd MMM yyyy') : '—'}
                                                </span>
                                                {m.description && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                        <span className="text-[11px] text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">{m.description}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 ml-12 sm:ml-0">
                                        <div className="flex items-center gap-2">
                                            <span className={clsx("px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0", statusConfig.bg, statusConfig.text)}>
                                                {statusConfig.icon}
                                                {m.status}
                                            </span>
                                            {m.history && m.history.length > 0 && (
                                                <button 
                                                    onClick={() => setExpandedHistoryId(isExpanded ? null : m.id)}
                                                    className={clsx(
                                                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all",
                                                        isExpanded ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                                    )}
                                                >
                                                    <History className="w-3 h-3" />
                                                    {m.history.length}
                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingId(m.id);
                                                    setEditForm({
                                                        name: m.name,
                                                        date: m.date || '',
                                                        description: m.description || '',
                                                        status: m.status,
                                                        stage: m.stage || 'S2',
                                                        isKey: m.isKey || false,
                                                    });
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(m.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {isExpanded && m.history && (
                                    <div className="mx-4 sm:mx-12 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                        <div className="bg-slate-50 border-x border-b border-slate-200 rounded-b-xl p-3 space-y-2 mt-[-1px]">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Timeline History</p>
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                                {m.history.map(entry => (
                                                    <div key={entry.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex gap-3 shadow-sm">
                                                        <div className="shrink-0 flex flex-col items-center">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                            <div className="w-px flex-1 bg-slate-200 my-1" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-4 mb-1">
                                                                <span className="text-[10px] font-black text-slate-900 uppercase">Moved to {isValid(new Date(entry.date)) ? format(new Date(entry.date), 'dd MMM yyyy') : entry.date}</span>
                                                                <span className="text-[9px] text-slate-400 font-medium">{isValid(new Date(entry.updatedAt)) ? format(new Date(entry.updatedAt), 'dd/MM/yy HH:mm') : '—'}</span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 leading-normal italic">"{entry.comment}"</p>
                                                            <div className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">— {entry.updatedBy}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="px-6 py-5 border-b border-slate-100 bg-rose-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-base">Delete Milestone</h3>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">
                                        {safeMilestones.find(m => m.id === deleteConfirmId)?.name || 'This milestone'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600">This will permanently remove the milestone and its history. This cannot be undone.</p>
                            <div className="pt-5 flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 tracking-widest"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mandatory Comment Modal */}
            {pendingUpdate && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in transition-all">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-white/20 overflow-hidden scale-in-center">
                        <div className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <History className="w-24 h-24" />
                            </div>
                            <h2 className="text-xl font-black tracking-tight mb-1">Mandatory Date Tracking</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Documentation for Audit Trail</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="text-center flex-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Original Date</p>
                                    <p className="text-sm font-bold text-slate-600">{format(new Date(pendingUpdate.originalDate), 'dd MMM yyyy')}</p>
                                </div>
                                <div className="shrink-0">
                                    <Plus className="w-4 h-4 text-indigo-400 rotate-45" />
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-[9px] font-black text-indigo-500 uppercase mb-1">New Target</p>
                                    <p className="text-sm font-black text-indigo-700">{format(new Date(pendingUpdate.updates.date!), 'dd MMM yyyy')}</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Reason for Change <span className="text-rose-500">*</span></label>
                                <textarea
                                    autoFocus
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Explain why the date was changed (e.g., Planning delays, Material shortage...)"
                                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                                />
                                <p className="text-[9px] text-slate-400 font-medium mt-2 leading-normal">
                                    This comment is mandatory and will be logged in the permanent milestone history for stakeholder accountability.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPendingUpdate(null)}
                                    className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Revert Change
                                </button>
                                <button
                                    onClick={() => performUpdate(pendingUpdate.id, pendingUpdate.updates, comment)}
                                    disabled={!comment.trim()}
                                    className="flex-1 py-3 bg-indigo-600 disabled:bg-slate-300 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-200"
                                >
                                    Log & Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

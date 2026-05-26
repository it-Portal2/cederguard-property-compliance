import React, { useState } from 'react';
import { TeamMember } from '../store/useStore';
import { Plus, User, Mail, Building2, Trash2, Edit2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { generateId } from '../lib/utils';

interface DeliveryTeamCRUDProps {
    members: TeamMember[];
    isDone: boolean;
    onUpdate: (members: TeamMember[], isDone: boolean) => void;
    title?: string;
    saving?: boolean;
    saved?: boolean;
}

export const DeliveryTeamCRUD: React.FC<DeliveryTeamCRUDProps> = ({
    members = [],
    isDone,
    onUpdate,
    title = "Delivery Team Composition",
    saving = false,
    saved = false,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<TeamMember>>({
        name: '',
        role: '',
        email: '',
        phone: '',
        organization: ''
    });

    const resetForm = () => {
        setFormData({ name: '', role: '', email: '', phone: '', organization: '' });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleAdd = () => {
        if (!formData.name || !formData.role) return;
        const newMember: TeamMember = {
            id: generateId('tm_'),
            name: formData.name,
            role: formData.role,
            email: formData.email || '',
            phone: formData.phone || '',
            organization: formData.organization || ''
        };
        onUpdate([...members, newMember], isDone);
        resetForm();
    };

    const handleUpdate = () => {
        if (!editingId || !formData.name || !formData.role) return;
        const updatedMembers = members.map(m => 
            m.id === editingId ? { ...m, ...formData as TeamMember } : m
        );
        onUpdate(updatedMembers, isDone);
        resetForm();
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = () => {
        if (!deleteConfirmId) return;
        onUpdate(members.filter(m => m.id !== deleteConfirmId), isDone);
        setDeleteConfirmId(null);
    };

    const startEdit = (member: TeamMember) => {
        setFormData(member);
        setEditingId(member.id);
        setIsAdding(true);
    };

    const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all";
    const labelCls = "block font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
                    {saving ? (
                        <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-indigo-500 mt-0.5 uppercase tracking-wide">
                            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                        </span>
                    ) : saved ? (
                        <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-emerald-600 mt-0.5 uppercase tracking-wide">
                            <CheckCircle2 className="w-3 h-3" /> Saved
                        </span>
                    ) : (
                        <p className="text-[10px] text-slate-500 font-medium">Assign key stakeholders and project roles.</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => { resetForm(); setIsAdding(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-mono text-[10px] font-medium uppercase tracking-wide hover:bg-indigo-100 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
            </div>

            {isAdding && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Full Name *</label>
                            <input 
                                className={inputCls} 
                                value={formData.name} 
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Role *</label>
                            <input 
                                className={inputCls} 
                                value={formData.role} 
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                placeholder="e.g. Project Manager"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Email Address</label>
                            <input 
                                className={inputCls} 
                                value={formData.email} 
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Organization</label>
                            <input 
                                className={inputCls} 
                                value={formData.organization} 
                                onChange={e => setFormData({ ...formData, organization: e.target.value })}
                                placeholder="e.g. Cedar Property"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={editingId ? handleUpdate : handleAdd}
                            disabled={!formData.name || !formData.role}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                        >
                            {editingId ? 'Update Member' : 'Save Member'}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {members.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-center">
                        <User className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="font-mono text-[11px] text-slate-400 font-medium uppercase tracking-wide">No team members assigned</p>
                        <p className="text-[10px] text-slate-400 mt-1">Start by adding the SRO or Project Lead.</p>
                    </div>
                ) : (
                    members.map(member => (
                        <div key={member.id} className="group p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-200 hover:shadow-md transition-all flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-900 leading-none">{member.name}</p>
                                    <p className="font-mono text-[10px] text-indigo-600 font-medium mt-1 uppercase tracking-wide">{member.role}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {member.email && (
                                            <span className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                                                <Mail className="w-2.5 h-2.5" /> {member.email}
                                            </span>
                                        )}
                                        {member.organization && (
                                            <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500 font-medium uppercase tracking-wide">
                                                <Building2 className="w-2.5 h-2.5" /> {member.organization}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => startEdit(member)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(member.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {deleteConfirmId && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4 text-rose-600">
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-base font-semibold tracking-tight">Remove Team Member</h3>
                        </div>
                        <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                            Are you sure you want to remove <strong className="text-slate-800">{members.find(m => m.id === deleteConfirmId)?.name}</strong> from the delivery team?
                        </p>
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200/50 rounded-lg transition-all"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

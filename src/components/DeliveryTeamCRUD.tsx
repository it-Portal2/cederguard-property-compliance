import React, { useState } from 'react';
import { useStore, TeamMember } from '../store/useStore';
import { Plus, User, Mail, Phone, Building2, Trash2, Edit2, CheckCircle2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { generateId } from '../lib/utils';

interface DeliveryTeamCRUDProps {
    members: TeamMember[];
    isDone: boolean;
    onUpdate: (members: TeamMember[], isDone: boolean) => void;
    title?: string;
}

export const DeliveryTeamCRUD: React.FC<DeliveryTeamCRUDProps> = ({ 
    members = [], 
    isDone, 
    onUpdate,
    title = "Delivery Team Composition"
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
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
        onUpdate(members.filter(m => m.id !== id), isDone);
    };

    const startEdit = (member: TeamMember) => {
        setFormData(member);
        setEditingId(member.id);
        setIsAdding(true);
    };

    const toggleDone = () => {
        onUpdate(members, !isDone);
    };

    const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all";
    const labelCls = "block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Assign key stakeholders and project roles.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsAdding(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
            </div>

            {isAdding && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
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
                            onClick={resetForm}
                            className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase hover:bg-slate-100 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={editingId ? handleUpdate : handleAdd}
                            disabled={!formData.name || !formData.role}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                        >
                            {editingId ? 'Update Member' : 'Save Member'}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {members.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                        <User className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">No team members assigned</p>
                        <p className="text-[10px] text-slate-400 mt-1">Start by adding the SRO or Project Lead.</p>
                    </div>
                ) : (
                    members.map(member => (
                        <div key={member.id} className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-900 leading-none">{member.name}</p>
                                    <p className="text-[10px] text-indigo-600 font-bold mt-1 uppercase tracking-tighter">{member.role}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {member.email && (
                                            <span className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                                                <Mail className="w-2.5 h-2.5" /> {member.email}
                                            </span>
                                        )}
                                        {member.organization && (
                                            <span className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                                                <Building2 className="w-2.5 h-2.5" /> {member.organization}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => startEdit(member)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
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

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                <div className="text-center sm:text-left">
                    <p className="text-xs font-black text-indigo-900 uppercase tracking-tight">Requirement Completion</p>
                    <p className="text-[10px] text-indigo-700/70 font-medium">Is the delivery team fully assigned and confirmed?</p>
                </div>
                <button 
                    onClick={toggleDone}
                    className={clsx(
                        "w-full sm:w-auto px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                        isDone 
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
                            : "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 shadow-sm"
                    )}
                >
                    {isDone ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                        </>
                    ) : (
                        "Mark Section Complete"
                    )}
                </button>
            </div>
        </div>
    );
};

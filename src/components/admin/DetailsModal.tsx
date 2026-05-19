import React, { useState } from 'react';
import { 
    Layers, 
    FolderKanban, 
    X, 
    Edit2, 
    RefreshCw, 
    Trash2 
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router';

interface DetailsModalProps {
    isOpen: boolean;
    type: 'programmes' | 'projects' | null;
    onClose: () => void;
    items: any[];
    allUsers: any[];
    onItemDeleted: (id: string, type: 'programmes' | 'projects') => void;
    onItemTransferred: (id: string, type: 'programmes' | 'projects', targetUser: any) => void;
    adminDeleteProgramme: (id: string) => Promise<void>;
    adminDeleteProject: (id: string) => Promise<void>;
    adminTransferProgramme: (id: string, targetUser: any) => Promise<void>;
    adminTransferProject: (id: string, targetUser: any) => Promise<void>;
}

export function DetailsModal({
    isOpen,
    type,
    onClose,
    items,
    allUsers,
    onItemDeleted,
    onItemTransferred,
    adminDeleteProgramme,
    adminDeleteProject,
    adminTransferProgramme,
    adminTransferProject
}: DetailsModalProps) {
    const navigate = useNavigate();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [transferringId, setTransferringId] = useState<string | null>(null);
    const [targetPmUid, setTargetPmUid] = useState<string>('');

    if (!isOpen || !type) return null;

    const handleDelete = async (item: any) => {
        setProcessingId(item.id);
        try {
            if (type === 'programmes') {
                await adminDeleteProgramme(item.id);
            } else {
                await adminDeleteProject(item.id);
            }
            onItemDeleted(item.id, type);
            setConfirmDeleteId(null);
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleTransfer = async (item: any) => {
        if (!targetPmUid) return;
        const targetUser = allUsers.find(u => u.uid === targetPmUid);
        if (!targetUser) return;

        setProcessingId(item.id);
        try {
            if (type === 'programmes') {
                await adminTransferProgramme(item.id, targetUser);
            } else {
                await adminTransferProject(item.id, targetUser);
            }
            onItemTransferred(item.id, type, targetUser);
            setTransferringId(null);
            setTargetPmUid('');
            alert('Ownership successfully transferred to ' + targetUser.email);
        } catch (err: any) {
            alert('Transfer failed: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        {type === 'programmes' ? <Layers className="w-6 h-6 text-purple-600" /> : <FolderKanban className="w-6 h-6 text-amber-600" />}
                        {type === 'programmes' ? 'All Programmes' : 'All Projects'}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{items.length} items</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 border border-transparent hover:bg-slate-50 transition-colors rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-4 flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="p-3">Name</th>
                                <th className="p-3">Manager/Identity</th>
                                <th className="p-3">Email Address</th>
                                <th className="p-3">Organization</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(item => {
                                const userList = Array.isArray(allUsers) ? allUsers : [];
                                
                                // Identity logic
                                const pmUser = userList.find(u => 
                                    u.uid === item.userId || 
                                    (item.pm && u.email?.toLowerCase() === item.pm.toLowerCase())
                                );
                                const creatorUser = userList.find(u => u.uid === item.createdBy);
                                const clientUser = userList.find(u => u.uid === item.clientId);

                                const getIdentityName = () => {
                                    if (pmUser) return pmUser.displayName || pmUser.name || pmUser.email || `PM (${pmUser.uid.slice(0, 8)})`;
                                    if (creatorUser) return creatorUser.displayName || creatorUser.name || creatorUser.email || `Creator (${creatorUser.uid.slice(0, 8)})`;
                                    if (item.pm && !item.pm.includes('@')) return item.pm;
                                    if (item.pm && item.pm.includes('@')) return item.pm;
                                    return item.userId ? `User ID: ${item.userId.slice(0, 8)}` : 'System/Anonymous';
                                };
                                
                                const getIdentityEmail = () => {
                                    if (pmUser?.email) return pmUser.email;
                                    if (creatorUser?.email) return creatorUser.email;
                                    if (item.pm && item.pm.includes('@')) return item.pm;
                                    if (item.userId && !item.userId.includes('-')) return `ID: ${item.userId.slice(0, 8)}`;
                                    return 'no-email@system';
                                };

                                const getOrgName = () => {
                                    if (clientUser) return clientUser.companyName || clientUser.displayName || `Org (${clientUser.uid.slice(0, 8)})`;
                                    if (pmUser?.companyName) return pmUser.companyName;
                                    if (creatorUser?.companyName) return creatorUser.companyName;
                                    return item.clientName || 'Private/Unknown';
                                };

                                const transferTargets = allUsers.filter(u => {
                                    if (type === 'programmes') {
                                        return ['client_admin', 'enterprise'].includes(u.role);
                                    }
                                    return ['project_manager', 'senior_pm', 'senior_project_manager', 'assistant_project_manager', 'project_coordinator'].includes(u.role);
                                });

                                return (
                                    <tr key={item.id} className={clsx("hover:bg-slate-50/50 transition-colors", processingId === item.id && "opacity-50 animate-pulse")}>
                                        <td className="p-3">
                                            <p className="font-bold text-slate-800">{item.name}</p>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm font-medium text-slate-600">{getIdentityName()}</p>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm text-slate-500 font-mono">{getIdentityEmail()}</p>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase whitespace-nowrap">
                                                {getOrgName()}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            {confirmDeleteId === item.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleDelete(item)} className="px-2 py-1 bg-red-600 text-white text-[10px] font-black uppercase rounded shadow-sm hover:bg-red-700">Confirm</button>
                                                    <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded hover:bg-slate-300">No</button>
                                                </div>
                                            ) : transferringId === item.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <select 
                                                        value={targetPmUid} 
                                                        onChange={(e) => setTargetPmUid(e.target.value)}
                                                        className="text-[10px] border border-slate-200 rounded px-1 py-1 max-w-[150px]"
                                                    >
                                                        <option value="">Move to...</option>
                                                        {transferTargets.map(target => (
                                                            <option key={target.uid} value={target.uid}>
                                                                {target.displayName ? `${target.displayName} (${target.email})` : (target.email || `User (${target.uid.slice(0, 8)})`)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => handleTransfer(item)} disabled={!targetPmUid} className="p-1 px-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => { setTransferringId(null); setTargetPmUid(''); }} className="p-1 px-2 bg-slate-100 text-slate-400 rounded hover:bg-slate-200">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    <button 
                                                        onClick={() => navigate(type === 'programmes' ? `/initiation/programme?id=${item.id}` : `/initiation/project?id=${item.id}`)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Edit Details"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => setTransferringId(item.id)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Transfer Ownership"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => setConfirmDeleteId(item.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete From Database"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

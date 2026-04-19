import React, { useEffect, useState, useCallback } from 'react';
import {
    Search,
    ChevronDown,
    AlertCircle,
    Loader2,
    Trash2,
    RefreshCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import { isSystemAdmin } from '../../lib/roles';
import { ROLE_CONFIG, PLAN_OPTIONS, RoleBadge } from './constants';

export function UsersTab({ isAdmin }: { isAdmin: boolean }) {
    const { user } = useStore();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);
    const [deletingUser, setDeletingUser] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetUsers();
            if (res.success) setUsers(res.users || []);
            else setError(res.error || 'Failed to load users');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

    const handleRoleChange = async (targetUid: string, role: string) => {
        setUpdating(targetUid);
        try {
            await api.adminUpdateUser(targetUid, { role });
            setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, role } : u));
        } catch (e: any) {
            setError('Update failed: ' + e.message);
        } finally {
            setUpdating(null);
        }
    };

    const handleClientChange = async (targetUid: string, clientId: string) => {
        setUpdating(targetUid);
        try {
            await api.adminUpdateUser(targetUid, { clientId });
            setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, clientId } : u));
        } catch (e: any) {
            setError('Update failed: ' + e.message);
        } finally {
            setUpdating(null);
        }
    };

    const handleDeleteUser = async (targetUid: string) => {
        setDeletingUser(targetUid);
        setError(null);
        try {
            await api.deleteUserAccount(targetUid);
            setUsers(prev => prev.filter(u => u.uid !== targetUid));
            setUserToDelete(null);
        } catch (e: any) {
            setError('Delete failed: ' + e.message);
        } finally {
            setDeletingUser(null);
        }
    };

    const clientAdmins = users.filter(u => ['enterprise', 'client_admin'].includes(u.role));

    const filtered = (Array.isArray(users) ? users : []).filter(u =>
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.displayName || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (error) return <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by email or name…"
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button onClick={load} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
                <span className="text-sm text-slate-500">{filtered.length} users</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">User</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Joined</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Access Level</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Assigned Client</th>
                            <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-12 text-slate-400">No users found.</td></tr>
                        ) : filtered.map(u => (
                            <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-slate-800">{u.displayName || u.email || 'Admin User'}</p>
                                    <p className="text-xs text-slate-400">{u.email}</p>
                                </td>
                                <td className="px-4 py-3"><RoleBadge role={u.role || 'user'} /></td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    {updating === u.uid ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="relative inline-block">
                                                <select
                                                    value={u.role || 'user'}
                                                    onChange={e => handleRoleChange(u.uid, e.target.value)}
                                                    className="appearance-none pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                    disabled={
                                                        u.email === user?.email ||
                                                        isSystemAdmin(u.email)
                                                    }
                                                >
                                                    {PLAN_OPTIONS.map(p => (
                                                        <option key={p} value={p}>{ROLE_CONFIG[p]?.label || p}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}
                                </td>
                                {(['project_manager', 'senior_pm', 'senior_project_manager', 'assistant_project_manager', 'project_coordinator', 'user', 'enterprise', 'employee'].includes(u.role || 'user')) && (
                                    <td className="px-4 py-3">
                                        <div className="relative inline-block w-full max-w-[200px]">
                                            <select
                                                value={u.clientId || ''}
                                                onChange={e => handleClientChange(u.uid, e.target.value)}
                                                className="appearance-none w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs bg-indigo-50 text-indigo-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
                                            >
                                                <option value="" className="text-slate-500 font-normal">Assign Client...</option>
                                                {clientAdmins.map(ca => (
                                                    <option key={ca.uid} value={ca.uid} className="text-slate-900 font-normal">
                                                        {ca.companyName || ca.displayName || ca.email}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-400 pointer-events-none" />
                                        </div>
                                    </td>
                                )}
                                {!(['project_manager', 'senior_pm', 'senior_project_manager', 'assistant_project_manager', 'project_coordinator', 'user', 'enterprise', 'employee'].includes(u.role || 'user')) && (
                                    <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                                )}
                                <td className="px-4 py-3 text-right">
                                    {userToDelete === u.uid ? (
                                        <div className="flex items-center justify-end gap-2 p-2 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-right-2">
                                            <p className="text-[10px] text-red-600 font-bold uppercase mr-2 text-wrap max-w-[100px] text-left leading-tight">Erase all data permanently?</p>
                                            <button
                                                onClick={() => handleDeleteUser(u.uid)}
                                                disabled={deletingUser === u.uid}
                                                className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded shadow-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shrink-0"
                                            >
                                                {deletingUser === u.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setUserToDelete(null)}
                                                disabled={deletingUser === u.uid}
                                                className="px-3 py-1 bg-white text-slate-600 border border-slate-200 text-xs font-bold rounded hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm shrink-0"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setUserToDelete(u.uid)}
                                            disabled={u.email === user?.email || isSystemAdmin(u.email)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                            title="Delete User"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

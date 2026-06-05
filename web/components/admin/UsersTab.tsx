import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Search,
    ChevronDown,
    AlertCircle,
    Loader2,
    Trash2,
    RefreshCw,
    UserCog,
    FolderCog,
    BadgeCheck,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import { isSystemAdmin, canonicalRole, pmLevelLabel } from '../../lib/roles';
import type { CanonicalRole } from '../../lib/roles';
import { PM_LEVELS } from '../../../shared/constants/roleConstants';
import type { PmLevel } from '../../../shared/constants/roleConstants';
import { ROLE_CONFIG, PLAN_OPTIONS, RoleBadge } from './constants';

const PM_LEVEL_OPTIONS: { value: PmLevel; label: string }[] = PM_LEVELS.map(v => ({
    value: v,
    label: pmLevelLabel(v),
}));

const CANONICAL_ROLE_OPTIONS: { value: CanonicalRole; label: string }[] = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'client_admin', label: 'Client Admin' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'viewer', label: 'Viewer' },
];

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function UsersTab({ isAdmin }: { isAdmin: boolean }) {
    const { user } = useStore();
    const [users, setUsers] = useState<any[]>([]);
    const [programmes, setProgrammes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);
    const [deletingUser, setDeletingUser] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    // Admin modals
    const [supervisorFor, setSupervisorFor] = useState<any | null>(null);
    const [rosterFor, setRosterFor] = useState<any | null>(null);
    const [pmLevelFor, setPmLevelFor] = useState<any | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [uRes, pRes] = await Promise.all([
                api.adminGetUsers(),
                api.adminGetProgrammes().catch(() => null),
            ]);
            if (uRes.success) setUsers(uRes.users || []);
            else setError(uRes.error || 'Failed to load users');
            if (pRes && Array.isArray(pRes.programmes)) setProgrammes(pRes.programmes);
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
            const canonical = canonicalRole(role);
            await api.adminPromoteUser(targetUid, canonical);
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

    // Supervisor-eligible users (client_admin + super_admin canonicals)
    const supervisorCandidates = useMemo(
        () => users.filter(u => {
            const c = canonicalRole(u.role);
            return c === 'client_admin' || c === 'super_admin';
        }),
        [users],
    );

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

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">User</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Role</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Joined</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Access Level</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Assigned Client</th>
                            <th className="text-right px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12 text-slate-400">No users found.</td></tr>
                        ) : filtered.map(u => {
                            const c = canonicalRole(u.role);
                            return (
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
                                            <p className="font-mono text-[10px] text-red-600 font-medium uppercase tracking-wide mr-2 text-wrap max-w-[100px] text-left leading-tight">Erase all data permanently?</p>
                                            <button
                                                onClick={() => handleDeleteUser(u.uid)}
                                                disabled={deletingUser === u.uid}
                                                className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded shadow-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shrink-0"
                                            >
                                                {deletingUser === u.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setUserToDelete(null)}
                                                disabled={deletingUser === u.uid}
                                                className="px-3 py-1 bg-white text-slate-600 border border-slate-200 text-xs font-medium rounded hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm shrink-0"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => setSupervisorFor(u)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Reassign supervisor"
                                            >
                                                <UserCog className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setRosterFor(u)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Manage programme rosters"
                                            >
                                                <FolderCog className="w-4 h-4" />
                                            </button>
                                            {c === 'project_manager' && (
                                                <button
                                                    onClick={() => setPmLevelFor(u)}
                                                    className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                                    title="Change PM level"
                                                >
                                                    <BadgeCheck className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setUserToDelete(u.uid)}
                                                disabled={u.email === user?.email || isSystemAdmin(u.email)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {supervisorFor && (
                <SupervisorPickerModal
                    user={supervisorFor}
                    candidates={supervisorCandidates.filter(c => c.uid !== supervisorFor.uid)}
                    onClose={() => setSupervisorFor(null)}
                    onSaved={(newUid) => {
                        setUsers(prev => prev.map(u => u.uid === supervisorFor.uid ? { ...u, supervisorUid: newUid } : u));
                        setSupervisorFor(null);
                    }}
                />
            )}

            {rosterFor && (
                <RosterPickerModal
                    user={rosterFor}
                    programmes={programmes}
                    onClose={() => setRosterFor(null)}
                    onSaved={() => {
                        setRosterFor(null);
                        load();
                    }}
                />
            )}

            {pmLevelFor && (
                <PmLevelModal
                    user={pmLevelFor}
                    onClose={() => setPmLevelFor(null)}
                    onSaved={(lvl) => {
                        setUsers(prev => prev.map(u => u.uid === pmLevelFor.uid ? { ...u, pmLevel: lvl } : u));
                        setPmLevelFor(null);
                    }}
                />
            )}
        </div>
    );
}

// ── Supervisor Picker Modal ────────────────────────────────────────────────────

function SupervisorPickerModal({
    user,
    candidates,
    onClose,
    onSaved,
}: {
    user: any;
    candidates: any[];
    onClose: () => void;
    onSaved: (supervisorUid: string | null) => void;
}) {
    const [selected, setSelected] = useState<string>(user.supervisorUid || '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setErr(null);
        try {
            const val = selected || null;
            await api.adminAssignSupervisor(user.uid, val);
            onSaved(val);
        } catch (e: any) {
            setErr(e?.message || 'Failed to assign supervisor.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                <fieldset disabled={saving} className="contents">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                            <UserCog className="w-5 h-5 text-indigo-600" />
                            Reassign supervisor
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{user.displayName || user.email}</p>
                    </div>
                    <div className="px-6 py-5 space-y-3">
                        <label className="block font-mono text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">Supervisor</label>
                        <select
                            className={inputCls}
                            value={selected}
                            onChange={e => setSelected(e.target.value)}
                        >
                            <option value="">— No supervisor —</option>
                            {candidates.map(c => (
                                <option key={c.uid} value={c.uid}>
                                    {c.displayName || c.email} ({canonicalRole(c.role) === 'super_admin' ? 'Super Admin' : 'Client Admin'})
                                </option>
                            ))}
                        </select>
                        {err && <p className="text-xs text-red-600">{err}</p>}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save
                        </button>
                    </div>
                </fieldset>
            </div>
        </div>
    );
}

// ── Roster Picker Modal (all programmes, all-powerful) ─────────────────────────

function RosterPickerModal({
    user,
    programmes,
    onClose,
    onSaved,
}: {
    user: any;
    programmes: any[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const initial = useMemo(() => {
        const set = new Set<string>();
        programmes.forEach(p => {
            if (Array.isArray(p.assignedPMIds) && p.assignedPMIds.includes(user.uid)) {
                set.add(p.id);
            }
        });
        return set;
    }, [programmes, user.uid]);

    const [selected, setSelected] = useState<Set<string>>(new Set(initial));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setErr(null);
        try {
            const toAdd: string[] = [];
            const toRemove: string[] = [];
            programmes.forEach(p => {
                const was = initial.has(p.id);
                const is = selected.has(p.id);
                if (!was && is) toAdd.push(p.id);
                if (was && !is) toRemove.push(p.id);
            });
            await Promise.all([
                ...toAdd.map(pid => api.addPMToProgramme(pid, user.uid)),
                ...toRemove.map(pid => api.removePMFromProgramme(pid, user.uid)),
            ]);
            onSaved();
        } catch (e: any) {
            setErr(e?.message || 'Failed to update roster.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
                <fieldset disabled={saving} className="contents">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                            <FolderCog className="w-5 h-5 text-emerald-600" />
                            Manage programme rosters
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{user.displayName || user.email}</p>
                    </div>
                    <div className="px-6 py-4 overflow-y-auto flex-1">
                        {programmes.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">No programmes exist yet.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {programmes.map(p => (
                                    <label key={p.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 mt-0.5 accent-indigo-600"
                                            checked={selected.has(p.id)}
                                            onChange={e => {
                                                setSelected(prev => {
                                                    const next = new Set(prev);
                                                    if (e.target.checked) next.add(p.id);
                                                    else next.delete(p.id);
                                                    return next;
                                                });
                                            }}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name || p.reference}</p>
                                            {p.reference && p.name && (
                                                <p className="text-[11px] text-slate-500 truncate">{p.reference}</p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        {err && <p className="text-xs text-red-600 mt-3">{err}</p>}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save changes
                        </button>
                    </div>
                </fieldset>
            </div>
        </div>
    );
}

// ── PM Level Modal ──────────────────────────────────────────────────────────────

function PmLevelModal({
    user,
    onClose,
    onSaved,
}: {
    user: any;
    onClose: () => void;
    onSaved: (lvl: PmLevel) => void;
}) {
    const [lvl, setLvl] = useState<PmLevel>(user.pmLevel || 'standard');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setErr(null);
        try {
            await api.setPmLevel(user.uid, lvl);
            onSaved(lvl);
        } catch (e: any) {
            setErr(e?.message || 'Failed to update PM level.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                <fieldset disabled={saving} className="contents">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                            <BadgeCheck className="w-5 h-5 text-sky-600" />
                            Change PM level
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{user.displayName || user.email}</p>
                    </div>
                    <div className="px-6 py-5 space-y-3">
                        <label className="block font-mono text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">PM Level</label>
                        <select
                            className={inputCls}
                            value={lvl}
                            onChange={e => setLvl(e.target.value as PmLevel)}
                        >
                            {PM_LEVEL_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {err && <p className="text-xs text-red-600">{err}</p>}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save
                        </button>
                    </div>
                </fieldset>
            </div>
        </div>
    );
}

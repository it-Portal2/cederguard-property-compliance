import React, { useEffect, useState, useCallback } from 'react';
import {
    Filter,
    AlertCircle,
    Loader2,
    RefreshCw,
    LineChart,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ACTIVITY_ICONS } from './constants';

export function ActivityTab({ isAdmin, users }: { isAdmin: boolean; users: any[] }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterType, setFilterType] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetActivity();
            if (res.success) setLogs(res.logs || []);
            else setError(res.error || 'Failed to load activity');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

    const types = ['all', ...Array.from(new Set((Array.isArray(logs) ? logs : []).map(l => l.type)))];
    const filtered = filterType === 'all' ? (Array.isArray(logs) ? logs : []) : (Array.isArray(logs) ? logs : []).filter(l => l.type === filterType);

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (error) return <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {(Array.isArray(types) ? types : []).map(t => (
                        <option key={t as string} value={t as string}>
                            {t === 'all' ? 'All Types' : (ACTIVITY_ICONS[t as string]?.label || t as string)}
                        </option>
                    ))}
                </select>
                <button onClick={load} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
                <span className="text-sm text-slate-500">{filtered.length} events</span>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 p-16 text-center">
                    <LineChart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No activity recorded yet</p>
                    <p className="text-xs text-slate-400 mt-1">Activity will appear here as users interact with the platform</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
                    {filtered.map(log => {
                        const cfg = ACTIVITY_ICONS[log.type] || ACTIVITY_ICONS.default;
                        
                        const getUserIdentity = () => {
                            const found = users.find(u => u.uid === log.adminUid || u.uid === log.uid || u.email === (log.adminEmail || log.userEmail));
                            if (found) {
                                return found.displayName || found.email || `User (${found.uid.slice(0, 8)})`;
                            }
                            return log.adminEmail || log.userEmail || (log.uid ? `User (${log.uid.slice(0, 8)})` : 'System');
                        };

                        const formatUpdateDescription = () => {
                            if (!log.updates) return null;
                            try {
                                const updates = typeof log.updates === 'string' ? JSON.parse(log.updates) : log.updates;
                                if (log.type === 'admin_transfer_programme' || log.type === 'admin_transfer_project') {
                                    const target = users.find(u => u.uid === updates.targetUid || u.email === updates.targetEmail);
                                    const targetName = target ? (target.displayName || target.email) : (updates.targetEmail || 'Unknown');
                                    return `Transferred ownership to ${targetName}`;
                                }
                                if (log.type === 'project_deleted' || log.type === 'programme_deleted') {
                                    return `Permanently deleted ${updates.name || 'resource'}`;
                                }
                                const keys = Object.keys(updates);
                                if (keys.length > 0) {
                                    return `Updated: ${keys.join(', ')}`;
                                }
                            } catch (e) {
                                return JSON.stringify(log.updates);
                            }
                            return null;
                        };

                        const identity = getUserIdentity();
                        const updateDesc = formatUpdateDescription();

                        return (
                            <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                                <span className={`mt-0.5 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${cfg.color}`}>{cfg.label}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 truncate">
                                        <span className="font-bold text-slate-900">{identity}</span>
                                        {updateDesc ? (
                                            <span className="text-slate-500 font-medium italic ml-2">— {updateDesc}</span>
                                        ) : log.description ? (
                                            <span className="text-slate-500 ml-2">— {log.description}</span>
                                        ) : null}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 underline-none">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                                        </p>
                                        {log.targetUid && (
                                            <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                                                ID: {log.targetUid.slice(0, 8)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

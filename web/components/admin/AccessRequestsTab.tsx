import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Loader2, RefreshCw, Inbox } from 'lucide-react';
import { api } from '../../lib/api';

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700 bg-amber-50' },
    approved: { label: 'Approved', color: 'text-emerald-700 bg-emerald-50' },
    rejected: { label: 'Rejected', color: 'text-red-700 bg-red-50' },
};

export function AccessRequestsTab({ isAdmin }: { isAdmin: boolean }) {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acting, setActing] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetAccessRequests();
            if (res.success) setRequests(res.requests || []);
            else setError(res.error || 'Failed to load access requests');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

    const handleApprove = async (id: string) => {
        setActing(id);
        setError(null);
        try {
            await api.adminApproveAccessRequest(id);
            await load();
        } catch (e: any) {
            setError('Approve failed: ' + e.message);
        } finally {
            setActing(null);
        }
    };

    const handleReject = async (id: string) => {
        setActing(id);
        setError(null);
        try {
            await api.adminRejectAccessRequest(id);
            await load();
        } catch (e: any) {
            setError('Reject failed: ' + e.message);
        } finally {
            setActing(null);
        }
    };

    const pending = requests.filter(r => r.status === 'pending');

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-slate-700">
                    {pending.length > 0 ? `${pending.length} pending` : 'No pending requests'}
                </h3>
                <button onClick={load} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />{error}
                </div>
            )}

            {!error && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Requester</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Requested Role</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Reason</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Requested</th>
                            <th className="text-left px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Status</th>
                            <th className="text-right px-4 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {requests.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-slate-400">
                                    <Inbox className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                                    No access requests yet.
                                </td>
                            </tr>
                        ) : requests.map(r => {
                            const badge = STATUS_BADGES[r.status] || STATUS_BADGES.pending;
                            return (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-slate-800">{r.displayName || r.email}</p>
                                        <p className="text-xs text-slate-400">{r.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{r.requestedRole}</td>
                                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.reason || '—'}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">
                                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {r.status === 'pending' && (
                                            acting === r.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 ml-auto" />
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(r.id)}
                                                        title="Approve — promotes to Project Manager"
                                                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(r.id)}
                                                        title="Reject"
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    );
}

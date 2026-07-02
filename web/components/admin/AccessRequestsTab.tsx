import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Loader2, RefreshCw, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700 bg-amber-50' },
    approved: { label: 'Approved', color: 'text-emerald-700 bg-emerald-50' },
    rejected: { label: 'Rejected', color: 'text-red-700 bg-red-50' },
};

type ConfirmState = { type: 'approve' | 'reject'; request: any } | null;

export function AccessRequestsTab({ isAdmin }: { isAdmin: boolean }) {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acting, setActing] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const trapRef = useFocusTrap<HTMLDivElement>(!!confirm);

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

    const closeConfirm = () => {
        setConfirm(null);
        setRejectReason('');
    };

    useEffect(() => {
        if (!confirm) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting) closeConfirm();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirm, submitting]);

    const runConfirmedAction = async () => {
        if (!confirm) return;
        const { type, request } = confirm;
        setSubmitting(true);
        setActing(request.id);
        setError(null);
        try {
            if (type === 'approve') {
                await api.adminApproveAccessRequest(request.id);
            } else {
                await api.adminRejectAccessRequest(request.id, rejectReason.trim() || undefined);
            }
            closeConfirm();
            await load();
        } catch (e: any) {
            setError(`${type === 'approve' ? 'Approve' : 'Reject'} failed: ${e.message}`);
        } finally {
            setSubmitting(false);
            setActing(null);
        }
    };

    const pending = requests.filter(r => r.status === 'pending');

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    const confirmName = confirm?.request?.displayName || confirm?.request?.email || 'this user';

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
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
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
                                    <td className="px-4 py-3">
                                        {r.status === 'pending' && (
                                            acting === r.id ? (
                                                <div className="flex justify-end"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /></div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setConfirm({ type: 'approve', request: r })}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirm({ type: 'reject', request: r })}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <XCircle className="w-4 h-4" /> Reject
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

            {confirm && (
                <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && !submitting && closeConfirm()}>
                    <div
                        ref={trapRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="access-confirm-title"
                        tabIndex={-1}
                        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
                    >
                        <div className="flex items-center gap-2">
                            {confirm.type === 'approve'
                                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                : <XCircle className="w-5 h-5 text-red-600" />}
                            <h3 id="access-confirm-title" className="text-lg font-semibold text-slate-800">
                                {confirm.type === 'approve' ? 'Approve access request' : 'Reject access request'}
                            </h3>
                        </div>

                        {confirm.type === 'approve' ? (
                            <p className="text-sm text-slate-600 mt-3">
                                This will grant <strong>{confirmName}</strong> Project Manager access. They'll be notified by email.
                            </p>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600 mt-3">
                                    Reject the access request from <strong>{confirmName}</strong>? They'll be notified by email, including the reason below if you provide one.
                                </p>
                                <textarea
                                    className="w-full mt-3 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows={3}
                                    placeholder="Reason for rejection (optional)"
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                />
                            </>
                        )}

                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={closeConfirm}
                                disabled={submitting}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={runConfirmedAction}
                                disabled={submitting}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2 ${confirm.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {confirm.type === 'approve' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

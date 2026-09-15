import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  LifeBuoy,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  X,
  Building2,
  User,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Flame,
  Zap,
  Droplets,
  Bug,
  ShieldAlert,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import { api } from '../../lib/api';
import { clsx } from 'clsx';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  open: { label: 'Open / Unassigned', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  waiting_on_client: { label: 'Waiting on Council', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  medium: { label: 'Medium', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  high: { label: 'High', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  critical: { label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export function SupportTicketsTab({ isAdmin }: { isAdmin: boolean }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Selected ticket modal / drawer
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<string>('in_progress');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminGetSupportTickets();
      if (res.success) {
        setTickets(res.tickets || []);
      } else {
        setError(res.error || 'Failed to load tickets');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to retrieve tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadTickets();
  }, [isAdmin, loadTickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        t.ticketCode?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        t.userName?.toLowerCase().includes(q) ||
        t.userEmail?.toLowerCase().includes(q) ||
        t.clientName?.toLowerCase().includes(q) ||
        t.propertyRef?.toLowerCase().includes(q);
      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [tickets, statusFilter, priorityFilter, searchQuery]);

  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const critical = tickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'resolved').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    return { total, open, critical, resolved };
  }, [tickets]);

  const handleUpdateStatus = async (newStatusToApply?: string) => {
    if (!selectedTicket) return;
    const targetStatus = newStatusToApply || statusUpdate;
    setIsUpdating(true);
    setActionSuccess(null);

    try {
      const res = await api.adminUpdateSupportTicketStatus({
        id: selectedTicket.id,
        status: targetStatus,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });

      if (res.success) {
        setActionSuccess(`Status updated to ${targetStatus.replace('_', ' ').toUpperCase()}`);
        setSelectedTicket((prev: any) => ({
          ...prev,
          status: targetStatus,
          resolutionNotes: resolutionNotes.trim() || prev.resolutionNotes,
        }));
        setResolutionNotes('');
        loadTickets();
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsSendingReply(true);
    try {
      const res = await api.addSupportTicketMessage({
        id: selectedTicket.id,
        message: replyMessage.trim(),
        newStatus: statusUpdate !== selectedTicket.status ? statusUpdate : undefined,
      });

      if (res.success && res.message) {
        setSelectedTicket((prev: any) => ({
          ...prev,
          status: statusUpdate !== prev.status ? statusUpdate : prev.status,
          messages: [...(prev.messages || []), res.message],
        }));
        setReplyMessage('');
        loadTickets();
      }
    } catch (e: any) {
      setError(e.message || 'Failed to send reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Metric Header ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Logged</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
            <span className="text-xs text-slate-500 font-medium">All time</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Active / In Progress</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-blue-700">{metrics.open}</span>
            <span className="text-xs text-blue-600 font-medium">Requires attention</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-red-500">Critical / High Urgency</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-red-700">{metrics.critical}</span>
            <span className="text-xs text-red-600 font-medium">SLA Priority</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Resolved Tickets</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-700">{metrics.resolved}</span>
            <span className="text-xs text-emerald-600 font-medium">Completed</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket ID, subject, requester, council, or UPRN..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_on_client">Waiting on Council</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical (&lt; 2h)</option>
            <option value="high">High (8-12h)</option>
            <option value="medium">Medium (24-48h)</option>
            <option value="low">Low (48-72h)</option>
          </select>

          <button
            onClick={loadTickets}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Tickets Table ── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <LifeBuoy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">No Support Tickets Found</h4>
          <p className="text-xs text-slate-400 mt-1">There are no tickets matching your current search criteria.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Ticket Ref</th>
                  <th className="py-3.5 px-4">Requester & Council</th>
                  <th className="py-3.5 px-4">Subject & Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTickets.map(ticket => {
                  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  const prioCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setStatusUpdate(ticket.status || 'in_progress');
                      }}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-900">
                        {ticket.ticketCode}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ticket.userName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{ticket.clientName || 'Council Partner'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 truncate">{ticket.subject}</div>
                        <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                          {ticket.category?.replace('_', ' ')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase border', prioCfg.bg, prioCfg.text, prioCfg.border)}>
                          {prioCfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-GB') : 'Recent'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
                            setStatusUpdate(ticket.status || 'in_progress');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Ticket Detail & Discussion Drawer ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {selectedTicket.ticketCode}
                  </span>
                  {(() => {
                    const cfg = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open;
                    return (
                      <span className={clsx('text-xs font-bold px-2.5 py-0.5 rounded-full border', cfg.bg, cfg.text, cfg.border)}>
                        {cfg.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {selectedTicket.priority}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Requester Profile Panel */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold uppercase">Council / Organisation</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedTicket.clientName || 'Housing Partner'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Requester Officer</span>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedTicket.userName} ({selectedTicket.userEmail})</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Compliance Stream</span>
                  <p className="font-bold text-slate-900 mt-0.5 capitalize">{selectedTicket.category?.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Property Ref / UPRN</span>
                  <p className="font-bold text-slate-900 mt-0.5 font-mono">{selectedTicket.propertyRef || 'N/A'}</p>
                </div>
                {selectedTicket.contactPhone && (
                  <div className="col-span-2">
                    <span className="text-slate-400 font-bold uppercase">Contact Phone</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedTicket.contactPhone}</p>
                  </div>
                )}
              </div>

              {/* Status Update & Resolution Controls */}
              <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Update Ticket Status & Resolution
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
                    <select
                      value={statusUpdate}
                      onChange={e => setStatusUpdate(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_on_client">Waiting on Council</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus('resolved')}
                      className="flex-1 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus()}
                      className="px-4 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Resolution / Technical Notes <span className="text-slate-400 font-normal">(Sent in confirmation email to client)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe resolution steps taken, bugfix details, or advice provided to the council..."
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Message Thread History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Communication & Activity Log</h4>

                {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-1">Initial Problem Statement:</span>
                    {selectedTicket.description}
                  </div>
                ) : (
                  selectedTicket.messages.map((msg: any, i: number) => {
                    const isStaff = msg.isAdmin || msg.senderRole === 'support_admin';
                    return (
                      <div
                        key={msg.id || i}
                        className={clsx(
                          'p-4 rounded-xl border text-xs space-y-1.5',
                          isStaff
                            ? 'bg-indigo-50/60 border-indigo-200 ml-6'
                            : 'bg-white border-slate-200 mr-6 shadow-sm'
                        )}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className={isStaff ? 'text-indigo-900 font-bold' : 'text-slate-900'}>
                            {msg.senderName} {isStaff && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.2 rounded ml-1 font-normal">CedarGuard Support</span>}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-GB') : ''}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reply Footer */}
            <form onSubmit={handleAdminReply} className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  placeholder="Post technical response to council (triggers notification email via Resend)..."
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  className="flex-1 p-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyMessage.trim()}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

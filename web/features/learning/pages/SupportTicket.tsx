import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  LifeBuoy,
  Send,
  TicketCheck,
  AlertTriangle,
  Bug,
  Lightbulb,
  UserCog,
  HelpCircle,
  CheckCircle2,
  Copy,
  Mail,
  Clock,
  ShieldAlert,
  Building2,
  Flame,
  FileCheck,
  Zap,
  Droplets,
  Layers,
  Search,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  X,
  Loader2,
  CheckCircle,
  PlusCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { api } from '../../../lib/api';
import PageHeader from '../../../components/PageHeader';

/* ── Category options matching UK Social Housing & Compliance ────── */
const CATEGORIES = [
  { id: 'technical_issue', label: 'Technical Issue / Platform Glitch', icon: Bug, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'golden_thread', label: 'Golden Thread & Building Safety Act 2022', icon: ShieldAlert, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'fire_safety', label: 'Fire Safety (FRAEW, PAS 79 / PAS 9980)', icon: Flame, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'gas_eicr', label: 'Gas (LGSR) & Electrical (EICR) Compliance', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'damp_mould', label: "Damp, Mould & Awaab's Law Hazards", icon: Droplets, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'integrations', label: 'Integrations, API & Webhook Sync', icon: Layers, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'account_access', label: 'User Roles, Multi-Council Access & RBAC', icon: UserCog, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'statutory_query', label: 'General Statutory Compliance Inquiry', icon: HelpCircle, color: 'text-slate-600 bg-slate-50 border-slate-200' },
] as const;

/* ── Urgency levels & SLAs ────── */
const PRIORITIES = [
  {
    id: 'low',
    label: 'Standard (Low)',
    sla: '48-72 hrs',
    desc: 'General inquiry or non-urgent UI improvement.',
    badgeClass: 'text-slate-700 bg-slate-100 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  {
    id: 'medium',
    label: 'Medium (Operational)',
    sla: '24-48 hrs',
    desc: 'Daily task impairment with available manual workaround.',
    badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  {
    id: 'high',
    label: 'High (Compliance Deadline)',
    sla: '8-12 hrs',
    desc: 'Approaching statutory deadline or core workflow blocker.',
    badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  {
    id: 'critical',
    label: 'Critical (Statutory Emergency)',
    sla: '< 2 hrs',
    desc: 'System outage, regulatory breach, or immediate safety hazard.',
    badgeClass: 'text-red-700 bg-red-50 border-red-200',
    dotClass: 'bg-red-500',
  },
] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  open: { label: 'Open / Assigned', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  waiting_on_client: { label: 'Waiting on Council', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

function generateClientTicketId(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CG-TKT-${dateStr}-${suffix}`;
}

export function SupportTicket() {
  const { user } = useStore();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Form states
  const [category, setCategory] = useState<string>('technical_issue');
  const [priority, setPriority] = useState<string>('medium');
  const [subject, setSubject] = useState('');
  const [propertyRef, setPropertyRef] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [impact, setImpact] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Submission / interaction states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Messaging thread reply
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Search in ticket history
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const userName = user?.displayName || user?.name || user?.email?.split('@')[0] || 'Council Officer';
  const userEmail = user?.email || '';
  const userOrg = (user as any)?.organizationName || (user as any)?.councilName || (user as any)?.company || 'Housing Governance Partner';

  const loadMyTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await api.getMySupportTickets();
      if (res.success) {
        setTickets(res.tickets || []);
      }
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    loadMyTickets();
  }, [loadMyTickets]);

  // Construct structured mailto link for direct escalation to CTO
  const buildMailtoUrl = (ticketCode?: string) => {
    const code = ticketCode || submittedTicket?.ticketCode || generateClientTicketId();
    const catLabel = CATEGORIES.find(c => c.id === category)?.label || category;
    const prioLabel = PRIORITIES.find(p => p.id === priority)?.label || priority;
    const now = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const emailSubject = `[ESCALATED TICKET #${code}] ${subject || 'Urgent Platform Assistance'}`;
    const emailBody = [
      '======================================================',
      'CEDARGUARD STATUTORY & TECHNICAL ESCALATION',
      '======================================================',
      '',
      `TICKET ID:       ${code}`,
      `DATE / TIME:     ${now} (UTC)`,
      `ORGANISATION:    ${userOrg}`,
      `OFFICER NAME:    ${userName}`,
      `OFFICER EMAIL:   ${userEmail}`,
      contactPhone ? `CONTACT PHONE:   ${contactPhone}` : '',
      '',
      `CATEGORY:        ${catLabel}`,
      `URGENCY LEVEL:   ${prioLabel}`,
      propertyRef ? `PROPERTY / UPRN: ${propertyRef}` : '',
      '',
      'ISSUE DETAILS:',
      '------------------------------------------------------',
      description || '(No additional description entered)',
      '',
      stepsToReproduce ? 'STEPS TO REPRODUCE / ERROR LOGS:' : '',
      stepsToReproduce ? '------------------------------------------------------' : '',
      stepsToReproduce ? stepsToReproduce : '',
      '',
      impact ? 'OPERATIONAL / REGULATORY IMPACT:' : '',
      impact ? '------------------------------------------------------' : '',
      impact ? impact : '',
      '',
      '======================================================',
      'Pre-formatted escalation dispatched via CedarGuard Compliance Suite.',
    ]
      .filter(Boolean)
      .join('\n');

    return `mailto:cto@cedarguard.co.uk?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleEscalateDirectly = () => {
    window.location.href = buildMailtoUrl();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setSubmitError('Please provide both a subject and detailed description.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.createSupportTicket({
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
        propertyRef: propertyRef.trim() || undefined,
        stepsToReproduce: stepsToReproduce.trim() || undefined,
        impact: impact.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });

      if (res.success && res.ticket) {
        setSubmittedTicket(res.ticket);
        loadMyTickets();
      } else {
        setSubmitError(res.error || 'Failed to submit ticket. Please try again or use direct email.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setIsSendingReply(true);
    setReplyError(null);

    try {
      const res = await api.addSupportTicketMessage({
        id: selectedTicket.id,
        message: replyText.trim(),
      });

      if (res.success && res.message) {
        setSelectedTicket((prev: any) => ({
          ...prev,
          messages: [...(prev.messages || []), res.message],
        }));
        setReplyText('');
        loadMyTickets();
      } else {
        setReplyError(res.error || 'Failed to send message');
      }
    } catch (err: any) {
      setReplyError(err.message || 'Failed to send message');
    } finally {
      setIsSendingReply(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const resetForm = () => {
    setSubmittedTicket(null);
    setSubject('');
    setPropertyRef('');
    setDescription('');
    setStepsToReproduce('');
    setImpact('');
    setContactPhone('');
    setCategory('technical_issue');
    setPriority('medium');
    setSubmitError(null);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        t.ticketCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title="Technical Support & Governance Tickets"
        subtitle="Direct technical escalation, statutory query resolution, and system support for UK local authorities and housing associations."
        breadcrumbs={[{ label: 'Help Centre', href: '/help' }, { label: 'Support Tickets' }]}
      />

      {/* ── Authority Trust & SLA Ribbon ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Statutory Compliance</h4>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">Building Safety & Golden Thread</p>
            <p className="text-xs text-slate-400 mt-1">Direct support for BSA 2022, Fire, Gas, and Awaab's Law issues.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Priority SLA Framework</h4>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">&lt; 2hr Critical / 24hr Standard</p>
            <p className="text-xs text-slate-400 mt-1">Automatic triage and direct alert dispatch to technical leads.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Direct CTO Escalation</h4>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">cto@cedarguard.co.uk</p>
            <p className="text-xs text-slate-400 mt-1">One-click prefilled mailto logic with full ticket telemetry.</p>
          </div>
        </div>
      </div>

      {/* ── Main Tab Navigation ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('create'); }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            <PlusCircle className="w-4 h-4" />
            Raise Support Ticket
          </button>

          <button
            onClick={() => { setActiveTab('history'); loadMyTickets(); }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            <TicketCheck className="w-4 h-4" />
            My Tickets
            {tickets.length > 0 && (
              <span className={clsx(
                'ml-1 px-2 py-0.5 text-xs rounded-full font-bold',
                activeTab === 'history' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
              )}>
                {tickets.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          Signed in as: <strong className="text-slate-700">{userEmail}</strong> ({userOrg})
        </div>
      </div>

      {/* ── TAB 1: CREATE TICKET ── */}
      {activeTab === 'create' && (
        <div>
          {submittedTicket ? (
            /* ── Post-Submit Success View ── */
            <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-lg shadow-emerald-900/5 p-8 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-emerald-600 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Support Ticket Registered</h3>
                  <p className="text-xs text-slate-500">Your ticket has been logged into the CedarGuard Technical Governance System.</p>
                </div>
              </div>

              {/* Ticket Summary Card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 my-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Ticket Identifier</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-base font-bold text-indigo-900 bg-white px-3 py-1.5 rounded-lg border border-indigo-100 font-mono shadow-sm">
                        {submittedTicket.ticketCode}
                      </code>
                      <button
                        onClick={() => copyToClipboard(submittedTicket.ticketCode)}
                        title="Copy Ticket ID"
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                      >
                        {copiedId ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Subject</span>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{submittedTicket.subject}</p>
                  </div>

                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Status & Urgency</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        Open & Assigned
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase bg-slate-200 text-slate-700">
                        {submittedTicket.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 mt-5 pt-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>An automated confirmation email has been dispatched via Resend to <strong>{userEmail}</strong>.</span>
                  <span>Direct technical routing: <strong>cto@cedarguard.co.uk</strong></span>
                </div>
              </div>

              {/* Direct CTO Escalation Option */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/80 p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    High Priority / Urgent Escalation
                  </div>
                  <p className="text-xs text-amber-700 mt-0.5 max-w-xl">
                    Need immediate leadership attention or experiencing an active regulatory blocker? Trigger a prefilled email to our CTO with your ticket ID and system telemetry attached.
                  </p>
                </div>
                <a
                  href={buildMailtoUrl(submittedTicket.ticketCode)}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Escalate to CTO via Direct Email
                </a>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab('history');
                    loadMyTickets();
                  }}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  View My Tickets & Thread
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                >
                  Raise Another Ticket
                </button>
              </div>
            </div>
          ) : (
            /* ── Ticket Creation Form ── */
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Section 1: Classification */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                  1. Classification & Scope
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Compliance Stream / Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority / Urgency */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Urgency & Target SLA <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {PRIORITIES.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.label} — SLA: {p.sla}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority SLA helper card */}
                {(() => {
                  const selectedPrio = PRIORITIES.find(p => p.id === priority) || PRIORITIES[1];
                  return (
                    <div className={clsx('mt-3 p-3 rounded-lg border text-xs flex items-center justify-between', selectedPrio.badgeClass)}>
                      <div className="flex items-center gap-2">
                        <span className={clsx('w-2 h-2 rounded-full', selectedPrio.dotClass)} />
                        <span><strong>{selectedPrio.label}:</strong> {selectedPrio.desc}</span>
                      </div>
                      <span className="font-bold font-mono">Response target: {selectedPrio.sla}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Section 2: Subject & Property Reference */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  2. Subject & Asset References
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Ticket Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Discrepancy in Gas Safety LGSR inspection schedule or Report export failure"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Property Reference / UPRN <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UPRN 1000234891 / Block 4B"
                      value={propertyRef}
                      onChange={e => setPropertyRef(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Detailed Description */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  3. Issue Description & Diagnostics
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Detailed Description of the Issue <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Please provide full details of what you were doing, what occurred, and any specific records, schemes, or data points affected..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full p-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Steps to Reproduce / Error Text <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="1. Navigate to Compliance Tracker&#10;2. Filter by Fire Safety&#10;3. Click Export PDF..."
                        value={stepsToReproduce}
                        onChange={e => setStepsToReproduce(e.target.value)}
                        className="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Operational / Audit Impact <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Audit submission due this Friday, or 14 blocks pending verification..."
                        value={impact}
                        onChange={e => setImpact(e.target.value)}
                        className="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Direct Contact Phone <span className="text-slate-400 text-[10px] font-normal">(Optional for urgent callback)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +44 20 7946 0991"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      className="w-full md:w-1/2 h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submission Controls */}
              <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  Tickets are permanently stored for audit compliance and dispatches real-time alerts.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Secondary Mailto Escalation Button */}
                  <button
                    type="button"
                    onClick={handleEscalateDirectly}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-colors"
                    title="Opens your desktop/web email client directly to cto@cedarguard.co.uk with prefilled ticket details"
                  >
                    <Mail className="w-4 h-4 text-amber-600" />
                    Escalate via Email (CTO)
                  </button>

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Registering Ticket...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Ticket
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── TAB 2: MY TICKETS & HISTORY ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets by ID, subject, or compliance stream..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
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

              <button
                onClick={loadMyTickets}
                title="Refresh"
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', loadingTickets && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Tickets List */}
          {loadingTickets ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-400 mt-2 font-medium">Fetching support tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <TicketCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Support Tickets Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? 'No tickets match your active filter criteria.'
                  : 'You have not registered any support tickets yet.'}
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Raise New Ticket
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {filteredTickets.map(ticket => {
                const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const prioCfg = PRIORITIES.find(p => p.id === ticket.priority) || PRIORITIES[1];
                const catObj = CATEGORIES.find(c => c.id === ticket.category);

                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                          {ticket.ticketCode}
                        </span>
                        <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
                          {statusCfg.label}
                        </span>
                        <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded border uppercase', prioCfg.badgeClass)}>
                          {prioCfg.label}
                        </span>
                        {ticket.propertyRef && (
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            {ticket.propertyRef}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 truncate">{ticket.subject}</h4>

                      <p className="text-xs text-slate-500 line-clamp-1">{ticket.description}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right text-[11px] text-slate-400">
                        <div>Logged: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-GB') : 'Recently'}</div>
                        <div className="flex items-center justify-end gap-1 text-indigo-600 font-medium mt-0.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{ticket.messages?.length || 1} {ticket.messages?.length === 1 ? 'msg' : 'msgs'}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TICKET DISCUSSION & DETAILS DRAWER / MODAL ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded">
                    {selectedTicket.ticketCode}
                  </span>
                  {(() => {
                    const cfg = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open;
                    return (
                      <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full border', cfg.bg, cfg.text, cfg.border)}>
                        {cfg.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {selectedTicket.priority}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body: Metadata + Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Panel */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold uppercase">Council / Organisation</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedTicket.clientName || userOrg}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Logged By</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedTicket.userName} ({selectedTicket.userEmail})</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Category</span>
                  <p className="font-semibold text-slate-800 mt-0.5 capitalize">
                    {CATEGORIES.find(c => c.id === selectedTicket.category)?.label || selectedTicket.category}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Property Reference</span>
                  <p className="font-semibold text-slate-800 mt-0.5 font-mono">{selectedTicket.propertyRef || 'N/A'}</p>
                </div>
              </div>

              {/* Direct Escalation Action within Drawer */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <div className="text-xs text-amber-900 font-medium">
                  Need priority assistance on this ticket?
                </div>
                <a
                  href={buildMailtoUrl(selectedTicket.ticketCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Escalate to CTO
                </a>
              </div>

              {/* Messages Thread */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Communication History</h4>

                {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800 mb-1">Original Issue Description:</p>
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
                            ? 'bg-indigo-50/60 border-indigo-200 ml-4'
                            : 'bg-white border-slate-200 mr-4 shadow-sm'
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

            {/* Reply Input Footer */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
              {replyError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {replyError}
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  placeholder="Provide additional details or respond to support team..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="flex-1 p-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyText.trim()}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Reply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

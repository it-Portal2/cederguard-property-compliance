import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import {
  LifeBuoy,
  Send,
  TicketCheck,
  AlertTriangle,
  Bug,
  HelpCircle,
  CheckCircle2,
  Mail,
  Clock,
  ChevronRight,
  RefreshCw,
  X,
  Loader2,
  PlusCircle,
  SlidersHorizontal,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Video,
  BookOpen,
  Maximize2,
  Shield,
  FolderKanban,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { api } from '../../../lib/api';
import PageHeader from '../../../components/PageHeader';
import { Link } from 'react-router';
import { isSuperAdmin, getFriendlyRoleLabel } from '../../../lib/roles';

/* ── Platform Feature Areas (SaaS Application Modules) ────── */
export const FEATURE_AREAS = [
  { id: 'programmes_projects', label: 'Programmes & Projects (Initiation, Plan, Schemes)' },
  { id: 'compliance_tracker', label: 'Compliance (Setup, Tracker, Evidence & Documents)' },
  { id: 'risk_management', label: 'Risk Management (Risk Register, Issues Log, Alerts)' },
  { id: 'programme_governance', label: 'Programme Governance (Reports, Forward Plan, Meetings)' },
  { id: 'technical_assurance', label: 'Technical Assurance Companion (TAC Enquiries & RFIs)' },
  { id: 'resource_planner', label: 'Resource Planner (Timeline, Demand, Capacity)' },
  { id: 'escalations_incidents', label: 'Escalations, Controls & Incidents Register' },
  { id: 'reporting_dashboards', label: 'Executive Dashboards, Reports & Trends' },
  { id: 'user_roles_access', label: 'User Roles, Permissions & Workspace Settings' },
  { id: 'exports_documents', label: 'Document Exports (PDF, Excel, CSV) & Uploads' },
  { id: 'general_platform', label: 'General Navigation, UI Glitch or Performance' },
] as const;

/* ── Technical Issue Types ────── */
export const ISSUE_TYPES = [
  { id: 'bug_error', label: 'Bug / Unexpected Error Message' },
  { id: 'data_save', label: 'Data Saving / Form Submission Failure' },
  { id: 'file_upload', label: 'File or Screenshot Upload Problem' },
  { id: 'export_failure', label: 'PDF or Data Export Generation Failure' },
  { id: 'access_permission', label: 'Permission Denied / Feature Access Issue' },
  { id: 'data_discrepancy', label: 'Calculation, Metric, or Status Discrepancy' },
  { id: 'slow_performance', label: 'Slow Performance or Page Freezing' },
  { id: 'feature_inquiry', label: 'Feature Question / How-To Guidance' },
] as const;

/* ── Urgency levels & standard operational SLAs ────── */
export const PRIORITIES = [
  {
    id: 'low',
    label: 'Low',
    sla: 'Within 48-72 hours',
    desc: 'General inquiry, feature question, or minor non-blocking UI improvement.',
    badgeClass: 'text-slate-700 bg-slate-100 border-slate-200',
  },
  {
    id: 'medium',
    label: 'Medium',
    sla: 'Within 24 hours',
    desc: 'Operational task impairment with an available workaround.',
    badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  {
    id: 'high',
    label: 'High',
    sla: 'Within 8-12 hours',
    desc: 'Core workflow blocker or approaching programme/reporting milestone.',
    badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  {
    id: 'critical',
    label: 'Critical',
    sla: 'Within 2 hours',
    desc: 'System outage, critical data loss, or blocking all team members.',
    badgeClass: 'text-red-700 bg-red-50 border-red-200',
  },
] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  open: { label: 'Open / Assigned', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  waiting_on_client: { label: 'Waiting on User', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
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
  const isAdmin = isSuperAdmin(user?.email, user?.role);

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Form states
  const [featureArea, setFeatureArea] = useState<string>('programmes_projects');
  const [issueType, setIssueType] = useState<string>('bug_error');
  const [priority, setPriority] = useState<string>('medium');
  const [subject, setSubject] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [impact, setImpact] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Attachment states (Form)
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; base64: string; previewUrl?: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission / interaction states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Messaging thread reply
  const [replyText, setReplyText] = useState('');
  const [replyAttachment, setReplyAttachment] = useState<{ name: string; type: string; base64: string; previewUrl?: string } | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox for image preview
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  // Search in ticket history
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const userName = user?.displayName || user?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userRoleLabel = getFriendlyRoleLabel(user?.role || (user as any)?.profile?.role, (user as any)?.pmLevel);
  const userOrg =
    (user as any)?.organizationName ||
    (user as any)?.councilName ||
    (user as any)?.company ||
    (user as any)?.clientName ||
    '';

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

  // Handle file selection (max 3.5MB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'form' | 'reply' = 'form') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3.5 * 1024 * 1024) {
      const msg = 'File size exceeds 3.5MB limit. Please upload a smaller image or document.';
      if (target === 'form') setFileError(msg);
      else setReplyError(msg);
      return;
    }

    if (target === 'form') setFileError(null);
    else setReplyError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const isImg = file.type.startsWith('image/');
      const fileObj = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64,
        previewUrl: isImg ? base64 : undefined,
      };

      if (target === 'form') {
        setAttachedFile(fileObj);
      } else {
        setReplyAttachment(fileObj);
      }
    };
    reader.readAsDataURL(file);
  };

  // Construct structured mailto link for direct escalation
  const buildMailtoUrl = (ticketCode?: string) => {
    const code = ticketCode || selectedTicket?.ticketCode || generateClientTicketId();
    const areaObj = FEATURE_AREAS.find(a => a.id === featureArea);
    const issueObj = ISSUE_TYPES.find(i => i.id === issueType);
    const prioObj = PRIORITIES.find(p => p.id === priority);

    const areaLabel = areaObj?.label || selectedTicket?.featureArea || featureArea;
    const issueLabel = issueObj?.label || selectedTicket?.issueType || issueType;
    const prioLabel = prioObj?.label || selectedTicket?.priority || priority;

    const now = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const emailSubject = `[TECHNICAL ESCALATION #${code}] ${subject || selectedTicket?.subject || 'Platform Support Request'}`;
    const emailBody = [
      '======================================================',
      'CEDARGUARD TECHNICAL PLATFORM ESCALATION',
      '======================================================',
      '',
      `TICKET ID:          ${code}`,
      `DATE / TIME:        ${now} (UTC)`,
      `OFFICER NAME:       ${userName}`,
      `OFFICER EMAIL:      ${userEmail}`,
      `OFFICER ROLE:       ${userRoleLabel}`,
      userOrg ? `ORGANISATION:       ${userOrg}` : '',
      contactPhone ? `CONTACT PHONE:      ${contactPhone}` : '',
      '',
      `APPLICATION AREA:   ${areaLabel}`,
      `ISSUE TYPE:         ${issueLabel}`,
      `URGENCY:            ${prioLabel}`,
      (projectRef || selectedTicket?.projectRef || selectedTicket?.propertyRef)
        ? `PROJECT/PROGRAMME:  ${projectRef || selectedTicket?.projectRef || selectedTicket?.propertyRef}`
        : '',
      '',
      'TECHNICAL ISSUE DETAILS:',
      '------------------------------------------------------',
      description || selectedTicket?.description || '(No additional description entered)',
      '',
      stepsToReproduce ? 'STEPS TO REPRODUCE / ERROR LOGS:' : '',
      stepsToReproduce ? '------------------------------------------------------' : '',
      stepsToReproduce ? stepsToReproduce : '',
      '',
      impact ? 'OPERATIONAL IMPACT / DEADLINE:' : '',
      impact ? '------------------------------------------------------' : '',
      impact ? impact : '',
      '',
      attachedFile ? `ATTACHMENT INCLUDED: ${attachedFile.name}` : '',
      '======================================================',
      'Dispatched via CedarGuard Support Console.',
    ]
      .filter(Boolean)
      .join('\n');

    return `mailto:support@cedarguard.co.uk?cc=cto@cedarguard.co.uk&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleEscalateDirectly = () => {
    window.location.href = buildMailtoUrl();
  };

  // Submitting the ticket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setSubmitError('Please provide both a ticket subject and description of the problem.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const areaObj = FEATURE_AREAS.find(a => a.id === featureArea);
    const issueObj = ISSUE_TYPES.find(i => i.id === issueType);
    const categoryLabel = `${areaObj?.label || featureArea} — ${issueObj?.label || issueType}`;

    try {
      const res = await api.createSupportTicket({
        subject: subject.trim(),
        category: categoryLabel,
        featureArea,
        issueType,
        priority,
        description: description.trim(),
        projectRef: projectRef.trim() || undefined,
        propertyRef: projectRef.trim() || undefined,
        stepsToReproduce: stepsToReproduce.trim() || undefined,
        impact: impact.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        attachment: attachedFile
          ? {
              name: attachedFile.name,
              type: attachedFile.type,
              base64: attachedFile.base64,
            }
          : undefined,
      });

      if (res.success && res.ticket) {
        // Reset form fields
        setSubject('');
        setProjectRef('');
        setDescription('');
        setStepsToReproduce('');
        setImpact('');
        setContactPhone('');
        setAttachedFile(null);

        // Fetch full ticket details and immediately open the chat system
        const detailRes = await api.getSupportTicketDetails({ id: res.ticket.id });
        if (detailRes.success && detailRes.ticket) {
          setSelectedTicket(detailRes.ticket);
        } else {
          setSelectedTicket({
            ...res.ticket,
            description: description.trim(),
            messages: [
              {
                id: '1',
                senderName: userName,
                text: description.trim(),
                createdAt: new Date().toISOString(),
              },
              {
                id: '2',
                senderName: 'CedarGuard Support Desk',
                isAdmin: true,
                text: `Ticket registered. Our technical team is reviewing your report.`,
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }

        // Switch to history tab and refresh list
        setActiveTab('history');
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
    if (!selectedTicket || (!replyText.trim() && !replyAttachment)) return;

    setIsSendingReply(true);
    setReplyError(null);

    try {
      const res = await api.addSupportTicketMessage({
        id: selectedTicket.id,
        message: replyText.trim() || undefined,
        attachment: replyAttachment
          ? {
              name: replyAttachment.name,
              type: replyAttachment.type,
              base64: replyAttachment.base64,
            }
          : undefined,
      });

      if (res.success && res.message) {
        setSelectedTicket((prev: any) => ({
          ...prev,
          messages: [...(prev.messages || []), res.message],
        }));
        setReplyText('');
        setReplyAttachment(null);
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

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const refVal = t.projectRef || t.propertyRef || '';
      const matchesSearch =
        !searchQuery ||
        t.ticketCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refVal.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title="Technical Support & Diagnostics"
        subtitle="Report software issues, application bugs, export errors, or data saving problems with screenshots and direct back-and-forth messaging with CedarGuard engineering."
        breadcrumbs={[{ label: 'Help Centre' }, { label: 'Support Tickets' }]}
      />

      {/* ── Admin Mode Banner (if user is Super Admin) ── */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Admin Mode Active</span>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-mono uppercase">Platform Admin</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Signed in as Platform Administrator ({user?.email}). You can test ticket submission here, or open the Resolution Desk to manage and reply to tickets submitted across the platform.
              </p>
            </div>
          </div>
          <Link
            to="/admin?tab=support-tickets"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-sm shrink-0 whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5" />
            Open Admin Resolution Desk
          </Link>
        </div>
      )}

      {/* ── Platform Support Overview Ribbon ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Support</h4>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">Application Assistance</p>
            <p className="text-xs text-slate-500 mt-1">Direct engineering support for project workflows, data saving, uploads, and exports.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resolution Updates</h4>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">Dedicated Ticket Thread</p>
            <p className="text-xs text-slate-500 mt-1">Chat directly with technicians and post follow-up attachments inside your ticket thread.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Direct Escalation</h4>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">support@cedarguard.co.uk</p>
            <p className="text-xs text-slate-500 mt-1">Priority escalation dispatch with full telemetry directly to technical leadership.</p>
          </div>
        </div>
      </div>

      {/* ── Client Video & Training Guide Callout ── */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Looking for visual walk-throughs and guides?</p>
            <p className="text-[11px] text-slate-400">Explore instructional videos and compliance modules in our Training Academy.</p>
          </div>
        </div>
        <Link
          to="/training"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Open Video Training
        </Link>
      </div>

      {/* ── Main Tab Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
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
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            <TicketCheck className="w-4 h-4" />
            My Tickets & Chat
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

        <div className="text-xs text-slate-600">
          Signed in as: <strong className="text-slate-900">{userEmail}</strong> · <span className="font-semibold text-indigo-700">{userRoleLabel}</span>{userOrg ? ` (${userOrg})` : ''}
        </div>
      </div>

      {/* ── TAB 1: CREATE TICKET ── */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          {submitError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Section 1: Classification */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              1. Platform Feature & Technical Scope
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Feature Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Application Feature / Module <span className="text-red-500">*</span>
                </label>
                <select
                  value={featureArea}
                  onChange={e => setFeatureArea(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                >
                  {FEATURE_AREAS.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Technical Problem Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={issueType}
                  onChange={e => setIssueType(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                >
                  {ISSUE_TYPES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority / Urgency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Urgency Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                >
                  {PRIORITIES.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label} — Response {p.sla}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clean Priority SLA helper card (clean & professional, no fake AI gimmicks) */}
            {(() => {
              const selectedPrio = PRIORITIES.find(p => p.id === priority) || PRIORITIES[1];
              return (
                <div className={clsx('mt-3 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-colors', selectedPrio.badgeClass)}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{selectedPrio.label}:</span>
                    <span className="text-slate-700">{selectedPrio.desc}</span>
                  </div>
                  <span className="font-semibold shrink-0 px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] text-slate-800 shadow-2xs">
                    Target: {selectedPrio.sla}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Section 2: Subject & Project/Programme Reference */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-600" />
              2. Subject & Project / Programme Identification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Ticket Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Error exporting Programme Risk Register to PDF or failed saving milestone"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Project / Programme Reference <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. PRJ-2024-001 or Decarbonisation Programme"
                  value={projectRef}
                  onChange={e => setProjectRef(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Detailed Description & File/Screenshot Upload */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              3. Issue Description & Screenshot Attachment
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  What were you doing and what problem did you face? <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Please describe what task you were performing in the application, what error or unexpected behavior occurred, and what you expected to happen..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* ── Image / Screenshot Upload Field ── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Upload Screenshot or Error Document <span className="text-slate-400 text-[10px] font-normal">(Recommended to demonstrate problem)</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => handleFileChange(e, 'form')}
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="hidden"
                />

                {attachedFile ? (
                  <div className="p-3 bg-slate-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {attachedFile.previewUrl ? (
                        <img
                          src={attachedFile.previewUrl}
                          alt="Attachment preview"
                          className="w-12 h-12 rounded object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{attachedFile.name}</p>
                        <p className="text-[11px] text-slate-400">{attachedFile.type}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-xl p-4 text-center transition-colors group cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="w-9 h-9 rounded-full bg-slate-200/60 group-hover:bg-indigo-100 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">Click to upload screenshot or drag & drop</span>
                      <span className="text-[10px] text-slate-400">PNG, JPG, WEBP, or PDF up to 3.5MB</span>
                    </div>
                  </button>
                )}
                {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Steps to Reproduce <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="1. Opened Programme Governance -> Reports&#10;2. Clicked 'Export PDF'..."
                    value={stepsToReproduce}
                    onChange={e => setStepsToReproduce(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Operational / Team Impact <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Committee meeting scheduled for tomorrow, or team unable to record items..."
                    value={impact}
                    onChange={e => setImpact(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              Submitting registers your ticket and opens the live chat thread with CedarGuard engineering.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Secondary Mailto Escalation Button */}
              <button
                type="button"
                onClick={handleEscalateDirectly}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors"
                title="Opens your email client directly to support@cedarguard.co.uk with prefilled ticket details"
              >
                <Mail className="w-4 h-4 text-slate-600" />
                Escalate via Email
              </button>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening Ticket Chat...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit & Open Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB 2: MY TICKETS & HISTORY ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets by ID, subject, project, or feature area..."
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
                <option value="waiting_on_client">Waiting on User</option>
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
              {filteredTickets.map(ticket => {
                const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const prioCfg = PRIORITIES.find(p => p.id === ticket.priority) || PRIORITIES[1];
                const refCode = ticket.projectRef || ticket.propertyRef;

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
                        {refCode && (
                          <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            {refCode}
                          </span>
                        )}
                        {ticket.attachmentUrl && (
                          <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                            <ImageIcon className="w-3 h-3" /> Screenshot Attached
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

      {/* ── TICKET DISCUSSION & DETAILS DRAWER ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
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
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Update Notice Banner */}
            <div className="bg-indigo-50/80 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-900">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {selectedTicket.status === 'resolved'
                    ? 'This ticket has been marked resolved. You can reply below if you require further assistance.'
                    : 'We are actively investigating — expect updates directly in this thread.'}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(selectedTicket.ticketCode)}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-[11px]"
              >
                {copiedId ? 'Copied' : 'Copy Ref'}
              </button>
            </div>

            {/* Content Body: Metadata + Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Panel */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold uppercase">Organisation</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedTicket.clientName || userOrg || 'Workspace'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Logged By</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedTicket.userName} ({selectedTicket.userEmail})</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Feature Area / Stream</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedTicket.category || 'General Platform'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Project / Programme Ref</span>
                  <p className="font-semibold text-slate-800 mt-0.5 font-mono">{selectedTicket.projectRef || selectedTicket.propertyRef || 'N/A'}</p>
                </div>
              </div>

              {/* Direct Escalation Action within Drawer */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Need urgent escalation?</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Send a direct email escalation to engineering leads.</div>
                </div>
                <a
                  href={buildMailtoUrl(selectedTicket.ticketCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Escalate via Email
                </a>
              </div>

              {/* Messages Thread */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Communication & Activity Thread</h4>

                {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800 mb-1">Original Issue Description:</p>
                    {selectedTicket.description}
                  </div>
                ) : (
                  selectedTicket.messages.map((msg: any, i: number) => {
                    const isStaff = msg.isAdmin || msg.senderRole === 'support_admin';
                    const isSystem = msg.senderId === 'system';

                    return (
                      <div
                        key={msg.id || i}
                        className={clsx(
                          'p-4 rounded-xl border text-xs space-y-2',
                          isSystem
                            ? 'bg-slate-50 border-slate-200'
                            : isStaff
                            ? 'bg-indigo-50/70 border-indigo-200 ml-4'
                            : 'bg-white border-slate-200 mr-4 shadow-2xs'
                        )}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className={isStaff ? 'text-indigo-900 font-bold' : 'text-slate-900'}>
                            {msg.senderName}
                            {isStaff && (
                              <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.2 rounded ml-1 font-normal">
                                {isSystem ? 'Support Desk' : 'CedarGuard Engineering'}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-GB') : ''}
                          </span>
                        </div>

                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                        {/* Attached Image/Screenshot in message */}
                        {msg.attachmentUrl && (
                          <div className="pt-2">
                            <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                              <Paperclip className="w-3 h-3 text-indigo-500" />
                              Attached: {msg.attachmentName || 'Screenshot'}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewImageModal(msg.attachmentUrl)}
                              className="relative group rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition-colors block text-left"
                            >
                              <img
                                src={msg.attachmentUrl}
                                alt={msg.attachmentName || 'Attachment'}
                                className="max-h-48 max-w-full rounded object-contain bg-slate-100"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Maximize2 className="w-4 h-4 mr-1" /> View Full Size
                              </div>
                            </button>
                          </div>
                        )}
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

              {/* Reply Attachment Preview */}
              {replyAttachment && (
                <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-indigo-950 truncate">{replyAttachment.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyAttachment(null)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={replyFileInputRef}
                onChange={e => handleFileChange(e, 'reply')}
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => replyFileInputRef.current?.click()}
                  className="p-2.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Attach screenshot or file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  rows={2}
                  placeholder="Type a response or add more diagnostic context..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="flex-1 p-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />

                <button
                  type="submit"
                  disabled={isSendingReply || (!replyText.trim() && !replyAttachment)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 h-full"
                >
                  {isSendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Reply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Image Lightbox Modal ── */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-mono font-bold">Screenshot Attachment</span>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="p-1 rounded hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImageModal}
              alt="Screenshot full size"
              className="max-h-[80vh] w-auto mx-auto object-contain p-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}

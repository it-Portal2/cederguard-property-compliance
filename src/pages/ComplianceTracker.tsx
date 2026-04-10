import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Shield, Search, Filter, ChevronRight, AlertCircle, CheckCircle2, Clock, Calendar, AlertTriangle, ArrowRight, TrendingUp, LayoutGrid, List, ExternalLink, Info, ShieldCheck, SearchCheck, FileText, Target, History, Lock, MessageSquare, MoreVertical, Plus, ScanSearch, Trash2, ArrowLeft, X, ChevronDown, Edit2, Layers, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, Link } from 'react-router';
import { useStore, ComplianceItem } from '../store/useStore';
import { DOMAINS, getRIBALabelFull } from '../data/complianceData';
import { isAtLeastClientAdmin } from '../lib/roles';
import { stripMarkdown, downloadFile, exportComplianceToCSV } from '../lib/utils';
import { api } from '../lib/api';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { AIWriter } from '../components/AIWriter';
import { format, isValid } from 'date-fns';
import toast from 'react-hot-toast';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import { canCreateCompliance } from '../lib/roles';

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const STAGES = [
  'Information Gap',
  'Risk Identified',
  'In Progress',
  'Live',
  'Archived'
];

/* ═══════════════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════════════ */

const Badge = ({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: string, className?: string }) => {
  const variants: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
};

const Progress = ({ value, className = '' }: { value: number, className?: string }) => (
  <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${value}%` }}
      transition={{ duration: 1, ease: 'easeOut' }}
      className="bg-indigo-600 h-full rounded-full"
    />
  </div>
);

/**
 * Utility function to join class names (simplified version of cn/clsx)
 */
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT: COMPLIANCE TRACKER
   ═══════════════════════════════════════════════════ */

export function ComplianceTracker() {
  const {
    complianceItems,
    updateComplianceItem,
    isComplianceLocked,
    setComplianceLocked,
    activeProjectId,
    activeProgrammeId,
    activeProject,
    activeProgramme,
    projects,
    programmes,
    user: currentUser,
    deleteComplianceItem,
    addComplianceItem,
    bulkDeleteComplianceItems,
    addNotification,
    getActiveItems,
    getPendingItems,
    addComplianceUpdate,
    canEditCompliance,
    loadProjectData,
    loadProgrammeData,
    setActiveProject,
    setActiveProgramme
  } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);

  // Load data when active context changes.
  // Skip the fetch if complianceItems already has data for this context (e.g. loaded by initStore).
  useEffect(() => {
    if (!activeProjectId && !activeProgrammeId) return;
    const contextId = activeProjectId || activeProgrammeId!;
    const alreadyLoaded = complianceItems.some(i =>
      activeProjectId ? i.projectId === contextId : i.programmeId === contextId
    );
    if (alreadyLoaded) return;
    let cancelled = false;
    setIsLoading(true);
    const loadFn = activeProjectId
      ? loadProjectData(activeProjectId)
      : loadProgrammeData(activeProgrammeId!);
    loadFn.finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, activeProgrammeId]);

  // Sync URL params to store context
  useEffect(() => {
    const pId = searchParams.get('projectId') || searchParams.get('id');
    const prId = searchParams.get('programmeId');
    const type = searchParams.get('type');

    if (type === 'project' && pId && activeProjectId !== pId) {
      setActiveProject(pId);
    } else if (type === 'programme' && pId && activeProgrammeId !== pId) {
      setActiveProgramme(pId);
    } else if (prId && activeProgrammeId !== prId) {
      setActiveProgramme(prId);
    }
  }, [searchParams, activeProjectId, activeProgrammeId, setActiveProject, setActiveProgramme]);

  const fromInitiation = searchParams.get('from') === 'initiation';
  const isPM = !isAtLeastClientAdmin(currentUser?.profile?.role);
  const activeItems = getActiveItems();
  const pendingItems = getPendingItems();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFullQueue, setShowFullQueue] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'tracker' | 'dashboard' | 'analytics'>('tracker');

  // Handle URL-based action triggers
  useEffect(() => {
      const action = searchParams.get('action');
      if (action === 'add-compliance') {
          setIsAddModalOpen(true);
          // Clean up the URL
          setSearchParams(prev => {
              const next = new URLSearchParams(prev);
              next.delete('action');
              return next;
          }, { replace: true });
      }
  }, [searchParams, setSearchParams]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedEvidence, setExpandedEvidence] = useState<any[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Fetch evidence documents linked to the expanded compliance item
  const contextId = activeProjectId || activeProgrammeId || 'all';
  useEffect(() => {
    if (!expandedId) { setExpandedEvidence([]); return; }
    let cancelled = false;
    setEvidenceLoading(true);
    api.getEvidence(contextId).then(res => {
      if (!cancelled && res.success) {
        setExpandedEvidence(
          (res.data || []).filter((e: any) => e.relatedRequirementId === expandedId)
        );
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setEvidenceLoading(false); });
    return () => { cancelled = true; };
  }, [expandedId, contextId]);

  // Confirmation dialog state — replaces all window.confirm() calls
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const openConfirm = (opts: Omit<typeof confirmDialog, 'isOpen'>) =>
    setConfirmDialog({ ...opts, isOpen: true });

  const closeConfirm = () =>
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const idsToDelete = [...selectedIds];
    openConfirm({
      title: 'Delete Selected Requirements',
      message: `Are you sure you want to permanently delete ${count} selected compliance requirement${count > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: `Delete ${count}`,
      isDanger: true,
      onConfirm: async () => {
        setSelectedIds([]);
        try {
          await bulkDeleteComplianceItems(idsToDelete);
          toast.success(`Deleted ${count} requirement${count > 1 ? 's' : ''}`);
        } catch {
          toast.error('Something went wrong. Please try again.');
        }
      }
    });
  };

  const handleVerify = async (id: string) => {
    try {
      await updateComplianceItem(id, { status: 'applicable' });
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const handleDismiss = (id: string) => {
    openConfirm({
      title: 'Dismiss Requirement',
      message: 'Are you sure you want to dismiss this requirement? It will be moved to history and will no longer appear in your active tracker.',
      confirmLabel: 'Dismiss',
      isDanger: false,
      onConfirm: async () => {
        try {
          await updateComplianceItem(id, { status: 'dismissed' });
        } catch {
          toast.error('Something went wrong. Please try again.');
        }
      }
    });
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [newReq, setNewReq] = useState({ domain: 'General', reg: '', auth: '', risk: 'Medium', req: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);

  const openEditModal = (item: ComplianceItem) => {
    setEditingItem(item);
    // Normalise stored domain (id or label) to label so the modal select can match it
    const domainLabel = DOMAINS.find(d => d.id === item.domain || d.label === item.domain)?.label || item.domain || 'General';
    setNewReq({
      domain: domainLabel,
      reg: item.reg || '',
      auth: item.auth || '',
      risk: item.risk || 'Medium',
      req: item.req || ''
    });
    setIsAddModalOpen(true);
  };

  const handleSaveRequirement = async () => {
    // Normalise domain: always store the id (e.g. "bs"), not the label ("Building Safety")
    const domainId = DOMAINS.find(d => d.label === newReq.domain || d.id === newReq.domain)?.id || newReq.domain;
    const payload = { ...newReq, domain: domainId, reg: newReq.reg.trim(), req: newReq.req.trim() };
    setIsSaving(true);
    try {
      if (editingItem) {
        await updateComplianceItem(editingItem.id, payload);
        toast.success('Requirement updated');
        setEditingItem(null);
      } else {
        await addComplianceItem({
          ...payload,
          projectId: activeProjectId || undefined,
          programmeId: activeProgrammeId || undefined,
          status: 'applicable'
        });
        toast.success('Requirement added');
        addNotification({
          title: 'New Requirement Added',
          body: `Requirement "${newReq.req.trim() || 'New Requirement'}" added manually.`,
          type: 'compliance',
          projectId: activeProjectId || undefined
        });
      }
      setIsAddModalOpen(false);
      setNewReq({ domain: 'General', reg: '', auth: '', risk: 'Medium', req: '' });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const dismissedItems = useMemo(() => {
    return (complianceItems || []).filter(i => i.status === 'dismissed');
  }, [complianceItems]);

  const displayItems = useMemo(() => {
    return showDismissed ? dismissedItems : activeItems;
  }, [showDismissed, dismissedItems, activeItems]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = activeItems.length;
    const completed = activeItems.filter(i => i.stage === 'Live' || i.stage === 'Archived').length;
    const upcoming = activeItems.filter(i => {
      if (!i.dueDate) return false;
      const dueDate = new Date(i.dueDate);
      if (isNaN(dueDate.getTime())) return false;
      const days = (dueDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return days > 0 && days <= 30;
    }).length;
    const critical = activeItems.filter(i => i.stage === 'Risk Identified' || i.stage === 'Information Gap').length;

    return {
      total,
      completed,
      upcoming,
      critical,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [activeItems]);

  // Filter items by selected domain and search term
  const filteredItems = useMemo(() => {
    return displayItems.filter(item => {
      const matchesSearch = item.req?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.risk?.toLowerCase().includes(searchTerm.toLowerCase());

      const domainObj = selectedDomainId ? DOMAINS.find(d => d.id === selectedDomainId) : null;
      const matchesDomain = !selectedDomainId ||
        item.domain === selectedDomainId ||
        item.domain === domainObj?.label;

      return matchesSearch && matchesDomain;
    });
  }, [displayItems, searchTerm, selectedDomainId]);

  // Group items for category cards
  const domainStats = useMemo(() => {
    return DOMAINS.map(domain => {
      const domainItems = activeItems.filter(i => i.domain === domain.id || i.domain === domain.label);
      const completed = domainItems.filter(i => i.stage === 'Live' || i.stage === 'Archived').length;
      return {
        ...domain,
        total: domainItems.length,
        completed,
        percent: domainItems.length > 0 ? Math.round((completed / domainItems.length) * 100) : 0,
        recentItems: domainItems.slice(0, 3)
      };
    });
  }, [activeItems]);

  const handleToggleHistory = () => {
    setShowDismissed(!showDismissed);
    setSelectedDomainId(null);
  };

  const handleExport = () => {
    const exportData = filteredItems.map(req => ({
      ID: req.id,
      Domain: req.domain,
      Title: req.req, // Assuming 'req' is the title/requirement text
      Status: req.status,
      Risk: req.risk,
      Stage: req.stage,
      Trigger: req.trigger,
      Conditional: req.conditional,
      ConditionReason: req.condReason,
      Project: req.projectName,
      Programme: req.programmeName,
      // Add other fields as needed, ensure they exist on ComplianceItem
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ComplianceTracker");
    // Using a simple date format for filename, assuming `format` utility is available or using basic JS Date methods
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    XLSX.writeFile(workbook, `Compliance_Tracker_${formattedDate}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:px-8 space-y-6 sm:space-y-8">
      <ServiceManagementBar className="mb-4" />
      
      {/* Verification Queue (Dynamic) */}
      <AnimatePresence>
        {pendingItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-600 rounded-3xl p-8 mb-8 text-white relative shadow-2xl shadow-indigo-200 overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="absolute left-0 bottom-0 w-48 h-48 bg-indigo-500 rounded-full -ml-10 -mb-10 blur-2xl"></div>
              
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-xl space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                    <Target className="w-3.5 h-3.5 fill-white" />
                    Pending Verification
                  </div>
                  <h2 className="text-3xl font-black tracking-tight leading-tight">
                    Review {pendingItems.length} New Compliance Requirements
                  </h2>
                  <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                    Our AI has identified {pendingItems.length} potential items for your project. Please verify if they are applicable to add them to your tracking profile.
                  </p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 flex flex-col items-center justify-center text-center min-w-[200px]">
                  <div className="text-4xl font-black mb-1">{pendingItems.length}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Pending Review</div>
                </div>
              </div>

              <div className="mt-8 space-y-3 relative z-10">
                {(showFullQueue ? pendingItems : pendingItems.slice(0, 3)).map((item) => (
                  <motion.div 
                    layout
                    key={item.id}
                    className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center justify-between gap-4 group hover:bg-white/20 transition-all"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Info className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/20 rounded-md">{item.domain}</span>
                          <span className="text-[10px] font-black text-indigo-200">{item.reg}</span>
                        </div>
                        <p className="font-bold text-sm mt-0.5 line-clamp-1">{item.req}</p>
                        <p className="text-[10px] text-indigo-200 mt-1 flex items-center gap-1 italic">
                          <AlertCircle className="w-3 h-3" />
                          {item.condReason || 'Conditionally matched based on project profile.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button 
                        onClick={() => handleDismiss(item.id)}
                        className="px-4 py-2 bg-white/10 hover:bg-rose-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                      >
                        No
                      </button>
                      <button 
                        onClick={() => handleVerify(item.id)}
                        className="px-6 py-2 bg-white text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg"
                      >
                        Yes, Apply
                      </button>
                    </div>
                  </motion.div>
                ))}
                {!showFullQueue && pendingItems.length > 3 && (
                  <button 
                    onClick={() => setShowFullQueue(true)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-indigo-100 hover:bg-white/10 transition-all"
                  >
                    Show {pendingItems.length - 3} more pending review...
                  </button>
                )}
                {showFullQueue && pendingItems.length > 3 && (
                  <button 
                    onClick={() => setShowFullQueue(false)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-indigo-100 hover:bg-white/10 transition-all"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Dashboard Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <Badge variant="indigo">{stats.percent}% Overall</Badge>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.completed} / {stats.total}</p>
            <p className="text-slate-500 text-sm">Active Compliance Items</p>
          </div>
          <Progress value={stats.percent} />
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.critical}</p>
            <p className="text-slate-500 text-sm">Critical Risks Identified</p>
          </div>
          <div className="flex items-center gap-2 text-rose-600 text-sm font-medium">
            <ScanSearch className="w-4 h-4 text-indigo-400 shrink-0" />
            Action required immediately
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.upcoming}</p>
            <p className="text-slate-500 text-sm">Renewals in next 30 days</p>
          </div>
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
            <Calendar className="w-4 h-4" />
            Plan upcoming inspections
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">+12%</p>
            <p className="text-slate-500 text-sm">Compliance vs Last Month</p>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            Positive trajectory
          </div>
        </motion.div>
      </div>

      {/* Enhanced AI Inquiry Visibility Banner */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 group">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-1000"></div>
        <div className="absolute left-0 bottom-0 w-48 h-48 bg-indigo-500/50 rounded-full -ml-24 -mb-24 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm">
              <ScanSearch className="w-3.5 h-3.5 fill-white animate-pulse" />
              CedarGuard AI Assistant
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight italic">
              Deep Compliance Inquiry
            </h2>
            <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-lg">
              Analyze regulatory requirements, identify risks, or seek guidance on building safety. 
              Our CedarGuard AI will scan the entire tracker and project context to provide instant insights.
            </p>
          </div>
          
          <button 
            onClick={() => setIsAIInquiryOpen(true)}
            className="shrink-0 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-900 hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-3 group/btn"
          >
            <MessageSquare className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
            Launch AI Advisor
          </button>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search requirements, risks, or domains..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1 font-medium text-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2",
                viewMode === 'grid' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2",
                viewMode === 'list' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
          
          <button
            onClick={() => setComplianceLocked(!isComplianceLocked)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all shadow-sm shadow-slate-100/50",
              isComplianceLocked 
                ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" 
                : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
            )}
            title={isComplianceLocked ? "Unlock Compliance Editing" : "Lock Compliance Editing"}
          >
            {isComplianceLocked ? <Lock className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {isComplianceLocked ? "Locked" : "Unlocked"}
          </button>

          <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 font-bold text-[10px] uppercase tracking-widest transition-all">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          
          <button 
            onClick={handleToggleHistory}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border font-medium transition-all shadow-sm",
              showDismissed 
                ? "bg-slate-900 border-slate-900 text-white shadow-slate-200" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <History className={cn("w-4 h-4", showDismissed ? "text-slate-400" : "text-slate-500")} />
            {showDismissed ? 'Hide History' : 'Show History'}
          </button>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-medium transition-all shadow-sm hover:bg-emerald-100"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Data
          </button>
          
          {selectedIds.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-100 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all cursor-pointer select-none group active:scale-95"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-4 h-4 group-hover:animate-bounce" />
              Delete {selectedIds.length} Selected
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
                    <div className="w-16 h-8 bg-slate-100 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-5 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full" />
                  <div className="space-y-2 pt-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-4/5" />
                    <div className="h-3 bg-slate-100 rounded w-3/5" />
                  </div>
                </div>
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between">
                  <div className="h-6 w-20 bg-slate-100 rounded-full" />
                  <div className="h-8 w-8 bg-slate-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-24 px-4 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 relative">
              <SearchCheck className="w-10 h-10 text-slate-300" />
              <div className="absolute -right-2 -top-2 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center border-4 border-white">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 italic">No Requirements Found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed font-medium">
              We couldn't find any compliance items matching your current filters. 
              Try adjusting your search or add a new manual requirement.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              <button 
                onClick={() => { setSearchTerm(''); setSelectedDomainId(null); }}
                className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Clear All Filters
              </button>
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setNewReq({ domain: 'General', reg: '', auth: '', risk: 'Medium', req: '' });
                  setIsAddModalOpen(true);
                }}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
              >
                Add Manual Requirement
              </button>
            </div>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {domainStats.map((domain) => (
              <motion.div
                key={domain.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group border-b-4"
                style={{ borderBottomColor: domain.color }}
              >
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                      <Shield className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-slate-900">{domain.percent}%</span>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Compliance</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                      {domain.label}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">{domain.total} total requirements</p>
                  </div>

                  <Progress value={domain.percent} className="h-1.5" />

                  {/* Quick Requirements List */}
                  <div className="space-y-2 pt-2 text-sm">
                    {domain.recentItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-slate-600">
                        <span className="truncate flex-1 pr-4" title={item.req}>{item.req}</span>
                        {item.stage === 'Live' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        )}
                      </div>
                    ))}
                    {domain.total > 3 && (
                      <button
                        onClick={() => { setSelectedDomainId(domain.id); setViewMode('list'); }}
                        className="text-indigo-600 font-medium hover:underline text-xs flex items-center mt-2"
                      >
                        +{domain.total - 3} more requirements
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </button>
                    )}
                    {domain.total === 0 && (
                      <p className="text-slate-400 italic text-xs py-2">No requirements tracked yet</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                  <Badge variant={domain.percent === 100 ? 'success' : domain.percent > 50 ? 'warning' : 'danger'}>
                    {domain.completed}/{domain.total} Done
                  </Badge>
                  <button
                    onClick={() => { setSelectedDomainId(domain.id); setViewMode('list'); }}
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Sidebar */}
            <aside className="w-full lg:w-72 shrink-0 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Domains</h3>
                  <Badge variant="blue" className="px-1.5 py-0">{DOMAINS.length}</Badge>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedDomainId(null)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                      !selectedDomainId 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      !selectedDomainId ? "bg-white/20" : "bg-slate-100"
                    )}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <span>All Domains</span>
                  </button>
                  {DOMAINS.map(domain => {
                    const isActive = selectedDomainId === domain.id;
                    const counts = {
                      total: activeItems.filter(i => i.domain === domain.id || i.domain === domain.label).length,
                      live: activeItems.filter(i => (i.domain === domain.id || i.domain === domain.label) && i.stage === 'Live').length
                    };

                    return (
                      <button
                        key={domain.id}
                        onClick={() => setSelectedDomainId(domain.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                          isActive 
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            isActive ? "bg-white/20" : "bg-slate-100 group-hover:bg-white"
                          )}>
                             <Layers className="w-4 h-4" style={{ color: !isActive ? domain.color : 'white' }} />
                          </div>
                          <span>{domain.label}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-black",
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {counts.total}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 mt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setNewReq({ domain: selectedDomainId ? (DOMAINS.find(d => d.id === selectedDomainId)?.label || 'Fire Safety') : 'Fire Safety', reg: '', auth: '', req: '', risk: 'Medium' });
                      setIsAddModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600/10 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Requirement
                  </button>
                </div>
              </div>

            </aside>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 space-y-6">
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200" style={{ maxWidth: '100%' }}>
                  <table className="w-full text-left min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4 w-12 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={selectedIds.length > 0 && selectedIds.length === filteredItems.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-6 py-4 w-[40%] min-w-[300px]">Requirement Details</th>
                        <th className="px-6 py-4 w-[15%] hidden sm:table-cell">Domain</th>
                        <th className="px-6 py-4 w-[20%] min-w-[150px]">Compliance Stage</th>
                        <th className="px-6 py-4 w-[15%] hidden md:table-cell">Due Date</th>
                        <th className="px-6 py-4 w-[10%] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map(item => (
                        <React.Fragment key={item.id}>
                          <tr
                            className={cn(
                              "hover:bg-slate-50/80 transition-all group cursor-pointer",
                              expandedId === item.id && "bg-slate-50/50"
                            )}
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={selectedIds.includes(item.id)}
                                  onClick={(e) => toggleSelectOne(item.id, e)}
                                  onChange={() => {}} 
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-4">
                                <div className="mt-1">
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    item.stage === 'Live' ? "bg-emerald-500" :
                                      item.stage === 'Risk Identified' ? "bg-rose-500" : "bg-amber-500"
                                  )} />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="font-extrabold text-slate-900 leading-snug text-[11px] sm:text-xs break-words whitespace-normal overflow-visible" title={stripMarkdown(item.req)}>
                                    {stripMarkdown(item.req)}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-3 mt-2">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                       Reg: {stripMarkdown(item.reg)}
                                    </span>
                                    <Badge variant={item.risk === 'Critical' ? 'rose' : item.risk === 'High' ? 'orange' : 'blue'} className="text-[8px] py-0 px-1.5 font-black uppercase shrink-0">
                                      {item.risk} Risk
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const d = DOMAINS.find(d => d.id === item.domain);
                                  return (
                                    <>
                                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                                        <Layers className="w-3 h-3" style={{ color: d?.color }} />
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-600">{d?.label || item.domain}</span>
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <select
                                  disabled={!canEditCompliance()}
                                  className={cn(
                                    "flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase border border-transparent focus:ring-4 focus:ring-indigo-500/10 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:border-indigo-200 outline-none appearance-none min-w-[120px]",
                                    (item.stage || 'Information Gap') === 'Live' ? "bg-emerald-50 text-emerald-800" :
                                      (item.stage || 'Information Gap') === 'Risk Identified' ? "bg-rose-50 text-rose-800" :
                                        "bg-amber-50 text-amber-800"
                                  )}
                                  value={item.stage || 'Information Gap'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={async (e) => {
                                    try {
                                      await updateComplianceItem(item.id, { stage: e.target.value as any });
                                    } catch {
                                      toast.error('Something went wrong. Please try again.');
                                    }
                                  }}
                                >
                                  {STAGES.map(stage => (
                                    <option key={stage} value={stage} className="bg-white text-slate-900 font-bold uppercase tracking-widest">{stage}</option>
                                  ))}
                                </select>
                                {!canEditCompliance() && (
                                  <div className="p-1.5 bg-slate-100 text-slate-400 rounded-md shrink-0" title="This requirement is locked for this project session. Only admins can unlock.">
                                    <Lock className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="flex items-center gap-2 text-slate-500">
                                <Calendar className="w-3.5 h-3.5" />
                                <span className={cn("text-[10px] font-bold", !item.dueDate && "text-slate-300 italic")}>
                                  {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Set Date'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const label = item.req ? `"${stripMarkdown(item.req).slice(0, 60)}${item.req.length > 60 ? '…' : ''}"` : 'this requirement';
                                    openConfirm({
                                      title: 'Delete Requirement',
                                      message: `Are you sure you want to permanently delete ${label}? This cannot be undone.`,
                                      confirmLabel: 'Delete',
                                      isDanger: true,
                                      onConfirm: async () => {
                                        try {
                                          await deleteComplianceItem(item.id);
                                          toast.success('Requirement deleted');
                                        } catch {
                                          toast.error('Something went wrong. Please try again.');
                                        }
                                      }
                                    });
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform", expandedId === item.id && "rotate-180")} />
                              </div>
                            </td>
                          </tr>
                          <AnimatePresence>
                            {expandedId === item.id && (
                              <tr>
                                <td colSpan={6} className="p-0 border-b border-slate-100 bg-slate-50/30">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
                                      {/* Expanded content remains similar but styled better ... */}
                                      <div className="space-y-6">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                          <List className="w-3 h-3" /> Step-by-Step Tasks
                                        </h4>
                                        <ul className="space-y-4">
                                          {(item.tasks || []).map((task: string, idx: number) => (
                                            <li key={idx} className="flex gap-4 text-xs text-slate-600 leading-relaxed font-medium">
                                              <span className="text-indigo-600 font-black">{String(idx + 1).padStart(2, '0')}</span>
                                              {stripMarkdown(task)}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>

                                      <div className="space-y-6 border-x border-slate-100 px-8">
                                        <div>
                                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <SearchCheck className="w-3 h-3" /> Definition of Done
                                          </h4>
                                          <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            {stripMarkdown(item.dod || 'No definition specified.')}
                                          </p>
                                        </div>
                                        <div>
                                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <History className="w-3 h-3 text-indigo-400" /> Historical Updates
                                          </h4>
                                          <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
                                            {item.updates && item.updates.length > 0 ? (
                                              item.updates.map((update: { id: string; date: string; content: string; author?: string }) => (
                                                <div key={update.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm space-y-1">
                                                  <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                      {isValid(new Date(update.date)) ? format(new Date(update.date), 'dd MMM yyyy HH:mm') : '—'}
                                                    </span>
                                                    <span className="text-[9px] font-black text-indigo-600 uppercase italic">{update.author}</span>
                                                  </div>
                                                  <p className="text-[11px] text-slate-600 leading-normal">{update.content}</p>
                                                </div>
                                              ))
                                            ) : (
                                              <p className="text-[10px] text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No history yet</p>
                                            )}
                                          </div>
                                          <div className="mt-4 pt-4 border-t border-slate-100">
                                            <div className="relative group">
                                               <textarea 
                                                placeholder="Add a progress update..."
                                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[80px]"
                                                onKeyDown={async (e) => {
                                                  if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    const val = e.currentTarget.value.trim();
                                                    if (!val) return;
                                                    const updateObj = {
                                                      id: `upd-${Date.now()}`,
                                                      date: new Date().toISOString(),
                                                      content: val,
                                                      author: currentUser?.displayName || currentUser?.email || 'User'
                                                    };
                                                    try {
                                                      await addComplianceUpdate(item.id, updateObj);
                                                      e.currentTarget.value = '';
                                                    } catch {
                                                      toast.error('Something went wrong. Please try again.');
                                                    }
                                                  }
                                                }}
                                              />
                                              <div className="absolute right-3 bottom-3 text-[9px] text-slate-400 font-bold opacity-0 group-focus-within:opacity-100 transition-opacity">Press Enter to save</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="space-y-6">
                                        <div>
                                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <ExternalLink className="w-3 h-3" /> Evidence
                                          </h4>
                                          <div className="space-y-2">
                                            {/* Linked evidence from Evidence Vault */}
                                            {evidenceLoading ? (
                                              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                                <span className="text-[10px] text-slate-400 font-bold">Loading evidence...</span>
                                              </div>
                                            ) : expandedEvidence.length > 0 ? (
                                              <div className="space-y-1.5">
                                                {expandedEvidence.map((ev: any) => (
                                                  <a
                                                    key={ev.id}
                                                    href={ev.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors group"
                                                  >
                                                    <div className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center shrink-0">
                                                      <FileText className="w-3 h-3 text-emerald-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-[11px] font-bold text-emerald-800 truncate">{ev.name}</p>
                                                      <p className="text-[9px] text-emerald-600">
                                                        {ev.type === 'link' ? 'External URL' : (ev.size ? `${(ev.size / 1024).toFixed(1)} KB` : 'File')}
                                                        {ev.uploadedAt && ` · ${new Date(ev.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
                                                      </p>
                                                    </div>
                                                    <ExternalLink className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                  </a>
                                                ))}
                                                <Link
                                                  to={`/compliance/evidence${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`}
                                                  className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-black hover:underline px-1 mt-1"
                                                >
                                                  <ExternalLink className="w-3 h-3" /> View in Evidence Vault
                                                </Link>
                                              </div>
                                            ) : null}

                                            {/* Manual fallback input */}
                                            <input
                                              type="text"
                                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                              defaultValue={item.evidence || ''}
                                              placeholder={expandedEvidence.length > 0 ? 'Add additional link...' : 'Link evidence...'}
                                              onClick={(e) => e.stopPropagation()}
                                              onBlur={async (e) => {
                                                const val = e.target.value.trim();
                                                if (val === (item.evidence || '')) return;
                                                try {
                                                  await updateComplianceItem(item.id, { evidence: val });
                                                } catch {
                                                  toast.error('Something went wrong. Please try again.');
                                                }
                                              }}
                                            />
                                            {item.evidence && item.evidence.startsWith('http') && (
                                              <a href={item.evidence} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-black hover:underline px-1">
                                                <ExternalLink className="w-3 h-3" /> Open Manual Link
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                           <div className="flex items-center justify-between gap-4">
                                              <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                <input
                                                  type="date"
                                                  className="bg-transparent text-[10px] font-black text-slate-900 focus:outline-none"
                                                  value={item.dueDate || ''}
                                                  onChange={async (e) => {
                                                    const val = e.target.value;
                                                    // Reject invalid dates; allow clearing (empty string)
                                                    if (val && !isValid(new Date(val))) return;
                                                    try {
                                                      await updateComplianceItem(item.id, { dueDate: val || undefined });
                                                    } catch {
                                                      toast.error('Something went wrong. Please try again.');
                                                    }
                                                  }}
                                                />
                                              </div>
                                              <button
                                                onClick={() => openEditModal(item)}
                                                className="px-3 py-1.5 bg-indigo-600/10 text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                              >
                                                Edit Full Entry
                                              </button>
                                           </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      ))}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="max-w-xs mx-auto space-y-4">
                              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                                <SearchCheck className="w-8 h-8 text-slate-200" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">No Requirements Found</p>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">Adjust your filters or search term to find what you're looking for.</p>
                              </div>
                              <button
                                onClick={() => { setSearchTerm(''); setSelectedDomainId(null); }}
                                className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                              >
                                Reset All Filters
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Requirement Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] md:max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingItem ? 'Edit Requirement' : 'Add New Requirement'}
              </h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }} 
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-8 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Domain</label>
                  <select 
                    value={newReq.domain}
                    onChange={e => setNewReq({...newReq, domain: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {DOMAINS.map(d => <option key={d.id} value={d.label}>{d.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Level</label>
                  <select 
                    value={newReq.risk}
                    onChange={e => setNewReq({...newReq, risk: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regulation / Name</label>
                <input 
                  value={newReq.reg}
                  onChange={e => setNewReq({...newReq, reg: e.target.value})}
                  placeholder="e.g. Building Safety Act Gateway 2"
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requirement Detail</label>
                  <AIWriter
                    onSuggest={(content) => setNewReq({...newReq, req: content})}
                    context={[
                      `Write one plain-text sentence (max 30 words) describing a compliance action for a UK construction project.`,
                      `Domain: ${DOMAINS.find(d => d.id === newReq.domain || d.label === newReq.domain)?.label || newReq.domain}.`,
                      `Regulation: ${newReq.reg || 'General'}.`,
                      `Risk: ${newReq.risk}.`,
                      newReq.req ? `Expand on: "${newReq.req.slice(0, 80)}".` : '',
                      `No markdown, no bullet points, no headers. Plain text only.`
                    ].filter(Boolean).join(' ')}
                    label="Draft with AI"
                  />
                </div>
                <textarea 
                  value={newReq.req}
                  onChange={e => setNewReq({...newReq, req: e.target.value})}
                  placeholder="Describe the specific compliance requirement..."
                  rows={4}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-4 px-6 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRequirement}
                  disabled={!newReq.reg || !newReq.req || isSaving}
                  className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    editingItem ? 'Update Requirement' : 'Add to Registry'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeConfirm()}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                {confirmDialog.title}
              </h3>
              <button
                onClick={closeConfirm}
                className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                {confirmDialog.message}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeConfirm}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    closeConfirm();
                  }}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all shadow-lg ${
                    confirmDialog.isDanger
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {confirmDialog.confirmLabel || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* AI Inquiry Popup */}
      <AIInquiryPopup
        isOpen={isAIInquiryOpen}
        onClose={() => setIsAIInquiryOpen(false)}
        context="Compliance Tracker Dashboard"
      />
      <button
        onClick={() => setIsAIInquiryOpen(true)}
        className="fixed bottom-8 right-8 z-[150] bg-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-500/40 hover:bg-slate-900 transition-all hover:scale-110 active:scale-95 group"
        title="Consult CedarGuard AI"
      >
        <ScanSearch className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    </div>
  );
}

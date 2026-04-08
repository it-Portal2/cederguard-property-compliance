import React, { useState, useEffect } from 'react';
import { useStore, RiskItem } from '../store/useStore';
import { isAtLeastPM, isAtLeastClientAdmin, isSuperAdmin, UserRole } from '../lib/roles';
import { RISK_STATUSES, CATEGORIES, WORKSTREAMS } from '../data/riskData';
import { clsx } from 'clsx';
import { stripMarkdown, generateId } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { InfoTooltip } from '../components/InfoTooltip';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Trash2, Edit2, ShieldOff, AlertCircle, ArrowUpRight, Upload, Download, ScanSearch, FileSpreadsheet, Plus, AlertTriangle, Flag, RotateCcw, ArrowLeft, ArrowRight } from 'lucide-react';
import { RiskModal } from '../components/RiskModal';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import * as XLSX from 'xlsx';

const EmptyState = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-t border-slate-100 italic">
    <ShieldOff className="w-10 h-10 text-slate-200 mb-3" />
    <p className="text-sm font-medium text-slate-400">{title}</p>
    <p className="text-[10px] text-slate-300 mt-1">Adjust your filters or add a new risk to populate this view.</p>
  </div>
);

function rsScore(score: number) {
  if (!score || score <= 6) return 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm';
  if (score <= 14) return 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm';
  return 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm font-black animate-pulse';
}

function rLabel(s: number) {
  if (!s || s <= 6) return { l: 'Low', c: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  if (s <= 14) return { l: 'Medium', c: 'bg-amber-50 text-amber-600 border-amber-200' };
  return { l: 'High', c: 'bg-rose-50 text-rose-600 border-rose-200 font-bold' };
}

function fGBP(v?: number) {
  if (v === null || v === undefined || isNaN(v) || v === 0) return '—';
  return '£' + Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function fDate(d?: string) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yy'); } catch { return d; }
}

function ageCalc(dateAdded?: string, status?: string) {
  if (!dateAdded || status === 'Closed') return '—';
  try { return differenceInDays(new Date(), new Date(dateAdded)) + 'd'; } catch { return '—'; }
}

/** Convert stored probability to display percentage string.
 * Stored as 0-1 decimal (e.g. 0.40) → show "40%" */
function probDisplay(prob?: number): string {
  if (!prob && prob !== 0) return '—';
  if (prob === 0) return '—';
  // If stored > 1 it was stored as raw %, e.g. legacy "40"
  const pct = prob > 1 ? prob : prob * 100;
  return Math.round(pct) + '%';
}


function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Open' ? 'bg-red-50 text-red-600 border-red-200' :
      status === 'Closed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
        status === 'Mitigated' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          status === 'Tolerated' ? 'bg-amber-50 text-amber-600 border-amber-200' :
            'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', cls)}>{status}</span>;
}

// Risk Register Component
export function RiskRegister() {
  const { risks, updateRisk, deleteRisk, addRisk, addRisks, addIssue, projects, programmes, activeProjectId, activeProgrammeId, user, addNotification, updateProject, updateProgramme } = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromInitiation = searchParams.get('from') === 'initiation';
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
  const canModify = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
  const progLevelLabel = isPM ? 'Shared Portfolio' : 'Programme Level';
  const scopedProjects = activeProgrammeId
    ? (Array.isArray(projects) ? projects : []).filter(p => p.programmeId === activeProgrammeId)
    : (Array.isArray(projects) ? projects : []);

  const [filter, setFilter] = useState({
    project: '',   // '' = All (within current context)
    status: '',
    category: '',
    workstream: '',
    search: ''
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);

  // When context or filter changes, reset selection
  useEffect(() => {
    setFilter(f => ({ ...f, project: '' }));
    setSelectedIds([]);
  }, [activeProjectId, activeProgrammeId]);

  // Handle URL-based actions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add-risk') {
      setEditingRisk(null);
      setIsModalOpen(true);
      // Clean up param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = (Array.isArray(risks) ? risks : []).filter(r => {
    // --- Context scope ---
    if (activeProjectId) {
      // Viewing a specific project — only show its risks
      if (r.projectId !== activeProjectId) return false;
    } else if (activeProgrammeId) {
      // Viewing a programme — show risks in this programme
      if (r.programmeId !== activeProgrammeId) {
        // Fallback: include risks whose project belongs to this programme
        const rProject = (Array.isArray(projects) ? projects : []).find(p => p.id === r.projectId);
        if (!rProject || rProject.programmeId !== activeProgrammeId) return false;
      }
    }

    // --- Local filter bar (only relevant when at programme level, not project level) ---
    if (!activeProjectId && filter.project) {
      if (filter.project === progLevelLabel) {
        // Only show risks not assigned to any project (programme-level risks)
        if (r.projectId) return false;
      } else {
        // Filter to a specific project
        if (r.projectId !== filter.project) return false;
      }
    }

    if (filter.status && r.status !== filter.status) return false;
    if (filter.category && r.category !== filter.category) return false;
    if (filter.workstream && r.workstream !== filter.workstream) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!r.title?.toLowerCase().includes(q) && !r.id?.toLowerCase().includes(q) && !r.workstream?.toLowerCase().includes(q) && !r.desc?.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
    const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    return (b.id || '').localeCompare(a.id || '');
  });

  const toggleEscalate = (id: string, current: boolean) => {
    if (!canModify) return;
    const isEscalating = !current;
    updateRisk(id, { escalated: isEscalating, isNew: false });
    
    if (isEscalating) {
      const risk = risks.find(r => r.id === id);
      const proj = projects.find(p => p.id === risk?.projectId);
      const prog = programmes.find(p => p.id === (risk?.programmeId || proj?.programmeId));
      
      addNotification({
        title: 'Risk Escalated to Programme',
        body: `Risk ${id} ("${risk?.title}") has been escalated from project "${proj?.name || 'Unknown'}" to programme "${prog?.name || 'General'}".`,
        type: 'risk',
        projectId: proj?.id,
        programmeId: prog?.id
      });
    }
  };

  const handleConvertToIssue = (id: string) => {
    if (!canModify) return;
    if (window.confirm(`Convert risk ${id} to an issue? This will close the risk and generate a standardized Issue ID.`)) {
      useStore.getState().convertToIssue(id);
      addNotification({ title: 'Issue Created', body: `Issue generated successfully from risk.`, type: 'issue' });
    }
  };

  const activeProgName = (Array.isArray(programmes) ? programmes : []).find(p => p.id === activeProgrammeId)?.name;
  const activeProjName = (Array.isArray(projects) ? projects : []).find(p => p.id === activeProjectId)?.name;
  const contextLabel = activeProjName || activeProgName || 'All Risks';

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) return;

      const newRisks: any[] = json.map((row: any) => ({
        id: generateId('R-IMP'),
        title: row.Title || row.Risk || 'Imported Risk',
        desc: row.Description || row.Desc || '',
        owner: row.Owner || '',
        category: row.Category || 'Compliance',
        workstream: row.Workstream || 'General',
        grossL: parseInt(row.Likelihood) || 3,
        grossI: parseInt(row.Impact) || 3,
        residualL: parseInt(row.ResidualLikelihood) || 2,
        residualI: parseInt(row.ResidualImpact) || 2,
        status: 'Open',
        dateAdded: new Date().toISOString().slice(0, 10),
        projectId: activeProjectId || '',
        programmeId: activeProgrammeId || '',
        isProgrammeLevel: !activeProjectId && !!activeProgrammeId,
        escalated: false
      }));

      if (newRisks.length > 0) {
        addRisks(newRisks);
        addNotification({ title: 'Risks Imported', body: `Successfully imported ${newRisks.length} risks.`, type: 'risk' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const downloadCSVTemplate = () => {
    const headers = ["Title", "Description", "Category", "Owner", "Likelihood", "Impact", "ResidualLikelihood", "ResidualImpact", "Workstream"];
    const worksheet = XLSX.utils.json_to_sheet([headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "risk_import_template.xlsx");
  };

  const handleRestartAnalysis = async () => {
    const confirm = window.confirm("Restart AI Risk Analysis? This will reset your progress and allow you to re-run the AI discovery questions. Existing risks will NOT be deleted automatically.");
    if (!confirm) return;

    if (activeProjectId) {
      await updateProject(activeProjectId, { riskSetupDone: false });
    } else if (activeProgrammeId) {
      await updateProgramme(activeProgrammeId, { riskSetupDone: false });
    }
    
    navigate(`/risk/setup${activeProjectId ? `?projectId=${activeProjectId}` : activeProgrammeId ? `?programmeId=${activeProgrammeId}` : ''}${fromInitiation ? '&from=initiation' : ''}`);
  };

  const handleBulkDelete = () => {
    if (!canDelete || selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected risks?`)) {
      selectedIds.forEach(id => deleteRisk(id));
      setSelectedIds([]);
      addNotification({ 
        title: 'Risks Deleted', 
        body: `Successfully deleted ${selectedIds.length} risks.`, 
        type: 'risk' 
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <>
      <ServiceManagementBar />
      <div className="max-w-[98%] mx-auto space-y-6 sm:space-y-8 p-2 sm:p-4 lg:p-6">

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: filtered.length, color: 'text-indigo-600', border: 'border-l-indigo-500' },
          { label: 'Open', value: filtered.filter(r => r.status === 'Open').length, color: 'text-red-600', border: 'border-l-red-500' },
          { label: 'High/Severe', value: filtered.filter(r => r.residualRating >= 16).length, color: 'text-red-700', border: 'border-l-red-700' },
          { label: 'Escalated', value: filtered.filter(r => r.escalated).length, color: 'text-amber-600', border: 'border-l-amber-500' },
          {
            label: 'Residual ALE',
            value: (() => {
              const total = filtered.reduce((s, r) => s + (r.residualALE || 0), 0);
              return total >= 1000000 ? `£${(total / 1000000).toFixed(1)}m` : total >= 1000 ? `£${Math.round(total / 1000)}k` : fGBP(Math.round(total));
            })(),
            color: 'text-slate-700', border: 'border-l-slate-400'
          },
        ].map(s => (
          <div key={s.label} className={clsx('bg-white rounded-xl border border-slate-200 border-l-4 px-4 py-3 shadow-sm', s.border)}>
            <div className={clsx('text-xl font-extrabold', s.color)}>{s.value}</div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Project filter — only show when at programme level (not locked to a project) */}
        {!activeProjectId && (
          <select
            value={filter.project}
            onChange={e => setFilter({ ...filter, project: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500 min-w-[180px] w-full sm:w-auto"
          >
            <option value="">All Projects</option>
             <option value={progLevelLabel}>{isPM ? 'Shared Portfolio Items' : 'Programme Level Only'}</option>
            <optgroup label="Projects">
              {scopedProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          </select>
        )}
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto">
          <option value="">All Status</option>
          {RISK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filter.workstream} onChange={e => setFilter({ ...filter, workstream: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto">
          <option value="">All Workstreams</option>
          {WORKSTREAMS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <input type="search" placeholder="Search risks..." value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          className="w-full sm:flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
      </div>

      {/* Full Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left text-[11px] border-collapse min-w-[1700px]">
          <thead>
            {/* Group row */}
            <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 uppercase tracking-[0.15em] text-[10px] font-black">
              <th className="px-3 py-2" colSpan={activeProjectId ? 6 : 7}></th>
              <th className="px-3 py-2 text-center border-x border-slate-200 bg-rose-50/50 text-rose-700" colSpan={3}>Gross Risk Rating</th>
              <th className="px-3 py-2" colSpan={2}></th>
              <th className="px-3 py-2 text-center border-x border-slate-200 bg-emerald-50/50 text-emerald-700" colSpan={3}>Residual Risk Rating</th>
              <th className="px-3 py-2" colSpan={4}></th>
              <th className="px-3 py-2 text-center border-x border-slate-200 bg-blue-50/50 text-blue-700" colSpan={3}>Gross ALE</th>
              <th className="px-3 py-2 text-center border-x border-slate-200 bg-indigo-50/50 text-indigo-700" colSpan={3}>Residual ALE</th>
              <th className="px-3 py-2" colSpan={4}></th>
            </tr>
            {/* Column headers */}
            <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider border-b border-slate-200 text-[9px] font-bold sticky top-0 z-10 backdrop-blur-sm">
              <th className="px-3 py-3 w-10 text-center sticky left-0 bg-slate-50 border-r border-slate-100 z-20">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-3 py-3 whitespace-nowrap">Ref</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Workstream</th>
              <th className="px-3 py-3 whitespace-nowrap">Linked KRI</th>
              <th className="px-3 py-3 whitespace-nowrap">Date Added</th>
              {!activeProjectId && <th className="px-3 py-3 whitespace-nowrap">Source Project</th>}
              <th className="px-3 py-3 min-w-[350px]">Risk Title & Desc <InfoTooltip content="Click ID to open full risk details" /></th>
              {/* Gross */}
              <th className="px-2 py-3 text-center border-l border-slate-200 bg-rose-50/20">L</th>
              <th className="px-2 py-3 text-center bg-rose-50/20">I</th>
              <th className="px-2 py-3 text-center border-r border-slate-200 bg-rose-50/20">Rating</th>
              {/* After Gross */}
              <th className="px-3 py-3 whitespace-nowrap">Response</th>
              <th className="px-3 py-3 whitespace-nowrap">Controls</th>
              {/* Residual */}
              <th className="px-2 py-3 text-center border-l border-slate-200 bg-emerald-50/20">L</th>
              <th className="px-2 py-3 text-center bg-emerald-50/20">I</th>
              <th className="px-2 py-3 text-center border-r border-slate-200 bg-emerald-50/20">Rating</th>
              {/* Post Rating */}
              <th className="px-3 py-3 whitespace-nowrap">Label</th>
              <th className="px-3 py-3 whitespace-nowrap">Appetite</th>
              <th className="px-3 py-3 whitespace-nowrap min-w-[150px]">Further Action</th>
              <th className="px-3 py-3 whitespace-nowrap">Status</th>
              {/* ALE columns */}
              <th className="px-3 py-3 text-right border-l border-slate-200 bg-blue-50/20 whitespace-nowrap">Impact</th>
              <th className="px-3 py-3 text-center bg-blue-50/20 whitespace-nowrap">Prob%</th>
              <th className="px-3 py-3 text-right border-r border-slate-200 bg-blue-50/20 whitespace-nowrap">ALE</th>
              <th className="px-3 py-3 text-right border-l border-slate-200 bg-indigo-50/20 whitespace-nowrap">Impact</th>
              <th className="px-3 py-3 text-center bg-indigo-50/20 whitespace-nowrap">Prob%</th>
              <th className="px-3 py-3 text-right border-r border-slate-200 bg-indigo-50/20 whitespace-nowrap">ALE</th>
              {/* Tail */}
              <th className="px-3 py-3 text-right whitespace-nowrap">Reduction</th>
              <th className="px-3 py-3 text-center text-slate-500 uppercase tracking-tighter text-[9px]">Ind</th>
              <th className="px-3 py-3 whitespace-nowrap">Age</th>
              <th className="px-3 py-3 text-center whitespace-nowrap sticky right-0 bg-slate-50 border-l border-slate-200 z-30 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)] min-w-[130px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => {
              const c = rLabel(r.residualRating);
              const gALE = r.grossALE || 0;
              const rALE = r.residualALE || 0;
              const reduction = (r.grossALE || 0) - (r.residualALE || 0);
              return (
                <tr 
                  key={r.id} 
                  className={clsx(
                    "border-b border-slate-100 transition-colors group relative",
                    r.escalated ? "bg-indigo-50/30 hover:bg-indigo-50/50" : "hover:bg-slate-50/80",
                    selectedIds.includes(r.id) && 'bg-indigo-50/40'
                  )}
                >
                  {r.escalated && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 z-30" />
                  )}
                  <td className="px-3 py-3 text-center sticky left-0 bg-white z-20 border-r border-slate-100 group-hover:bg-slate-50">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelectOne(r.id)}
                    />
                  </td>
                  <td className="px-3 py-3 font-bold text-indigo-600 cursor-pointer hover:underline text-[11px] whitespace-nowrap" onClick={() => {
                    if (canModify) { setEditingRisk(r); setIsModalOpen(true); }
                  }}>{r.id}</td>
                  <td className="px-3 py-3 text-slate-600 max-w-[100px] truncate whitespace-nowrap text-center" title={r.workstream}>{stripMarkdown(r.workstream || '—')}</td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{r.kri || '—'}</td>
                   <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{fDate(r.dateAdded)}</td>
                  {!activeProjectId && (
                    <td className="px-3 py-3 font-bold text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      { (Array.isArray(projects) ? projects : []).find(p => p.id === r.projectId)?.name || 'Programme-Level'}
                    </td>
                  )}
                  <td className="px-3 py-3 font-medium text-slate-800 min-w-[350px] whitespace-normal">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-slate-900 leading-snug text-xs truncate max-w-[400px]" title={stripMarkdown(r.title)}>{stripMarkdown(r.title)}</span>
                        {r.isNew !== false && differenceInDays(new Date(), new Date(r.dateAdded || '')) < 1 && (
                          <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[7px] font-black uppercase rounded shadow-sm">New</span>
                        )}
                        {!r.owner && <AlertCircle className="w-3 h-3 text-rose-500" title="Missing Owner" />}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal leading-relaxed" title={stripMarkdown(r.desc)}>{stripMarkdown(r.desc)}</span>
                    </div>
                  </td>

                  {/* Gross */}
                  <td className="px-2 py-3 text-center border-l border-slate-100 bg-rose-50/5">
                    <div className={clsx('inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black border', rsScore(r.grossRating))}>
                      {r.grossL}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center bg-rose-50/5">
                    <div className={clsx('inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black border', rsScore(r.grossRating))}>
                      {r.grossI}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-100 bg-rose-50/5">
                    <div className={clsx('inline-flex items-center justify-center w-7 h-7 rounded text-[12px] font-black border flex-col leading-none shadow-sm', rsScore(r.grossRating))}>
                      <span>{r.grossRating}</span>
                    </div>
                  </td>

                  <td className="px-3 py-3 text-slate-600 max-w-[100px] truncate italic whitespace-nowrap" title={r.response}>{stripMarkdown(r.response || '—')}</td>
                  <td className="px-3 py-3 text-slate-600 max-w-[150px] truncate whitespace-nowrap" title={r.controls}>
                    <div className="flex items-center gap-2">
                      {!r.controls && <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />}
                      <span className="truncate">{stripMarkdown(r.controls)?.split('\n')[0] || '—'}</span>
                    </div>
                  </td>

                  {/* Residual */}
                  <td className="px-2 py-3 text-center border-l border-slate-100 bg-emerald-50/5">
                    <div className={clsx('inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black border', rsScore(r.residualRating))}>
                      {r.residualL}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center bg-emerald-50/5">
                    <div className={clsx('inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black border', rsScore(r.residualRating))}>
                      {r.residualI}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center border-r border-slate-100 bg-emerald-50/5">
                    <div className={clsx('inline-flex items-center justify-center w-7 h-7 rounded text-[12px] font-black border flex-col leading-none shadow-sm', rsScore(r.residualRating))}>
                      <span>{r.residualRating}</span>
                    </div>
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap"><span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold border', c.c)}>{c.l}</span></td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap font-medium text-[10px] uppercase tracking-tighter">{stripMarkdown(r.appetite || '—')}</td>
                  <td className="px-3 py-3 text-slate-500 min-w-[150px] whitespace-normal leading-relaxed text-[10px]">{stripMarkdown(r.furtherAction) || '—'}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>

                  {/* Gross ALE */}
                  <td className="px-3 py-3 text-right border-l border-slate-100 text-slate-600 whitespace-nowrap font-medium">{fGBP(r.grossImpact)}</td>
                  <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap font-medium">{probDisplay(r.grossProb)}</td>
                  <td className="px-3 py-3 text-right border-r border-slate-100 font-bold text-slate-900 whitespace-nowrap">{fGBP(Math.round(gALE))}</td>

                  {/* Residual ALE */}
                  <td className="px-3 py-3 text-right border-l border-slate-100 text-slate-600 whitespace-nowrap font-medium">{fGBP(r.residualImpact)}</td>
                  <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap font-medium">{probDisplay(r.residualProb)}</td>
                  <td className="px-3 py-3 text-right border-r border-slate-100 font-bold text-indigo-600 whitespace-nowrap">{fGBP(Math.round(rALE))}</td>

                  <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">{reduction > 0 ? fGBP(Math.round(reduction)) : '—'}</td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex flex-col gap-1.5 items-center">
                      {r.escalated && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-rose-200/50 uppercase tracking-wider">
                          <Flag className="w-2.5 h-2.5 fill-current" /> ESC
                        </span>
                      )}
                      {r.convertedToIssue && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-amber-200/50 uppercase tracking-wider">
                          <AlertTriangle className="w-2.5 h-2.5 fill-current" /> ISSUE
                        </span>
                      )}
                      {!r.escalated && !r.convertedToIssue && (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-400 whitespace-nowrap font-medium">{ageCalc(r.dateAdded, r.status)}</td>
                   <td className="px-3 py-3 sticky right-0 bg-white z-10 border-l border-slate-200 group-hover:bg-slate-50/80 backdrop-blur-sm shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)] min-w-[130px]">
                    <div className="flex items-center gap-1 justify-center">
                      {canModify && (
                        <>
                          <button onClick={() => { setEditingRisk(r); setIsModalOpen(true); }}
                            className="w-6 h-6 flex items-center justify-center bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm" title="Edit">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => toggleEscalate(r.id, r.escalated)}
                            className={clsx('w-6 h-6 flex items-center justify-center rounded-lg border transition-all shadow-sm',
                              r.escalated 
                                ? 'bg-slate-900 text-white border-slate-900' 
                                : 'bg-white text-orange-600 border-orange-100 hover:bg-orange-50')} title={r.escalated ? 'De-escalate' : 'Escalate to Programme'}>
                            <Flag className={clsx("w-3 h-3", r.escalated ? "fill-current" : "")} />
                          </button>
                          {!r.convertedToIssue && r.status !== 'Closed' && (
                            <button onClick={() => handleConvertToIssue(r.id)}
                            className="w-6 h-6 flex items-center justify-center bg-white text-amber-500 border border-amber-100 rounded-lg hover:bg-amber-50 transition-all shadow-sm" title="Move to Issue">
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      )}
                      {canDelete && (
                        <button onClick={() => {
                          if (window.confirm(`Are you sure you want to delete risk ${r.id}?`)) {
                            deleteRisk(r.id);
                          }
                        }} className="w-6 h-6 flex items-center justify-center bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors shadow-sm" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState title="No risks found matching your filters." />
        )}
      </div>

      <RiskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(d) => {
          if (editingRisk) { updateRisk(editingRisk.id, { ...d, isNew: false }); }
          else {
            const newId = generateId('R');
            const newRisk: RiskItem = { 
              ...d, 
              id: newId, 
              dateAdded: new Date().toISOString().split('T')[0],
              isNew: true 
            } as RiskItem;
            addRisk(newRisk);
          }
        }}
        initialData={editingRisk}
      />
    </div>
    </>
  );
}

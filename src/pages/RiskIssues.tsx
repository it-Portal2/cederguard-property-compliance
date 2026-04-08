import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore, IssueItem } from '../store/useStore';
import { isAtLeastPM, isAtLeastClientAdmin, isSuperAdmin, UserRole } from '../lib/roles';
import { ISSUE_STATUSES, ISSUE_RESPONSES } from '../data/riskData';
import { clsx } from 'clsx';
import { generateId } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { InfoTooltip } from '../components/InfoTooltip';
import { Trash2, Edit2, Info, Lightbulb, TrendingUp, AlertCircle, ShieldOff, CheckCircle2, ArrowLeft, ArrowRight, ScanSearch, FileSpreadsheet, Download } from 'lucide-react';
import { IssueModal } from '../components/IssueModal';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import * as XLSX from 'xlsx';

const EmptyState = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2 opacity-60">
    <ShieldOff className="w-8 h-8" />
    <p className="text-xs font-medium">{title}</p>
  </div>
);

function iScore(p: number | string, s: number | string) {
  const map: Record<string, number> = { 'Low': 1, 'Medium': 3, 'High': 5, 'Critical': 10 };
  const pv = typeof p === 'number' ? p : (map[p] || 1);
  const sv = typeof s === 'number' ? s : (map[s] || 1);
  const v = pv * sv;
  if (v >= 20) return { l: 'Critical', c: 'bg-red-900 text-white border-red-900' };
  if (v >= 12) return { l: 'High', c: 'bg-red-100 text-red-800 border-red-200' };
  if (v >= 8) return { l: 'Medium', c: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { l: 'Low', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

function fDate(d?: string) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yy'); } catch { return d; }
}

function ageCalc(d?: string, status?: string) {
  if (!d || status === '4. Resolved') return '—';
  try { return differenceInDays(new Date(), new Date(d)) + 'd'; } catch { return '—'; }
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === '4. Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      status === '2. Escalated' ? 'bg-red-100 text-red-700 border-red-200' :
        status === '3. Implementing Fix' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          status === '1. Investigating' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap', cls)}>{status}</span>;
}

export function RiskIssues() {
  const { issues, deleteIssue, addIssue, updateIssue, activeProjectId, activeProgrammeId, programmes, projects, user } = useStore();
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get('from') === 'initiation';
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
  const canModify = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
  const progLevelLabel = isPM ? 'Shared Portfolio' : 'Programme Level';

  const [filter, setFilter] = useState({ project: activeProjectId || 'All Projects', status: '', priority: '', search: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(i => i.id));
    }
  };
  const toggleSelectOne = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulkDelete = () => {
    if (!canDelete || selectedIds.length === 0) return;
    if (window.confirm(`Delete ${selectedIds.length} selected issues?`)) {
      selectedIds.forEach(id => deleteIssue(id));
      setSelectedIds([]);
    }
  };

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

      const newIssues: any[] = json.map((row: any) => ({
        id: generateId('ISS-IMP'),
        desc: row.Description || row.Issue || 'Imported Issue',
        owner: row.Owner || '',
        category: row.Category || 'General',
        priority: parseInt(row.Priority) || 3,
        severity: parseInt(row.Severity) || 3,
        status: '1. Investigating',
        dateAdded: new Date().toISOString().slice(0, 10),
        projectId: activeProjectId || '',
        programmeId: activeProgrammeId || ''
      }));

      if (newIssues.length > 0) {
        newIssues.forEach(i => addIssue(i));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const downloadCSVTemplate = () => {
    const headers = ["Issue", "Description", "Category", "Owner", "Priority", "Severity"];
    const worksheet = XLSX.utils.json_to_sheet([headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "issue_import_template.xlsx");
  };

  const activeProjName = (Array.isArray(projects) ? projects : []).find(p => p.id === activeProjectId)?.name;

  useEffect(() => {
    if (activeProjectId) {
      setFilter(f => ({ ...f, project: activeProjectId }));
    } else {
      setFilter(f => ({ ...f, project: 'All Projects' }));
    }
  }, [activeProjectId]);

  // Handle URL-based actions from ServiceManagementBar
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add-issue') {
      setEditingIssue(null);
      setIsModalOpen(true);
      // Clean up URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`);
    }
  }, [searchParams]);

  const safeIssues = Array.isArray(issues) ? issues : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const filtered = safeIssues.filter(i => {
    // If we have an active project or programme, filter by them first
    if (activeProjectId && i.projectId !== activeProjectId) return false;
    if (!activeProjectId && activeProgrammeId && i.programmeId !== activeProgrammeId) return false;

    if (filter.project === progLevelLabel && !!i.projectId) return false;
    if (filter.project !== 'All Projects' && filter.project !== progLevelLabel && i.projectId !== filter.project) return false;
    if (filter.status && i.status !== filter.status) return false;
    if (filter.priority && i.priority.toString() !== filter.priority) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!i.desc?.toLowerCase().includes(q) && !i.id?.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // Sort by dateAdded descending, then by id descending
    const dateA = new Date(a.dateAdded || 0).getTime();
    const dateB = new Date(b.dateAdded || 0).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return b.id.localeCompare(a.id);
  });

  // Insights for the Advisory Panel
  const openIssues = safeIssues.filter(i => i.status !== '4. Resolved');
  const escalatedIssues = safeIssues.filter(i => i.status === '2. Escalated');
  const avgAge = openIssues.length
    ? Math.round(openIssues.reduce((acc, i) => acc + differenceInDays(new Date(), new Date(i.dateAdded)), 0) / openIssues.length)
    : 0;

  return (
    <>
      <ServiceManagementBar />
      <div className="max-w-[98%] lg:max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 space-y-5 sm:space-y-6">
        {/* Hidden File Input for ServiceManagementBar integration if needed, 
            though usually it would be triggered from the bar. 
            Keeping local input hidden for compatibility with existing local logic if any. */}
        <input
          type="file"
          id="issue-file-import"
          className="hidden"
          accept=".csv, .xlsx, .xls"
          onChange={handleFileImport}
        />

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: safeIssues.length, color: 'text-indigo-600', border: 'border-l-indigo-500' },
          { label: 'Open', value: safeIssues.filter(i => i.status !== '4. Resolved').length, color: 'text-red-600', border: 'border-l-red-500' },
          { label: 'Escalated', value: safeIssues.filter(i => i.status === '2. Escalated').length, color: 'text-orange-600', border: 'border-l-orange-500' },
          { label: 'Implementing Fix', value: safeIssues.filter(i => i.status === '3. Implementing Fix').length, color: 'text-blue-600', border: 'border-l-blue-500' },
          { label: 'Resolved', value: safeIssues.filter(i => i.status === '4. Resolved').length, color: 'text-emerald-600', border: 'border-l-emerald-500' },
        ].map(s => (
          <div key={s.label} className={clsx('bg-white rounded-xl border border-slate-200 border-l-4 px-4 py-3 shadow-sm hover:shadow-md transition-shadow', s.border)}>
            <div className={clsx('text-xl font-extrabold', s.color)}>{s.value}</div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Advisory Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-indigo-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                <Lightbulb className="w-5 h-5 text-indigo-200" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-200">Issue Advisory</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xl font-bold">{escalatedIssues.length > 0 ? `${escalatedIssues.length} Escalated Issues` : 'No Critical Escalations'}</p>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  {escalatedIssues.length > 0
                    ? "Immediate management attention required for escalated items to prevent project delays."
                    : "Issue management is currently within normal operating parameters."}
                </p>
              </div>
              <div className="space-y-1 sm:border-l sm:border-indigo-800 sm:pl-4">
                <p className="text-xl font-bold">{avgAge}d Average Age</p>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  {avgAge > 14
                    ? "Resolution cycle time is exceeding 14 days. Review bottleneck in 'Implementing Fix' stage."
                    : "Resolution cycle is healthy. Continue proactive monitoring of investigations."}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attention Required</h3>
          </div>
          <div className="space-y-3">
            {openIssues.slice(0, 2).map(iss => (
              <div key={iss.id} className="border-l-2 border-amber-500 pl-3 py-1">
                <p className="text-xs font-bold text-slate-800 truncate" title={iss.id}>{iss.id}</p>
                <p className="text-[10px] text-slate-500 line-clamp-1" title={iss.desc}>{iss.desc}</p>
              </div>
            ))}
            {openIssues.length === 0 && <p className="text-xs text-slate-400 italic">No open issues requiring immediate action.</p>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <select value={filter.project} onChange={e => setFilter({ ...filter, project: e.target.value })}
          disabled={!!activeProjectId}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto">
          <option value="All Projects">All Projects</option>
          {activeProgrammeId && !activeProjectId && <option value={progLevelLabel}>{progLevelLabel}</option>}
          {safeProjects
            .filter(p => !activeProgrammeId || p.programmeId === activeProgrammeId)
            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto">
          <option value="">All Status</option>
          {ISSUE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.priority} onChange={e => setFilter({ ...filter, priority: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto">
          <option value="">All Priority</option>
          {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Priority {p}</option>)}
        </select>
        <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto">
          <option value="">Issue Data</option>
          <option value="critical">Critical</option>
          <option value="overdue">Overdue</option>
        </select>
        <input type="search" placeholder="Search issues..." value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          className="w-full sm:flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
      </div>

      {/* Full Issues Log Table — matching Excel columns */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left text-[11px] border-collapse min-w-[1400px]">
          <thead>
            <tr className="bg-[#111827] text-white uppercase tracking-[0.15em] border-b border-slate-200 text-[9px] font-black sticky top-0 z-20 backdrop-blur-md">
              <th className="p-4 w-8 text-center">
                <input type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-4 whitespace-nowrap">Issue Ref</th>
              <th className="p-4 whitespace-nowrap">Risk Ref</th>
              <th className="p-4">Date Added</th>
              <th className="p-4">Issue Description & Impact</th>
              <th className="p-4">Issue Owner</th>
              <th className="p-4 text-center">P <InfoTooltip content="Priority (1-5)" /></th>
              <th className="p-4 text-center">S <InfoTooltip content="Severity (1-5)" /></th>
              <th className="p-4">Score</th>
              <th className="p-4">Issue Response</th>
              <th className="p-4">Response Description</th>
              <th className="p-4">Control Owner</th>
              <th className="p-4">Progress Updates</th>
              <th className="p-4">Date Updated</th>
              <th className="p-4">Control Deadline</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Age</th>
              <th className="p-4 text-center">Lessons Learnt</th>
              <th className="p-4 text-right sticky right-0 bg-[#111827] z-20 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.5)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(iss => {
              const sc = iScore(iss.priority, iss.severity);
              return (
                <tr key={iss.id} className={clsx('hover:bg-slate-50/80 transition-all group border-b border-slate-100', selectedIds.includes(iss.id) && 'bg-indigo-50/40')}>
                  <td className="p-2 text-center">
                    <input type="checkbox"
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.includes(iss.id)}
                      onChange={() => toggleSelectOne(iss.id)}
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap" onClick={() => {
                    if (canModify) {
                      setEditingIssue(iss);
                      setIsModalOpen(true);
                    }
                  }}>
                    <div className="font-bold text-indigo-600 cursor-pointer hover:underline">{iss.id}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">
                      {!iss.projectId ? progLevelLabel : safeProjects.find(p => p.id === iss.projectId)?.name || 'Project Issue'}
                    </div>
                  </td>
                  <td className="p-2 text-indigo-400 font-medium">{iss.linkedRisk || '—'}</td>
                  <td className="p-2 text-slate-400">{fDate(iss.dateAdded)}</td>
                  <td className="p-2 font-medium text-slate-800 max-w-[200px] truncate" title={iss.desc}>{iss.desc}</td>
                  <td className="p-2 text-slate-600">{iss.owner || '—'}</td>
                  <td className="p-2 text-center font-bold text-slate-700">{iss.priority}</td>
                  <td className="p-2 text-center font-bold text-slate-700">{iss.severity}</td>
                  <td className="p-2"><span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', sc.c)}>{sc.l}</span></td>
                  <td className="p-2 text-slate-500">{(iss as any).response || '—'}</td>
                  <td className="p-2 text-slate-500 max-w-[130px] truncate" title={(iss as any).responsDesc}>{(iss as any).responsDesc?.split('\n')[0] || '—'}</td>
                  <td className="p-2 text-slate-500">{(iss as any).controlOwner || '—'}</td>
                  <td className="p-2 text-slate-500 max-w-[140px] truncate" title={(iss as any).progress}>{(iss as any).progress?.split('\n')[0] || '—'}</td>
                  <td className="p-2 text-slate-400">{fDate((iss as any).dateUpdated)}</td>
                  <td className="p-2 text-slate-500">{fDate(iss.deadline)}</td>
                  <td className="p-2"><StatusBadge status={iss.status} /></td>
                  <td className="p-2 text-center text-slate-400">{ageCalc(iss.dateAdded, iss.status)}</td>
                  <td className="p-2 text-center">
                    {(iss as any).lessonsLearnt
                      ? <span className="flex items-center justify-center text-emerald-600" title="Lessons Learnt Captured">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className="p-2 text-right sticky right-0 bg-white z-10 border-l border-slate-100 group-hover:bg-slate-50/80 backdrop-blur-sm shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center justify-end gap-2">
                      {canModify && (
                        <button onClick={() => { setEditingIssue(iss); setIsModalOpen(true); }}
                          className="text-slate-400 hover:text-indigo-600 transition-colors" title="Edit Issue">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => {
                          if (window.confirm(`Are you sure you want to delete issue ${iss.id}?`)) {
                            deleteIssue(iss.id);
                          }
                        }}
                          className="text-slate-400 hover:text-red-500 transition-colors" title="Delete Issue">
                          <Trash2 className="w-3.5 h-3.5" />
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
          <EmptyState title="No issues found matching your filters." />
        )}
      </div>

      <IssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(issueData) => {
          if (editingIssue) {
            updateIssue(editingIssue.id, issueData);
          } else {
            const newIssue: IssueItem = {
              ...issueData,
              id: generateId('ISS'),
              dateAdded: new Date().toISOString().split('T')[0]
            } as IssueItem;
            addIssue(newIssue);
          }
        }}
        initialData={editingIssue}
      />

      <AIInquiryPopup 
        isOpen={isAIInquiryOpen} 
        onClose={() => setIsAIInquiryOpen(false)} 
        context="Issue Management"
      />
    </div>
    </>
  );
}

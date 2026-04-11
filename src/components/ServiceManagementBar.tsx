import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Settings,
  RefreshCw,
  History,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
  Layout,
  Briefcase,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';

export const ServiceManagementBar: React.FC<{ className?: string }> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const {
    activeProject,
    activeProgramme,
    canManageContext,
    projects,
    programmes,
    setActiveProject,
    setActiveProgramme,
    complianceItems,
    risks,
    issues,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isProject = !!activeProject;
  const context = activeProject || activeProgramme;

  if (!context) return null;

  const canManage = canManageContext();
  const name = isProject ? activeProject?.name : activeProgramme?.name;
  const reference = isProject ? activeProject?.reference : activeProgramme?.reference;
  const type = isProject ? 'Project' : 'Programme';

  const lastRiskRun = context.lastRiskRun;
  const lastComplianceRun = context.lastComplianceRun;

  // Task #3 — correct routes for both project and programme
  const handleEditProfile = () => {
    if (isProject) {
      // ProjectInitiation reads activeProjectId from the store — no id param needed
      navigate('/project/initiation');
    } else {
      // ProgrammeInitiation reads id from useParams via /programmes/edit/:id
      navigate(`/programmes/edit/${activeProgramme!.id}`);
    }
  };

  // Task #4 — compliance setup with restart flag
  const handleRerunCompliance = () => {
    navigate(
      `/compliance/setup?type=${isProject ? 'project' : 'programme'}&restart=true`
    );
  };


  // Detect which page we're on to make export context-aware
  const isRiskPage       = pathname.startsWith('/risk');
  const isTrackerPage    = pathname === '/compliance/tracker';
  const isCompliancePage = pathname.startsWith('/compliance') && !isTrackerPage;

  const exportLabel = isExporting
    ? 'Exporting...'
    : isRiskPage
    ? 'Export Risk Data (Excel)'
    : isTrackerPage
    ? 'Export Tracker Data (Excel)'
    : isCompliancePage
    ? 'Export Compliance Data (Excel)'
    : 'Export Data (Excel)';

  const exportDescription = isRiskPage
    ? 'Download all risk register data as .xlsx.'
    : isTrackerPage
    ? 'Download compliance tracker data as .xlsx.'
    : isCompliancePage
    ? 'Download compliance items as .xlsx.'
    : 'Download compliance, risk and issue data as .xlsx.';

  // Task #6 — real Excel export, page-aware
  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setIsOpen(false);
    try {
      const contextId = isProject ? activeProject?.id : activeProgramme?.id;
      const wb = XLSX.utils.book_new();

      const ctxCompliance = (Array.isArray(complianceItems) ? complianceItems : []).filter((c) =>
        isProject ? c.projectId === contextId : c.programmeId === contextId
      );
      const ctxRisks = (Array.isArray(risks) ? risks : []).filter((r) =>
        isProject ? r.projectId === contextId : r.programmeId === contextId
      );
      const ctxIssues = (Array.isArray(issues) ? issues : []).filter((i) =>
        isProject ? i.projectId === contextId : i.programmeId === contextId
      );

      // ── Risk-only export ────────────────────────────────────────────────
      if (isRiskPage) {
        const rows = ctxRisks.map((r) => ({
          'Ref': r.id,
          'Workstream': r.workstream || '—',
          'Linked KRI': r.kri || '—',
          'Date Added': r.dateAdded ? new Date(r.dateAdded).toLocaleDateString() : '—',
          'Risk Title': r.title || '',
          'Risk Desc': r.desc || '',
          'Gross L': r.grossL ?? '',
          'Gross I': r.grossI ?? '',
          'Gross Rating': r.grossRating ?? '',
          'Response': r.response || '—',
          'Controls': r.controls || '—',
          'Residual L': r.residualL ?? '',
          'Residual I': r.residualI ?? '',
          'Residual Rating': r.residualRating ?? '',
          'Appetite': r.appetite || '—',
          'Further Action': r.furtherAction || '—',
          'Status': r.status || '',
          'Gross Impact (£)': r.grossImpact || 0,
          'Gross ALE (£)': Math.round(r.grossALE || 0),
          'Residual Impact (£)': r.residualImpact || 0,
          'Residual ALE (£)': Math.round(r.residualALE || 0),
          'Reduction (£)': Math.round((r.grossALE || 0) - (r.residualALE || 0)),
          'Indicator': r.escalated ? 'ESC' : r.convertedToIssue ? 'ISSUE' : '—',
          'Owner': r.owner || '',
          'Escalated': r.escalated ? 'Yes' : 'No',
        }));
        if (rows.length > 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Risk Register');
        } else {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Note: 'No risk data for this context.' }]), 'Risk Register');
        }

      // ── Tracker / Compliance-only export ────────────────────────────────
      } else if (isTrackerPage || isCompliancePage) {
        const rows = ctxCompliance.map((c) => ({
          'ID': c.id,
          'Regulation': c.reg || '',
          'Domain': c.domain || '',
          'Requirement': c.req || '',
          'Stage': (c as any).stage || 'Not Started',
          'Status': c.status || 'applicable',
          'Risk Level': c.risk || 'Medium',
          'Authority': (c as any).auth || '',
          'Trigger': (c as any).trigger || '',
        }));
        if (rows.length > 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), isTrackerPage ? 'Compliance Tracker' : 'Compliance Items');
        } else {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Note: 'No compliance data for this context.' }]), 'Compliance Items');
        }

      // ── Full multi-sheet export (all other pages) ────────────────────────
      } else {
        if (ctxCompliance.length > 0) {
          const rows = ctxCompliance.map((c) => ({
            'ID': c.id,
            'Regulation': c.reg || '',
            'Domain': c.domain || '',
            'Requirement': c.req || '',
            'Stage': (c as any).stage || 'Not Started',
            'Status': c.status || 'applicable',
            'Risk Level': c.risk || 'Medium',
            'Authority': (c as any).auth || '',
            'Trigger': (c as any).trigger || '',
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Compliance Items');
        }
        if (ctxRisks.length > 0) {
          const rows = ctxRisks.map((r) => ({
            'ID': r.id,
            'Title': r.title || '',
            'Category': r.category || '',
            'Workstream': r.workstream || '',
            'Status': r.status || '',
            'Gross Likelihood': r.grossL ?? '',
            'Gross Impact': r.grossI ?? '',
            'Gross Rating': r.grossRating ?? (r.grossL && r.grossI ? r.grossL * r.grossI : ''),
            'Owner': r.owner || '',
            'Due Date': r.dueDate || '',
            'Escalated': r.escalated ? 'Yes' : 'No',
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Risk Register');
        }
        if (ctxIssues.length > 0) {
          const rows = ctxIssues.map((i) => ({
            'ID': i.id,
            'Title': (i as any).title || i.desc?.substring(0, 60) || '',
            'Description': i.desc || '',
            'Status': i.status || '',
            'Impact': i.impact || '',
            'Owner': i.owner || '',
            'Priority': i.priority ?? '',
            'Deadline': (i as any).deadline || '',
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Issues');
        }
        if (ctxCompliance.length === 0 && ctxRisks.length === 0 && ctxIssues.length === 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet([{ Note: 'No data available for this context yet.' }]),
            'Summary'
          );
        }
      }

      const fileName = `${(name || 'CedarGuard').replace(/\s+/g, '_')}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  // Tasks #1 (removed New Programme, New Project, Add Requirement)
  // Task #2 (Add Risk → risk register)
  // Task #4 (Re-run AI Analysis → compliance setup)
  // Task #5 (Download Templates commented out)
  const actions = [
    {
      label: 'Add Risk',
      icon: AlertCircle,
      onClick: () => navigate(isProject ? '/risk/register' : '/risk/programme-register'),
      description: 'Go to the risk register to log a new risk.',
      category: 'Context Actions',
    },
    {
      label: 'Edit Profile',
      icon: Settings,
      onClick: handleEditProfile,
      description: `Modify ${type.toLowerCase()} metadata and parameters.`,
      category: 'Context Actions',
    },
    {
      label: 'Re-run AI Analysis',
      icon: RefreshCw,
      onClick: handleRerunCompliance,
      description: 'Restart compliance setup and re-run AI analysis.',
      category: 'Context Actions',
    },
    {
      label: isExporting ? 'Exporting...' : exportLabel,
      icon: isExporting ? Loader2 : FileSpreadsheet,
      onClick: handleExportExcel,
      description: exportDescription,
      category: 'Data Tools',
    },
    // Download Templates — available in a future release
    // {
    //   label: 'Download Templates',
    //   icon: FileDown,
    //   onClick: () => {},
    //   description: 'Access standardized management frameworks.',
    //   category: 'Data Tools',
    // },
  ];

  // Group actions by category
  const groupedActions = actions.reduce(
    (acc, action) => {
      if (!acc[action.category]) acc[action.category] = [];
      acc[action.category].push(action);
      return acc;
    },
    {} as Record<string, typeof actions>
  );

  return (
    <div className={`sticky top-0 z-30 w-full px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500${className ? ` ${className}` : ''}`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

        {/* Left: Context Identity */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center shadow-inner shrink-0',
              isProject ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
            )}
          >
            {isProject ? <Briefcase className="w-5 h-5" /> : <Layout className="w-5 h-5" />}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <div className="relative group">
                <select
                  value={isProject ? activeProject?.id : activeProgramme?.id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (isProject) setActiveProject(id);
                    else setActiveProgramme(id);
                  }}
                  className="appearance-none bg-transparent border-none text-sm font-black text-slate-900 pr-6 py-0 focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors truncate max-w-[200px] md:max-w-xs"
                >
                  <option value={context.id}>{name}</option>
                  {(isProject ? projects : programmes)
                    .filter((i) => i.id !== context.id)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors pointer-events-none" />
              </div>
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0',
                  isProject ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                )}
              >
                {type}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">
              REF: {reference || 'NOT ASSIGNED'}
            </p>
          </div>
        </div>

        {/* Middle: Status Indicators */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">
              AI Profile: Active
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">
                Last Risk Run:{' '}
                <span className="text-slate-900">
                  {lastRiskRun ? new Date(lastRiskRun).toLocaleDateString() : 'Never'}
                </span>
              </span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <History className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">
                Compliance Sync:{' '}
                <span className="text-slate-900">
                  {lastComplianceRun
                    ? new Date(lastComplianceRun).toLocaleDateString()
                    : 'Never'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Primary Actions */}
        <div className="relative w-full md:w-auto">
          {canManage ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                  'flex items-center justify-between gap-3 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all w-full md:w-auto min-w-[180px]',
                  isOpen
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
                )}
              >
                <span>Actions & Options</span>
                <ChevronDown
                  className={clsx(
                    'w-4 h-4 transition-transform duration-300',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                      {Object.entries(groupedActions).map(([category, items], catIdx) => (
                        <div
                          key={category}
                          className={clsx(catIdx !== 0 && 'mt-4 pt-4 border-t border-slate-100')}
                        >
                          <div className="px-3 mb-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {category}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-1 px-1">
                            {items.map((action, idx) => (
                              <button
                                key={idx}
                                disabled={isExporting && action.label.startsWith('Export')}
                                onClick={() => {
                                  action.onClick();
                                  if (!action.label.startsWith('Export')) setIsOpen(false);
                                }}
                                className="group flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all text-left w-full disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg group-hover:bg-white group-hover:shadow-md transition-all border border-transparent group-hover:border-slate-100">
                                  <action.icon
                                    className={clsx(
                                      'w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600',
                                      isExporting &&
                                        action.label.startsWith('Export') &&
                                        'animate-spin'
                                    )}
                                  />
                                </div>
                                <div>
                                  <p className="text-[11px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                    {action.label}
                                  </p>
                                  <p className="text-[9px] text-slate-400 font-medium leading-tight mt-0.5">
                                    {action.description}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 px-3 pb-1">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase italic">
                        <Info className="w-3 h-3" />
                        Requires PM/SRO Permissions
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Read-Only Access
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  Settings, 
  RefreshCw, 
  Users, 
  FileDown, 
  History, 
  ChevronDown, 
  Info,
  CheckCircle2,
  AlertCircle,
  Layout,
  Briefcase,
  PlusCircle,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';

export const ServiceManagementBar: React.FC = () => {
  const navigate = useNavigate();
  const { 
    activeProject, 
    activeProgramme, 
    canManageContext,
    updateProject,
    updateProgramme,
    projects,
    programmes,
    setActiveProject,
    setActiveProgramme,
    user
  } = useStore();
  
  const [isOpen, setIsOpen] = useState(false);

  const isProject = !!activeProject;
  const context = activeProject || activeProgramme;
  
  if (!context) return null;

  const canManage = canManageContext();
  const name = isProject ? activeProject?.name : activeProgramme?.name;
  const reference = isProject ? activeProject?.reference : activeProgramme?.reference;
  const type = isProject ? 'Project' : 'Programme';
  
  const lastRiskRun = context.lastRiskRun;
  const lastComplianceRun = context.lastComplianceRun;

  const handleEditProfile = () => {
    if (isProject) {
      navigate(`/project-initiation?id=${activeProject.id}`);
    } else {
      navigate(`/programme-setup?id=${activeProgramme.id}`);
    }
  };

  const handleRerunAI = (type: 'risk' | 'compliance') => {
    if (type === 'risk') {
      navigate(`/risk-setup?id=${context.id}`);
    } else {
      navigate(`/compliance-setup?id=${context.id}`);
    }
  };

  const handleManageTeam = () => {
    // For now, redirect to a common team panel or handle via modal (future)
    navigate('/team'); 
  };

  const handleCreateAction = (action: 'add-risk' | 'add-compliance') => {
    // Append search param to current URL to trigger modal
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('action', action);
    navigate(`${window.location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  const actions = [
    { 
      label: 'New Programme', 
      icon: PlusCircle, 
      onClick: () => navigate('/programme-setup'),
      description: 'Initialize a new strategic programme portfolio.',
      category: 'Creation Hub'
    },
    { 
      label: 'New Project', 
      icon: Briefcase, 
      onClick: () => navigate('/project-initiation'),
      description: 'Launch a new tactical project initiation.',
      category: 'Creation Hub'
    },
    { 
      label: 'Add New Risk', 
      icon: AlertCircle, 
      onClick: () => handleCreateAction('add-risk'),
      description: 'Log and assess a new project-specific risk.',
      category: 'Creation Hub'
    },
    { 
      label: 'Add Requirement', 
      icon: CheckCircle2, 
      onClick: () => handleCreateAction('add-compliance'),
      description: 'Add a new compliance or regulatory tracking point.',
      category: 'Creation Hub'
    },
    { 
      label: 'Edit Profile', 
      icon: Settings, 
      onClick: handleEditProfile,
      description: `Modify ${type.toLowerCase()} metadata and parameters.`,
      category: 'Context Actions'
    },
    { 
      label: 'Re-run AI Analysis', 
      icon: RefreshCw, 
      onClick: () => handleRerunAI('risk'),
      description: 'Trigger a fresh AI analysis of current risks.',
      category: 'Context Actions'
    },
    { 
      label: 'Export Data (Excel)', 
      icon: FileSpreadsheet, 
      onClick: () => console.log('Export Excel'),
      description: 'Generate raw data extract for external reporting.',
      category: 'Data Tools'
    },
    { 
      label: 'Download Templates', 
      icon: Download, 
      onClick: () => console.log('Templates'),
      description: 'Access standardized management frameworks.',
      category: 'Data Tools'
    }
  ];

  // Group actions by category
  const groupedActions = actions.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, typeof actions>);


  return (
    <div className="sticky top-0 z-30 w-full px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Context Identity */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className={clsx(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-inner shrink-0",
            isProject ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
          )}>
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
                    .filter(i => i.id !== context.id)
                    .map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))
                  }
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors pointer-events-none" />
              </div>
              <span className={clsx(
                "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0",
                isProject ? "bg-indigo-600 text-white" : "bg-emerald-600 text-white"
              )}>
                {type}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">REF: {reference || 'NOT ASSIGNED'}</p>
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
                Last Risk Run: <span className="text-slate-900">{lastRiskRun ? new Date(lastRiskRun).toLocaleDateString() : 'Never'}</span>
              </span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <History className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">
                Compliance Sync: <span className="text-slate-900">{lastComplianceRun ? new Date(lastComplianceRun).toLocaleDateString() : 'Never'}</span>
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
                  "flex items-center justify-between gap-3 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all w-full md:w-auto min-w-[180px]",
                  isOpen 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100"
                )}
              >
                <span>Actions & Options</span>
                <ChevronDown className={clsx("w-4 h-4 transition-transform duration-300", isOpen && "rotate-180")} />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)} 
                  />
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                      {Object.entries(groupedActions).map(([category, items], catIdx) => (
                        <div key={category} className={clsx(catIdx !== 0 && "mt-4 pt-4 border-t border-slate-100")}>
                          <div className="px-3 mb-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{category}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-1 px-1">
                            {items.map((action, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  action.onClick();
                                  setIsOpen(false);
                                }}
                                className="group flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all text-left w-full"
                              >
                                <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg group-hover:bg-white group-hover:shadow-md transition-all border border-transparent group-hover:border-slate-100">
                                  <action.icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
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

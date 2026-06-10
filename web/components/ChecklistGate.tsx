import React from 'react';
import { CheckCircle2, AlertCircle, Shield, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { calculateProgrammeProgress } from '../lib/progress';

interface ChecklistItemProps {
  label: string;
  status: 'complete' | 'warning' | 'error' | 'not-started';
  info?: string;
  key?: React.Key;
}

function ChecklistItem({ label, status, info }: ChecklistItemProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'complete':
        return {
          bg: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />,
        };
      case 'warning':
        return {
          bg: 'bg-amber-500',
          icon: <AlertCircle className="w-3.5 h-3.5 text-white" />,
        };
      case 'error':
        return {
          bg: 'bg-rose-500',
          icon: <AlertCircle className="w-3.5 h-3.5 text-white" />,
        };
      case 'not-started':
      default:
        return {
          bg: 'bg-slate-200',
          icon: null,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-start gap-3 py-2.5 group cursor-pointer hover:translate-x-1 transition-all">
      <div className={clsx("w-6 h-6 rounded-lg flex items-center justify-center shadow-sm shrink-0 mt-0.5", config.bg)}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors leading-tight">{label}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5 group-hover:text-slate-500 transition-colors">{info}</p>
      </div>
    </div>
  );
}

interface ChecklistGateProps {
  type: 'programme' | 'project';
}

export function ChecklistGate({ type }: ChecklistGateProps) {
  const { 
    activeProgrammeId, 
    activeProjectId, 
    programmes, 
    projects, 
    complianceItems, 
    complianceAnalysis,
    risks,
  } = useStore();

  const programme = (Array.isArray(programmes) ? programmes : []).find(p => p.id === activeProgrammeId);
  const project = (Array.isArray(projects) ? projects : []).find(p => p.id === activeProjectId);

  if (type === 'programme' && !programme) return null;
  if (type === 'project' && !project) return null;

  // --- PROGRAMME LOGIC ---
  const getProgrammeItems = (): Array<{ label: string; status: ChecklistItemProps['status']; info: string }> => {
    const result = calculateProgrammeProgress(programme);
    return result.pillars.map(p => ({
      label: p.label,
      status: p.status as ChecklistItemProps['status'],
      info: p.info
    }));
  };

  // --- PROJECT LOGIC ---
  const getProjectItems = (): Array<{ label: string; status: ChecklistItemProps['status']; info: string }> => {
    if (!project) return [];

    // Step 1: Create a project (and basic setup)
    const detailStatus = (project.name && project.loc && project.units && project.type && project.client) ? 'complete' : 'warning';
    
    // Step 2: Complete Compliance Setup
    const hasAnalysis = complianceAnalysis !== null && (Array.isArray(complianceItems) ? complianceItems : []).some(c => c.projectId === activeProjectId);
    const compStatus = hasAnalysis ? 'complete' : 'error';

    // Step 3: Complete Risk Setup
    const projectRisks = (Array.isArray(risks) ? risks : []).filter(r => r.projectId === activeProjectId);
    const riskStatus = (project.riskSetupDone && project.aiRiskDiscoveryDone) ? 'complete' : (project.riskSetupDone ? 'warning' : 'error');

    // Step 4: Publish Readiness (derived)
    const allPrecedingComplete = detailStatus === 'complete' && compStatus === 'complete' && riskStatus === 'complete';
    const publishStatus = allPrecedingComplete ? 'complete' : 'not-started';

    return [
      { label: '1. Create a project', status: detailStatus, info: 'Initial project creation and core metadata setup.' },
      { label: '2. Complete Compliance Setup', status: compStatus, info: 'Executing AI analysis and identifying obligations.' },
      { label: '3. Complete Risk Setup', status: riskStatus, info: 'Registering mandatory 3+ strategic project risks.' },
      { label: '4. Publish', status: publishStatus, info: 'Final readiness for internal/client publication.' },
    ];
  };

  const items = type === 'programme' ? getProgrammeItems() : getProjectItems();
  const completedCount = items.filter(i => i.status === 'complete').length;
  
  // Use centralized progress for programmes
  const progress = type === 'programme' 
    ? calculateProgrammeProgress(programme).percentage 
    : (items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0);
    
  const isComplete = progress === 100;
  const hasErrors = items.some(i => i.status === 'error');

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden lg:sticky lg:top-6">
      <div className="bg-slate-50/80 px-6 py-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              "p-2 rounded-lg border-2 transition-transform hover:scale-105",
              type === 'programme' ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
            )}>
              {type === 'programme' ? <Target className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900 leading-none">
                {type === 'programme' ? 'Programme Setup Gate' : 'Publication Checklist'}
              </h3>
              <p className="font-mono text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Required for Activation</p>
            </div>
          </div>
          <div className={clsx(
            "font-mono text-[10px] font-semibold px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm",
            isComplete ? "bg-emerald-500 text-white" : hasErrors ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
          )}>
            {isComplete ? 'Ready' : hasErrors ? 'Incomplete' : 'Action Required'}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-end justify-between mb-1">
            <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Overall Completion</span>
            <span className="text-2xl font-semibold text-slate-900 tracking-tight">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden shadow-inner p-0.5 border border-slate-100">
            <div 
              className={clsx(
                "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
                isComplete ? "bg-emerald-500" : hasErrors ? "bg-indigo-600" : "bg-amber-500"
              )} 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </div>

      <div className="p-7">
        <div className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-5 flex items-center gap-2.5 pb-2 border-b border-slate-50">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-sm shadow-indigo-500/50" />
          Mandatory Requirements
        </div>
        <div className="space-y-4">
          {items.map((item, idx) => (
            <ChecklistItem 
              key={`${item.label}-${idx}`}
              label={item.label} 
              status={item.status}
              info={item.info} 
            />
          ))}
        </div>

        <div className="mt-10">
          <button 
            disabled={!isComplete}
            className={clsx(
              "font-mono w-full flex items-center justify-center gap-2 px-6 py-4 text-sm font-semibold uppercase tracking-wide rounded-lg transition-all shadow-xl active:scale-95",
              isComplete 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/30 hover:shadow-indigo-500/40" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200"
            )}
          >
            {type === 'programme' ? 'Finalise Programme Setup' : 'Complete Publication'}
          </button>
          {!isComplete && (
            <p className="text-[11px] text-center text-slate-500 mt-4 font-bold px-4 leading-relaxed bg-slate-50 py-2.5 rounded-lg border border-dashed border-slate-200">
              Complete all requirements above to enable {type === 'programme' ? 'operational mode' : 'project publication'}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

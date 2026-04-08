import React from 'react';
import { Check, ChevronDown, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { PROGRAMME_PHASES, PROJECT_PHASES, QuestionPhase } from '../../data/complianceQuestions';

interface ComplianceQuestionnaireProps {
  activeType: 'project' | 'programme';
  projectInfo: any;
  setProjectInfo: (info: any) => void;
  expandedPhases: string[];
  setExpandedPhases: React.Dispatch<React.SetStateAction<string[]>>;
  activeQuestionId: string | null;
  setActiveQuestionId: React.Dispatch<React.SetStateAction<string | null>>;
  onQuestionAnswered: (key: string, value: any) => void;
}

// ─── UI Helper Components ───────────────────────────────────────────────────

const CheckPill: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => {
  return (
    <label
      className={clsx(
        "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none text-sm font-semibold",
        checked
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:bg-slate-50'
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
      <div className={clsx(
        "w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-all mt-0.5",
        checked ? 'bg-white/20 border-white/40' : 'bg-white border-slate-300'
      )}>
        {checked && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
      </div>
      <span className="leading-relaxed">{label}</span>
    </label>
  );
};

const inputCls = "w-full border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white/80 backdrop-blur-sm placeholder:text-slate-400 shadow-sm hover:border-slate-300";

// ─── Main Component ──────────────────────────────────────────────────────────

export const ComplianceQuestionnaire: React.FC<ComplianceQuestionnaireProps> = ({
  activeType,
  projectInfo,
  setProjectInfo,
  expandedPhases,
  setExpandedPhases,
  activeQuestionId,
  setActiveQuestionId,
  onQuestionAnswered
}) => {
  const phases = activeType === 'programme' ? PROGRAMME_PHASES : PROJECT_PHASES;

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => (prev.includes(id) ? [] : [id]));
  };

  const handleSelectChange = (id: string, value: string) => {
    onQuestionAnswered(id, value);
  };

  const toggleMultiSelect = (id: string, option: string) => {
    const current = Array.isArray(projectInfo[id]) ? projectInfo[id] : [];
    const next = current.includes(option) 
      ? current.filter((v: string) => v !== option) 
      : [...current, option];
    onQuestionAnswered(id, next);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
      {phases.map((qPhase, idx) => {
        const isExpanded = expandedPhases.includes(qPhase.id);
        
        return (
          <div
            key={qPhase.id}
            id={`phase-container-${qPhase.id}`}
            className={clsx(
              "bg-white rounded-[2rem] border-2 transition-all duration-500 overflow-hidden scroll-mt-32",
              isExpanded ? "border-indigo-100 shadow-xl shadow-indigo-50/50 mb-8" : "border-slate-50 mb-4 hover:border-slate-200"
            )}
          >
            {/* Phase Header */}
            <div 
              id={`phase-header-${qPhase.id}`}
              className={clsx(
                "p-6 md:p-8 flex items-center justify-between cursor-pointer transition-colors scroll-mt-32",
                isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50"
              )}
              onClick={() => togglePhase(qPhase.id)}
            >
              <div className="flex items-center gap-6">
                <div className={clsx(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm border",
                  isExpanded ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white border-slate-100 text-slate-400"
                )}>
                  <span className="text-lg font-black">{idx + 1}</span>
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{qPhase.title}</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Section {idx + 1} &bull; {qPhase.num}</p>
                </div>
              </div>
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300",
                isExpanded ? "bg-indigo-50 border-indigo-200 text-indigo-600 rotate-180" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-indigo-50 group-hover:border-indigo-100"
              )}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>

            <div
              className={clsx(
                "transition-all duration-500 ease-in-out",
                isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}
            >
              <div className="p-8 pt-0 space-y-8">
                <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent mb-8"></div>
                <p className="text-slate-500 text-sm font-medium italic border-l-4 border-indigo-100 pl-4">{qPhase.hint}</p>
                
                <div className="grid grid-cols-1 gap-6">
                  {qPhase.questions.map((q, qIndex) => {
                    const isActive = activeQuestionId === q.id;
                    const val = projectInfo[q.id];
                    const isAnswered = Array.isArray(val) ? val.length > 0 : (val !== undefined && val !== null && val !== '');
                    
                    return (
                      <div 
                        key={q.id} 
                        id={`q-container-${q.id}`}
                        className={clsx(
                          "group/q bg-slate-50/30 p-8 rounded-3xl border transition-all duration-300",
                          isActive ? "border-indigo-500 bg-indigo-50/50 shadow-lg scale-[1.01]" : "border-dashed border-slate-200",
                          !isActive && !isAnswered ? "opacity-30 grayscale select-none pointer-events-none" : "opacity-100 grayscale-0"
                        )}
                      >
                        {qIndex === 0 && <div id={`phase-first-q-${qPhase.id}`} className="absolute -top-32" />}
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                          <div className="max-w-2xl space-y-3">
                            <div className="flex items-center gap-3">
                              <div className={clsx(
                                "w-8 h-8 rounded-xl shadow-sm flex items-center justify-center shrink-0 transition-colors",
                                isAnswered ? "bg-emerald-500 text-white" : "bg-white text-indigo-600"
                              )}>
                                {isAnswered ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                              </div>
                              <h4 className="text-lg font-bold text-slate-900 leading-tight">{q.label}</h4>
                            </div>
                            {q.description && <p className="text-slate-500 text-sm font-medium pl-11">{q.description}</p>}
                            
                            {q.trigger && isAnswered && (projectInfo[q.id] === 'Yes' || (Array.isArray(projectInfo[q.id]) && projectInfo[q.id].length > 0)) && (
                              <div className="pl-11 animate-in slide-in-from-left-4 duration-500">
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100/50 flex items-start gap-3">
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <span className="text-xs font-bold text-amber-700 leading-relaxed italic">{q.trigger}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 lg:w-72">
                            {q.type === 'toggle' && (
                              <div className="flex p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                {['No', 'Yes'].map(option => (
                                  <button
                                    key={option}
                                    onClick={() => onQuestionAnswered(q.id, option)}
                                    className={clsx(
                                      "flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                      projectInfo[q.id] === option 
                                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                    )}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}

                            {q.type === 'select' && (
                              <select
                                value={projectInfo[q.id] || ''}
                                onChange={(e) => handleSelectChange(q.id, e.target.value)}
                                className={inputCls}
                              >
                                <option value="">Select option...</option>
                                {q.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}

                            {q.type === 'multi' && (
                              <div className="grid grid-cols-1 gap-2">
                                {q.options?.map(opt => (
                                  <CheckPill
                                    key={opt}
                                    label={opt}
                                    checked={(projectInfo[q.id] || []).includes(opt)}
                                    onChange={() => toggleMultiSelect(q.id, opt)}
                                  />
                                ))}
                              </div>
                            )}

                            {q.type === 'number' && (
                              <input
                                type="number"
                                value={projectInfo[q.id] || ''}
                                onChange={(e) => onQuestionAnswered(q.id, e.target.value)}
                                className={inputCls}
                                placeholder="Enter value..."
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

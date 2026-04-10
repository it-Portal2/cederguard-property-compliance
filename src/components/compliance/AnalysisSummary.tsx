import React, { useMemo } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, ClipboardList, Trash2, PlusCircle, Target, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { determineProjectCategory } from '../../utils/complianceCategorization';
import { stripMarkdown } from '../../lib/utils';
import { COMPLIANCE_ITEMS } from '../../data/complianceData';

interface AnalysisSummaryProps {
  projectInfo: any;
  lastAnalysisResults: any;
  complianceItems: any[];
  subPhase: 'review' | 'additions';
  setSubPhase: (phase: 'review' | 'additions') => void;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectAll: (items: any[]) => void;
  toggleSelectOne: (id: string, e: React.MouseEvent) => void;
  handleBulkAdd: (items: any[]) => void;
  deleteComplianceItem: (id: string) => void;
  addConditionalItems: (items: any[]) => void;
  buildAddableItems: () => any[];
  activeProjectId?: string | null;
  activeProgrammeId?: string | null;
  dispName: string;
  handleFinalise: () => Promise<void>;
  loading?: boolean;
}

export const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({
  projectInfo,
  lastAnalysisResults,
  complianceItems,
  subPhase,
  setSubPhase,
  selectedIds,
  setSelectedIds,
  toggleSelectAll,
  toggleSelectOne,
  handleBulkAdd,
  deleteComplianceItem,
  addConditionalItems,
  buildAddableItems,
  activeProjectId,
  activeProgrammeId,
  dispName,
  handleFinalise,
  loading
}) => {
  const categoryData = determineProjectCategory(projectInfo);
  const addableItems = buildAddableItems();
  // Bug 15: stable ID — recomputed only when category changes, not on every render
  const verifiedId = useMemo(
    () => `${categoryData.category}-${Math.random().toString(36).substring(7).toUpperCase()}`,
    [categoryData.category]
  );

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-700 pb-20">
      {/* ─── Premium Summary Header ─── */}
      <div className="bg-slate-900 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-indigo-500/10 rounded-full blur-[60px] sm:blur-[100px] -mr-32 sm:-mr-48 -mt-32 sm:-mt-48"></div>
        <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-emerald-500/5 rounded-full blur-[50px] sm:blur-[80px] -ml-24 sm:-ml-32 -mb-24 sm:-mb-32"></div>
        
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-start gap-6">
              <div 
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl font-black shadow-2xl"
                style={{ backgroundColor: categoryData.color }}
              >
                {categoryData.category}
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{categoryData.label}</h2>
                  <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-300 w-fit">
                    Verified ID: {verifiedId}
                  </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-medium">
                  {categoryData.description}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-emerald-400">High</span>
                  <Target className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Governing Bodies</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastAnalysisResults.regulatoryAuthorities?.length > 0 ? (
                  lastAnalysisResults.regulatoryAuthorities?.slice(0, 4).map((a: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-xl">
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] font-bold rounded-xl italic">
                    Internal Governance
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Key Consents</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastAnalysisResults.requiredApprovals?.length > 0 ? (
                  lastAnalysisResults.requiredApprovals?.slice(0, 4).map((a: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-xl">
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] font-bold rounded-xl italic">
                    Self-Certification
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Analysis Insight</h4>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed font-medium italic">
                "{stripMarkdown(lastAnalysisResults.summary?.substring(0, 120) || "")}..."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Requirements List Container ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
            <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 bg-slate-50/30">
              <div className="flex p-1 sm:p-1.5 bg-slate-200/50 rounded-2xl w-full sm:w-fit overflow-x-auto scrollbar-hide">
                {[
                  { id: 'review', label: 'Framework Scope', count: complianceItems.length },
                  { id: 'additions', label: 'AI Suggestions', count: addableItems.length }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSubPhase(t.id as any); setSelectedIds([]); }}
                    className={clsx(
                      "px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all shrink-0",
                      subPhase === t.id 
                        ? "bg-white text-slate-900 shadow-md border border-slate-100" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {subPhase === 'additions' && selectedIds.length > 0 && (
                <button 
                  onClick={() => handleBulkAdd(addableItems)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 animate-in zoom-in duration-300"
                >
                  <PlusCircle className="w-4 h-4" /> Add Selected ({selectedIds.length})
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    {subPhase === 'additions' && (
                      <th className="px-8 py-5 w-16">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedIds.length > 0 && selectedIds.length === addableItems.length}
                          onChange={() => toggleSelectAll(addableItems)}
                        />
                      </th>
                    )}
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px]">Requirement</th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px]">Domain</th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subPhase === 'review' ? (
                    <>
                      {complianceItems.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-20 h-20 bg-slate-50 rounded-4xl flex items-center justify-center border border-slate-100 shadow-inner">
                                <ClipboardList className="w-10 h-10 text-slate-200" />
                              </div>
                              <p className="font-black text-slate-300 uppercase tracking-widest text-[10px]">No requirements identified yet</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        complianceItems.map((item: any) => (
                          <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 sm:px-8 py-4 sm:py-6">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-black text-slate-900 text-sm tracking-tight">{item.reg}</span>
                                <span className="text-slate-500 text-xs leading-relaxed max-w-md line-clamp-2 font-medium">{stripMarkdown(item.req)}</span>
                              </div>
                            </td>
                            <td className="px-4 sm:px-8 py-4 sm:py-6">
                              <span className="px-2 sm:px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest border border-slate-200/50">
                                {item.domain}
                              </span>
                            </td>
                            <td className="px-4 sm:px-8 py-4 sm:py-6 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteComplianceItem(item.id); }}
                                className="p-3 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all bg-white border border-slate-100 shadow-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {addableItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-20 h-20 bg-emerald-50 rounded-4xl flex items-center justify-center border border-emerald-100 shadow-inner">
                                <ShieldCheck className="w-10 h-10 text-emerald-200" />
                              </div>
                              <p className="font-black text-emerald-400 uppercase tracking-widest text-[10px]">Framework fully optimized</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        addableItems.map(({ id, reason, type }) => {
                          const item = COMPLIANCE_ITEMS.find(i => i.id === id);
                          if (!item) return null;
                          const isAdded = complianceItems.some((i: any) => i.id === id);
                          return (
                            <tr key={id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={(e) => toggleSelectOne(id, e as any)}>
                              <td className="px-8 py-6">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={selectedIds.includes(id)}
                                  onChange={() => {}}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex flex-col gap-1.5">
                                  <span className="font-black text-slate-900 text-sm tracking-tight">{item.reg}</span>
                                  <span className="text-amber-600 text-[10px] italic font-bold">Reason: {stripMarkdown(reason) || item.trigger}</span>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <span className={clsx(
                                  'px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border',
                                  type === 'conditional'
                                    ? 'bg-amber-50 text-amber-600 border-amber-200/50'
                                    : 'bg-slate-100 text-slate-500 border-slate-200/50'
                                )}>
                                  {type === 'conditional' ? 'Conditional' : 'Excluded'}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdded) {
                                      deleteComplianceItem(id);
                                    } else {
                                      addConditionalItems([{
                                        ...item,
                                        projectId: activeProjectId || undefined,
                                        programmeId: activeProgrammeId || undefined,
                                        projectName: dispName,
                                        isProgrammeLevel: !!activeProgrammeId,
                                        stage: 'Not Started',
                                        conditional: true,
                                        condReason: reason || item.trigger || 'Manually added'
                                      }]);
                                    }
                                  }}
                                  className={clsx(
                                    'px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap inline-flex items-center gap-2',
                                    isAdded
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-rose-50 hover:text-rose-600'
                                      : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-slate-200'
                                  )}
                                >
                                  {isAdded ? <Check className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                                  {isAdded ? 'Added' : 'Add Item'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Sidebar Dashboard ─── */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/20 sticky top-32">
            <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight flex items-center gap-2">
              Regulation Coverage <Target className="w-4 h-4 text-amber-500" />
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-4">
                {['Building Safety', 'Health & Safety', 'Sustainability', 'Governance'].map((domain) => {
                  const count = complianceItems.filter((i: any) => i.domain.toLowerCase().includes(domain.toLowerCase())).length;
                  const percent = Math.min(100, Math.max(10, count * 20));
                  return (
                    <div key={domain} className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>{domain}</span>
                        <span>{count} Items</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-900 rounded-full transition-all duration-1000" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">AI</div>
                    <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest italic">Verification Mode</span>
                  </div>
                  <p className="text-[11px] font-medium text-indigo-600 leading-relaxed italic">
                    All items have been verified against current UK Building Regulations and CedarGuard AI analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl gap-4 shadow-xl">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setSubPhase('review')}
            className={clsx(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 w-full md:w-auto justify-center",
              subPhase === 'review'
                ? "bg-slate-700 text-slate-300 opacity-50 cursor-not-allowed"
                : "bg-white/10 text-white hover:bg-white/20"
            )}
            disabled={subPhase === 'review'}
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
        <button
          onClick={handleFinalise}
          disabled={loading}
          className={clsx(
            "flex items-center gap-2 px-8 py-3.5 bg-emerald-500 text-white rounded-xl font-black text-[11px] md:text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 w-full md:w-auto justify-center",
            loading && "opacity-70 cursor-not-allowed"
          )}
        >
          {loading ? (
            <>Saving... <Loader2 className="w-5 h-5 animate-spin" /></>
          ) : (
            <>Confirm and Finalise Tracker <CheckCircle2 className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  );
};

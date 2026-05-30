import { useState } from 'react';
import { useStore } from '../store/useStore';
import { STAGES, DOMAINS } from '../data/complianceData';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle, FolderKanban, Star } from 'lucide-react';
import { MilestoneManager } from '../components/MilestoneManager';
import type { ProgrammeMilestone } from '../store/useStore';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router';
import PageHeader from '../components/PageHeader';

export function LinkedRegs() {
  const navigate = useNavigate();
  const { complianceItems, projectInfo = {}, programmes, activeProgrammeId, projects, updateProgramme } = useStore();
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'timeline' | 'programme' | 'projects'>('timeline');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const targetProgrammeId = activeProgrammeId || projectInfo?.programmeId;
  const activeProgramme = targetProgrammeId ? programmes.find(p => p.id === targetProgrammeId) : undefined;
  const milestones = (activeProgramme?.milestones || []) as ProgrammeMilestone[];

  // Linked projects with their milestones
  const safeProjects = Array.isArray(projects) ? projects : [];
  const linkedProjects = targetProgrammeId ? safeProjects.filter(p => p.programmeId === targetProgrammeId) : [];

  const handleMilestonesChange = (updated: ProgrammeMilestone[]) => {
    if (activeProgramme && updateProgramme) {
      updateProgramme(activeProgramme.id, { milestones: updated } as any);
    }
  };

  const toggleStage = (id: string) => {
    setOpenStages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'Delayed': return 'bg-rose-50 border-rose-200 text-rose-700';
      default: return 'bg-amber-50 border-amber-200 text-amber-700';
    }
  };

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
  };

  // Aggregate stats
  const totalProjectMilestones = linkedProjects.reduce((acc, p) => acc + (p.milestones?.length || 0), 0);
  const totalDelayed = linkedProjects.reduce((acc, p) => acc + (p.milestones?.filter(m => m.status === 'Delayed').length || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${activeProgramme?.name || projectInfo?.name || 'Programme'} Plan`}
        subtitle="Strategic milestones and compliance regulations mapped across the project lifecycle."
        breadcrumbs={[{label:"Programme Initiation"},{label:"Programme Plan"}]}
      />

      {/* Stats */}
      {linkedProjects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Linked Projects', value: linkedProjects.length, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
            { label: 'Programme Milestones', value: milestones.length, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Project Milestones', value: totalProjectMilestones, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Delayed (all)', value: totalDelayed, color: totalDelayed > 0 ? 'text-rose-700' : 'text-emerald-700', bg: totalDelayed > 0 ? 'bg-rose-50' : 'bg-emerald-50', border: totalDelayed > 0 ? 'border-rose-200' : 'border-emerald-200' },
          ].map((s, i) => (
            <div key={i} className={clsx('rounded-lg border p-4 shadow-sm', s.bg, s.border)}>
              <p className="text-[10px] font-mono font-medium uppercase tracking-wide text-slate-400 mb-1">{s.label}</p>
              <p className={clsx('text-2xl font-medium tabular-nums', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { key: 'timeline', label: 'RIBA Timeline' },
          { key: 'programme', label: 'Programme Milestones' },
          { key: 'projects', label: `Project Milestones (${linkedProjects.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-mono font-medium uppercase tracking-wide transition-all',
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Programme Milestones */}
      {activeTab === 'programme' && (
        <MilestoneManager
          milestones={milestones}
          onChange={handleMilestonesChange}
          entityType="programme"
        />
      )}

      {/* TAB: Project Milestones — Programme Manager sees ALL project milestones aggregated */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          {linkedProjects.length === 0 ? (
            <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-lg p-12 text-center">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-4 opacity-50" />
              <h3 className="text-sm font-bold text-slate-600 mb-2 ">Waiting for Portfolio Data</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">No projects are currently linked to this programme. Once projects are added, their milestones will automatically aggregate here.</p>
            </div>
          ) : (
            linkedProjects.map(proj => {
              const projMilestones = (proj.milestones || []) as ProgrammeMilestone[];
              const isExpanded = expandedProject === proj.id;
              const projDelayed = projMilestones.filter(m => m.status === 'Delayed').length;
              const projCompleted = projMilestones.filter(m => m.status === 'Completed').length;
              const projKey = projMilestones.filter(m => m.isKey);

              return (
                <div key={proj.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => setExpandedProject(isExpanded ? null : proj.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <FolderKanban className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{proj.name}</h3>
                        <p className="text-[10px] text-slate-400 font-mono font-medium uppercase tracking-wide">{proj.type} · {proj.loc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {projDelayed > 0 && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">{projDelayed} Delayed</span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{projMilestones.length} Milestones</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">{projCompleted} Done</span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Key milestones preview */}
                  {!isExpanded && projKey.length > 0 && (
                    <div className="px-5 pb-4 flex flex-wrap gap-2">
                      {projKey.map(km => (
                        <div key={km.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-800">
                          <Star className="w-3 h-3 text-amber-500" />
                          {km.name}
                          <span className="text-amber-500 font-medium">{km.date ? formatDate(km.date) : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expanded: all milestones */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                      {projMilestones.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">No milestones added yet by the Project Manager.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {projMilestones.map(m => (
                            <div key={m.id} className={clsx('bg-white rounded-lg border p-4 shadow-sm', m.isKey ? 'border-amber-200' : 'border-slate-100')}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  {m.isKey && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                                  <span className={clsx('px-2 py-0.5 rounded text-[9px] font-mono font-medium uppercase tracking-wide border', getStatusColor(m.status))}>
                                    {m.status}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{m.date ? formatDate(m.date) : '—'}</span>
                              </div>
                              <h4 className="font-bold text-slate-900 text-sm mb-0.5">{m.name}</h4>
                              {m.stage && <p className="text-[10px] text-indigo-600 font-bold">RIBA {m.stage}</p>}
                              {m.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>}
                              {m.history && m.history.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <p className="text-[9px] font-mono font-medium uppercase tracking-wide text-slate-300 mb-1">{m.history.length} Date Change(s)</p>
                                  <p className="text-[10px] text-slate-500 ">"{m.history[m.history.length - 1].comment}"</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: RIBA Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
              RIBA Compliance Timeline
            </h3>
            <div className="flex flex-nowrap overflow-x-auto pb-8 pt-4 px-2 md:pb-4 md:flex-wrap md:justify-between items-center relative custom-scrollbar snap-x snap-mandatory">
              <div className="absolute left-0 right-0 top-1/2 -mt-2 md:mt-0 h-0.5 bg-slate-100 -z-10" />
              {STAGES.map(st => {
                const isActive = openStages[st.id];
                return (
                  <div key={st.id} className="flex flex-col items-center gap-2 cursor-pointer group shrink-0 min-w-[80px] md:min-w-0 snap-center" onClick={() => toggleStage(st.id)}>
                    <div
                      className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300",
                        isActive ? "text-white scale-110 shadow-lg" : "bg-white hover:scale-105"
                      )}
                      style={{ borderColor: st.color, backgroundColor: isActive ? st.color : 'white', color: isActive ? 'white' : st.color }}
                    >
                      {st.num}
                    </div>
                    <div className={clsx("text-[10px] font-bold text-center w-16 leading-tight", isActive ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600")}>
                      {st.riba}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {STAGES.map(st => {
              const isOpen = openStages[st.id];
              const applicableRegs = st.regs.filter(r => (Array.isArray(complianceItems) ? complianceItems : []).some(i => i.domain === r.domain));
              return (
                <div key={st.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="flex items-center gap-5 p-5 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleStage(st.id)}>
                    <div className="w-12 h-12 shrink-0 rounded-lg flex items-center justify-center text-xl font-semibold" style={{ color: st.color, borderColor: `${st.color}30`, backgroundColor: `${st.color}10`, border: '2px solid' }}>
                      {st.num}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg">{st.name}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{st.desc}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                        {applicableRegs.length} regulations
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-white text-slate-400">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-5 bg-slate-50/50 border-t border-slate-100">
                      {applicableRegs.map((r, idx) => {
                        const dom = DOMAINS.find(d => d.id === r.domain);
                        const relItems = (Array.isArray(complianceItems) ? complianceItems : []).filter(i => i.domain === r.domain);
                        const complete = relItems.filter(i => i.stage === "Complete").length;
                        const pct = relItems.length ? Math.round((complete / relItems.length) * 100) : 0;
                        return (
                          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-5 border-l-[6px] shadow-sm" style={{ borderLeftColor: dom?.color || '#cbd5e1' }}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-medium uppercase tracking-wide mb-2.5 inline-block" style={{ backgroundColor: `${dom?.color}10`, color: dom?.color, border: `1px solid ${dom?.color}30` }}>
                                  {dom?.abbr || r.domain}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 leading-tight pr-4">{r.name}</h4>
                              </div>
                              {relItems.length > 0 && (
                                <div className="text-right shrink-0 ml-4 pl-4 border-l border-slate-100">
                                  <div className="text-xl font-semibold tracking-tight" style={{ color: dom?.color }}>{pct}%</div>
                                  <div className="text-[10px] font-mono font-medium text-slate-400 mt-0.5 uppercase tracking-wide tabular-nums">{complete} / {relItems.length} Done</div>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-4 leading-relaxed">{r.action}</p>
                            <div className="text-xs font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-100 rounded-lg px-3 py-2 inline-flex items-center gap-2 w-full sm:w-auto">
                              <span>🔑</span> <span className="flex-1">{r.key}</span>
                            </div>
                          </div>
                        );
                      })}
                      {applicableRegs.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-10 text-center bg-white border border-dashed border-slate-300 rounded-lg">
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-2xl">🍃</div>
                          <h4 className="text-sm font-bold text-slate-800 mb-1">No Regulations</h4>
                          <p className="text-xs text-slate-500 max-w-sm">No applicable compliance regulations identified for this RIBA stage.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { TrendingUp } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  OPERATIONAL_WORKSTREAMS,
  STRATEGIC_WORKSTREAMS,
  getWorkstreamName,
} from '../data/riskTaxonomy';

// Bug 5 fix: explicit null-safe colour + tier computation
function cellColor(score: number) {
  if (score >= 16) return 'bg-red-900 text-white';
  if (score >= 12) return 'bg-red-200 text-red-900';
  if (score >= 9)  return 'bg-orange-200 text-orange-900';
  if (score >= 6)  return 'bg-yellow-100 text-yellow-800';
  return 'bg-emerald-100 text-emerald-800';
}

export function TrendsHeatmaps() {
  const {
    risks,
    activeProjectId,
    activeProgrammeId,
    projects,
    isInitialized,
    loadProjectData,
    loadProgrammeData,
  } = useStore();

  const safeRisks    = Array.isArray(risks)    ? risks    : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const inProgrammeContext = !activeProjectId && !!activeProgrammeId;
  const inProjectContext   = !!activeProjectId;

  // Bug 4: Trigger data load on context change
  useEffect(() => {
    if (!isInitialized) return;
    if (activeProjectId) {
      loadProjectData(activeProjectId);
    } else if (activeProgrammeId) {
      loadProgrammeData(activeProgrammeId);
    }
  }, [isInitialized, activeProjectId, activeProgrammeId]);

  // Bug 3: Scope risks to active context
  const contextRisks = useMemo(() => {
    return safeRisks.filter(r => {
      if (inProjectContext) return r.projectId === activeProjectId;
      if (inProgrammeContext) {
        if (r.programmeId === activeProgrammeId) return true;
        const proj = safeProjects.find(p => p.id === r.projectId);
        return !!proj && proj.programmeId === activeProgrammeId;
      }
      return true;
    });
  }, [safeRisks, safeProjects, activeProjectId, activeProgrammeId, inProjectContext, inProgrammeContext]);

  // Bug 1: Use authoritative taxonomy workstream list, context-aware
  const activeWorkstreams = inProgrammeContext
    ? STRATEGIC_WORKSTREAMS
    : OPERATIONAL_WORKSTREAMS;

  // Bug 1 + 2: Build workstream → max risk score using resolved names
  const heatmapData = useMemo(() => {
    return activeWorkstreams.map(ws => {
      const wsRisks = contextRisks.filter(r => {
        if (!r.workstream) return false;
        // Bug 2: resolve ID → display name before comparing
        const resolvedName = getWorkstreamName(r.workstream);
        return resolvedName === ws;
      });
      const score = wsRisks.length > 0
        ? Math.max(...wsRisks.map(r => r.grossRating || 0))
        : 0;
      return { ws, score, count: wsRisks.length };
    }).filter(row => row.count > 0 || contextRisks.length === 0);
    // When no risks yet, show all rows so heatmap skeleton is visible
  }, [activeWorkstreams, contextRisks]);

  // Category breakdown for supplementary section
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    contextRisks.forEach(r => {
      const cat = r.category || 'Uncategorised';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [contextRisks]);

  // Bug 5: null-safe comparisons for all KPIs
  const severeRisks = contextRisks.filter(r => (r.grossRating || 0) >= 16).length;
  const openRisks   = contextRisks.filter(r => r.status === 'Open').length;
  const totalRisks  = contextRisks.length;

  const hasData = totalRisks > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:scale-110 transition-transform duration-1000" />
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            Trends &amp; Heatmaps
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed max-w-2xl italic">
            Enterprise risk intelligence overview across strategic workstreams. Aggregate heatmaps driven by live field data.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white border-b-4 md:border-t-4 md:border-b-0 border-red-500 border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl md:text-4xl font-black text-red-600 tabular-nums tracking-tighter">{severeRisks}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Severe Risks (≥16)</div>
        </div>
        <div className="bg-white border-b-4 md:border-t-4 md:border-b-0 border-amber-500 border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl md:text-4xl font-black text-amber-600 tabular-nums tracking-tighter">{openRisks}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Open Risks</div>
        </div>
        <div className="bg-white border-b-4 md:border-t-4 md:border-b-0 border-indigo-500 border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl md:text-4xl font-black text-indigo-600 tabular-nums tracking-tighter">{totalRisks}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Risks</div>
        </div>
      </div>

      {/* Workstream Heatmap */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100 flex items-center justify-between">
          <span className="font-black text-slate-900 text-xs md:text-sm uppercase tracking-widest">Risk Heatmap — By Workstream</span>
          <span className="hidden md:inline text-[10px] font-bold text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-3 py-1 rounded-full">Live Analytics Layer</span>
        </div>
        <div className="p-6 md:p-10">
          {!hasData ? (
            <p className="text-slate-400 text-sm text-center py-6">
              No risk data yet. Add risks in the Risk Register to populate this heatmap.
            </p>
          ) : (
            <div className="space-y-4">
              {heatmapData.map(row => (
                <div key={row.ws} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group">
                  <span
                    className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:w-48 flex-shrink-0 group-hover:text-slate-900 transition-colors truncate"
                    title={row.ws}
                  >
                    {row.ws}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 bg-slate-50 rounded-lg overflow-hidden h-8 ring-1 ring-slate-100 group-hover:ring-indigo-100 transition-all">
                      <div
                        className={`h-full flex items-center justify-center text-[10px] font-black transition-all ${cellColor(row.score)}`}
                        style={{
                          width: row.score > 0 ? `${(row.score / 25) * 100}%` : '4%',
                          minWidth: '1.5rem',
                        }}
                      >
                        {row.score > 0 ? row.score : ''}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums w-14 text-right">
                      {row.count} risk{row.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Score Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-10 p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Score Legend:</span>
            {[
              ['bg-emerald-100 text-emerald-800 border-emerald-200',  '1–5 Low'],
              ['bg-yellow-100 text-yellow-800 border-yellow-200',     '6–8 Minor'],
              ['bg-orange-200 text-orange-900 border-orange-300',     '9–11 Moderate'],
              ['bg-red-200 text-red-900 border-red-300',              '12–15 Major'],
              ['bg-red-900 text-white border-red-950',                '16–25 Severe'],
            ].map(([cls, label]) => (
              <span
                key={label}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-transform hover:scale-105 ${cls}`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Category Density — supplementary, not in spec but non-destructive */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100">
            <span className="font-black text-slate-900 text-xs md:text-sm uppercase tracking-widest">Risk Category Density</span>
          </div>
          <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryBreakdown.map(([cat, count]) => (
              <div
                key={cat}
                className="group flex items-center justify-between bg-slate-50 hover:bg-white hover:ring-2 hover:ring-indigo-500/10 rounded-2xl px-5 py-4 transition-all duration-300 border border-transparent hover:border-slate-100 shadow-sm hover:shadow-indigo-500/5"
              >
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-900 truncate mr-4" title={cat}>{cat}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1 w-8 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / totalRisks) * 100)}%` }}
                    />
                  </div>
                  <span className="text-lg font-black text-indigo-600 tabular-nums">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

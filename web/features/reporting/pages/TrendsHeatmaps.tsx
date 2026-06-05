import { TrendingUp, PoundSterling, ArrowUpRight, Flame, AlertTriangle, Shield } from 'lucide-react';
import { StatsCard } from '../../../components/common/StatsCard';
import { useEffect, useMemo } from 'react';
import { useStore } from '../../../store/useStore';
import {
  OPERATIONAL_WORKSTREAMS,
  STRATEGIC_WORKSTREAMS,
  getWorkstreamName,
} from '../../../data/riskTaxonomy';
import {
  calculateMatrixScore,
  bandForScore,
  BAND_STYLES,
  BAND_RANGES,
  SEVERE_SCORE_THRESHOLD,
} from '../../../data/riskScoringMatrix';
import PageHeader from '../../../components/PageHeader';

// Local helpers — used only on this page to display ALE as a passive % of
// linked project / programme value. The matrix-score band drives colour;
// there is no separate "escalation" rule (the matrix already encodes severity).
function resolveLinkedValue(
  risk: { projectId?: string | null; programmeId?: string | null },
  projects: ReadonlyArray<{
    id?: string;
    programmeId?: string | null;
    contractValue?: number | string | null;
    totalValue?: number | null;
    value?: number | null;
  }>,
): number | null {
  const valueOf = (p: typeof projects[number]): number => {
    const v =
      Number(p.contractValue) ||
      Number(p.totalValue) ||
      Number(p.value) ||
      0;
    return v;
  };
  if (risk.projectId) {
    const p = projects.find((x) => x.id === risk.projectId);
    if (!p) return null;
    const v = valueOf(p);
    return v > 0 ? v : null;
  }
  if (risk.programmeId) {
    const sum = projects
      .filter((p) => p.programmeId === risk.programmeId)
      .reduce((acc, p) => acc + valueOf(p), 0);
    return sum > 0 ? sum : null;
  }
  return null;
}
function aleAsPercent(ale: number | null | undefined, value: number | null | undefined): number | null {
  const a = Number(ale) || 0;
  const v = Number(value) || 0;
  if (v <= 0) return null;
  if (a <= 0) return 0;
  return a / v;
}
function formatAlePercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  if (pct < 0.005) return '<1%';
  return `${(pct * 100).toFixed(0)}%`;
}

// Workstream heatmap cell colour — derived from the client's 4-band scheme
// so the supplementary workstream view shares the same visual language as the
// primary 5×5 matrix above.
function cellColor(score: number) {
  return BAND_STYLES[bandForScore(score)].cell;
}

// Compact GBP formatter for the Financial Risk Exposure card. Uses K/M/B
// suffixes so cards stay one line on mobile and table cells don't wrap.
function formatGBP(n: number): string {
  const v = Number(n) || 0;
  if (v <= 0) return '£0';
  if (v >= 1_000_000_000) return `£${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
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

  // Build workstream → max risk score using resolved names.
  // Score is recomputed via calculateMatrixScore (calibrated 5×5 matrix)
  // ONLY for this heatmap page — every other surface in the app continues
  // to read r.grossRating which is the existing L × I product.
  // spec: the heatmap calculates risk scores from the matrix.
  const heatmapData = useMemo(() => {
    return activeWorkstreams.map(ws => {
      const wsRisks = contextRisks.filter(r => {
        if (!r.workstream) return false;
        const resolvedName = getWorkstreamName(r.workstream);
        return resolvedName === ws;
      });
      const score = wsRisks.length > 0
        ? Math.max(...wsRisks.map(r => calculateMatrixScore(r.grossL, r.grossI)))
        : 0;
      return { ws, score, count: wsRisks.length };
    }).filter(row => row.count > 0 || contextRisks.length === 0);
    // When no risks yet, show all rows so heatmap skeleton is visible
  }, [activeWorkstreams, contextRisks]);

  // Financial Risk Exposure rows — per-risk ALE linked to project/programme
  // value, with escalation applied on top of the matrix-derived base band.
  // cost linkage drives the financial threshold
  // for Gross ALE and Residual ALE. Local to this page only — does not
  // change r.grossRating or any other persisted field anywhere in the app.
  const financialExposureRows = useMemo(() => {
    return contextRisks
      .map((r: any) => {
        const linkedValue = resolveLinkedValue(
          { projectId: r.projectId, programmeId: r.programmeId },
          safeProjects as any,
        );
        if (!linkedValue) return null;
        const matrixScore = calculateMatrixScore(r.grossL, r.grossI);
        const baseBand = bandForScore(matrixScore);
        const residualMatrixScore = calculateMatrixScore(r.residualL, r.residualI);
        const residualBaseBand = bandForScore(residualMatrixScore);
        const grossPct = aleAsPercent(r.grossALE, linkedValue);
        const residualPct = aleAsPercent(r.residualALE, linkedValue);
        // Suppress rows that have nothing meaningful to show (no ALE on either side).
        if ((grossPct ?? 0) <= 0 && (residualPct ?? 0) <= 0) return null;
        // Severe (Band 5) flag — any risk with Gross OR Residual
        // Impact = 5 surfaces as escalated.
        const isSevere = Number(r.grossI) >= 5 || Number(r.residualI) >= 5;
        const project = r.projectId
          ? safeProjects.find((p: any) => p.id === r.projectId)
          : null;
        const projectsInProgramme = r.programmeId
          ? safeProjects.filter((p: any) => p.programmeId === r.programmeId).length
          : 0;
        const linkedTo = project
          ? ((project as any).name || (project as any).id || 'Linked project')
          : r.programmeId
            ? `Programme · ${projectsInProgramme} project${projectsInProgramme !== 1 ? 's' : ''}`
            : '—';
        return {
          id: r.id,
          title: r.title || '(untitled risk)',
          linkedTo,
          linkedValue,
          grossL: r.grossL,
          grossI: r.grossI,
          matrixScore,
          baseBand,
          residualMatrixScore,
          residualBaseBand,
          grossALE: Number(r.grossALE) || 0,
          residualALE: Number(r.residualALE) || 0,
          grossPct,
          residualPct,
          isSevere,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => {
        // Severe first; then by gross % desc.
        if (a.isSevere && !b.isSevere) return -1;
        if (!a.isSevere && b.isSevere) return 1;
        return (b.grossPct ?? 0) - (a.grossPct ?? 0);
      });
  }, [contextRisks, safeProjects]);

  const escalatedCount = financialExposureRows.filter(r => r.isSevere).length;

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

  // KPI counts. Severe count uses the matrix-based score ≥19 (Severe band
  //  5-band scheme: Insignificant 1-3 / Minor 4-6 / Moderate 7-11
  // / Major 12-18 / Severe 19-25).
  const severeRisks = contextRisks.filter(
    r => calculateMatrixScore(r.grossL, r.grossI) >= SEVERE_SCORE_THRESHOLD,
  ).length;
  const openRisks   = contextRisks.filter(r => r.status === 'Open').length;
  const totalRisks  = contextRisks.length;

  const hasData = totalRisks > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trends & Heatmaps"
        subtitle="Enterprise risk intelligence across strategic workstreams. Aggregate heatmaps driven by live field data."
        breadcrumbs={[{label:"Monitoring & Reporting"},{label:"Trends & Heatmaps"}]}
      />

      {/* KPIs*/}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <StatsCard
          icon={Flame}
          title={`Severe Risks (≥${SEVERE_SCORE_THRESHOLD})`}
          value={severeRisks}
          iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
          iconClassName="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          icon={AlertTriangle}
          title="Open Risks"
          value={openRisks}
          iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
          iconClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          icon={Shield}
          title="Total Risks"
          value={totalRisks}
          iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
          iconClassName="text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Workstream Heatmap*/}
      <div className="bg-white rounded-lg md:rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100 flex items-center justify-between">
          <span className="font-mono font-semibold text-slate-900 text-xs md:text-sm uppercase tracking-wide">Risk Heatmap — By Workstream</span>
          <span className="hidden md:inline text-[10px] font-mono font-medium text-indigo-500 uppercase tracking-wide bg-indigo-50 px-3 py-1 rounded-full">Live Analytics Layer</span>
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
                    className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wide sm:w-48 flex-shrink-0 group-hover:text-slate-900 transition-colors truncate"
                    title={row.ws}
                  >
                    {row.ws}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 bg-slate-50 rounded-lg overflow-hidden h-8 ring-1 ring-slate-100 group-hover:ring-indigo-100 transition-all">
                      <div
                        className={`h-full flex items-center justify-center text-[11px] font-mono font-semibold tabular-nums transition-all ${cellColor(row.score)}`}
                        style={{
                          width: row.score > 0 ? `${(row.score / 25) * 100}%` : '4%',
                          minWidth: '1.5rem',
                        }}
                      >
                        {row.score > 0 ? row.score : ''}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-medium text-slate-400 tabular-nums w-14 text-right">
                      {row.count} risk{row.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Score Legend — uses the same 4 bands as the calibrated matrix above*/}
          <div className="flex flex-wrap items-center gap-3 mt-10 p-5 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wide mr-2">Score Legend:</span>
            {BAND_RANGES.map(({ band, range }) => {
              const styles = BAND_STYLES[band];
              return (
                <span
                  key={band}
                  className={`px-3 py-1 rounded-lg text-[10px] font-mono font-medium uppercase tracking-wide border transition-transform hover:scale-105 ${styles.pill}`}
                >
                  {range} {styles.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Financial Risk Exposure — ALE values + ALE % of linked project/programme
 value. The matrix score drives the band colour (no separate ALE
 escalation rule — the calibrated 5-band scheme already encodes
 severity ). Severe (Band 5) Impact = 5 risks
 carry the rose ESCALATE pill.*/}
      <div className="bg-white rounded-lg md:rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <PoundSterling className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <span className="block font-mono font-semibold text-slate-900 text-xs md:text-sm uppercase tracking-wide">Financial Risk Exposure</span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                Gross / Residual ALE = Impact (£) × Likelihood probability · % shown against linked project / programme value
              </span>
            </div>
          </div>
          {escalatedCount > 0 && (
            <span className="text-[10px] font-mono font-medium text-rose-600 uppercase tracking-wide bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
              {escalatedCount} severe
            </span>
          )}
        </div>
        <div className="p-4 md:p-6">
          {financialExposureRows.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">
              No risks with linked project/programme cost in this context. Add a contract value to the project, or link risks to a project, to see ALE figures here.
            </p>
          ) : (
            <div className="space-y-3">
              {financialExposureRows.map(row => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:ring-2 hover:ring-indigo-500/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate" title={row.title}>
                          {row.title}
                        </span>
                        {row.isSevere && (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" aria-label="Severe impact — escalate" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1 truncate tabular-nums" title={row.linkedTo}>
                        {row.linkedTo} · L={row.grossL} I={row.grossI} · matrix score {row.matrixScore}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wide border ${BAND_STYLES[row.baseBand].pill}`}
                        title="Gross band from 5×5 matrix score"
                      >
                        Gross · {BAND_STYLES[row.baseBand].label}
                      </span>
                      <span className="text-slate-400 text-xs">→</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wide border ${BAND_STYLES[row.residualBaseBand].pill}`}
                        title="Residual band from 5×5 matrix score"
                      >
                        Residual · {BAND_STYLES[row.residualBaseBand].label}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                      <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Linked Value</div>
                      <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{formatGBP(row.linkedValue)}</div>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                      <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Gross ALE</div>
                      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 tabular-nums">{formatGBP(row.grossALE)}</span>
                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">{formatAlePercent(row.grossPct)}</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                      <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Residual ALE</div>
                      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 tabular-nums">{formatGBP(row.residualALE)}</span>
                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">{formatAlePercent(row.residualPct)}</span>
                      </div>
                    </div>
                  </div>
                  {row.isSevere && (
                    <div className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 mt-1">
                      Severe Impact (Band 5) — escalate to senior management immediately.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Density — supplementary, not in spec but non-destructive*/}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-lg md:rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100">
            <span className="font-mono font-semibold text-slate-900 text-xs md:text-sm uppercase tracking-wide">Risk Category Density</span>
          </div>
          <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryBreakdown.map(([cat, count]) => (
              <div
                key={cat}
                className="group flex items-center justify-between bg-slate-50 hover:bg-white hover:ring-2 hover:ring-indigo-500/10 rounded-lg px-5 py-4 transition-all duration-300 border border-transparent hover:border-slate-100 shadow-sm hover:shadow-indigo-500/5"
              >
                <span className="font-mono text-[11px] font-semibold text-slate-600 uppercase tracking-wide group-hover:text-slate-900 truncate mr-4" title={cat}>{cat}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1 w-8 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / totalRisks) * 100)}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-indigo-600 tabular-nums">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

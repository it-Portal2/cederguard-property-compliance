import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, CalendarCheck } from 'lucide-react';
import {
  getGrossScore,
  getResidualScore,
} from '../../lib/riskMetrics';

type RiskLike = {
  id?: string;
  grossRating?: number;
  residualRating?: number;
  grossL?: number;
  grossI?: number;
  residualL?: number;
  residualI?: number;
  residualALE?: number;
  status?: string;
  dateAdded?: string;
  dueDate?: string;
  category?: string;
  [k: string]: any;
};

type MilestoneLike = {
  date?: string;
  title?: string;
  name?: string;
  stage?: string;
  [k: string]: any;
};

type Props = {
  risks: RiskLike[];
  milestones?: MilestoneLike[];
  className?: string;
  onPlanSprint?: () => void;
};

type Point = { d: number; score: number };

const W = 720;
const H = 290;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 26;
const DAYS = 90;
const dayMs = 86_400_000;

/** Reduction one mitigation delivers (gross score minus post-mitigation residual). */
function reductionFor(r: RiskLike): number {
  const gross = getGrossScore(r);
  const residual = getResidualScore(r);
  // Fall back to 50% reduction when residual is missing/zero
  if (residual <= 0) return gross * 0.5;
  return Math.max(0, gross - residual);
}

/**
 * Daily risk-accrual rate from real `dateAdded` history.
 * Uses ALL risks (not just open) over the last 90 days so the baseline
 * reflects the actual creation cadence.
 */
function computeDailyAccrual(risks: RiskLike[]): number {
  const cutoff = Date.now() - 90 * dayMs;
  const recent = risks.filter((r) => {
    const t = r.dateAdded ? new Date(r.dateAdded).getTime() : NaN;
    return !isNaN(t) && t > cutoff;
  });
  return recent.length / 90;
}

function buildBaseline(grossSum: number, dailyAccrual: number, avgScorePerRisk: number): Point[] {
  const out: Point[] = [];
  for (let d = 0; d <= DAYS; d++) {
    out.push({ d, score: grossSum + dailyAccrual * avgScorePerRisk * d });
  }
  return out;
}

function buildPlanned(
  grossSum: number,
  top3: RiskLike[],
  top3Reduction: number,
): Point[] {
  const out: Point[] = [];
  const todayMs = Date.now();
  const hasDueDates = top3.length > 0 && top3.every((r) =>
    r.dueDate && !isNaN(new Date(r.dueDate).getTime())
  );

  for (let d = 0; d <= DAYS; d++) {
    let landed = 0;
    if (hasDueDates) {
      const dateAtDay = todayMs + d * dayMs;
      top3.forEach((r) => {
        const due = new Date(r.dueDate!).getTime();
        if (due <= dateAtDay) landed += reductionFor(r);
      });
    } else {
      // Linear-decay fallback over 45 days when due dates absent
      const t = Math.min(d, 45) / 45;
      landed = top3Reduction * t;
    }
    const score = Math.max(grossSum - top3Reduction, grossSum - landed);
    out.push({ d, score });
  }
  return out;
}

function shortStageLabel(m: MilestoneLike): string {
  if (m.stage) return m.stage.toString();
  return (m.title || m.name || 'Milestone').toString();
}

export function RiskBurnDown({ risks, milestones = [], className, onPlanSprint }: Props) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const model = useMemo(() => {
    const openRisks = risks.filter((r) => r.status === 'Open');
    const grossSum = openRisks.reduce((s, r) => s + getGrossScore(r), 0);
    const residualSum = openRisks.reduce((s, r) => {
      const res = getResidualScore(r);
      return s + (res > 0 ? res : getGrossScore(r) * 0.5);
    }, 0);

    const top3 = [...openRisks]
      .sort((a, b) => getGrossScore(b) - getGrossScore(a))
      .slice(0, 3);
    const top3Reduction = top3.reduce((s, r) => s + reductionFor(r), 0);

    // Tolerance line = 20% above residual sum (where we'd sit if every current mitigation lands)
    const tolerance = Math.round(residualSum * 1.2);

    const avgScorePerRisk = openRisks.length > 0 ? grossSum / openRisks.length : 0;
    const dailyAccrual = computeDailyAccrual(risks);

    const baselineArr = buildBaseline(grossSum, dailyAccrual, avgScorePerRisk);
    const plannedArr = buildPlanned(grossSum, top3, top3Reduction);

    // Y-axis ceiling — covers worst-case (baseline end) with a 10% headroom; floor at 50.
    const peak = Math.max(grossSum, baselineArr[DAYS].score, tolerance);
    const yMaxVal = Math.max(50, Math.ceil((peak * 1.1) / 50) * 50);

    // Baseline crosses tolerance going UP when accruing risks pushes score above tolerance.
    // (Baseline holds or rises; planned curves drop.)
    const baselineBreachDay = (() => {
      if (grossSum >= tolerance) return 0;
      if (dailyAccrual <= 0 || avgScorePerRisk <= 0) return -1;
      const idx = baselineArr.findIndex((p) => p.score >= tolerance);
      return idx > 0 ? idx : -1;
    })();

    const plannedEnd = plannedArr[DAYS].score;
    const reductionPct = grossSum > 0
      ? Math.max(0, Math.round(((grossSum - plannedEnd) / grossSum) * 100))
      : 0;

    // Real milestones inside the window — no hardcoded fallback (drop when empty)
    const todayMs = Date.now();
    const anchors = milestones
      .map((m) => {
        if (!m.date) return null;
        const t = new Date(m.date).getTime();
        if (isNaN(t)) return null;
        const dayOffset = Math.round((t - todayMs) / dayMs);
        if (dayOffset <= 0 || dayOffset > DAYS) return null;
        return { d: dayOffset, label: shortStageLabel(m) };
      })
      .filter((a): a is { d: number; label: string } => a != null)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);

    // Top-3 categories for the "Recommended next action" copy
    const categories = Array.from(
      new Set(top3.map((r) => r.category).filter((c): c is string => Boolean(c)))
    );
    const categoryPhrase = categories.length === 0
      ? 'the top-3 highest-scored risks'
      : categories.length === 1
        ? `${categories[0]} risks`
        : categories.length === 2
          ? `${categories[0]} + ${categories[1]} risks`
          : `${categories[0]}, ${categories[1]} + others`;

    // Footnotes for honest fallback signalling
    const footnotes: string[] = [];
    if (openRisks.length > 0 && top3.some((r) => getResidualScore(r) <= 0)) {
      footnotes.push('Residual scores estimated at 50% reduction for risks without explicit residual ratings.');
    }
    if (top3.length > 0 && !top3.every((r) => r.dueDate && !isNaN(new Date(r.dueDate).getTime()))) {
      footnotes.push('Top-3 mitigation due dates not set; assuming a 45-day linear close.');
    }

    return {
      hasData: openRisks.length > 0,
      grossSum,
      residualSum,
      tolerance,
      baseline: baselineArr,
      planned: plannedArr,
      yMax: yMaxVal,
      baselineBreachDay,
      reductionPct,
      anchors,
      categoryPhrase,
      footnotes,
    };
  }, [risks, milestones]);

  // Empty state — hide the chart when there are no open risks.
  if (!model.hasData) {
    return (
      <div
        className={clsx(
          'rounded-lg border border-dashed border-slate-200 bg-white p-6',
          className,
        )}
      >
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-400 mb-2">
            Risk outlook
          </div>
          <p className="text-sm text-slate-500 max-w-sm">
            No open risks in this context — nothing to project. Add or open risks in the
            register to see the 90-day outlook.
          </p>
        </div>
      </div>
    );
  }

  const xs = (d: number) => PAD_L + (d / DAYS) * (W - PAD_L - PAD_R);
  const ys = (s: number) => H - PAD_B - (s / model.yMax) * (H - PAD_T - PAD_B);

  const pathOf = (arr: Point[]) =>
    arr
      .map((p, i) => `${i ? 'L' : 'M'}${xs(p.d).toFixed(1)} ${ys(p.score).toFixed(1)}`)
      .join(' ');

  const areaOf = (arr: Point[]) =>
    pathOf(arr) + ` L${xs(DAYS).toFixed(1)} ${H - PAD_B} L${xs(0).toFixed(1)} ${H - PAD_B} Z`;

  const hoverBaseline = hoverDay == null ? null : model.baseline[hoverDay];
  const hoverPlanned = hoverDay == null ? null : model.planned[hoverDay];
  const hoverX = hoverDay == null ? 0 : xs(hoverDay);
  const hoverY =
    hoverBaseline && hoverPlanned
      ? Math.min(ys(hoverBaseline.score), ys(hoverPlanned.score))
      : 0;

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-white',
        className,
      )}
      style={{
        backgroundImage:
          'radial-gradient(80% 120% at 100% 0%, rgba(99,102,241,0.08), transparent 50%), radial-gradient(60% 100% at 0% 100%, rgba(244,63,94,0.05), transparent 55%)',
      }}
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5 lg:gap-6 items-stretch">
          {/* Chart column */}
          <div className="min-w-0 flex flex-col h-full">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Risk outlook · next 90 days
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono text-indigo-600 border border-indigo-200 bg-indigo-50">
                    Projection
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate gross-risk score under two scenarios — do nothing vs execute the top 3 highest-scored risks.
                </p>
              </div>
            </div>
            <div className="relative flex-1 flex flex-col h-full">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="w-full flex-1 h-full"
                style={{ height: '100%', minHeight: H, display: 'block' }}
                role="img"
                aria-label="90-day risk outlook projection"
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const viewX = ((event.clientX - rect.left) / rect.width) * W;
                  const plotRatio = (viewX - PAD_L) / (W - PAD_L - PAD_R);
                  setHoverDay(Math.round(Math.max(0, Math.min(1, plotRatio)) * DAYS));
                }}
                onMouseLeave={() => setHoverDay(null)}
                cursor="crosshair"
              >
                <defs>
                  <linearGradient id="bd-base" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="bd-plan" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="bd-tol" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* above-tolerance shaded zone */}
                <rect
                  x={PAD_L}
                  y={PAD_T}
                  width={W - PAD_L - PAD_R}
                  height={Math.max(0, ys(model.tolerance) - PAD_T)}
                  fill="url(#bd-tol)"
                />
                {/* axes */}
                <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth="1" />
                {/* X-axis day ticks — always rendered so the time scale is legible */}
                {[0, 23, 45, 68, 90].map((d) => (
                  <g key={`xtick-${d}`}>
                    <line
                      x1={xs(d)}
                      x2={xs(d)}
                      y1={H - PAD_B}
                      y2={H - PAD_B + 4}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                    <text
                      x={xs(d)}
                      y={H - PAD_B + 15}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="Geist Mono, ui-monospace, monospace"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      {d === 0 ? 'Today' : `+${d}d`}
                    </text>
                  </g>
                ))}
                {/* gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
                  <g key={i}>
                    <line
                      x1={PAD_L}
                      x2={W - PAD_R}
                      y1={ys(model.yMax * g)}
                      y2={ys(model.yMax * g)}
                      stroke="#e2e8f0"
                      strokeDasharray="2 3"
                    />
                    <text
                      x={PAD_L - 8}
                      y={ys(model.yMax * g) + 3.5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="Geist Mono, ui-monospace, monospace"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      {Math.round(model.yMax * g)}
                    </text>
                  </g>
                ))}
                {/* tolerance line */}
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={ys(model.tolerance)}
                  y2={ys(model.tolerance)}
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="5 4"
                />
                <text
                  x={W - PAD_R - 4}
                  y={ys(model.tolerance) - 6}
                  textAnchor="end"
                  fill="#f43f5e"
                  fontSize="10"
                  fontFamily="Geist Mono, ui-monospace, monospace"
                  style={{ letterSpacing: '0.01em', textTransform: 'uppercase' }}
                >
                  Tolerance line · {model.tolerance}
                </text>
                {/* baseline area + path */}
                <path d={areaOf(model.baseline)} fill="url(#bd-base)" />
                <path
                  d={pathOf(model.baseline)}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* planned area + path */}
                <path d={areaOf(model.planned)} fill="url(#bd-plan)" />
                <path
                  d={pathOf(model.planned)}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* stage anchors — only real milestones in window */}
                {model.anchors.map((st) => (
                  <g key={`${st.d}-${st.label}`}>
                    <line
                      x1={xs(st.d)}
                      x2={xs(st.d)}
                      y1={PAD_T}
                      y2={H - PAD_B}
                      stroke="#e2e8f0"
                      strokeDasharray="2 3"
                    />
                    <circle cx={xs(st.d)} cy={PAD_T} r="3" fill="#6366f1" />
                    <text
                      x={xs(st.d)}
                      y={PAD_T - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#64748b"
                      fontFamily="Geist Mono, ui-monospace, monospace"
                      style={{ letterSpacing: '0.01em', textTransform: 'uppercase' }}
                    >
                      {st.label}
                    </text>
                  </g>
                ))}
                {/* trajectory end markers */}
                <circle cx={xs(DAYS)} cy={ys(model.baseline[DAYS].score)} r="3" fill="#f43f5e" />
                <circle cx={xs(DAYS)} cy={ys(model.planned[DAYS].score)} r="3" fill="#6366f1" />
                {model.baselineBreachDay > 0 && (
                  <circle
                    cx={xs(model.baselineBreachDay)}
                    cy={ys(model.tolerance)}
                    r="4"
                    fill="#fff"
                    stroke="#f43f5e"
                    strokeWidth="1.6"
                  />
                )}
                {hoverDay != null && hoverBaseline && hoverPlanned && (
                  <g pointerEvents="none">
                    <line
                      x1={hoverX}
                      x2={hoverX}
                      y1={PAD_T}
                      y2={H - PAD_B}
                      stroke="#334155"
                      strokeOpacity="0.35"
                      strokeDasharray="3 3"
                    />
                    <circle cx={hoverX} cy={ys(hoverBaseline.score)} r="4" fill="#fff" stroke="#f43f5e" strokeWidth="1.8" />
                    <circle cx={hoverX} cy={ys(hoverPlanned.score)} r="4" fill="#fff" stroke="#6366f1" strokeWidth="1.8" />
                  </g>
                )}
              </svg>
              {hoverDay != null && hoverBaseline && hoverPlanned && (
                <div
                  className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white/95 px-2.5 py-2 text-[11px] shadow-lg"
                  style={{
                    left: `${Math.min(92, Math.max(8, (hoverX / W) * 100))}%`,
                    top: `${Math.min(72, Math.max(12, (hoverY / H) * 100))}%`,
                    transform: hoverX > W * 0.72 ? 'translate(-100%, -8px)' : 'translate(10px, -8px)',
                  }}
                >
                  <div className="font-mono text-[10px] uppercase text-slate-500" style={{ letterSpacing: '0.01em' }}>
                    Day +{hoverDay}
                  </div>
                  <div className="mt-1 grid gap-0.5 font-mono tabular-nums text-slate-700">
                    <span><span className="text-rose-600">Baseline</span> {Math.round(hoverBaseline.score)}</span>
                    <span><span className="text-indigo-600">Planned</span> {Math.round(hoverPlanned.score)}</span>
                    <span><span className="text-slate-500">Tolerance</span> {model.tolerance}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column — burn-stat cards */}
          <div className="flex flex-col gap-2.5">
            <BurnStat
              label="If we do nothing"
              value={(() => {
                if (model.baselineBreachDay === 0) return 'Over';
                if (model.baselineBreachDay > 0) return `${model.baselineBreachDay}d`;
                return '—';
              })()}
              sub={(() => {
                if (model.baselineBreachDay === 0) return 'Already above tolerance';
                if (model.baselineBreachDay > 0) return 'until score crosses the tolerance line';
                return 'no projected drift in window';
              })()}
              tone="danger"
            />
            <BurnStat
              label="With top-3 mitigations"
              value={`−${model.reductionPct}%`}
              sub={`risk reduction by day ${DAYS}`}
              tone="accent"
            />
            <div
              className="rounded-lg p-3.5 border border-indigo-200 flex flex-col gap-2"
              style={{
                background:
                  'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(99,102,241,0.04))',
              }}
            >
              <div className="font-mono text-[10px] uppercase text-slate-500" style={{ letterSpacing: '0.01em' }}>
                Recommended next action
              </div>
              <div className="text-sm font-semibold text-slate-900 leading-snug">
                Stand up a 14-day mitigation sprint focused on {model.categoryPhrase}.
              </div>
              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={onPlanSprint}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Plan sprint
                </button>
                <button
                  type="button"
                  onClick={onPlanSprint}
                  aria-label="Details"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500 font-mono">
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-full" style={{ background: '#f43f5e' }} /> Do nothing · baseline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-full" style={{ background: '#6366f1' }} /> Top-3 mitigations · planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block" style={{ width: 10, height: 2, background: '#f43f5e' }} /> Tolerance line
          </span>
        </div>
        {model.footnotes.length > 0 && (
          <div className="text-[11px] text-slate-400 leading-relaxed">
            {model.footnotes.map((note, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span aria-hidden="true">·</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BurnStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'danger' | 'accent';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </div>
      <div
        className={clsx(
          'text-2xl font-medium tracking-tight leading-none tabular-nums',
          tone === 'danger' ? 'text-rose-600' : 'text-indigo-600',
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">{sub}</div>
    </div>
  );
}

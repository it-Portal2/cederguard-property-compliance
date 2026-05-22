import { useMemo } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, CalendarCheck } from 'lucide-react';

type Props = {
  critical: number;
  open: number;
  className?: string;
  onPlanSprint?: () => void;
};

type Point = { d: number; score: number };

const W = 720;
const H = 240;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 26;
const DAYS = 90;

const STAGES: { d: number; label: string }[] = [
  { d: 14, label: 'Stage 2 gate' },
  { d: 45, label: 'Stage 3 gate' },
  { d: 75, label: 'Board review' },
];

function buildTrajectory(
  startScore: number,
  mode: 'baseline' | 'planned',
): Point[] {
  const out: Point[] = [];
  for (let d = 0; d <= DAYS; d++) {
    let score: number;
    if (mode === 'baseline') {
      const t = d / DAYS;
      score = Math.max(0, startScore * (1 - 0.1 * t) + Math.sin(d / 8) * 6);
    } else {
      let p = startScore;
      if (d <= 14) p = startScore * (1 - 0.32 * (d / 14));
      else if (d <= 45) p = startScore * 0.68 * (1 - 0.45 * ((d - 14) / 31));
      else p = startScore * 0.37 * (1 - 0.35 * ((d - 45) / 45));
      score = Math.max(8, p + Math.sin(d / 6) * 2);
    }
    out.push({ d, score });
  }
  return out;
}

export function RiskBurnDown({ critical, open, className, onPlanSprint }: Props) {
  const { baseline, planned, startScore, breachAt, yMax, breachDay, breachDayPlanned, reductionPct } =
    useMemo(() => {
      const composite = critical * 24 + open * 6;
      const start = Math.max(60, composite);
      const baselineArr = buildTrajectory(start, 'baseline');
      const plannedArr = buildTrajectory(start, 'planned');
      const breach = Math.round(start * 0.55);
      const yMaxVal = Math.ceil(start / 50) * 50;
      const bDay = baselineArr.findIndex((p) => p.score < breach);
      const pDay = plannedArr.findIndex((p) => p.score < breach);
      const reduction = Math.round((1 - plannedArr[DAYS].score / start) * 100);
      return {
        baseline: baselineArr,
        planned: plannedArr,
        startScore: start,
        breachAt: breach,
        yMax: yMaxVal,
        breachDay: bDay,
        breachDayPlanned: pDay,
        reductionPct: reduction,
      };
    }, [critical, open]);

  const xs = (d: number) => PAD_L + (d / DAYS) * (W - PAD_L - PAD_R);
  const ys = (s: number) => H - PAD_B - (s / yMax) * (H - PAD_T - PAD_B);

  const pathOf = (arr: Point[]) =>
    arr
      .map((p, i) => `${i ? 'L' : 'M'}${xs(p.d).toFixed(1)} ${ys(p.score).toFixed(1)}`)
      .join(' ');

  const areaOf = (arr: Point[]) =>
    pathOf(arr) + ` L${xs(DAYS).toFixed(1)} ${H - PAD_B} L${xs(0).toFixed(1)} ${H - PAD_B} Z`;

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
      <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5 lg:gap-6 items-stretch">
        {/* Chart column */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Risk burn-down · next 90 days
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono text-indigo-600 border border-indigo-200 bg-indigo-50">
                  Forecast
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Projection of composite gross risk score, baseline vs executing the top 3 mitigations.
              </p>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full"
            style={{ height: H, display: 'block' }}
            role="img"
            aria-label="90-day risk burn-down projection"
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
              <linearGradient id="bd-breach" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* breach zone */}
            <rect
              x={PAD_L}
              y={PAD_T}
              width={W - PAD_L - PAD_R}
              height={ys(breachAt) - PAD_T}
              fill="url(#bd-breach)"
            />
            {/* gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
              <g key={i}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={ys(yMax * g)}
                  y2={ys(yMax * g)}
                  stroke="#e2e8f0"
                  strokeDasharray="2 3"
                />
                <text
                  x={PAD_L - 8}
                  y={ys(yMax * g) + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="Geist Mono, ui-monospace, monospace"
                >
                  {Math.round(yMax * g)}
                </text>
              </g>
            ))}
            {/* breach threshold */}
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={ys(breachAt)}
              y2={ys(breachAt)}
              stroke="#f43f5e"
              strokeWidth="1.2"
              strokeDasharray="5 4"
            />
            <text
              x={W - PAD_R - 4}
              y={ys(breachAt) - 6}
              textAnchor="end"
              fill="#f43f5e"
              fontSize="10"
              fontFamily="Geist Mono, ui-monospace, monospace"
              style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              Regulatory breach line · {breachAt}
            </text>
            {/* baseline area + path */}
            <path d={areaOf(baseline)} fill="url(#bd-base)" />
            <path
              d={pathOf(baseline)}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* planned area + path */}
            <path d={areaOf(planned)} fill="url(#bd-plan)" />
            <path
              d={pathOf(planned)}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* stage anchors */}
            {STAGES.map((st) => (
              <g key={st.d}>
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
                  style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {st.label}
                </text>
                <text
                  x={xs(st.d)}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                  fontFamily="Geist Mono, ui-monospace, monospace"
                >
                  +{st.d}d
                </text>
              </g>
            ))}
            {/* trajectory end markers */}
            <circle cx={xs(DAYS)} cy={ys(baseline[DAYS].score)} r="3" fill="#f43f5e" />
            <circle cx={xs(DAYS)} cy={ys(planned[DAYS].score)} r="3" fill="#6366f1" />
            {breachDay > 0 && (
              <circle
                cx={xs(breachDay)}
                cy={ys(breachAt)}
                r="4"
                fill="#fff"
                stroke="#f43f5e"
                strokeWidth="1.6"
              />
            )}
            {breachDayPlanned > 0 && (
              <circle
                cx={xs(breachDayPlanned)}
                cy={ys(breachAt)}
                r="4"
                fill="#fff"
                stroke="#6366f1"
                strokeWidth="1.6"
              />
            )}
          </svg>
          <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-slate-500 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full" style={{ background: '#f43f5e' }} /> Do nothing · trajectory
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full" style={{ background: '#6366f1' }} /> Top 3 mitigations · planned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block" style={{ width: 10, height: 2, background: '#f43f5e' }} /> Regulatory breach line
            </span>
          </div>
        </div>

        {/* Right column — burn-stat cards */}
        <div className="flex flex-col gap-2.5">
          <BurnStat
            label="If we do nothing"
            value={breachDay > 0 ? `${breachDay}d` : '—'}
            sub={
              breachDay > 0
                ? 'until composite score crosses the breach line'
                : 'no projected breach in window'
            }
            tone="danger"
          />
          <BurnStat
            label="With top 3 mitigations"
            value={`−${reductionPct}%`}
            sub={`composite risk reduction by day ${DAYS}`}
            tone="accent"
          />
          <div
            className="rounded-lg p-3.5 border border-indigo-200 flex flex-col gap-2"
            style={{
              background:
                'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(99,102,241,0.04))',
            }}
          >
            <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
              Recommended next action
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-snug">
              Stand up a 14-day verification sprint focused on Safety + Funding categories.
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

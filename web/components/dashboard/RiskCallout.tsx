import { AlertTriangle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { getGrossScore, getResidualALE, SEVERE_SCORE_THRESHOLD } from '../../lib/riskMetrics';

type RiskLike = {
  grossRating?: number;
  grossL?: number;
  grossI?: number;
  residualALE?: number;
  [k: string]: any;
};

type Props = {
  risks: RiskLike[];
  className?: string;
  onGenerate?: () => void;
};

export function RiskCallout({ risks, className, onGenerate }: Props) {
  if (!Array.isArray(risks) || risks.length === 0) return null;

  const exposureOf = (r: RiskLike) => getResidualALE(r);
  const scoreOf = (r: RiskLike) => getGrossScore(r);

  const critical = risks.filter((r) => scoreOf(r) >= SEVERE_SCORE_THRESHOLD);
  const totalExp = risks.reduce((s, r) => s + exposureOf(r), 0);
  const criticalExp = critical.reduce((s, r) => s + exposureOf(r), 0);
  const top3 = [...risks].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 3);
  const top3Exp = top3.reduce((s, r) => s + exposureOf(r), 0);

  const critPct = totalExp > 0 ? Math.round((criticalExp / totalExp) * 100) : 0;
  const top3Pct = totalExp > 0 ? Math.round((top3Exp / totalExp) * 100) : 0;

  if (critical.length === 0 && top3.length === 0) return null;

  return (
    <div
      className={clsx(
        'rounded-lg border border-dashed border-indigo-200 p-3 grid grid-cols-[22px_1fr_auto] gap-3 items-start',
        className,
      )}
      style={{
        background:
          'linear-gradient(90deg, rgba(99,102,241,0.08), rgba(99,102,241,0) 80%)',
      }}
    >
      <span className="inline-flex w-5.5 h-5.5 items-center justify-center rounded-md bg-rose-50 text-rose-600">
        <AlertTriangle className="w-3.5 h-3.5" />
      </span>
      <p className="text-xs text-slate-700 leading-relaxed">
        <span className="font-semibold text-slate-900 tabular-nums">{critical.length}</span>{' '}
        {critical.length === 1 ? 'risk sits' : 'risks sit'} in the critical quadrant
        {totalExp > 0 ? (
          <>
            {' '}carrying{' '}
            <span className="font-semibold text-slate-900 tabular-nums">{critPct}%</span> of
            total exposure
          </>
        ) : null}
        . Closing the top{' '}
        <span className="font-semibold text-slate-900 tabular-nums">{top3.length}</span>
        {totalExp > 0 ? (
          <>
            {' '}(
            <span className="font-semibold text-slate-900 tabular-nums">{top3Pct}%</span> of
            exposure)
          </>
        ) : null}{' '}
        would re-base the portfolio below the breach line.
      </p>
      {onGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors self-start"
        >
          Generate mitigation plan
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

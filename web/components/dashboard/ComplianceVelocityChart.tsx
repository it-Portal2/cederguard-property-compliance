import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';

type ComplianceItem = {
  status?: string;
  stage?: string;
  /** Set when an item is moved to Live/Closed (see store.updateComplianceItem). */
  completedAt?: string | number | Date;
  [k: string]: any;
};

type Range = number; // Window in days. Pills set 7/30/90; custom picker can set any positive integer.

type Props = {
  items: ComplianceItem[];
  className?: string;
  /** Optional controlled range. When passed, the chart's range pills
   *  call `onRangeChange` instead of mutating internal state. */
  range?: Range;
  onRangeChange?: (r: Range) => void;
};

// Velocity = requirements VERIFIED over time. Bucket by `completedAt`, not
// creation date — every item is created at once during analysis (a single
// spike), whereas verification happens over time.
function bucketByCompletion(items: ComplianceItem[], days: number) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const perDay = Array.from({ length: days }, () => 0);
  let baseline = 0; // verified BEFORE the window (seeds the cumulative line)

  items.forEach((it) => {
    const raw = it.completedAt;
    if (!raw) return; // only verified items carry completedAt
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    if (d > today) return;
    if (d < start) {
      baseline += 1;
      return;
    }
    const idx = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (idx >= 0 && idx < perDay.length) perDay[idx] += 1;
  });

  let running = baseline;
  const data = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    running += perDay[i];
    data.push({
      day: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      verified: perDay[i],
      cumulative: running,
    });
  }

  const verifiedInWindow = perDay.reduce((a, b) => a + b, 0);
  return { data, baseline, verifiedInWindow };
}

// Current snapshot (not time-bucketed) for the legend + progress %.
function statusTotals(items: ComplianceItem[]) {
  let verified = 0;
  let inProgress = 0;
  let pending = 0;
  items.forEach((it) => {
    const s = String(it.stage || '').toLowerCase();
    if (s === 'live' || s === 'archived') verified += 1;
    else if (s === 'in progress') inProgress += 1;
    else pending += 1;
  });
  return { verified, inProgress, pending, total: verified + inProgress + pending };
}

export function ComplianceVelocityChart({
  items,
  className,
  range: controlledRange,
  onRangeChange,
}: Props) {
  const [internalRange, setInternalRange] = useState<Range>(30);
  const isControlled = typeof controlledRange === 'number';
  const range: Range = isControlled ? (controlledRange as Range) : internalRange;
  const setRange = (r: Range) => {
    if (onRangeChange) onRangeChange(r);
    if (!isControlled) setInternalRange(r);
  };

  const { data, verifiedInWindow } = useMemo(
    () => bucketByCompletion(items, range),
    [items, range],
  );
  const totals = useMemo(() => statusTotals(items), [items]);
  const pctComplete = totals.total > 0 ? Math.round((totals.verified / totals.total) * 100) : 0;
  const hasData = verifiedInWindow > 0;

  return (
    <div className={clsx('bg-white rounded-lg border border-slate-200', className)}>
      <div className="px-5 pt-5 pb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
            Compliance velocity
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Requirements verified across the window, with cumulative progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
            <LegendChip color="#10b981" label="Verified" val={totals.verified} />
            <LegendChip color="#6366f1" label="In progress" val={totals.inProgress} />
            <LegendChip color="#f59e0b" label="Pending" val={totals.pending} />
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 self-start">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r as Range)}
                className={clsx(
                  'px-2.5 h-7 text-xs font-medium rounded-md transition-colors font-mono',
                  range === r
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className="px-2 h-55"
        role="img"
        aria-label={`Compliance verified over the last ${range} days`}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
                labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                cursor={{ fill: 'rgba(99,102,241,0.05)' }}
              />
              <Bar
                yAxisId="left"
                dataKey="verified"
                name="Verified that day"
                fill="#10b981"
                fillOpacity={0.85}
                radius={[2, 2, 0, 0]}
                maxBarSize={28}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                name="Cumulative verified"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full relative">
            <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
              {[0.2, 0.4, 0.6, 0.8].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  x2="100%"
                  y1={`${pct * 100}%`}
                  y2={`${pct * 100}%`}
                  stroke="#f1f5f9"
                  strokeDasharray="3 3"
                />
              ))}
              <line x1="0" x2="100%" y1="92%" y2="92%" stroke="#e2e8f0" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-md bg-slate-50 text-slate-400 mb-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </span>
              <p className="text-sm font-medium text-slate-600">No verifications in this window</p>
              <p className="mt-0.5 text-xs text-slate-400 max-w-xs">
                As requirements are moved to Live, they plot here by the day they were verified.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-slate-100">
        <span className="tabular-nums">{verifiedInWindow} verified · {range}d</span>
        <span className="tabular-nums">{pctComplete}% complete</span>
      </div>
    </div>
  );
}

function LegendChip({ color, label, val }: { color: string; label: string; val: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="w-2 h-2 rounded-xs" style={{ background: color }} />
      <span className="font-sans text-slate-500">{label}</span>
      <span className="tabular-nums text-slate-700 font-medium">{val}</span>
    </span>
  );
}

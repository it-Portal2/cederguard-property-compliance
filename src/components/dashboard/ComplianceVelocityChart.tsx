import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { clsx } from 'clsx';

type ComplianceItem = {
  status?: string;
  dateAdded?: string | number | Date;
  [k: string]: any;
};

type Range = 7 | 30 | 90;

type Props = {
  items: ComplianceItem[];
  className?: string;
};

function bucketByDay(items: ComplianceItem[], days: number) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const buckets: { day: string; verified: number; inProgress: number; pending: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({
      day: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      verified: 0,
      inProgress: 0,
      pending: 0,
    });
  }

  const startMs = new Date(today);
  startMs.setDate(today.getDate() - (days - 1));
  startMs.setHours(0, 0, 0, 0);

  items.forEach((it) => {
    const raw = it.dateAdded;
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    if (d < startMs || d > today) return;
    const idx = Math.floor(
      (d.getTime() - startMs.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (idx < 0 || idx >= buckets.length) return;
    const s = String(it.status || '').toLowerCase();
    if (s.includes('verified') || s.includes('complete') || s.includes('compliant')) {
      buckets[idx].verified += 1;
    } else if (s.includes('progress') || s.includes('review') || s.includes('open')) {
      buckets[idx].inProgress += 1;
    } else {
      buckets[idx].pending += 1;
    }
  });

  return buckets;
}

export function ComplianceVelocityChart({ items, className }: Props) {
  const [range, setRange] = useState<Range>(30);
  const data = useMemo(() => bucketByDay(items, range), [items, range]);
  const hasData = data.some((d) => d.verified + d.inProgress + d.pending > 0);

  return (
    <div className={clsx('bg-white rounded-lg border border-slate-200', className)}>
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Compliance velocity</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Items added over the last {range} days, split by status.
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 self-start">
          {[7, 30, 90].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r as Range)}
              className={clsx(
                'px-2.5 h-7 text-xs font-medium rounded-md transition-colors',
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
      <div className="px-2 pb-3 h-[220px]" role="img" aria-label={`Compliance velocity over the last ${range} days`}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cv-verified" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="cv-inprogress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="cv-pending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#0f172a', fontWeight: 600 }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                formatter={(value) => <span className="text-slate-600">{value}</span>}
              />
              <Area type="monotone" name="Verified" stackId="1" dataKey="verified" stroke="#6366f1" fill="url(#cv-verified)" strokeWidth={2} />
              <Area type="monotone" name="In progress" stackId="1" dataKey="inProgress" stroke="#0ea5e9" fill="url(#cv-inprogress)" strokeWidth={2} />
              <Area type="monotone" name="Pending" stackId="1" dataKey="pending" stroke="#f59e0b" fill="url(#cv-pending)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            No compliance activity in this window.
          </div>
        )}
      </div>
    </div>
  );
}

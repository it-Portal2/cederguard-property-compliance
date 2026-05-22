import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, Area, AreaChart } from 'recharts';
import { clsx } from 'clsx';

type MiniSparklineProps = {
  data: number[];
  color?: string;
  className?: string;
  /** Fixed pixel height. Ignored when `fill` is true. */
  height?: number;
  /** When true, the chart fills 100% of its container's height — wrap in a
   *  parent that gives it room (e.g. flex-1). */
  fill?: boolean;
  /** Optional date labels for tooltip (e.g. "Mon", "Tue" or "01 Jan"). */
  labels?: string[];
};

const SparklineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm text-xs">
      {label && <div className="text-[11px] font-medium text-slate-500">{label}</div>}
      <div className="font-semibold text-slate-900 tabular-nums">{payload[0].value}</div>
    </div>
  );
};

export function MiniSparkline({
  data,
  color = '#6366f1',
  className,
  height = 32,
  fill = false,
  labels,
}: MiniSparklineProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((v, i) => ({
    label: labels?.[i] ?? String(i + 1),
    v,
  }));

  const gradientId = `sl-gradient-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div
      className={clsx(fill ? 'w-full h-full min-h-12' : 'w-full', className)}
      style={fill ? undefined : { height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            content={<SparklineTooltip />}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '2 2' }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive
            animationDuration={700}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
// Re-export LineChart Line for components that may want a no-fill variant
export { LineChart, Line };

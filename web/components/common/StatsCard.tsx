import type { ReactNode } from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { InfoTooltip } from '../InfoTooltip';

export type StatsCardRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type StatsCardSize = 'sm' | 'md' | 'lg';

export interface StatsCardTrend {
  value: number;
  label?: string;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  /** Tooltip content shown via an info icon next to the title. */
  info?: ReactNode;
  icon?: LucideIcon;
  highlighted?: boolean;
  accentClassName?: string;
  tileClassName?: string;
  iconClassName?: string;
  iconBgClassName?: string;
  titleClassName?: string;
  valueClassName?: string;
  unitClassName?: string;
  rounded?: StatsCardRounded;
  size?: StatsCardSize;
  progress?: boolean;
  progressValue?: number;
  progressLabel?: string;
  progressClassName?: string;
  trend?: StatsCardTrend;
  footer?: ReactNode;
  onClick?: () => void;
  onIconClick?: () => void;
  className?: string;
  animate?: boolean;
}

// Updated to align with the design-system pass: the semantic 'lg' now
// emits Tailwind's rounded-lg (8px) — the standard radius across every
// card / button / modal / input in the app. Larger semantic values are
// kept in the map for the rare case a caller wants explicit opt-in,
// but the default (lg) matches the global rule.
const roundedMap: Record<StatsCardRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-lg',
  '2xl': 'rounded-lg',
  '3xl': 'rounded-lg',
};

const sizeMap: Record<StatsCardSize, { padding: string; minH: string; value: string; iconBtn: string; iconSize: number }> = {
  sm: { padding: 'p-4', minH: 'min-h-[110px]', value: 'text-[28px]', iconBtn: 'w-7 h-7', iconSize: 13 },
  md: { padding: 'p-5', minH: 'min-h-[140px]', value: 'text-[36px]', iconBtn: 'w-9 h-9', iconSize: 15 },
  lg: { padding: 'p-6', minH: 'min-h-[170px]', value: 'text-[44px]', iconBtn: 'w-10 h-10', iconSize: 16 },
};

export function StatsCard({
  title,
  value,
  unit,
  description,
  info,
  icon: Icon = ArrowUpRight,
  highlighted = false,
  accentClassName,
  tileClassName,
  iconClassName,
  iconBgClassName,
  titleClassName,
  valueClassName,
  unitClassName,
  rounded = 'lg',
  size = 'md',
  progress = false,
  progressValue = 0,
  progressLabel = 'Progress',
  progressClassName,
  trend,
  footer,
  onClick,
  onIconClick,
  className,
  animate = true,
}: StatsCardProps) {
  const s = sizeMap[size];
  const pct = Math.max(0, Math.min(100, progressValue));

  const Wrapper: any = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
      }
    : {};

  return (
    <Wrapper
      onClick={onClick}
      {...motionProps}
      className={clsx(
        'relative flex flex-col justify-between transition-all duration-200',
        s.padding,
        s.minH,
        roundedMap[rounded],
        highlighted
          ? clsx(
              'text-slate-900 shadow-sm',
              accentClassName ?? 'bg-amber-300 dark:bg-amber-400'
            )
          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm',
        tileClassName,
        onClick && 'cursor-pointer hover:shadow-md active:scale-[0.99]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={clsx(
                'text-[14px] font-medium tracking-tight leading-snug line-clamp-2',
                titleClassName ?? (highlighted ? 'text-slate-800' : 'text-slate-600 dark:text-slate-300')
              )}
            >
              {title}
            </p>
            {info && <InfoTooltip content={info} />}
          </div>
          {description && (
            <p
              className={clsx(
                'mt-0.5 text-[11px] font-medium leading-snug line-clamp-2',
                highlighted ? 'text-slate-700/80' : 'text-slate-400 dark:text-slate-500'
              )}
            >
              {description}
            </p>
          )}
        </div>

        {onIconClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIconClick();
            }}
            aria-label={`${title} action`}
            className={clsx(
              'shrink-0 flex items-center justify-center rounded-full transition-all active:scale-95',
              s.iconBtn,
              iconBgClassName ??
                (highlighted
                  ? 'bg-white hover:bg-white/90'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'),
              iconClassName ?? (highlighted ? 'text-slate-900' : 'text-white')
            )}
          >
            <Icon size={s.iconSize} strokeWidth={2.25} />
          </button>
        ) : (
          <div
            className={clsx(
              'shrink-0 flex items-center justify-center rounded-full',
              s.iconBtn,
              iconBgClassName ??
                (highlighted ? 'bg-white' : 'bg-slate-900 dark:bg-slate-700'),
              iconClassName ?? (highlighted ? 'text-slate-900' : 'text-white')
            )}
          >
            <Icon size={s.iconSize} strokeWidth={2.25} />
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-baseline gap-1.5">
          <span
            className={clsx(
              'font-semibold leading-none tracking-tight tabular-nums',
              s.value,
              valueClassName
            )}
          >
            {value}
          </span>
          {unit && (
            <span
              className={clsx(
                'text-[12px] font-medium',
                unitClassName ?? (highlighted ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400')
              )}
            >
              {unit}
            </span>
          )}
        </div>

        {trend && (
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
            <span
              className={clsx(
                'tabular-nums',
                trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}%
            </span>
            {trend.label && (
              <span
                className={
                  highlighted ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                }
              >
                {trend.label}
              </span>
            )}
          </div>
        )}

        {progress && (
          <div className="mt-3">
            <div
              className={clsx(
                'h-1.5 w-full rounded-full overflow-hidden',
                highlighted ? 'bg-slate-900/15' : 'bg-slate-100 dark:bg-slate-700'
              )}
            >
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500 ease-out',
                  progressClassName ?? (highlighted ? 'bg-slate-900' : 'bg-indigo-600')
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span
                className={clsx(
                  'text-[10px] font-medium',
                  highlighted ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                )}
              >
                {progressLabel}
              </span>
              <span
                className={clsx(
                  'text-[10px] font-semibold tabular-nums',
                  highlighted ? 'text-slate-900' : 'text-slate-700 dark:text-slate-200'
                )}
              >
                {pct}%
              </span>
            </div>
          </div>
        )}

        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </Wrapper>
  );
}

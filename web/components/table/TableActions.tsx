import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { RowAction } from './types';
import TableTooltip from './TableTooltip';

interface TableActionsProps<T> {
  row: T;
  actions: RowAction<T>[];
  onActionClick: (action: RowAction<T>, row: T) => void;
}

export default function TableActions<T extends Record<string, any>>({
  row,
  actions,
  onActionClick,
}: TableActionsProps<T>) {
  const visible = actions.filter((a) => !a.isVisible || a.isVisible(row));
  if (visible.length === 0) return null;

  return (
    <td
      className="sticky right-0 z-10 bg-slate-50 dark:bg-slate-800/50 border-l border-b border-slate-200 dark:border-slate-700 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.08)] px-2 py-2 whitespace-nowrap group-hover:bg-slate-100 dark:group-hover:bg-slate-700/50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        {visible.map((action) => {
          const loading = action.isLoading?.(row) ?? false;
          const disabled = action.isDisabled?.(row) ?? false;
          const label = typeof action.label === 'function' ? action.label(row) : action.label;
          const Icon =
            typeof action.icon === 'function'
              ? (action.icon as (r: T) => React.ComponentType<{ size?: number; className?: string }>)(row)
              : action.icon;
          const isActive = action.isActive?.(row) ?? false;

          return (
            <TableTooltip key={action.key} content={label} variant="action" align="center">
              <button
                disabled={loading || disabled}
                onClick={() => onActionClick(action, row)}
                aria-label={label}
                className={clsx(
                  'w-7 h-7 flex items-center justify-center rounded-lg text-[11px] transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                  isActive && !action.isDanger && 'bg-orange-100 text-orange-600 ring-1 ring-orange-300 shadow-sm hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:ring-orange-700/50',
                  !isActive && !action.isDanger && 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400',
                  action.isDanger && 'bg-rose-50 text-rose-400 border border-rose-100 hover:text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/40'
                )}
              >
                {loading
                  ? <Loader2 size={14} className="animate-spin" />
                  : Icon
                    ? <Icon size={14} />
                    : <span className="text-[10px] font-medium">{label.charAt(0)}</span>}
              </button>
            </TableTooltip>
          );
        })}
      </div>
    </td>
  );
}

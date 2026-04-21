import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import TableCell from './TableCell';
import TableActions from './TableActions';
import type { ColumnDef, RowAction } from './types';

interface TableRowProps<T> {
  row: T;
  index: number;
  columns: ColumnDef<T>[];
  rowActions?: RowAction<T>[];
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  expandable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  renderExpanded?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  onActionClick: (action: RowAction<T>, row: T) => void;
  rowClassName?: string;
  totalColCount: number;
}

const INTERACTIVE = 'button, input, select, textarea, a, [role="button"]';

export default function TableRow<T extends Record<string, any>>({
  row,
  index,
  columns,
  rowActions,
  selectable,
  isSelected,
  onToggleSelect,
  expandable,
  isExpanded,
  onToggleExpand,
  renderExpanded,
  onRowClick,
  onActionClick,
  rowClassName,
  totalColCount,
}: TableRowProps<T>) {
  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest(INTERACTIVE)) return;
    onRowClick?.(row);
  };

  return (
    <>
      <tr
        onClick={handleRowClick}
        className={clsx(
          'border-b border-slate-100 dark:border-slate-800 transition-colors duration-100',
          isSelected && 'bg-indigo-50/40 dark:bg-indigo-950/30',
          !isSelected && 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
          onRowClick && 'cursor-pointer',
          rowClassName
        )}
      >
        {selectable && (
          <td
            className="px-3 py-2.5 w-8 border-r border-b border-slate-100 dark:border-slate-800"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          >
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={() => {}}
              className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
            />
          </td>
        )}

        {columns.map((col) => (
          <TableCell key={String(col.key)} column={col} row={row} index={index} />
        ))}

        {expandable && (
          <td
            className="px-2 py-2.5 w-8 text-right border-r border-b border-slate-100 dark:border-slate-800"
            onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
          >
            <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ChevronDown
                size={14}
                className={clsx(
                  'text-slate-400 transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>
          </td>
        )}

        {rowActions && rowActions.length > 0 && (
          <TableActions row={row} actions={rowActions} onActionClick={onActionClick} />
        )}
      </tr>

      {expandable && renderExpanded && (
        <tr className="border-t-0">
          <td colSpan={totalColCount} className="p-0">
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {renderExpanded(row)}
                </motion.div>
              )}
            </AnimatePresence>
          </td>
        </tr>
      )}
    </>
  );
}

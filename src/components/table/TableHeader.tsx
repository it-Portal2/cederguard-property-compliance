import { useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { ColumnDef } from './types';

interface TableHeaderProps<T> {
  columns: ColumnDef<T>[];
  sortState: { key: string; direction: 'asc' | 'desc' | null };
  onSort: (key: string) => void;
  selectable?: boolean;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  onToggleAll?: () => void;
  expandable?: boolean;
  hasRowActions?: boolean;
  headerVariant?: 'light' | 'dark';
  stickyHeader?: boolean;
}

type GroupCell = { type: 'group'; label: string; colSpan: number; className?: string } | { type: 'spacer'; colSpan: number };

export default function TableHeader<T extends Record<string, any>>({
  columns,
  sortState,
  onSort,
  selectable,
  isAllSelected,
  isIndeterminate,
  onToggleAll,
  expandable,
  hasRowActions,
  headerVariant = 'light',
  stickyHeader = false,
}: TableHeaderProps<T>) {
  const groupCells = useMemo<GroupCell[] | null>(() => {
    const hasGroups = columns.some((c) => c.groupHeader);
    if (!hasGroups) return null;

    const cells: GroupCell[] = [];
    let i = 0;

    while (i < columns.length) {
      const col = columns[i];
      if (!col.groupHeader) {
        cells.push({ type: 'spacer', colSpan: 1 });
        i++;
        continue;
      }
      let span = 1;
      while (
        i + span < columns.length &&
        columns[i + span].groupHeader === col.groupHeader
      ) {
        span++;
      }
      cells.push({ type: 'group', label: col.groupHeader, colSpan: span, className: col.groupHeaderClassName });
      i += span;
    }

    return cells;
  }, [columns]);

  // Base header cell styles without borders
  const thBase = clsx(
    'font-mono px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
    headerVariant === 'dark'
      ? 'bg-[#111827] text-slate-400'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
  );

  // Shared header cell base (includes left and right column dividers)
  const thVariant = clsx(thBase, 'border-r border-r-slate-300 dark:border-r-slate-700');

  // Bottom divider below group row
  const groupRowBottom = 'border-b border-b-slate-300 dark:border-b-slate-700';
  // Strong divider below main column-header row (separates head from body)
  const mainRowBottom = 'border-b border-b-slate-300 dark:border-b-slate-700';

  const stickyClass = stickyHeader ? 'sticky top-0 z-10 backdrop-blur-sm' : '';

  const checkboxTh = (
    <th
      key="__select"
      className={clsx(thVariant, mainRowBottom, 'w-8', stickyClass)}
      onClick={onToggleAll}
    >
      <input
        type="checkbox"
        checked={isAllSelected ?? false}
        ref={(el) => { if (el) el.indeterminate = isIndeterminate ?? false; }}
        onChange={() => {}}
        className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
      />
    </th>
  );

  return (
    <thead className="border-t border-t-slate-300 dark:border-t-slate-700">
      {groupCells && (
        <tr>
          {selectable && <th className={clsx(thBase, groupRowBottom, 'w-8')} />}
          {groupCells.map((cell, i) =>
            cell.type === 'group' ? (
              <th
                key={i}
                colSpan={cell.colSpan}
                className={clsx(
                  'font-mono px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
                  'border-x border-r-slate-200 border-b border-b-slate-300 dark:border-r-slate-700 dark:border-b-slate-700',
                  cell.className ?? (headerVariant === 'dark'
                    ? 'bg-[#111827] text-slate-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400')
                )}
              >
                {cell.label}
              </th>
            ) : (
              <th key={i} colSpan={cell.colSpan} className={clsx(thBase, groupRowBottom)} />
            )
          )}
          {expandable && <th className={clsx(thBase, groupRowBottom, 'w-8')} />}
          {hasRowActions && (
            <th
              className={clsx(
                thBase,
                groupRowBottom,
                'sticky right-0 z-20',
                headerVariant === 'dark' ? 'bg-[#111827]' : 'bg-slate-100 dark:bg-slate-800'
              )}
            />
          )}
        </tr>
      )}

      <tr>
        {selectable && checkboxTh}

        {columns.map((col) => {
          const key = String(col.key);
          const isSorted = sortState.key === key;
          const dir = isSorted ? sortState.direction : null;

          return (
            <th
              key={key}
              aria-sort={
                dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'
              }
              className={clsx(
                thVariant,
                mainRowBottom,
                stickyClass,
                col.sticky && col.stickyPosition !== 'right' && 'sticky left-0 z-20',
                col.sortable && 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200',
                col.headerClassName
              )}
              style={col.width ? { width: col.width, minWidth: col.width } : undefined}
              onClick={col.sortable ? () => onSort(key) : undefined}
            >
              <div className={clsx('flex items-center gap-1', col.align === 'center' && 'justify-center', col.align === 'right' && 'justify-end')}>
                {col.label}
                {col.sortable && (
                  <span className="flex flex-col -space-y-1">
                    <ChevronUp
                      size={9}
                      className={clsx(dir === 'asc' ? 'text-indigo-600' : 'text-slate-400 dark:text-slate-600')}
                    />
                    <ChevronDown
                      size={9}
                      className={clsx(dir === 'desc' ? 'text-indigo-600' : 'text-slate-400 dark:text-slate-600')}
                    />
                  </span>
                )}
              </div>
            </th>
          );
        })}

        {expandable && (
          <th className={clsx(thVariant, mainRowBottom, 'w-8', stickyClass)} />
        )}

        {hasRowActions && (
          <th
            className={clsx(
              thVariant,
              mainRowBottom,
              'sticky right-0 z-20 text-center',
              'border-l border-l-slate-200 dark:border-l-slate-700',
              'shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.08)]',
              headerVariant === 'dark'
                ? 'bg-[#111827]'
                : 'bg-slate-100 dark:bg-slate-800'
            )}
          >
            Actions
          </th>
        )}
      </tr>
    </thead>
  );
}

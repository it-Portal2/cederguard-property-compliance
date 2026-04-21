import { useRef, useState, useEffect, useCallback } from 'react';
import TableRow from './TableRow';
import type { ColumnDef, RowAction } from './types';

const OVERSCAN = 3;

interface TableBodyProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  rowActions?: RowAction<T>[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  expandable?: boolean;
  expandedId?: string | null;
  onToggleExpand?: (id: string) => void;
  renderExpanded?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  onActionClick: (action: RowAction<T>, row: T) => void;
  getRowId: (row: T) => string;
  rowClassName?: (row: T, index: number) => string;
  virtualize?: boolean;
  rowHeight?: number;
  visibleRowCount?: number;
  totalColCount: number;
}

export default function TableBody<T extends Record<string, any>>({
  data,
  columns,
  rowActions,
  selectable,
  selectedIds,
  onToggleSelect,
  expandable,
  expandedId,
  onToggleExpand,
  renderExpanded,
  onRowClick,
  onActionClick,
  getRowId,
  rowClassName,
  virtualize = false,
  rowHeight = 44,
  visibleRowCount = 20,
  totalColCount,
}: TableBodyProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);

  // Disable virtualization when expandable rows are active (variable heights)
  const useVirtual = virtualize && !expandable;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const top = scrollRef.current.scrollTop;
    setStartIndex(Math.floor(top / rowHeight));
  }, [rowHeight]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!useVirtual || !el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [useVirtual, handleScroll]);

  const renderRow = (row: T, originalIndex: number) => {
    const id = getRowId(row);
    return (
      <TableRow
        key={id}
        row={row}
        index={originalIndex}
        columns={columns}
        rowActions={rowActions}
        selectable={selectable}
        isSelected={selectedIds?.has(id)}
        onToggleSelect={() => onToggleSelect?.(id)}
        expandable={expandable}
        isExpanded={expandedId === id}
        onToggleExpand={() => onToggleExpand?.(id)}
        renderExpanded={renderExpanded}
        onRowClick={onRowClick}
        onActionClick={onActionClick}
        rowClassName={rowClassName?.(row, originalIndex)}
        totalColCount={totalColCount}
      />
    );
  };

  if (useVirtual) {
    const windowEnd = Math.min(startIndex + visibleRowCount + OVERSCAN, data.length);
    const windowStart = Math.max(0, startIndex);
    const paddingTop = windowStart * rowHeight;
    const paddingBottom = (data.length - windowEnd) * rowHeight;

    return (
      <div
        ref={scrollRef}
        style={{ height: visibleRowCount * rowHeight, overflowY: 'auto' }}
      >
        <table className="w-full text-left text-[11px] border-separate border-spacing-0">
          <tbody>
            {paddingTop > 0 && (
              <tr style={{ height: paddingTop }}><td /></tr>
            )}
            {data.slice(windowStart, windowEnd).map((row, i) =>
              renderRow(row, windowStart + i)
            )}
            {paddingBottom > 0 && (
              <tr style={{ height: paddingBottom }}><td /></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <tbody>
      {data.map((row, i) => renderRow(row, i))}
    </tbody>
  );
}

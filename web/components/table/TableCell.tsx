import clsx from 'clsx';
import type { ColumnDef } from './types';
import TableTooltip from './TableTooltip';

interface TableCellProps<T> {
  column: ColumnDef<T>;
  row: T;
  index: number;
}

export default function TableCell<T extends Record<string, any>>({
  column,
  row,
  index,
}: TableCellProps<T>) {
  const value = row[column.key as keyof T];

  const isSticky = column.sticky;
  const isRight = column.stickyPosition === 'right';

  const stickyClass = isSticky
    ? clsx(
        isRight
          ? 'sticky right-0 z-10 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.08)]'
          : 'sticky left-0 z-20',
        'bg-white dark:bg-slate-900'
      )
    : '';

  const alignClass =
    column.align === 'center' ? 'text-center' :
    column.align === 'right' ? 'text-right' : 'text-left';

  let content: React.ReactNode;

  if (column.render) {
    content = column.render(value, row, index);
  } else if (column.inlineEdit?.type === 'select') {
    const { options, onChange } = column.inlineEdit;
    content = (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(row, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="bg-transparent border-0 text-[11px] font-medium cursor-pointer focus:ring-2 focus:ring-indigo-500 rounded outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  } else {
    content = String(value ?? '—');
  }

  const tooltipText =
    column.tooltip === true
      ? String(value ?? '')
      : typeof column.tooltip === 'function'
      ? column.tooltip(value, row)
      : null;

  const inner = column.truncate
    ? <div className="truncate w-full min-w-0">{content}</div>
    : content;

  const cellContent = tooltipText ? (
    <TableTooltip content={tooltipText} variant="cell" align="start">
      <div className="w-full min-w-0">{inner}</div>
    </TableTooltip>
  ) : inner;

  return (
    <td
      className={clsx(
        'px-3 py-2.5 text-[11px] text-slate-700 dark:text-slate-300',
        'border-r border-b border-slate-100 dark:border-slate-800',
        !column.truncate && 'whitespace-nowrap',
        column.truncate && 'overflow-hidden',
        alignClass,
        stickyClass,
        column.className
      )}
      style={
        column.width
          ? column.truncate
            ? { width: column.width, minWidth: column.width, maxWidth: column.width }
            : { width: column.width, minWidth: column.width }
          : undefined
      }
    >
      {cellContent}
    </td>
  );
}

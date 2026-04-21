import clsx from 'clsx';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  headerVariant?: 'light' | 'dark';
}

const WIDTHS = ['w-3/4', 'w-1/2', 'w-full', 'w-2/3', 'w-1/3', 'w-5/6'];

export default function TableSkeleton({ rows = 5, columns = 6, headerVariant = 'light' }: TableSkeletonProps) {
  return (
    <table className="w-full text-left text-[11px] border-collapse">
      <thead>
        <tr
          className={clsx(
            headerVariant === 'dark'
              ? 'bg-[#111827]'
              : 'bg-slate-50/80 dark:bg-slate-800'
          )}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-3 py-2.5">
              <div className="h-3 w-16 rounded animate-pulse bg-slate-300 dark:bg-slate-600" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr
            key={rowIdx}
            className="border-t border-slate-100 dark:border-slate-800"
            style={{ animationDelay: `${rowIdx * 0.06}s` }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} className="px-3 py-2.5">
                <div
                  className={clsx(
                    'h-3 rounded animate-pulse bg-slate-200 dark:bg-slate-700',
                    WIDTHS[(rowIdx + colIdx) % WIDTHS.length]
                  )}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

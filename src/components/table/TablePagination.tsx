import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  pageSizeOptions?: number[];
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

function buildPageRange(page: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  if (page > 3) pages.push('...');

  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < total - 2) pages.push('...');
  pages.push(total);

  return pages;
}

export default function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const jumpRef = useRef<HTMLInputElement>(null);

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const handleJump = () => {
    const val = parseInt(jumpRef.current?.value ?? '', 10);
    if (!isNaN(val)) onPageChange(val);
    if (jumpRef.current) jumpRef.current.value = '';
  };

  const pages = buildPageRange(page, totalPages);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-[11px]">
        Showing <span className="font-medium text-slate-700 dark:text-slate-200">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-200">{totalItems}</span> results
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={clsx(
                'w-7 h-7 rounded-lg text-[11px] font-medium transition-all duration-150',
                p === page
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">Jump to</span>
          <input
            ref={jumpRef}
            type="number"
            min={1}
            max={totalPages}
            placeholder="page"
            onBlur={handleJump}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            className="w-14 h-7 px-2 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-7 px-2 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
      </div>
    </div>
  );
}

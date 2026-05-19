import { useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Search, X, SlidersHorizontal, Eye, FileSpreadsheet, Download, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import type { FilterDef, FilterValue, ColumnDef, BulkAction } from './types';

interface TableToolbarProps<T> {
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filterDefs?: FilterDef<T>[];
  filterValues: Record<string, FilterValue>;
  onFilterChange: (key: string, val: FilterValue | null) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  columns?: ColumnDef<T>[];
  hiddenKeys?: Set<string>;
  onToggleColumn?: (key: string) => void;
  columnVisibilityControl?: boolean;
  exportCsv?: boolean;
  exportXlsx?: boolean;
  onExportCsv?: () => void;
  onExportXlsx?: () => void;
  inlineBulkActions?: BulkAction<T>[];
  selectedCount?: number;
  selectedRows?: T[];
  onBulkAction?: (action: BulkAction<T>) => void;
  toolbarActions?: ReactNode;
}

export default function TableToolbar<T extends Record<string, any>>({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterDefs = [],
  filterValues,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  columns = [],
  hiddenKeys = new Set(),
  onToggleColumn,
  columnVisibilityControl,
  exportCsv,
  exportXlsx,
  onExportCsv,
  onExportXlsx,
  inlineBulkActions = [],
  selectedCount = 0,
  selectedRows = [],
  onBulkAction,
  toolbarActions,
}: TableToolbarProps<T>) {
  const [showFilters, setShowFilters] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSearch = true;
  const hasFilters = filterDefs.length > 0;
  const hasInlineBulk = inlineBulkActions.filter((a) => a.style === 'inline').length > 0;

  const showSecondaryRow =
    columnVisibilityControl ||
    exportCsv ||
    (hasInlineBulk && selectedCount > 0) ||
    activeFilterCount > 0;

  return (
    <div className="mb-3 space-y-2">
      {/* Primary row: Search + Filters — full width */}
      <div className="flex flex-wrap items-stretch gap-2 w-full">
        {hasSearch && (
          <div className="relative w-full md:flex-1 md:w-auto min-w-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-10 pl-10 pr-9 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150"
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {hasFilters && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={clsx(
              'flex items-center justify-center gap-2 h-10 px-4 text-[13px] font-medium rounded-lg border shadow-sm shrink-0 transition-all duration-150',
              showFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200'
            )}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {exportXlsx && (
          <button
            onClick={onExportXlsx}
            title="Export XLSX"
            className="flex items-center justify-center gap-2 h-10 px-4 text-[13px] font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 shadow-sm shrink-0 transition-all duration-150"
          >
            <FileSpreadsheet size={15} />
            <span>Export</span>
          </button>
        )}

        {toolbarActions && (
          <div className="flex items-stretch gap-2 shrink-0 md:ml-auto">{toolbarActions}</div>
        )}
      </div>

      {/* Secondary row: Columns / Export / Bulk / Clear All */}
      {showSecondaryRow && (
        <div className="flex flex-wrap items-center gap-2">
          {columnVisibilityControl && (
            <div className="relative" ref={colPickerRef}>
              <button
                onClick={() => setShowColPicker((v) => !v)}
                className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 transition-all duration-150"
              >
                <Eye size={13} />
                Columns
              </button>
              {showColPicker && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-2 min-w-40">
                  {columns.map((col) => {
                    const key = String(col.key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenKeys.has(key)}
                          onChange={() => onToggleColumn?.(key)}
                          className="w-3 h-3 accent-indigo-600"
                        />
                        {col.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {exportCsv && (
            <button
              onClick={onExportCsv}
              title="Export CSV"
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 transition-all duration-150"
            >
              <Download size={13} />
              CSV
            </button>
          )}

          {hasInlineBulk && selectedCount > 0 &&
            inlineBulkActions
              .filter((a) => a.style === 'inline')
              .map((action) => {
                const Icon = action.icon ?? Trash2;
                return (
                  <button
                    key={action.key}
                    onClick={() => onBulkAction?.(action)}
                    className={clsx(
                      'flex items-center gap-1.5 h-8 px-3 text-[11px] font-medium rounded-lg border transition-all duration-150 active:scale-95',
                      action.isDanger
                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-700 dark:text-rose-400'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300'
                    )}
                  >
                    <Icon size={13} />
                    {action.label} ({selectedCount})
                  </button>
                );
              })}

          {activeFilterCount > 0 && (
            <button
              onClick={onClearFilters}
              className="ml-auto flex items-center gap-1 h-8 px-2.5 text-[11px] font-medium rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-150"
            >
              <X size={12} />
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Filter row */}
      {showFilters && filterDefs.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 px-4 py-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
          {filterDefs.map((def) => {
            const val = filterValues[def.key];
            const isActive = val !== undefined && val !== null && val !== '';

            return (
              <div key={def.key} className="flex flex-col gap-1.5 min-w-40">
                <span className={clsx(
                  'text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5',
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                )}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />}
                  {def.label}
                </span>

                {def.type === 'select' && (
                  <select
                    value={String(val ?? '')}
                    onChange={(e) => onFilterChange(def.key, e.target.value || null)}
                    className="h-9 px-3 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All {def.label}</option>
                    {def.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}

                {def.type === 'text' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={String(val ?? '')}
                      onChange={(e) => onFilterChange(def.key, e.target.value || null)}
                      placeholder={def.placeholder ?? `Filter by ${def.label}...`}
                      className="h-9 pl-3 pr-7 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                    />
                    {val && (
                      <button
                        onClick={() => onFilterChange(def.key, null)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}

                {def.type === 'boolean' && (
                  <div className="flex items-center gap-1.5">
                    {[
                      { v: true, label: def.trueLabel ?? 'Yes' },
                      { v: false, label: def.falseLabel ?? 'No' },
                    ].map(({ v, label }) => (
                      <button
                        key={String(v)}
                        onClick={() => onFilterChange(def.key, val === v ? null : v)}
                        className={clsx(
                          'h-9 px-3.5 text-[12px] rounded-full border font-medium transition-all duration-150',
                          val === v
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {def.type === 'number_range' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={def.min}
                      max={def.max}
                      step={def.step ?? 1}
                      placeholder="Min"
                      value={(val as any)?.min ?? ''}
                      onChange={(e) => {
                        const prev = (val as any) ?? {};
                        onFilterChange(def.key, { min: Number(e.target.value), max: prev.max ?? def.max ?? 9999 });
                      }}
                      className="w-20 h-9 px-2.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400 text-[12px]">—</span>
                    <input
                      type="number"
                      min={def.min}
                      max={def.max}
                      step={def.step ?? 1}
                      placeholder="Max"
                      value={(val as any)?.max ?? ''}
                      onChange={(e) => {
                        const prev = (val as any) ?? {};
                        onFilterChange(def.key, { min: prev.min ?? def.min ?? 0, max: Number(e.target.value) });
                      }}
                      className="w-20 h-9 px-2.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {def.unit && <span className="text-[12px] text-slate-500">{def.unit}</span>}
                  </div>
                )}

                {def.type === 'date' && (
                  <input
                    type="date"
                    value={String(val ?? '')}
                    onChange={(e) => onFilterChange(def.key, e.target.value || null)}
                    className="h-9 px-3 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}

                {def.type === 'date_range' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={(val as any)?.from ?? ''}
                      onChange={(e) => {
                        const prev = (val as any) ?? {};
                        onFilterChange(def.key, { from: e.target.value, to: prev.to ?? '' });
                      }}
                      className="h-9 px-3 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400 text-[12px]">to</span>
                    <input
                      type="date"
                      value={(val as any)?.to ?? ''}
                      onChange={(e) => {
                        const prev = (val as any) ?? {};
                        onFilterChange(def.key, { from: prev.from ?? '', to: e.target.value });
                      }}
                      className="h-9 px-3 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

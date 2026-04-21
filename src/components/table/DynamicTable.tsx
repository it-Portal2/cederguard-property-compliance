import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import clsx from 'clsx';

import {
  useTableFilter,
  useTableSort,
  useTablePagination,
  useTableSelection,
  useTableColumns,
} from './useTableState';

import TableToolbar from './TableToolbar';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import TablePagination from './TablePagination';
import TableSkeleton from './TableSkeleton';
import TableBulkBar from './TableBulkBar';
import ConfirmDialog from './ConfirmDialog';
import { EmptyState } from '../common/EmptyState';

import type { DynamicTableProps, RowAction, BulkAction, ConfirmVariant } from './types';

const DEFAULT_GET_ROW_ID = (row: any) => row.id ?? String(Math.random());

export default function DynamicTable<T extends Record<string, any>>({
  data,
  columns,
  rowActions,
  bulkActions = [],
  filters = [],
  searchable = false,
  searchPlaceholder,
  searchFields = [],
  selectable = false,
  expandable = false,
  renderExpanded,
  pagination,
  loading = false,
  error,
  emptyState,
  export: exportConfig,
  headerVariant = 'light',
  stickyHeader = false,
  onRowClick,
  rowClassName,
  getRowId = DEFAULT_GET_ROW_ID,
  columnVisibilityControl = false,
  className,
  virtualize = false,
  rowHeight = 44,
  visibleRowCount = 20,
}: DynamicTableProps<T>) {
  // ── Local state ─────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: RowAction<T> | BulkAction<T>;
    row?: T;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Data pipeline ────────────────────────────────────────────────────────────
  const {
    filteredData,
    searchValue,
    filterValues,
    setSearch,
    setFilter,
    clearFilters,
    activeFilterCount,
  } = useTableFilter(data, filters, searchFields as (keyof T)[]);

  const { sortedData, sortState, toggleSort } = useTableSort(filteredData);

  const { page, pageSize, totalPages, paginatedSlice, setPage, setPageSize } =
    useTablePagination(sortedData.length, pagination);

  const pageData = paginatedSlice(sortedData);

  const {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    toggleOne,
    toggleAll,
    clearSelection,
    selectedRows,
  } = useTableSelection(pageData, getRowId);

  const { visibleColumns, hiddenKeys, toggleColumn } = useTableColumns(
    columns,
    columnVisibilityControl
  );

  // ── Column counts for row colSpan ────────────────────────────────────────────
  const totalColCount = useMemo(() => {
    let count = visibleColumns.length;
    if (selectable) count++;
    if (expandable) count++;
    if (rowActions && rowActions.length > 0) count++;
    return count;
  }, [visibleColumns.length, selectable, expandable, rowActions]);

  // ── Action handling ──────────────────────────────────────────────────────────
  const handleActionClick = useCallback(
    (action: RowAction<T>, row: T) => {
      if (action.requireConfirm) {
        setPendingConfirm({ action, row });
      } else {
        action.onClick(row);
      }
    },
    []
  );

  const handleBulkAction = useCallback(
    (action: BulkAction<T>) => {
      if (action.requireConfirm) {
        setPendingConfirm({ action });
      } else {
        action.onClick(selectedRows(data));
        clearSelection();
      }
    },
    [selectedRows, data, clearSelection]
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingConfirm) return;
    setConfirmLoading(true);
    try {
      const { action, row } = pendingConfirm;
      if (row) {
        await Promise.resolve((action as RowAction<T>).onClick(row));
      } else {
        await Promise.resolve((action as BulkAction<T>).onClick(selectedRows(data)));
        clearSelection();
      }
    } finally {
      setConfirmLoading(false);
      setPendingConfirm(null);
    }
  }, [pendingConfirm, selectedRows, data, clearSelection]);

  // ── Export ───────────────────────────────────────────────────────────────────
  const buildExportRows = useCallback(() => {
    return sortedData.map((row) => {
      const obj: Record<string, string> = {};
      visibleColumns.forEach((col) => {
        const val = row[col.key as keyof T];
        obj[col.label] = col.exportValue ? col.exportValue(val, row) : String(val ?? '');
      });
      return obj;
    });
  }, [sortedData, visibleColumns]);

  const handleExportXlsx = useCallback(() => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${exportConfig?.filename ?? 'export'}.xlsx`);
  }, [buildExportRows, exportConfig?.filename]);

  const handleExportCsv = useCallback(() => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportConfig?.filename ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExportRows, exportConfig?.filename]);

  // ── Confirm dialog resolution ─────────────────────────────────────────────────
  const confirmCtx = useMemo(() => {
    if (!pendingConfirm) return null;
    const cfg = pendingConfirm.action.requireConfirm!;
    const subject = pendingConfirm.row ?? selectedRows(data);

    const title = typeof cfg.title === 'function' ? cfg.title(subject) : cfg.title;
    const message = typeof cfg.message === 'function' ? cfg.message(subject) : cfg.message;
    const confirmLabel =
      typeof cfg.confirmLabel === 'function'
        ? (cfg.confirmLabel as (r: any) => string)(subject)
        : cfg.confirmLabel;

    // Icon can be a ComponentType (lucide's forwardRef — object) or a factory fn (row → ComponentType).
    // Lucide icons register as typeof 'object'; our factory registers as 'function', so this narrows reliably.
    const icon =
      typeof cfg.icon === 'function'
        ? (cfg.icon as (r: any) => React.ComponentType<{ size?: number; className?: string }>)(subject)
        : cfg.icon;

    const resolvedVariant =
      typeof cfg.variant === 'function'
        ? (cfg.variant as (r: any) => ConfirmVariant)(subject)
        : cfg.variant;
    const variant: ConfirmVariant =
      resolvedVariant ?? (cfg.isDanger ? 'danger' : 'default');

    return { title, message, confirmLabel, icon, variant };
  }, [pendingConfirm, selectedRows, data]);

  // ── Bulk bar actions (style: 'bar') ──────────────────────────────────────────
  const barBulkActions = bulkActions.filter((a) => a.style === 'bar');
  const inlineBulkActions = bulkActions.filter((a) => a.style !== 'bar');
  const showBulkBar = selectedIds.size > 0 && barBulkActions.length > 0;

  return (
    <>
      <div className={clsx('w-full', className)}>
        <TableToolbar
          searchValue={searchValue}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          filterDefs={filters}
          filterValues={filterValues}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          activeFilterCount={activeFilterCount}
          columns={columns}
          hiddenKeys={hiddenKeys}
          onToggleColumn={toggleColumn}
          columnVisibilityControl={columnVisibilityControl}
          exportCsv={exportConfig?.csv}
          exportXlsx={exportConfig?.xlsx}
          onExportCsv={handleExportCsv}
          onExportXlsx={handleExportXlsx}
          inlineBulkActions={inlineBulkActions}
          selectedCount={selectedIds.size}
          selectedRows={selectedRows(data)}
          onBulkAction={handleBulkAction}
        />

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
          {loading ? (
            <TableSkeleton columns={visibleColumns.length + (selectable ? 1 : 0)} headerVariant={headerVariant} />
          ) : error ? (
            <div className="px-6 py-10 text-center text-sm text-rose-500">{error}</div>
          ) : pageData.length === 0 ? (
            emptyState ? (
              <div className="py-10">
                <EmptyState
                  icon={emptyState.icon}
                  title={emptyState.title}
                  description={emptyState.description}
                  action={emptyState.action}
                />
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-xs text-slate-400">No results found.</div>
            )
          ) : (
            <table className="w-full text-left text-[11px] border-separate border-spacing-0">
              <TableHeader
                columns={visibleColumns}
                sortState={sortState}
                onSort={toggleSort}
                selectable={selectable}
                isAllSelected={isAllSelected}
                isIndeterminate={isIndeterminate}
                onToggleAll={toggleAll}
                expandable={expandable}
                hasRowActions={!!rowActions && rowActions.length > 0}
                headerVariant={headerVariant}
                stickyHeader={stickyHeader}
              />
              <TableBody
                data={pageData}
                columns={visibleColumns}
                rowActions={rowActions}
                selectable={selectable}
                selectedIds={selectedIds}
                onToggleSelect={toggleOne}
                expandable={expandable}
                expandedId={expandedId}
                onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                renderExpanded={renderExpanded}
                onRowClick={onRowClick}
                onActionClick={handleActionClick}
                getRowId={getRowId}
                rowClassName={rowClassName}
                virtualize={virtualize}
                rowHeight={rowHeight}
                visibleRowCount={visibleRowCount}
                totalColCount={totalColCount}
              />
            </table>
          )}
        </div>

        {pagination?.enabled && !loading && pageData.length > 0 && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={sortedData.length}
            totalPages={totalPages}
            pageSizeOptions={pagination.pageSizeOptions}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}

        <ConfirmDialog
          open={!!pendingConfirm}
          title={confirmCtx?.title ?? ''}
          message={confirmCtx?.message ?? ''}
          confirmLabel={confirmCtx?.confirmLabel}
          variant={confirmCtx?.variant}
          icon={confirmCtx?.icon}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      </div>

      {/* Outside wrapper — fixed positioning requires no transform ancestor */}
      <AnimatePresence>
        {showBulkBar && (
          <TableBulkBar
            selectedCount={selectedIds.size}
            actions={barBulkActions}
            onAction={handleBulkAction}
            onClear={clearSelection}
          />
        )}
      </AnimatePresence>
    </>
  );
}

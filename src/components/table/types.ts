import type React from 'react';

// ── Filter types ─────────────────────────────────────────────────────────────

export type FilterType = 'text' | 'select' | 'boolean' | 'number_range' | 'date' | 'date_range';

export type FilterValue =
  | string
  | boolean
  | { min: number; max: number }
  | { from: string; to: string };

export interface FilterDef<T> {
  key: string;
  label: string;
  type: FilterType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  trueLabel?: string;
  falseLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  match?: (rowValue: any, filterValue: FilterValue) => boolean;
}

// ── Column definition ────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  exportValue?: (value: any, row: T) => string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  hidden?: boolean;
  groupHeader?: string;
  sticky?: boolean;
  stickyPosition?: 'left' | 'right';
  inlineEdit?: {
    type: 'select';
    options: { value: string; label: string }[];
    onChange: (row: T, value: string) => void;
  };
  truncate?: boolean;
  tooltip?: boolean | ((value: any, row: T) => string);
  className?: string;
  headerClassName?: string;
  groupHeaderClassName?: string;
}

// ── Row actions ──────────────────────────────────────────────────────────────

export interface RowAction<T> {
  key: string;
  label: string | ((row: T) => string);
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick: (row: T) => void;
  isVisible?: (row: T) => boolean;
  isDanger?: boolean;
  requireConfirm?: ConfirmConfig;
  isLoading?: (row: T) => boolean;
  isActive?: (row: T) => boolean;
}

// ── Bulk actions ─────────────────────────────────────────────────────────────

export interface BulkAction<T> {
  key: string;
  label: string;
  icon?: React.ComponentType<any>;
  onClick: (selectedRows: T[]) => void;
  isDanger?: boolean;
  requireConfirm?: ConfirmConfig;
  style?: 'bar' | 'inline';
}

// ── Confirm dialog ───────────────────────────────────────────────────────────

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success' | 'default';

export interface ConfirmConfig {
  title: string | ((row: any) => string);
  message: string | ((row: any) => string);
  confirmLabel?: string | ((row: any) => string);
  isDanger?: boolean;
  icon?:
    | React.ComponentType<{ size?: number; className?: string }>
    | ((row: any) => React.ComponentType<{ size?: number; className?: string }>);
  variant?: ConfirmVariant | ((row: any) => ConfirmVariant);
}

// ── Pagination config ────────────────────────────────────────────────────────

export interface PaginationConfig {
  enabled: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

// ── Main props ───────────────────────────────────────────────────────────────

export interface DynamicTableProps<T extends Record<string, any>> {
  data: T[];
  columns: ColumnDef<T>[];
  rowActions?: RowAction<T>[];
  bulkActions?: BulkAction<T>[];
  filters?: FilterDef<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  selectable?: boolean;
  expandable?: boolean;
  renderExpanded?: (row: T) => React.ReactNode;
  pagination?: PaginationConfig;
  loading?: boolean;
  error?: string | null;
  emptyState?: {
    title: string;
    description?: string;
    icon?: React.ComponentType<any>;
    action?: React.ReactNode;
  };
  export?: { csv?: boolean; xlsx?: boolean; filename?: string };
  headerVariant?: 'light' | 'dark';
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string;
  getRowId?: (row: T) => string;
  columnVisibilityControl?: boolean;
  className?: string;
  virtualize?: boolean;
  rowHeight?: number;
  visibleRowCount?: number;
}

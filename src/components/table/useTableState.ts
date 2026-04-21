import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { ColumnDef, FilterDef, FilterValue, PaginationConfig } from './types';

// ── useTableFilter ────────────────────────────────────────────────────────────

export function useTableFilter<T extends Record<string, any>>(
  data: T[],
  filterDefs: FilterDef<T>[],
  searchFields: (keyof T)[]
) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>({});

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filteredData = useMemo(() => {
    let result = data;

    if (debouncedSearch && searchFields.length > 0) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((row) =>
        searchFields.some((field) =>
          String(row[field] ?? '').toLowerCase().includes(q)
        )
      );
    }

    for (const def of filterDefs) {
      const val = filterValues[def.key];
      if (val === undefined || val === null || val === '') continue;

      result = result.filter((row) => {
        const rowVal = row[def.key];

        if (def.match) return def.match(rowVal, val);

        switch (def.type) {
          case 'text':
            return String(rowVal ?? '').toLowerCase().includes(String(val).toLowerCase());
          case 'select':
            return String(rowVal) === String(val);
          case 'boolean':
            return Boolean(rowVal) === val;
          case 'number_range': {
            const range = val as { min: number; max: number };
            return Number(rowVal) >= range.min && Number(rowVal) <= range.max;
          }
          case 'date':
            return String(rowVal ?? '').startsWith(String(val));
          case 'date_range': {
            const range = val as { from: string; to: string };
            return String(rowVal) >= range.from && String(rowVal) <= range.to;
          }
          default:
            return true;
        }
      });
    }

    return result;
  }, [data, debouncedSearch, searchFields, filterDefs, filterValues]);

  const activeFilterCount = useMemo(() => {
    let count = debouncedSearch ? 1 : 0;
    for (const key in filterValues) {
      const val = filterValues[key];
      if (val !== undefined && val !== null && val !== '') count++;
    }
    return count;
  }, [filterValues, debouncedSearch]);

  const setFilter = useCallback((key: string, value: FilterValue | null) => {
    setFilterValues((prev) => {
      if (value === null || value === undefined || value === '') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilterValues({});
    setSearchInput('');
    setDebouncedSearch('');
  }, []);

  return {
    filteredData,
    searchValue: searchInput,
    filterValues,
    setSearch: setSearchInput,
    setFilter,
    clearFilters,
    activeFilterCount,
  };
}

// ── useTableSort ──────────────────────────────────────────────────────────────

export function useTableSort<T>(data: T[]) {
  const [sortState, setSortState] = useState<{
    key: string;
    direction: 'asc' | 'desc' | null;
  }>({ key: '', direction: null });

  const toggleSort = useCallback((key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key: '', direction: null };
      return { key, direction: 'asc' };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortState.direction || !sortState.key) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortState.key];
      const bVal = (b as any)[sortState.key];

      const aNum = Number(aVal);
      const bNum = Number(bVal);

      let cmp: number;
      if (!isNaN(aNum) && !isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          cmp = aDate.getTime() - bDate.getTime();
        } else {
          cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
        }
      }

      return sortState.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sortState]);

  return { sortedData, sortState, toggleSort };
}

// ── useTablePagination ────────────────────────────────────────────────────────

export function useTablePagination(totalItems: number, config?: PaginationConfig) {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(config?.pageSize ?? 20);

  const totalPages = config?.enabled ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  // Reset to page 1 when total items change (filter applied)
  const prevTotal = useRef(totalItems);
  useEffect(() => {
    if (prevTotal.current !== totalItems) {
      prevTotal.current = totalItems;
      setPageRaw(1);
    }
  }, [totalItems]);

  const setPage = useCallback((p: number) => {
    setPageRaw(Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const setPageSize = useCallback((s: number) => {
    setPageSizeRaw(s);
    setPageRaw(1);
  }, []);

  const paginatedSlice = useCallback(
    <D>(data: D[]): D[] => {
      if (!config?.enabled) return data;
      const start = (page - 1) * pageSize;
      return data.slice(start, start + pageSize);
    },
    [config?.enabled, page, pageSize]
  );

  return { page, pageSize, totalPages, paginatedSlice, setPage, setPageSize };
}

// ── useTableSelection ─────────────────────────────────────────────────────────

export function useTableSelection<T>(visibleData: T[], getRowId: (r: T) => string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => visibleData.map(getRowId), [visibleData, getRowId]);

  const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isIndeterminate = !isAllSelected && visibleIds.some((id) => selectedIds.has(id));

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedRows = useCallback(
    (allData: T[]) => allData.filter((row) => selectedIds.has(getRowId(row))),
    [selectedIds, getRowId]
  );

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    toggleOne,
    toggleAll,
    clearSelection,
    selectedRows,
  };
}

// ── useTableColumns ───────────────────────────────────────────────────────────

export function useTableColumns<T>(columns: ColumnDef<T>[], enabled: boolean) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    const s = new Set<string>();
    columns.forEach((c) => {
      if (c.hidden) s.add(String(c.key));
    });
    return s;
  });

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenKeys.has(String(c.key))),
    [columns, hiddenKeys]
  );

  const toggleColumn = useCallback(
    (key: string) => {
      if (!enabled) return;
      setHiddenKeys((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
    },
    [enabled]
  );

  const showAll = useCallback(() => setHiddenKeys(new Set()), []);

  return { visibleColumns, hiddenKeys, toggleColumn, showAll };
}

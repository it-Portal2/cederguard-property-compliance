import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Calendar as CalendarIcon,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';

// Lightweight shape from the Forward Plan list endpoint.
interface PickerFpItem {
  id: string;
  title: string;
  scheme?: string | null;
  status?: string | null;
  targetDecisionDate?: string | null;
  isKeyDecision?: boolean;
  isHRB?: boolean;
  softDeleted?: boolean;
}

interface Props {
  isOpen: boolean;
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (item: PickerFpItem) => void;
}

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  Published: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Decided: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Deferred: 'bg-slate-50 text-slate-600 border-slate-200',
  Archived: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function FpItemPickerModal({
  isOpen,
  selectedId,
  onClose,
  onSelect,
}: Props) {
  const [items, setItems] = useState<PickerFpItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setShowAll(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.governanceListForwardPlanItems();
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.error ?? 'Failed to load FP items.');
        setItems((res.items ?? []) as PickerFpItem[]);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[FpItemPicker] load failed', e);
        toast.error(e?.message ?? 'Failed to load Forward Plan items.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    let pool = items.filter((i) => !i.softDeleted);
    if (!showAll) {
      // Default to forward-looking items only — Draft + Published.
      // Decided / Deferred / Archived rarely need a new report.
      pool = pool.filter((i) => i.status === 'Draft' || i.status === 'Published');
    }
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((i) => {
      const haystack = `${i.title} ${i.scheme ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, showAll]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.15 }}
          className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pick a Forward Plan item</h2>
                <p className="text-[11px] text-slate-500">
                  Reports inherit the FP entry's decision pipeline + board route.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Search + filter toggle */}
          <div className="border-b border-slate-200 px-5 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or scheme…"
                className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Include Decided / Deferred / Archived items
            </label>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Forward Plan…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No Forward Plan items match.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((it) => {
                  const isSelected = it.id === selectedId;
                  const statusCls =
                    STATUS_STYLE[it.status ?? ''] ?? 'bg-slate-50 text-slate-700 border-slate-200';
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(it)}
                        className={clsx(
                          'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50/40'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {it.title}
                            </p>
                            {it.isKeyDecision && (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                                Key
                              </span>
                            )}
                            {it.isHRB && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                HRB
                              </span>
                            )}
                          </div>
                          {it.scheme && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">
                              {it.scheme}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-1.5">
                            {it.status && (
                              <span
                                className={clsx(
                                  'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                                  statusCls,
                                )}
                              >
                                {it.status}
                              </span>
                            )}
                            {it.targetDecisionDate && (
                              <span className="text-[10px] text-slate-500">
                                Target{' '}
                                {new Date(it.targetDecisionDate).toLocaleDateString(
                                  'en-GB',
                                  {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  },
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

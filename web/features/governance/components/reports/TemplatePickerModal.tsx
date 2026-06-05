import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, FileText, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../../lib/api';

// Lightweight shape — only the fields we need to render a picker row.
interface PickerTemplate {
  id: string;
  code?: string | null;
  title: string;
  category?: string | null;
  description?: string | null;
  sections?: Array<{ id: string }>;
  defaultRoute?: string | null;
}

interface Props {
  isOpen: boolean;
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (template: PickerTemplate) => void;
}

const CATEGORY_STYLE: Record<string, string> = {
  gateway: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  milestone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  finance: 'bg-amber-50 text-amber-800 border-amber-200',
  shareholder: 'bg-rose-50 text-rose-700 border-rose-200',
  cabinet: 'bg-slate-50 text-slate-700 border-slate-200',
  other: 'bg-slate-50 text-slate-700 border-slate-200',
};

export function TemplatePickerModal({
  isOpen,
  selectedId,
  onClose,
  onSelect,
}: Props) {
  const [templates, setTemplates] = useState<PickerTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.governanceListTemplates();
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.error ?? 'Failed to load templates.');
        setTemplates((res.templates ?? res.items ?? []) as PickerTemplate[]);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[TemplatePicker] load failed', e);
        toast.error(e?.message ?? 'Failed to load templates.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const haystack = `${t.code ?? ''} ${t.title} ${t.category ?? ''} ${t.description ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [templates, search]);

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
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pick a template</h2>
                <p className="text-[11px] text-slate-500">
                  Sections from this template will be instantiated on the report.
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

          {/* Search */}
          <div className="border-b border-slate-200 px-5 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, title or category…"
                className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading templates…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No templates match.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((t) => {
                  const isSelected = t.id === selectedId;
                  const style = CATEGORY_STYLE[t.category ?? 'other'] ?? CATEGORY_STYLE.other;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(t)}
                        className={clsx(
                          'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50/40'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20',
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          {t.code && (
                            <span className="inline-flex shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                              {t.code}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-slate-900">
                                {t.title}
                              </p>
                              {t.category && (
                                <span
                                  className={clsx(
                                    'inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                                    style,
                                  )}
                                >
                                  {t.category}
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                                {t.description}
                              </p>
                            )}
                            <p className="mt-1 text-[10px] text-slate-400">
                              {t.sections?.length ?? 0} section
                              {(t.sections?.length ?? 0) === 1 ? '' : 's'}
                              {t.defaultRoute ? ` · ${t.defaultRoute}` : ''}
                            </p>
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

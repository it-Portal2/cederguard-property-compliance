import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, UserCheck, Loader2, Check, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';

interface PickerReviewer {
  uid: string;
  name: string;
  email: string;
  role: string;
  pmLevel?: string | null;
}

interface Props {
  isOpen: boolean;
  selectedUid?: string | null;
  onClose: () => void;
  onSelect: (reviewer: PickerReviewer) => void;
  /** Allow clearing the reviewer back to unassigned. */
  onClear?: () => void;
}

// Display labels per raw role. Note: there's only one PM role in this
// codebase (`project_manager`); the "Senior PM" tier comes from the
// pmLevel === 'senior' pill rendered separately on each row.
const ROLE_LABEL: Record<string, string> = {
  client_admin: 'Programme Manager',
  admin: 'Admin',
  super_admin: 'Super Admin',
  project_manager: 'Project Manager',
  strategic_director: 'Strategic Director',
};

const ROLE_BADGE: Record<string, string> = {
  client_admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  super_admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  project_manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  strategic_director: 'bg-amber-50 text-amber-800 border-amber-200',
};

function initials(name: string, email: string): string {
  const src = name?.trim() || email || '?';
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ReviewerPickerModal({
  isOpen,
  selectedUid,
  onClose,
  onSelect,
  onClear,
}: Props) {
  const [reviewers, setReviewers] = useState<PickerReviewer[]>([]);
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
        const res = await api.governanceListReviewers();
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.error ?? 'Failed to load.');
        setReviewers((res.reviewers ?? []) as PickerReviewer[]);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[ReviewerPicker] load failed', e);
        toast.error(e?.message ?? 'Failed to load reviewers.');
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
    if (!q) return reviewers;
    return reviewers.filter((u) => {
      const haystack =
        `${u.name} ${u.email} ${ROLE_LABEL[u.role] ?? u.role}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [reviewers, search]);

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
          className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pick a reviewer</h2>
                <p className="text-[11px] text-slate-500">
                  Showing eligible team members in this workspace — Programme
                  Managers, Senior PMs, and Strategic Directors. Invite more
                  people via Workspace Settings → Team.
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
                placeholder="Search by name, email or role…"
                className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading reviewers…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-slate-500">
                {reviewers.length === 0
                  ? 'No eligible reviewers in this workspace yet. Invite a Programme Manager or Senior PM from Workspace Settings.'
                  : 'No reviewers match.'}
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((u) => {
                  const isSelected = u.uid === selectedUid;
                  const badgeCls =
                    ROLE_BADGE[u.role] ?? 'bg-slate-50 text-slate-700 border-slate-200';
                  const roleLabel = ROLE_LABEL[u.role] ?? u.role;
                  return (
                    <li key={u.uid}>
                      <button
                        type="button"
                        onClick={() => onSelect(u)}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50/40'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20',
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                          {initials(u.name, u.email)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-900">
                            {u.name || u.email || '(unnamed)'}
                          </span>
                          {u.email && u.name && (
                            <span className="block truncate text-[10px] text-slate-500">
                              {u.email}
                            </span>
                          )}
                          <span className="mt-0.5 inline-flex items-center gap-1">
                            <span
                              className={clsx(
                                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                                badgeCls,
                              )}
                            >
                              {roleLabel}
                            </span>
                            {u.pmLevel === 'senior' && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                Senior
                              </span>
                            )}
                          </span>
                        </span>
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

          {selectedUid && onClear && (
            <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-2">
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <XCircle className="h-3 w-3" />
                Clear reviewer
              </button>
            </footer>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

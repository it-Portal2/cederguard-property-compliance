import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, AlertTriangle, Loader2, Send } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import type { ReportSection } from './types';

interface DraftAmendment {
  id: string;          // local-only, for React keys
  text: string;
  sectionId: string | null;
}

interface Props {
  isOpen: boolean;
  reportId: string;
  reportTitle: string;
  sections: ReportSection[];
  onClose: () => void;
  onCommitted: () => void;
  /** Which review stage the amendment is being raised at. Default 'pgm'
   *  routes via `governanceRequestAmendments` (existing). 'seniorPm'
   *  routes via the Senior PM endpoint so the audit trail tags
   *  the source stage.*/
  stage?: 'pgm' | 'seniorPm';
}

function makeDraft(): DraftAmendment {
  return {
    id: Math.random().toString(36).slice(2),
    text: '',
    sectionId: null,
  };
}

export function RequestAmendmentsModal({
  isOpen,
  reportId,
  reportTitle,
  sections,
  onClose,
  onCommitted,
  stage = 'pgm',
}: Props) {
  const [drafts, setDrafts] = useState<DraftAmendment[]>([makeDraft()]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) setDrafts([makeDraft()]);
  }, [isOpen]);

  if (!isOpen) return null;

  const updateDraft = (id: string, patch: Partial<DraftAmendment>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
  };

  const addDraft = () => setDrafts((prev) => [...prev, makeDraft()]);

  const removeDraft = (id: string) =>
    setDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== id) : prev));

  const valid = drafts.some((d) => d.text.trim().length > 0);

  const submit = async () => {
    const payload = drafts
      .map((d) => ({ text: d.text.trim(), sectionId: d.sectionId }))
      .filter((d) => d.text.length > 0);
    if (payload.length === 0) {
      toast.error('Add at least one amendment.');
      return;
    }
    setBusy(true);
    try {
      const res =
        stage === 'seniorPm'
          ? await api.governanceSeniorPmRequestAmendments(reportId, payload)
          : await api.governanceRequestAmendments(reportId, payload);
      if (!res?.success) throw new Error(res?.error ?? 'Request failed.');
      toast.success(
        `Sent ${res.created ?? payload.length} amendment${(res.created ?? payload.length) === 1 ? '' : 's'} back to the author.`,
      );
      onCommitted();
    } catch (e: any) {
      console.error('[RequestAmendmentsModal] failed', e);
      toast.error(e?.message ?? 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
        onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.15 }}
          className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Request amendments
                </h2>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {reportTitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-xs text-slate-600">
              Each amendment becomes a checklist item the author has to address
              before re-submitting. Optionally attach to a specific section.
            </p>

            <ul className="space-y-3">
              {drafts.map((d, idx) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Amendment {idx + 1}
                    </span>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDraft(d.id)}
                        disabled={busy}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                        aria-label="Remove amendment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={d.text}
                    onChange={(e) => updateDraft(d.id, { text: e.target.value })}
                    placeholder="What needs changing? Be specific so the author can act on it."
                    rows={3}
                    disabled={busy}
                    className="block w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                  />
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="font-semibold">Section:</span>
                    <select
                      value={d.sectionId ?? ''}
                      onChange={(e) =>
                        updateDraft(d.id, { sectionId: e.target.value || null })
                      }
                      disabled={busy}
                      className="block flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                    >
                      <option value="">No specific section</option>
                      {sections.map((s) => (
                        <option key={s._id} value={s.sectionId}>
                          {s.order}. {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={addDraft}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 hover:text-indigo-700 disabled:opacity-60"
            >
              <Plus className="h-3 w-3" />
              Add another amendment
            </button>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !valid}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send back to author
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

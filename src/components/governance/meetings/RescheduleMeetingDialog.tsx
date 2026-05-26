// Reschedule meeting dialog.
//
// Q20 = a — distinct from Cancel. Moves the meeting's date (+ optional
// times). Linked FP items + reports stay attached; their
// `targetDecisionDate` mirrors the new date server-side. Audit row
// captures from-date / to-date / reason.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

interface Props {
  open: boolean;
  meetingTitle: string;
  currentDate: string;
  currentTimeStart: string;
  currentTimeEnd: string;
  loading?: boolean;
  onConfirm: (params: {
    newDate: string;
    newTimeStart?: string;
    newTimeEnd?: string;
    reason: string;
  }) => void;
  onCancel: () => void;
}

export function RescheduleMeetingDialog({
  open,
  meetingTitle,
  currentDate,
  currentTimeStart,
  currentTimeEnd,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [newDate, setNewDate] = useState('');
  const [newTimeStart, setNewTimeStart] = useState('');
  const [newTimeEnd, setNewTimeEnd] = useState('');
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setNewDate(currentDate ?? '');
    setNewTimeStart(currentTimeStart ?? '');
    setNewTimeEnd(currentTimeEnd ?? '');
    setReason('');
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, currentDate, currentTimeStart, currentTimeEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  const trimmedReason = reason.trim();
  const dateChanged = newDate && newDate !== currentDate;
  const timeChanged =
    (newTimeStart && newTimeStart !== currentTimeStart) ||
    (newTimeEnd && newTimeEnd !== currentTimeEnd);
  const canConfirm =
    !!newDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(newDate) &&
    (dateChanged || timeChanged) &&
    trimmedReason.length >= 5;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-[min(520px,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start gap-3 px-5 py-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-slate-900">
                  Reschedule "{meetingTitle}"?
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Linked reports + Forward Plan items stay attached; their
                  dates auto-update.
                </p>
              </div>
            </header>

            <div className="space-y-3 px-5 pb-3">
              <div>
                <label className="font-mono block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  New date <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={inputRef}
                  type="date"
                  className={clsx(inputCls, 'mt-1')}
                  value={newDate}
                  disabled={loading}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Start time
                  </label>
                  <input
                    type="time"
                    className={clsx(inputCls, 'mt-1')}
                    value={newTimeStart}
                    disabled={loading}
                    onChange={(e) => setNewTimeStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-mono block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    End time
                  </label>
                  <input
                    type="time"
                    className={clsx(inputCls, 'mt-1')}
                    value={newTimeEnd}
                    disabled={loading}
                    onChange={(e) => setNewTimeEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="font-mono block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className={clsx(inputCls, 'mt-1 min-h-16 resize-none')}
                  value={reason}
                  disabled={loading}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Chair unavailable on original date — moved to next available slot."
                />
                {reason.trim().length > 0 && reason.trim().length < 5 && (
                  <p className="mt-1 text-[10px] text-rose-600">
                    Reason must be at least 5 characters.
                  </p>
                )}
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  onConfirm({
                    newDate,
                    newTimeStart: newTimeStart || undefined,
                    newTimeEnd: newTimeEnd || undefined,
                    reason: trimmedReason,
                  })
                }
                disabled={loading || !canConfirm}
                className="inline-flex h-9 min-w-30 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Reschedule
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

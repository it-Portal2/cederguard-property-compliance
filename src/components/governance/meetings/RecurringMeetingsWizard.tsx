// Recurring meetings bulk-create wizard.
//
// PgM picks a body + cadence + start date + N occurrences. Server
// generates dates, auto-shifting bank holidays to the next working
// day (Q11 = a). Cadence pre-fills from the body's `cadence` field
// (lesson reuse from framework).

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Calendar, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import type { FrameworkBody } from '../framework/types';
import ConfirmDialog from '../../table/ConfirmDialog';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-wider text-slate-500';

type Pattern = 'monthly' | 'quarterly' | 'weekly';

interface FormState {
  governanceBodyId: string;
  pattern: Pattern;
  dayOfMonth: number;
  startDate: string;
  numOccurrences: number;
  timeStart: string;
  timeEnd: string;
  location: string;
  chairLabel: string;
  shiftBankHolidays: boolean;
}

const EMPTY: FormState = {
  governanceBodyId: '',
  pattern: 'monthly',
  dayOfMonth: 8,
  startDate: '',
  numOccurrences: 12,
  timeStart: '10:00',
  timeEnd: '12:00',
  location: '',
  chairLabel: '',
  shiftBankHolidays: true,
};

// Map a framework body's `cadence` text to a pattern + warning. We don't
// block — Q37 says soft warning only.
function cadenceDefaultPattern(cadence: string | undefined): Pattern | null {
  if (!cadence) return null;
  const c = cadence.toLowerCase();
  if (c.includes('week')) return 'weekly';
  if (c.includes('quarter')) return 'quarterly';
  if (c.includes('month')) return 'monthly';
  return null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (count: number) => void;
}

export function RecurringMeetingsWizard({ isOpen, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [bodies, setBodies] = useState<FrameworkBody[]>([]);
  const [loadingBodies, setLoadingBodies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const initialSnapshot = useRef<FormState>(EMPTY);

  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY);
    initialSnapshot.current = EMPTY;
    let cancelled = false;
    (async () => {
      setLoadingBodies(true);
      try {
        const res = await api.governanceGetFramework();
        if (cancelled) return;
        setBodies(((res?.bodies ?? []) as FrameworkBody[]) || []);
      } catch (e: any) {
        console.error('[RecurringMeetingsWizard] framework load failed', e);
        if (!cancelled) {
          toast.error(e?.message ?? 'Failed to load bodies.');
        }
      } finally {
        if (!cancelled) setLoadingBodies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const selectedBody = useMemo(
    () => bodies.find((b) => b.id === form.governanceBodyId || b._id === form.governanceBodyId),
    [bodies, form.governanceBodyId],
  );

  const cadenceMismatch = useMemo(() => {
    if (!selectedBody?.cadence) return null;
    const expected = cadenceDefaultPattern(selectedBody.cadence);
    if (!expected) return null;
    if (expected !== form.pattern) {
      return `Body cadence is "${selectedBody.cadence}" — your pick (${form.pattern}) differs.`;
    }
    return null;
  }, [selectedBody, form.pattern]);

  // Pre-fill pattern from body cadence when body changes (only if user
  // hasn't manually changed pattern).
  useEffect(() => {
    if (!selectedBody?.cadence) return;
    const expected = cadenceDefaultPattern(selectedBody.cadence);
    if (expected) {
      setForm((p) => ({ ...p, pattern: expected }));
    }
  }, [selectedBody]);

  if (!isOpen) return null;

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialSnapshot.current);

  const handleClose = () => {
    if (submitting) return;
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const confirmDiscardClose = () => {
    setDiscardConfirmOpen(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.governanceBodyId) {
      toast.error('Pick a governance body.');
      return;
    }
    if (!form.startDate) {
      toast.error('Start date is required.');
      return;
    }
    if (form.numOccurrences < 1 || form.numOccurrences > 60) {
      toast.error('Number of occurrences must be between 1 and 60.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.governanceBulkCreateRecurringMeetings({
        governanceBodyId: form.governanceBodyId,
        pattern: form.pattern,
        dayOfMonth: form.pattern !== 'weekly' ? form.dayOfMonth : undefined,
        startDate: form.startDate,
        numOccurrences: form.numOccurrences,
        timeStart: form.timeStart,
        timeEnd: form.timeEnd,
        location: form.location,
        chairLabel: form.chairLabel,
        shiftBankHolidays: form.shiftBankHolidays,
      });
      if (!res?.success) throw new Error(res?.error ?? 'Bulk create failed.');
      toast.success(`${res.created} meetings created.`);
      onCreated(res.created ?? 0);
      onClose();
    } catch (e: any) {
      console.error('[RecurringMeetingsWizard] create failed', e);
      toast.error(e?.message ?? 'Bulk create failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative flex max-h-[92vh] w-[min(640px,94vw)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Bulk create
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Generate yearly meeting schedule
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Pick a body and cadence — bank holidays auto-shift to the
                next working day.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Body*/}
            <div>
              <label className={labelCls}>Governance body</label>
              <select
                className={clsx(inputCls, 'mt-1')}
                value={form.governanceBodyId}
                disabled={loadingBodies || submitting}
                onChange={(e) => setField('governanceBodyId', e.target.value)}
              >
                <option value="">— Select body —</option>
                {bodies.map((b) => (
                  <option key={b._id ?? b.id} value={b.id ?? b._id}>
                    {b.name} {b.cadence ? `· ${b.cadence}` : ''}
                  </option>
                ))}
              </select>
              {loadingBodies && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Loading bodies…
                </p>
              )}
            </div>

            {/* Pattern*/}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Cadence</label>
                <select
                  className={clsx(inputCls, 'mt-1')}
                  value={form.pattern}
                  disabled={submitting}
                  onChange={(e) => setField('pattern', e.target.value as Pattern)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="weekly">Weekly</option>
                </select>
                {cadenceMismatch && (
                  <p className="mt-1 inline-flex items-start gap-1 text-[10px] text-amber-700">
                    <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                    {cadenceMismatch}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Number of occurrences</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className={clsx(inputCls, 'mt-1')}
                  value={form.numOccurrences}
                  disabled={submitting}
                  onChange={(e) =>
                    setField('numOccurrences', parseInt(e.target.value || '0', 10))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Start date</label>
                <input
                  type="date"
                  className={clsx(inputCls, 'mt-1')}
                  value={form.startDate}
                  disabled={submitting}
                  onChange={(e) => setField('startDate', e.target.value)}
                />
              </div>
              {form.pattern !== 'weekly' && (
                <div>
                  <label className={labelCls}>Day of month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={clsx(inputCls, 'mt-1')}
                    value={form.dayOfMonth}
                    disabled={submitting}
                    onChange={(e) =>
                      setField('dayOfMonth', parseInt(e.target.value || '1', 10))
                    }
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Start time</label>
                <input
                  type="time"
                  className={clsx(inputCls, 'mt-1')}
                  value={form.timeStart}
                  disabled={submitting}
                  onChange={(e) => setField('timeStart', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>End time</label>
                <input
                  type="time"
                  className={clsx(inputCls, 'mt-1')}
                  value={form.timeEnd}
                  disabled={submitting}
                  onChange={(e) => setField('timeEnd', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Location</label>
                <input
                  className={clsx(inputCls, 'mt-1')}
                  value={form.location}
                  disabled={submitting}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="e.g. Tooley Street · Room 4.12 / MS Teams"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Chair</label>
                <input
                  className={clsx(inputCls, 'mt-1')}
                  value={form.chairLabel}
                  disabled={submitting}
                  onChange={(e) => setField('chairLabel', e.target.value)}
                  placeholder="e.g. Strategic Director · Housing"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.shiftBankHolidays}
                onChange={(e) => setField('shiftBankHolidays', e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Auto-shift bank holiday + weekend dates to next working day
            </label>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex h-9 min-w-30 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate {form.numOccurrences} meetings
            </button>
          </footer>
        </motion.div>
      </motion.div>
      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        message="You have edits in the wizard that haven't been submitted. Closing will discard them."
        confirmLabel="Discard changes"
        variant="danger"
        onConfirm={confirmDiscardClose}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </AnimatePresence>
  );
}

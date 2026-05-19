import { useEffect, useState } from 'react';
import { X, Save, Loader2, Scale, Infinity as InfinityIcon } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import type { FrameworkThreshold } from './types';

interface ThresholdBandModalProps {
  isOpen: boolean;
  /** Pass null to add a new band. Pass a row to edit it. */
  editing: FrameworkThreshold | null;
  /** Used to check for duplicate IDs when adding. */
  existingIds: string[];
  onClose: () => void;
  onSaved: (row: FrameworkThreshold) => void;
}

interface FormState {
  id: string;
  bandLabel: string;
  bandMin: string;
  bandMax: string;
  bandMinNone: boolean;
  bandMaxNone: boolean;
  decisionRoute: string;
  reportTypes: string;
  notes: string;
}

const EMPTY: FormState = {
  id: '',
  bandLabel: '',
  bandMin: '0',
  bandMax: '',
  bandMinNone: false,
  bandMaxNone: true,
  decisionRoute: '',
  reportTypes: '',
  notes: '',
};

// Tiny deterministic ID helper. Client-side only — server has its own regex
// guard so anything that slips through still fails safely.
function makeBandId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (slug) return `band-${slug}`;
  return `band-${Date.now()}`;
}

function rowToForm(row: FrameworkThreshold | null): FormState {
  if (!row) return { ...EMPTY };
  return {
    id: row.id,
    bandLabel: row.bandLabel ?? '',
    bandMin: row.bandMin == null ? '' : String(row.bandMin),
    bandMax: row.bandMax == null ? '' : String(row.bandMax),
    bandMinNone: row.bandMin == null,
    bandMaxNone: row.bandMax == null,
    decisionRoute: row.decisionRoute ?? '',
    reportTypes: (row.reportTypes ?? []).join(', '),
    notes: row.notes ?? '',
  };
}

export function ThresholdBandModal({
  isOpen,
  editing,
  existingIds,
  onClose,
  onSaved,
}: ThresholdBandModalProps) {
  const [form, setForm] = useState<FormState>(rowToForm(editing));
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(rowToForm(editing));
      setFieldErrors({});
    }
  }, [isOpen, editing]);

  if (!isOpen) return null;
  const isNew = !editing;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): Partial<Record<keyof FormState, string>> => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.bandLabel.trim()) errors.bandLabel = 'Band label is required.';
    if (!form.decisionRoute.trim()) errors.decisionRoute = 'Decision route is required.';

    if (!form.bandMinNone) {
      const n = Number(form.bandMin);
      if (form.bandMin === '' || Number.isNaN(n)) errors.bandMin = 'Enter a number or tick "No lower limit".';
      else if (n < 0) errors.bandMin = 'Cannot be negative.';
    }
    if (!form.bandMaxNone) {
      const n = Number(form.bandMax);
      if (form.bandMax === '' || Number.isNaN(n)) errors.bandMax = 'Enter a number or tick "No upper limit".';
      else if (n < 0) errors.bandMax = 'Cannot be negative.';
    }
    if (!form.bandMinNone && !form.bandMaxNone) {
      const lo = Number(form.bandMin);
      const hi = Number(form.bandMax);
      if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) {
        errors.bandMax = 'Upper limit must be ≥ lower limit.';
      }
    }
    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const bandMin = form.bandMinNone ? null : Number(form.bandMin);
    const bandMax = form.bandMaxNone ? null : Number(form.bandMax);
    const reportTypes = form.reportTypes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const id = isNew ? makeBandId(form.bandLabel) : form.id;
    if (isNew && existingIds.includes(id)) {
      setFieldErrors({ bandLabel: 'A band with this label already exists — pick a different name.' });
      return;
    }

    const patch: Partial<FrameworkThreshold> = {
      bandLabel: form.bandLabel.trim(),
      bandMin,
      bandMax,
      decisionRoute: form.decisionRoute.trim(),
      reportTypes,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      const res = await api.governanceUpsertThreshold(id, patch);
      toast.success(isNew ? 'Band added' : 'Band updated');
      onSaved(res.threshold as FrameworkThreshold);
      onClose();
    } catch (e: any) {
      console.error('[ThresholdBandModal] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Scale className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {isNew ? 'Add authority band' : 'Edit authority band'}
              </p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {form.bandLabel || 'Untitled band'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <Field label="Band label" error={fieldErrors.bandLabel}>
            <input
              value={form.bandLabel}
              onChange={(e) => setField('bandLabel', e.target.value)}
              placeholder="Up to £100,000"
              className={inputCls(!!fieldErrors.bandLabel)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Lower limit (£)" error={fieldErrors.bandMin}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={form.bandMin}
                  onChange={(e) => setField('bandMin', e.target.value)}
                  disabled={form.bandMinNone}
                  placeholder="0"
                  className={clsx(inputCls(!!fieldErrors.bandMin), 'flex-1')}
                />
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={form.bandMinNone}
                    onChange={(e) => setField('bandMinNone', e.target.checked)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  <InfinityIcon className="h-3.5 w-3.5" />
                  None
                </label>
              </div>
            </Field>
            <Field label="Upper limit (£)" error={fieldErrors.bandMax}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={form.bandMax}
                  onChange={(e) => setField('bandMax', e.target.value)}
                  disabled={form.bandMaxNone}
                  placeholder="100000"
                  className={clsx(inputCls(!!fieldErrors.bandMax), 'flex-1')}
                />
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={form.bandMaxNone}
                    onChange={(e) => setField('bandMaxNone', e.target.checked)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  <InfinityIcon className="h-3.5 w-3.5" />
                  None
                </label>
              </div>
            </Field>
          </div>

          <Field label="Decision route" error={fieldErrors.decisionRoute}>
            <input
              value={form.decisionRoute}
              onChange={(e) => setField('decisionRoute', e.target.value)}
              placeholder="DPB → DCRB → Cabinet"
              className={inputCls(!!fieldErrors.decisionRoute)}
            />
          </Field>

          <Field label="Report types (comma-separated)">
            <input
              value={form.reportTypes}
              onChange={(e) => setField('reportTypes', e.target.value)}
              placeholder="Gateway 2, Gateway 3, Cabinet Report"
              className={inputCls(false)}
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={3}
              placeholder="e.g. Automatic key decision · published 28 days before Cabinet."
              className={clsx(inputCls(false), 'resize-none')}
            />
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isNew ? 'Add band' : 'Save changes'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function inputCls(hasError: boolean): string {
  return clsx(
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
    hasError
      ? 'border-rose-300 focus:border-rose-500'
      : 'border-slate-200 focus:border-indigo-500',
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="mb-1 block">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] font-medium text-rose-600">{error}</span>
      )}
    </label>
  );
}

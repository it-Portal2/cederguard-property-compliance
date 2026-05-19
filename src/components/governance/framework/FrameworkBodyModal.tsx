import { useEffect, useState } from 'react';
import { X, Save, Loader2, Trash2, ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { api } from '../../../lib/api';
import {
  type BodyTier,
  type FrameworkBody,
  type TermsOfReference,
  TIER_LABEL,
  TIER_ORDER,
  TIER_STYLES,
} from './types';
import { TorEditor } from './TorEditor';
import ConfirmDialog from '../../table/ConfirmDialog';

interface FrameworkBodyModalProps {
  body: FrameworkBody | null;
  draftTier: BodyTier | null;
  /** Active ToR for this body — draft if one exists, else published. */
  tor: TermsOfReference | null;
  /** Last published ToR (null if body has never had one published). */
  lastPublishedTor: TermsOfReference | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (body: FrameworkBody) => void;
  onDeleted: (bodyId: string) => void;
  onTorSaved: (tor: TermsOfReference) => void;
}

type FormState = Pick<
  FrameworkBody,
  'id' | 'name' | 'tier' | 'cadence' | 'chair' | 'authority' | 'cabinetMemberPortfolio'
> & {
  acceptedReportTypes: string;
  standingItems: string;
};

const TAB_BODY = 'body';
const TAB_TOR = 'tor';

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function bodyToForm(body: FrameworkBody | null, draftTier: BodyTier | null): FormState {
  return {
    id: body?.id ?? '',
    name: body?.name ?? '',
    tier: body?.tier ?? draftTier ?? 'programme',
    cadence: body?.cadence ?? 'Monthly',
    chair: body?.chair ?? '',
    authority: body?.authority ?? '',
    cabinetMemberPortfolio: body?.cabinetMemberPortfolio ?? '',
    acceptedReportTypes: (body?.acceptedReportTypes ?? []).join(', '),
    standingItems: (body?.standingItems ?? []).join('\n'),
  };
}

export function FrameworkBodyModal({
  body,
  draftTier,
  tor,
  lastPublishedTor,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
  onTorSaved,
}: FrameworkBodyModalProps) {
  const [form, setForm] = useState<FormState>(bodyToForm(body, draftTier));
  const [tab, setTab] = useState<typeof TAB_BODY | typeof TAB_TOR>(TAB_BODY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(bodyToForm(body, draftTier));
      setTab(TAB_BODY);
    }
  }, [isOpen, body, draftTier]);

  if (!isOpen) return null;
  const isNew = !body;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    const bodyId = isNew ? makeSlug(form.name) || `body-${Date.now()}` : form.id;
    if (!bodyId) {
      toast.error('Could not derive a valid ID from the name.');
      return;
    }
    setSaving(true);
    try {
      const patch: Record<string, any> = {
        name: form.name.trim(),
        tier: form.tier,
        cadence: form.cadence.trim(),
        chair: form.chair.trim(),
        authority: form.authority.trim(),
        cabinetMemberPortfolio: form.cabinetMemberPortfolio?.trim() || null,
        acceptedReportTypes: form.acceptedReportTypes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        standingItems: form.standingItems
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await api.governanceUpsertBody(bodyId, patch);
      toast.success(isNew ? 'Body added' : 'Body updated');
      onSaved(res.body);
      onClose();
    } catch (e: any) {
      console.error('[FrameworkBodyModal] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!body) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!body) return;
    setDeleting(true);
    try {
      await api.governanceDeleteBody(body.id);
      toast.success('Body removed');
      onDeleted(body.id);
      setDeleteConfirmOpen(false);
      onClose();
    } catch (e: any) {
      console.error('[FrameworkBodyModal] delete failed', e);
      toast.error(e?.message ?? 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const tierStyle = TIER_STYLES[form.tier];

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className={clsx('mt-1.5 inline-flex h-2.5 w-2.5 rounded-full', tierStyle.dot)} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {isNew ? 'Add governance body' : 'Edit governance body'}
              </p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {form.name || 'Untitled body'}
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

        <nav className="flex items-center gap-1 border-b border-slate-100 px-4">
          {[
            { key: TAB_BODY, label: 'Body details' },
            { key: TAB_TOR, label: 'Terms of Reference' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              disabled={isNew && t.key === TAB_TOR}
              className={clsx(
                'relative px-4 py-3 text-xs font-semibold transition-colors',
                tab === t.key
                  ? 'text-indigo-700'
                  : 'text-slate-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-indigo-600" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === TAB_BODY ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Name" full>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="DPB · Departmental Programme Board"
                  className={inputCls}
                />
              </Field>
              <Field label="Tier">
                <select
                  value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as BodyTier }))}
                  className={inputCls}
                >
                  {TIER_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cadence">
                <input
                  value={form.cadence}
                  onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))}
                  placeholder="Weekly / Monthly / Quarterly / Ad-hoc"
                  className={inputCls}
                />
              </Field>
              <Field label="Chair">
                <input
                  value={form.chair}
                  onChange={(e) => setForm((f) => ({ ...f, chair: e.target.value }))}
                  placeholder="e.g. Strategic Director"
                  className={inputCls}
                />
              </Field>
              <Field label="Cabinet member portfolio (LMB only)">
                <input
                  value={form.cabinetMemberPortfolio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cabinetMemberPortfolio: e.target.value }))
                  }
                  placeholder="Council Homes & Homelessness"
                  className={inputCls}
                />
              </Field>
              <Field label="Authority" full>
                <textarea
                  value={form.authority}
                  onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))}
                  placeholder="What this body decides."
                  rows={3}
                  className={clsx(inputCls, 'resize-none')}
                />
              </Field>
              <Field label="Accepted report types (comma-separated)" full>
                <input
                  value={form.acceptedReportTypes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, acceptedReportTypes: e.target.value }))
                  }
                  placeholder="Gateway 2, Gateway 3, Cabinet Report"
                  className={inputCls}
                />
              </Field>
              <Field label="Standing items (one per line)" full>
                <textarea
                  value={form.standingItems}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, standingItems: e.target.value }))
                  }
                  placeholder={'Programme status\nRisk register\nForward Plan'}
                  rows={4}
                  className={clsx(inputCls, 'resize-none')}
                />
              </Field>
            </div>
          ) : (
            <TorEditor
              ownerBodyId={body?.id ?? ''}
              currentToR={tor}
              lastPublishedToR={lastPublishedTor}
              onSaved={onTorSaved}
            />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove body
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            {tab === TAB_BODY && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isNew ? 'Add body' : 'Save changes'}
              </button>
            )}
            {tab === TAB_TOR && isNew && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <ScrollText className="h-3.5 w-3.5" />
                Save the body first to edit its ToR.
              </span>
            )}
          </div>
        </footer>
      </div>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete "${body?.name ?? ''}"?`}
        message="This removes the body from the framework. Reports + meetings already linked to it keep their reference for audit purposes."
        confirmLabel="Delete body"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteConfirmOpen(false))}
      />
    </div>
  );
}

const inputCls =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={clsx('block text-xs font-semibold text-slate-700', full && 'md:col-span-2')}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

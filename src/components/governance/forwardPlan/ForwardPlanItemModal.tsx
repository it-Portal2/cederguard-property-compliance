import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Save,
  Loader2,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  CalendarDays,
  Users,
  Link as LinkIcon,
  FilePlus,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import ConfirmDialog from '../../table/ConfirmDialog';
import {
  type ApprovalStatus,
  type BoardGate,
  type Classification,
  type EntryType,
  type ForwardPlanItem,
  type RoutingMode,
  CLASSIFICATION_OPTIONS,
  ENTRY_TYPE_OPTIONS,
  ROUTING_MODE_OPTIONS,
  BOARD_GATE_STATUS_OPTIONS,
  APPROVAL_STATUS_OPTIONS,
} from './types';

// Framework body — minimum shape we need from the framework page so this
// modal can render the per-body board-gate rows.
export interface FpBodyOption {
  _id: string;
  id: string;
  name: string;
  tier: string;
}

interface ForwardPlanItemModalProps {
  isOpen: boolean;
  /** null = create mode; an item = edit mode.*/
  item: ForwardPlanItem | null;
  /** All framework bodies for the council (used to render boardGates rows).*/
  frameworkBodies: FpBodyOption[];
  /** Existing item IDs — used for client-side uniqueness check on create.*/
  existingIds: string[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (item: ForwardPlanItem) => void;
}

interface FormState {
  title: string;
  scheme: string;
  reportType: string;
  typeOfEntry: EntryType;
  classification: Classification;
  isHRB: boolean;
  wards: string;            // comma-separated for the input
  value: string;            // string in form, parsed to number on save
  targetDecisionDate: string;
  decisionRoute: string;
  routingMode: RoutingMode;
  boardGates: Record<string, BoardGate>;
  strategicLead: string;
  reportAuthor: string;
  representingOfficer: string;
  decisionMaker: string;
  otherMeetings: string;
  comments: string;
  fileLink: string;
  decisionLink: string;
  status: 'Draft' | 'Published';
  // Excel Column F. Empty string in form = not set; serialised
  // to `null` on save.
  approvalStatus: '' | ApprovalStatus;
}

function emptyState(): FormState {
  return {
    title: '',
    scheme: '',
    reportType: '',
    typeOfEntry: 'New',
    classification: 'Open',
    isHRB: false,
    wards: '',
    value: '',
    targetDecisionDate: '',
    decisionRoute: '',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: '',
    reportAuthor: '',
    representingOfficer: '',
    decisionMaker: '',
    otherMeetings: '',
    comments: '',
    fileLink: '',
    decisionLink: '',
    status: 'Draft',
    approvalStatus: '',
  };
}

function itemToForm(item: ForwardPlanItem): FormState {
  return {
    title: item.title ?? '',
    scheme: item.scheme ?? '',
    reportType: item.reportType ?? '',
    typeOfEntry: (item.typeOfEntry as EntryType) ?? 'New',
    classification: (item.classification as Classification) ?? 'Open',
    isHRB: !!item.isHRB,
    wards: Array.isArray(item.wards) ? item.wards.join(', ') : '',
    value: item.value != null ? String(item.value) : '',
    targetDecisionDate: item.targetDecisionDate ?? '',
    decisionRoute: item.decisionRoute ?? '',
    routingMode: (item.routingMode as RoutingMode) ?? 'sequential',
    boardGates: { ...(item.boardGates ?? {}) },
    strategicLead: item.strategicLead ?? '',
    reportAuthor: item.reportAuthor ?? '',
    representingOfficer: item.representingOfficer ?? '',
    decisionMaker: item.decisionMaker ?? '',
    otherMeetings: item.otherMeetings ?? '',
    comments: item.comments ?? '',
    fileLink: item.fileLink ?? '',
    decisionLink: item.decisionLink ?? '',
    status: item.status === 'Published' ? 'Published' : 'Draft',
    approvalStatus:
      item.approvalStatus === 'Pending' || item.approvalStatus === 'Approved'
        ? item.approvalStatus
        : '',
  };
}

// ID auto-gen pattern — never expose a code field for FP items.
function makeFpId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = (Date.now() % 1_000_000).toString(36);
  return slug ? `${slug}-${suffix}` : `fp-${suffix}`;
}

// Mirror of server-side computeIsKeyDecision so the form can show the badge
// live before save. Source-of-truth is still the server (lesson on
// server-computed flags, see governanceForwardPlan.ts).
function computeKeyDecisionPreview(form: FormState): boolean {
  const value = Number(form.value);
  if (Number.isFinite(value) && value > 500_000) return true;
  const wards = form.wards
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (wards.length >= 2) return true;
  if (form.isHRB) return true;
  return false;
}

export function ForwardPlanItemModal({
  isOpen,
  item,
  frameworkBodies,
  existingIds,
  canEdit,
  onClose,
  onSaved,
}: ForwardPlanItemModalProps) {
  const isCreating = item === null;
  const [form, setForm] = useState<FormState>(item ? itemToForm(item) : emptyState());
  const [saving, setSaving] = useState<'draft' | 'publish' | 'create' | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialRef = useRef<FormState>(form);

  useEffect(() => {
    if (!isOpen) return;
    const next = item ? itemToForm(item) : emptyState();
    setForm(next);
    initialRef.current = next;
  }, [isOpen, item]);

  // ALL hooks must be declared before any early return — React's rules of
  // hooks. Used to live after `if (!isOpen) return null` which crashed the
  // render the moment the modal opened (different hook count between renders).
  const keyDecisionPreview = useMemo(() => computeKeyDecisionPreview(form), [form]);
  const sortedBodies = useMemo(
    () =>
      [...frameworkBodies].sort((a, b) =>
        (a.tier ?? '').localeCompare(b.tier ?? '') ||
        (a.name ?? '').localeCompare(b.name ?? ''),
      ),
    [frameworkBodies],
  );

  if (!isOpen) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setGate = (bodyDocId: string, patch: Partial<BoardGate>) => {
    setForm((f) => {
      const current = f.boardGates[bodyDocId] ?? { status: 'scheduled' };
      const next = { ...current, ...patch } as BoardGate;
      return { ...f, boardGates: { ...f.boardGates, [bodyDocId]: next } };
    });
  };

  const isDirty = () =>
    JSON.stringify(form) !== JSON.stringify(initialRef.current);

  const handleClose = () => {
    if (isDirty()) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.scheme.trim()) return 'Scheme is required.';
    if (form.value && Number.isNaN(Number(form.value))) return 'Value must be a number.';
    return null;
  };

  const buildPatch = () => {
    const wards = form.wards
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      title: form.title.trim(),
      scheme: form.scheme.trim(),
      reportType: form.reportType.trim(),
      typeOfEntry: form.typeOfEntry,
      classification: form.classification,
      isHRB: form.isHRB,
      wards,
      value: form.value ? Number(form.value) : 0,
      targetDecisionDate: form.targetDecisionDate || null,
      decisionRoute: form.decisionRoute.trim(),
      routingMode: form.routingMode,
      boardGates: form.boardGates,
      strategicLead: form.strategicLead.trim(),
      reportAuthor: form.reportAuthor.trim(),
      representingOfficer: form.representingOfficer.trim(),
      decisionMaker: form.decisionMaker.trim(),
      otherMeetings: form.otherMeetings.trim(),
      comments: form.comments.trim(),
      fileLink: form.fileLink.trim(),
      decisionLink: form.decisionLink.trim(),
      status: form.status,
      // Excel Column F. Empty form value clears the field on
      // the server (server validator accepts null + undefined as "clear").
      approvalStatus: form.approvalStatus === '' ? null : form.approvalStatus,
    };
  };

  const save = async (mode: 'create' | 'draft' | 'publish') => {
    if (!canEdit) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(mode);
    try {
      let itemId: string;
      if (isCreating) {
        itemId = makeFpId(form.title);
        if (existingIds.includes(itemId)) {
          // Extremely unlikely with the timestamp suffix — but defensive.
          itemId = `${itemId}-${Math.floor(Math.random() * 1000)}`;
        }
      } else {
        itemId = item!.id;
      }
      const patch = buildPatch();
      if (mode === 'publish') (patch as any).status = 'Published';
      const res = await api.governanceUpsertForwardPlanItem(itemId, patch);
      const latest = res.item as ForwardPlanItem;
      onSaved(latest);
      initialRef.current = itemToForm(latest);
      toast.success(
        mode === 'publish'
          ? 'Item published'
          : mode === 'create'
          ? 'Item created — keep editing or publish when ready'
          : 'Draft saved',
      );
      if (mode === 'publish') onClose();
    } catch (e: any) {
      console.error('[ForwardPlanItemModal] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {isCreating ? 'New Forward Plan item' : `Forward Plan item · ${item!.status}`}
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {form.title || (isCreating ? 'Untitled item' : 'Item')}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {keyDecisionPreview ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  <ShieldAlert className="h-3 w-3" />
                  Key decision (auto-flagged)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Non-key
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {form.classification}
              </span>
              {form.isHRB && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  HRB
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <Section title="Identity">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Title" required>
                <input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Estate fencing replacement programme"
                  className={inputCls}
                />
              </Field>
              <Field label="Scheme" required>
                <input
                  value={form.scheme}
                  onChange={(e) => set('scheme', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Walworth estate refresh"
                  className={inputCls}
                />
              </Field>
              <Field label="Report type">
                <input
                  value={form.reportType}
                  onChange={(e) => set('reportType', e.target.value)}
                  disabled={!canEdit}
                  placeholder="GW2"
                  className={inputCls}
                />
              </Field>
              <Field label="Type of entry">
                <select
                  value={form.typeOfEntry}
                  onChange={(e) => set('typeOfEntry', e.target.value as EntryType)}
                  disabled={!canEdit}
                  className={inputCls}
                >
                  {ENTRY_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              {/*Excel Column F. Independent of FP status.*/}
              <Field label="Report approval status">
                <select
                  value={form.approvalStatus}
                  onChange={(e) =>
                    set('approvalStatus', e.target.value as '' | ApprovalStatus)
                  }
                  disabled={!canEdit}
                  className={inputCls}
                >
                  {APPROVAL_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Classification & key-decision">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Classification">
                <select
                  value={form.classification}
                  onChange={(e) =>
                    set('classification', e.target.value as Classification)
                  }
                  disabled={!canEdit}
                  className={inputCls}
                >
                  {CLASSIFICATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Wards (comma-separated)">
                <input
                  value={form.wards}
                  onChange={(e) => set('wards', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Walworth, Camberwell"
                  className={inputCls}
                />
              </Field>
              <Field label="Value (£)">
                <input
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={(e) => set('value', e.target.value)}
                  disabled={!canEdit}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <Field label="Target decision date">
                <input
                  type="date"
                  value={form.targetDecisionDate}
                  onChange={(e) => set('targetDecisionDate', e.target.value)}
                  disabled={!canEdit}
                  className={inputCls}
                />
              </Field>
              <div className="flex items-center md:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isHRB}
                    onChange={(e) => set('isHRB', e.target.checked)}
                    disabled={!canEdit}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  HRB · High-Risk Building (BSA 2022)
                </label>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Key-decision auto-flag fires when value &gt; £500k OR ≥ 2 wards affected OR HRB.
            </p>
          </Section>

          <Section title="Decision route">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Routing mode">
                <select
                  value={form.routingMode}
                  onChange={(e) => set('routingMode', e.target.value as RoutingMode)}
                  disabled={!canEdit}
                  className={inputCls}
                >
                  {ROUTING_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Decision route" full>
                <input
                  value={form.decisionRoute}
                  onChange={(e) => set('decisionRoute', e.target.value)}
                  disabled={!canEdit}
                  placeholder="DPB → DCRB → CCRB → Cabinet"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section title="Board dates" icon={<CalendarDays className="h-4 w-4" />}>
            {sortedBodies.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs text-slate-400">
                No framework bodies set up yet. Create them in Framework first.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Body</th>
                      <th className="w-44 px-3 py-2 text-left">Target date</th>
                      <th className="w-36 px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBodies.map((b) => {
                      const gate = form.boardGates[b._id] ?? { status: 'scheduled' as const };
                      return (
                        <tr key={b._id} className="border-t border-slate-100">
                          <td className="px-3 py-2 align-middle">
                            <div className="text-xs font-semibold text-slate-900">
                              {b.name}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400">
                              {b.tier}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <input
                              type="date"
                              value={gate.targetDate ?? ''}
                              onChange={(e) =>
                                setGate(b._id, { targetDate: e.target.value || undefined })
                              }
                              disabled={!canEdit}
                              className={inputCls}
                            />
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <select
                              value={gate.status}
                              onChange={(e) =>
                                setGate(b._id, {
                                  status: e.target.value as BoardGate['status'],
                                })
                              }
                              disabled={!canEdit}
                              className={inputCls}
                            >
                              {BOARD_GATE_STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <input
                              type="text"
                              value={gate.outcome ?? ''}
                              onChange={(e) =>
                                setGate(b._id, { outcome: e.target.value })
                              }
                              disabled={!canEdit}
                              placeholder="Approved / deferred / etc."
                              className={inputCls}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="People" icon={<Users className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Strategic Lead">
                <input
                  value={form.strategicLead}
                  onChange={(e) => set('strategicLead', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Director of Housing"
                  className={inputCls}
                />
              </Field>
              <Field label="Report Author">
                <input
                  value={form.reportAuthor}
                  onChange={(e) => set('reportAuthor', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Sarah Knowles, Senior PM"
                  className={inputCls}
                />
              </Field>
              <Field label="Representing Officer">
                <input
                  value={form.representingOfficer}
                  onChange={(e) => set('representingOfficer', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Head of Procurement"
                  className={inputCls}
                />
              </Field>
              <Field label="Decision Maker">
                <input
                  value={form.decisionMaker}
                  onChange={(e) => set('decisionMaker', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Cabinet Member · Housing"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section title="Other" icon={<LinkIcon className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="File link (e.g. SharePoint)" full>
                <input
                  type="url"
                  value={form.fileLink}
                  onChange={(e) => set('fileLink', e.target.value)}
                  disabled={!canEdit}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
              <Field label="Decision link (e.g. Modern.gov)" full>
                <input
                  type="url"
                  value={form.decisionLink}
                  onChange={(e) => set('decisionLink', e.target.value)}
                  disabled={!canEdit}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
              <Field label="Other meetings" full>
                <textarea
                  value={form.otherMeetings}
                  onChange={(e) => set('otherMeetings', e.target.value)}
                  disabled={!canEdit}
                  rows={2}
                  className={clsx(inputCls, 'resize-none')}
                />
              </Field>
              <Field label="Comments" full>
                <textarea
                  value={form.comments}
                  onChange={(e) => set('comments', e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  className={clsx(inputCls, 'resize-none')}
                />
              </Field>
            </div>
          </Section>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          {canEdit && isCreating && (
            <button
              type="button"
              onClick={() => save('create')}
              disabled={saving !== null}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === 'create' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FilePlus className="h-3.5 w-3.5" />
              )}
              Create item
            </button>
          )}
          {canEdit && !isCreating && (
            <>
              <button
                type="button"
                onClick={() => save('draft')}
                disabled={saving !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === 'draft' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save as draft
              </button>
              <button
                type="button"
                onClick={() => save('publish')}
                disabled={saving !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === 'publish' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                Publish
              </button>
            </>
          )}
        </footer>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="Discard your changes?"
        message="Unsaved edits to this Forward Plan item will be lost. This can't be undone."
        confirmLabel="Discard changes"
        variant="danger"
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}

const inputCls =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  full,
  required,
  children,
}: {
  label: string;
  full?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={clsx(
        'block text-[11px] font-semibold uppercase tracking-widest text-slate-500',
        full && 'md:col-span-3',
      )}
    >
      <span className="mb-1 block">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

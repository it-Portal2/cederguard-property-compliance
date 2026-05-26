import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Save,
  Loader2,
  UploadCloud,
  Copy,
  Trash2,
  ShieldCheck,
  Plus,
  ChevronUp,
  ChevronDown,
  Lock,
  Lightbulb,
  Info,
  FilePlus,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import {
  type ReportTemplate,
  type TemplateCategory,
  type TemplateSection,
  CATEGORY_LABEL,
  CATEGORY_STYLES,
} from './types';
import ConfirmDialog from '../../table/ConfirmDialog';
import { TextInputDialog } from '../TextInputDialog';

// All 6 categories shown in the Category dropdown.
const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'gateway', label: CATEGORY_LABEL.gateway },
  { value: 'milestone', label: CATEGORY_LABEL.milestone },
  { value: 'finance', label: CATEGORY_LABEL.finance },
  { value: 'shareholder', label: CATEGORY_LABEL.shareholder },
  { value: 'cabinet', label: CATEGORY_LABEL.cabinet },
  { value: 'other', label: CATEGORY_LABEL.other },
];

// Minimum structural scaffold for a brand-new blank template. Header +
// Audit footer are both statutory so the PDF layout never ends up empty.
function blankScaffold(): TemplateSection[] {
  return [
    {
      id: 'header',
      order: 1,
      name: 'Header metadata',
      guidance: 'Decision taker, date, wards, classification, report title.',
      mandatory: true,
      statutory: true,
      aiDraftAllowed: false,
      complianceCheck: false,
    },
    {
      id: 'audit-footer',
      order: 2,
      name: 'Audit trail footer',
      guidance: 'Auto-populated from report metadata.',
      mandatory: true,
      statutory: true,
      aiDraftAllowed: false,
      complianceCheck: false,
    },
  ];
}

// Auto-generate a document ID from the title so no user-facing "code" field
// is needed. Short base-36 timestamp suffix makes collisions ~impossible.
function makeId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = (Date.now() % 1_000_000).toString(36);
  return slug ? `${slug}-${suffix}` : `tpl-${suffix}`;
}

// Deep-clone a starter's sections so edits in the new template don't mutate
// the starter. Also resets section order numbers to 1..N.
function cloneSections(src: TemplateSection[]): TemplateSection[] {
  return src.map((s, i) => ({
    ...s,
    order: i + 1,
    citedRegulations: s.citedRegulations ? [...s.citedRegulations] : undefined,
    requiredAttachments: s.requiredAttachments ? [...s.requiredAttachments] : undefined,
  }));
}

function sortSections(sections: TemplateSection[]): TemplateSection[] {
  return [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

interface TemplateEditorModalProps {
  isOpen: boolean;
  /** Null = create mode; a template object = edit mode. */
  template: ReportTemplate | null;
  /** All templates in the council — used for the starter picker + uniqueness. */
  existingTemplates: ReportTemplate[];
  canEdit: boolean;
  /** Enables super-admin-only controls (flip `statutory`). */
  isSuperAdmin?: boolean;
  onClose: () => void;
  onSaved: (template: ReportTemplate) => void;
  onDuplicated: (template: ReportTemplate) => void;
}

interface FormState {
  title: string;
  code: string;
  description: string;
  category: TemplateCategory;
  defaultRoute: string;
  requireSeniorPmReview: boolean;
  sections: TemplateSection[];
  /** null = Blank template; otherwise the starter's id. Only used in create mode. */
  basedOn: string | null;
}

function initialCreateState(): FormState {
  return {
    title: '',
    code: '',
    description: '',
    category: 'other',
    defaultRoute: '',
    requireSeniorPmReview: false,
    sections: blankScaffold(),
    basedOn: null,
  };
}

function templateToFormState(t: ReportTemplate): FormState {
  return {
    title: t.title ?? '',
    code: t.code ?? '',
    description: t.description ?? '',
    category: t.category ?? 'other',
    defaultRoute: t.defaultRoute ?? '',
    requireSeniorPmReview: !!t.requireSeniorPmReview,
    sections: sortSections(t.sections ?? []),
    basedOn: t.originStarterId ?? null,
  };
}

function makeSectionId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `section-${Date.now()}`
  );
}

export function TemplateEditorModal({
  isOpen,
  template,
  existingTemplates,
  canEdit,
  isSuperAdmin = false,
  onClose,
  onSaved,
  onDuplicated,
}: TemplateEditorModalProps) {
  const isCreating = template === null;

  const [form, setForm] = useState<FormState>(
    template ? templateToFormState(template) : initialCreateState(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'publish' | 'create' | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingStarter, setPendingStarter] = useState<
    { starterId: string | null; firstTime: boolean } | null
  >(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // Snapshot the initial state so we can detect unsaved changes on close.
  const initialStateRef = useRef<FormState>(form);

  useEffect(() => {
    if (!isOpen) return;
    const next = template ? templateToFormState(template) : initialCreateState();
    setForm(next);
    initialStateRef.current = next;
    setSelectedId(next.sections[0]?.id ?? null);
  }, [isOpen, template]);

  const selected = useMemo(
    () => form.sections.find((s) => s.id === selectedId) ?? null,
    [form.sections, selectedId],
  );

  if (!isOpen) return null;

  // Starter picker options — Blank + every other template (seeded + PgM's own).
  // Exclude the currently-editing template from being its own starter.
  const starterOptions = existingTemplates
    .filter((t) => !template || t.id !== template.id)
    .slice()
    .sort((a, b) => {
      // Seeded first, then alphabetical within group.
      const aSeed = (a as any).seeded ? 0 : 1;
      const bSeed = (b as any).seeded ? 0 : 1;
      if (aSeed !== bSeed) return aSeed - bSeed;
      return (a.title ?? '').localeCompare(b.title ?? '');
    });

  const originStarter = template?.originStarterId
    ? existingTemplates.find((t) => t.id === template.originStarterId)
    : null;

  const categoryStyle = CATEGORY_STYLES[form.category];

  const isDirty = () => JSON.stringify(form) !== JSON.stringify(initialStateRef.current);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleClose = () => {
    if (isDirty()) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const confirmDiscardClose = () => {
    setDiscardConfirmOpen(false);
    onClose();
  };

  const applyStarter = (starterId: string | null) => {
    if (starterId === null) {
      // Blank → reset to scaffold, but keep any title/description the user typed.
      setForm((f) => ({
        ...f,
        basedOn: null,
        sections: blankScaffold(),
      }));
      return;
    }
    const starter = existingTemplates.find((t) => t.id === starterId);
    if (!starter) return;
    setForm({
      title: form.title || starter.title, // preserve user-typed title if any
      // Carry the starter's code so GW2 starter → GW2 code. User can override.
      code: starter.code ?? '',
      description: starter.description ?? '',
      category: starter.category,
      defaultRoute: starter.defaultRoute ?? '',
      requireSeniorPmReview: !!starter.requireSeniorPmReview,
      sections: cloneSections(starter.sections ?? []),
      basedOn: starter.id,
    });
  };

  const handleStarterChange = (starterId: string | null) => {
    // If user has made edits, ask before overwriting.
    if (isDirty()) {
      setPendingStarter({ starterId, firstTime: false });
      return;
    }
    applyStarter(starterId);
  };

  const confirmStarterSwap = () => {
    if (!pendingStarter) return;
    applyStarter(pendingStarter.starterId);
    setPendingStarter(null);
  };

  const patchSection = (id: string, patch: Partial<TemplateSection>) => {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const addSection = () => {
    if (!canEdit) return;
    const baseName = 'New section';
    let name = baseName;
    let suffix = 2;
    while (form.sections.some((s) => s.name === name)) {
      name = `${baseName} ${suffix++}`;
    }
    const id = makeSectionId(name) + '-' + Math.random().toString(36).slice(2, 6);
    const next: TemplateSection = {
      id,
      order: form.sections.length + 1,
      name,
      guidance: '',
      mandatory: false,
      statutory: false,
      aiDraftAllowed: true,
      complianceCheck: false,
      citedRegulations: [],
      routingRules: '',
      requiredAttachments: [],
    };
    setForm((f) => ({ ...f, sections: [...f.sections, next] }));
    setSelectedId(id);
  };

  const removeSection = (id: string) => {
    if (!canEdit) return;
    const s = form.sections.find((x) => x.id === id);
    if (!s) return;
    if (s.statutory && !isSuperAdmin) {
      toast.error('Statutory section — only a super admin can remove it.');
      return;
    }
    if (s.locked) {
      toast.error('Section is locked — unlock it first (right pane).');
      return;
    }
    const next = form.sections
      .filter((x) => x.id !== id)
      .map((x, i) => ({ ...x, order: i + 1 }));
    setForm((f) => ({ ...f, sections: next }));
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    if (!canEdit) return;
    const idx = form.sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= form.sections.length) return;
    const next = [...form.sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    setForm((f) => ({ ...f, sections: next.map((s, i) => ({ ...s, order: i + 1 })) }));
  };

  const validateForSave = (): string | null => {
    if (!form.title.trim()) return 'Title is required.';
    if (form.sections.length === 0) return 'At least one section is required.';
    for (const s of form.sections) {
      if (!s.name.trim()) return `Every section needs a name (section ${s.order}).`;
    }
    return null;
  };

  const buildPatch = () => ({
    title: form.title.trim(),
    code: form.code.trim().toUpperCase() || '',
    description: form.description.trim(),
    category: form.category,
    defaultRoute: form.defaultRoute.trim(),
    requireSeniorPmReview: form.requireSeniorPmReview,
    sections: form.sections.map((s, i) => ({ ...s, order: i + 1 })),
    ...(isCreating && form.basedOn ? { originStarterId: form.basedOn } : {}),
  });

  const save = async (mode: 'create' | 'draft' | 'publish') => {
    if (!canEdit) return;
    const err = validateForSave();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(mode);
    try {
      const templateId = isCreating ? makeId(form.title) : template!.id;
      const upsert = await api.governanceUpsertTemplate(templateId, buildPatch());
      let latest = upsert.template as ReportTemplate;
      if (mode === 'publish') {
        await api.governancePublishTemplate(templateId);
        const fresh = await api.governanceGetTemplate(templateId);
        latest = fresh.template as ReportTemplate;
      }
      onSaved(latest);
      // Update ref to the saved state so isDirty resets
      initialStateRef.current = templateToFormState(latest);
      if (mode === 'publish') {
        toast.success('Template published');
        onClose();
      } else if (mode === 'create') {
        toast.success('Template created — keep editing or publish when ready');
        // Keep modal open; parent reloads template via onSaved so we
        // transition naturally from create-mode to edit-mode next render.
      } else {
        toast.success('Draft saved');
      }
    } catch (e: any) {
      console.error('[TemplateEditorModal] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(null);
    }
  };

  const duplicate = () => {
    if (!canEdit || !template) return;
    setDuplicateDialogOpen(true);
  };

  const confirmDuplicate = async (newId: string) => {
    if (!template) return;
    setDuplicating(true);
    try {
      const res = await api.governanceDuplicateTemplate(template.id, newId);
      toast.success('Template duplicated — opening the copy for editing.');
      setDuplicateDialogOpen(false);
      onDuplicated(res.template as ReportTemplate);
    } catch (e: any) {
      console.error('[TemplateEditorModal] duplicate failed', e);
      toast.error(e?.message ?? 'Duplicate failed.');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-3">
            <span
              className={clsx(
                'font-mono mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                categoryStyle.badge,
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', categoryStyle.dot)} />
              {CATEGORY_LABEL[form.category]}
            </span>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {isCreating
                  ? 'New report template'
                  : `${CATEGORY_LABEL[template!.category]} template · v${template!.version} · ${template!.status}`}
              </p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {form.title || (isCreating ? 'Untitled template' : 'Template')}
              </h2>
              {!isCreating && originStarter && (
                <p className="mt-0.5 text-[11px] italic text-slate-500">
                  Based on: {originStarter.title}
                </p>
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

        {/* Top metadata strip */}
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 md:grid-cols-3">
          {isCreating && (
            <MetaField label="Start from" full>
              <select
                value={form.basedOn ?? ''}
                onChange={(e) => handleStarterChange(e.target.value || null)}
                disabled={!canEdit}
                className={inputCls}
              >
                <option value="">Blank template</option>
                {starterOptions.length > 0 && (
                  <optgroup label="Available starters">
                    {starterOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · {CATEGORY_LABEL[t.category]}
                        {(t as any).seeded ? ' · approved' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </MetaField>
          )}
          <MetaField label="Title">
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              disabled={!canEdit}
              placeholder={isCreating ? 'Annual Sustainability Report' : ''}
              className={inputCls}
            />
          </MetaField>
          <MetaField label="Code (optional)">
            <input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              disabled={!canEdit}
              placeholder="e.g. GW1, KM4, LHA-1"
              maxLength={40}
              className={inputCls}
            />
          </MetaField>
          <MetaField label="Category">
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as TemplateCategory)}
              disabled={!canEdit}
              className={inputCls}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </MetaField>
          <MetaField label="Default decision route">
            <input
              value={form.defaultRoute}
              onChange={(e) => set('defaultRoute', e.target.value)}
              placeholder="DPB → DCRB → Cabinet"
              disabled={!canEdit}
              className={inputCls}
            />
          </MetaField>
          <MetaField label="Senior PM review">
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.requireSeniorPmReview}
                onChange={(e) => set('requireSeniorPmReview', e.target.checked)}
                disabled={!canEdit}
                className="h-4 w-4 accent-indigo-600"
              />
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              Required before PgM review
            </label>
          </MetaField>
          <MetaField label="Description" full>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              disabled={!canEdit}
              rows={2}
              placeholder="One or two sentences on when this template should be used."
              className={clsx(inputCls, 'resize-none')}
            />
          </MetaField>
        </div>

        {/* Two-pane body */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Left pane — section list */}
          <aside className="flex w-full shrink-0 flex-col border-b border-slate-100 md:w-72 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Sections ({form.sections.length})
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              )}
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
              {form.sections.map((s, idx) => {
                const isSelected = s.id === selectedId;
                const isLocked = !!s.locked || s.statutory;
                const canDelete =
                  canEdit && !s.locked && (!s.statutory || isSuperAdmin);
                return (
                  <li key={s.id}>
                    <div
                      className={clsx(
                        'flex items-center gap-2 rounded-lg px-2 py-2 transition-colors',
                        isSelected
                          ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200'
                          : 'hover:bg-slate-50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-[11px] font-semibold text-slate-400">
                          {idx + 1}.
                        </span>
                        <span
                          className={clsx(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            s.mandatory ? 'bg-rose-500' : 'bg-slate-300',
                          )}
                          title={s.mandatory ? 'Mandatory' : 'Optional'}
                        />
                        <span
                          className={clsx(
                            'truncate text-xs',
                            isSelected ? 'font-bold text-slate-900' : 'text-slate-700',
                          )}
                        >
                          {s.name || 'Untitled'}
                        </span>
                        {isLocked && (
                          <Lock
                            className={clsx(
                              'h-3 w-3 shrink-0',
                              s.statutory ? 'text-slate-400' : 'text-indigo-500',
                            )}
                            aria-label={
                              s.statutory
                                ? 'Statutory — protected by law'
                                : 'Locked by PgM'
                            }
                          />
                        )}
                        {s.aiDraftAllowed && !s.statutory && (
                          <Lightbulb className="h-3 w-3 shrink-0 text-indigo-400" />
                        )}
                      </button>
                      {canEdit && (
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => moveSection(s.id, -1)}
                            disabled={idx === 0}
                            aria-label="Move up"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(s.id, 1)}
                            disabled={idx === form.sections.length - 1}
                            aria-label="Move down"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSection(s.id)}
                            disabled={!canDelete}
                            aria-label={
                              s.locked
                                ? 'Locked — unlock first'
                                : s.statutory && !isSuperAdmin
                                ? 'Statutory — only super admin can remove'
                                : 'Remove'
                            }
                            title={
                              s.locked
                                ? 'Locked — unlock first (right pane)'
                                : s.statutory && !isSuperAdmin
                                ? 'Statutory — only super admin can remove'
                                : 'Remove'
                            }
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Right pane — section detail */}
          <section className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <SectionDetail
                section={selected}
                canEdit={canEdit}
                isSuperAdmin={isSuperAdmin}
                onPatch={(patch) => patchSection(selected.id, patch)}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Add or select a section on the left to edit its detail.
              </p>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            {canEdit && !isCreating && (
              <button
                type="button"
                onClick={duplicate}
                disabled={duplicating || saving !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {duplicating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Duplicate
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
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
                Create template
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
                  Publish new version
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        message="You have edits that haven't been saved. Closing the editor will discard them."
        confirmLabel="Discard changes"
        variant="danger"
        onConfirm={confirmDiscardClose}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
      <ConfirmDialog
        open={pendingStarter !== null}
        title="Replace your current edits?"
        message={
          pendingStarter?.starterId
            ? 'Switching to a different starter will replace the sections you have on screen.'
            : 'Switching to Blank will replace the sections you have on screen.'
        }
        confirmLabel="Replace"
        variant="warning"
        onConfirm={confirmStarterSwap}
        onCancel={() => setPendingStarter(null)}
      />
      <TextInputDialog
        open={duplicateDialogOpen}
        title="Duplicate template"
        message="Pick a new ID for the copy. Letters, digits, underscores and hyphens only."
        inputLabel="New template ID"
        placeholder="e.g. gw1-housing-variant"
        defaultValue={template ? `${template.id}-copy` : ''}
        validate={(v) =>
          /^[a-z0-9_-]{2,80}$/i.test(v)
            ? null
            : 'Use 2–80 letters, digits, underscores or hyphens.'
        }
        confirmLabel="Duplicate"
        loading={duplicating}
        onConfirm={confirmDuplicate}
        onCancel={() => (duplicating ? null : setDuplicateDialogOpen(false))}
      />
    </div>
  );
}

interface SectionDetailProps {
  section: TemplateSection;
  canEdit: boolean;
  isSuperAdmin?: boolean;
  onPatch: (patch: Partial<TemplateSection>) => void;
}

function SectionDetail({
  section,
  canEdit,
  isSuperAdmin = false,
  onPatch,
}: SectionDetailProps) {
  return (
    <div className="space-y-5">
      {section.statutory && !isSuperAdmin && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Statutory section.</strong> Protected by UK Cabinet-paper rules —
            only a super admin can flip the statutory flag. You can still edit guidance,
            mandatory, compliance check and cited regulations.
          </span>
        </div>
      )}
      {section.locked && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-800">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Locked by PgM.</strong> Authors can't delete this section. Turn the
            lock off below to allow removal.
          </span>
        </div>
      )}
      <MetaField label="Section name">
        <input
          value={section.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          disabled={!canEdit}
          className={inputCls}
        />
      </MetaField>
      <MetaField label="Author guidance">
        <textarea
          value={section.guidance}
          onChange={(e) => onPatch({ guidance: e.target.value })}
          disabled={!canEdit}
          rows={4}
          placeholder="What should the author write here? Include any context they need."
          className={clsx(inputCls, 'resize-none')}
        />
      </MetaField>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Toggle
          label="Mandatory"
          description="Author must complete before submitting."
          checked={section.mandatory}
          onChange={(v) => onPatch({ mandatory: v })}
          disabled={!canEdit || section.statutory}
        />
        <Toggle
          label="AI drafting allowed"
          description="Show the 'Draft with AI' pill on this section."
          checked={section.aiDraftAllowed}
          onChange={(v) => onPatch({ aiDraftAllowed: v })}
          disabled={!canEdit || section.statutory}
          disabledReason={
            section.statutory
              ? 'Part A / Part B sign-off sections cannot be AI-drafted.'
              : undefined
          }
        />
        <Toggle
          label="Real-time compliance check"
          description="Surface to the right-hand compliance panel."
          checked={section.complianceCheck}
          onChange={(v) => onPatch({ complianceCheck: v })}
          disabled={!canEdit}
        />
      </div>

      <MetaField label="Cited regulations (comma-separated)">
        <input
          value={(section.citedRegulations ?? []).join(', ')}
          onChange={(e) =>
            onPatch({
              citedRegulations: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          disabled={!canEdit}
          placeholder="Local Government Act 2000, BSA 2022 s.31"
          className={inputCls}
        />
      </MetaField>

      <MetaField label="Routing rules">
        <input
          value={section.routingRules ?? ''}
          onChange={(e) => onPatch({ routingRules: e.target.value })}
          disabled={!canEdit}
          placeholder="e.g. S151 concurrent comment required before publish."
          className={inputCls}
        />
      </MetaField>

      <MetaField label="Required attachments (comma-separated)">
        <input
          value={(section.requiredAttachments ?? []).join(', ')}
          onChange={(e) =>
            onPatch({
              requiredAttachments: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          disabled={!canEdit}
          placeholder="ENIA, Procurement Strategy"
          className={inputCls}
        />
      </MetaField>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Access controls
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Toggle
            label="Lock for authors"
            description="Prevents authors from deleting this section. PgM can unlock any time."
            checked={!!section.locked}
            onChange={(v) => onPatch({ locked: v })}
            disabled={!canEdit}
          />
          <Toggle
            label="Statutory"
            description={
              isSuperAdmin
                ? 'Marks this as a UK Cabinet-paper statutory requirement. PgMs cannot flip this once set.'
                : 'Super-admin only — reflects UK statutory requirements.'
            }
            checked={!!section.statutory}
            onChange={(v) => onPatch({ statutory: v })}
            disabled={!canEdit || !isSuperAdmin}
            disabledReason={
              !isSuperAdmin
                ? 'Only a super admin can flip the statutory flag.'
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

function MetaField({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={clsx(
        'font-mono block text-[11px] font-semibold uppercase tracking-wide text-slate-500',
        full && 'md:col-span-3',
      )}
    >
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  disabledReason,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white p-3',
        disabled && 'opacity-70',
      )}
    >
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 disabled:cursor-not-allowed"
        />
        <span>
          <span className="font-semibold text-slate-900">{label}</span>
          <br />
          <span className="text-slate-500">{description}</span>
          {disabled && disabledReason && (
            <span className="mt-1 flex items-start gap-1 text-[10px] font-semibold text-amber-700">
              <Info className="mt-0.5 h-3 w-3" />
              {disabledReason}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Save,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CalendarDays,
  FileText,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import ConfirmDialog from '../../table/ConfirmDialog';
import {
  type Classification,
  type Report,
  CLASSIFICATION_OPTIONS,
  STATUS_STYLES,
} from './types';
import { TemplatePickerModal } from './TemplatePickerModal';
import { FpItemPickerModal } from './FpItemPickerModal';
import { MeetingPicker } from '../MeetingPicker';
import { ReviewerPickerModal } from './ReviewerPickerModal';
import { UserCheck } from 'lucide-react';

// 6a is intentionally minimal — production users CRUD a report's metadata
// here; the actual section-by-section authoring (Tiptap editor) lands in
// 6b. Hence no template picker yet (free-text label OK), no FP-item picker
// (free-text label OK). Both swap to real pickers in later sub-phases.

interface FormState {
  title: string;
  scheme: string;
  templateId: string;
  templateLabel: string;
  forwardPlanItemId: string;
  forwardPlanItemLabel: string;
  partClassification: Classification;
  isHRB: boolean;
  targetBoardDate: string;
  targetMeetingId: string | null; // Phase 5.5b
  reviewerUid: string;
  reviewerLabel: string;
}

function emptyState(): FormState {
  return {
    title: '',
    scheme: '',
    templateId: '',
    templateLabel: '',
    forwardPlanItemId: '',
    forwardPlanItemLabel: '',
    partClassification: 'Open',
    isHRB: false,
    targetBoardDate: '',
    targetMeetingId: null,
    reviewerUid: '',
    reviewerLabel: '',
  };
}

function makeReportId(title: string): string {
  const slug = (title || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const suffix = (Date.now() % 1_000_000).toString(36);
  return `${slug || 'report'}-${suffix}`;
}

interface Props {
  isOpen: boolean;
  /** null = create mode; existing report = edit mode. */
  report: Report | null;
  /** Existing IDs for client-side uniqueness check on create. */
  existingIds: string[];
  /** Caller's role check — disables Save when false. */
  canEdit: boolean;
  onClose: () => void;
  onSaved: (report: Report) => void;
}

export function ReportModal({
  isOpen,
  report,
  existingIds,
  canEdit,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [fpPickerOpen, setFpPickerOpen] = useState(false);
  const [reviewerPickerOpen, setReviewerPickerOpen] = useState(false);
  const initialFormRef = useRef<FormState>(emptyState());

  // ALL hooks declared BEFORE any early return (rules of hooks — lesson #40).
  const isEdit = report != null;
  const status = report?.status ?? 'Draft';
  const statusStyle = STATUS_STYLES[status];
  const isLocked = isEdit && status !== 'Draft';

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  }, [form]);

  useEffect(() => {
    if (!isOpen) return;
    if (report) {
      const next: FormState = {
        title: report.title ?? '',
        scheme: report.scheme ?? '',
        templateId: report.templateId ?? '',
        templateLabel: report.templateLabel ?? '',
        forwardPlanItemId: report.forwardPlanItemId ?? '',
        forwardPlanItemLabel: report.forwardPlanItemLabel ?? '',
        partClassification: report.partClassification ?? 'Open',
        isHRB: !!report.isHRB,
        targetBoardDate: report.targetBoardDate ?? '',
        targetMeetingId: report.targetMeetingId ?? null,
        reviewerUid: report.reviewerUid ?? '',
        reviewerLabel: report.reviewerLabel ?? '',
      };
      setForm(next);
      initialFormRef.current = next;
    } else {
      const blank = emptyState();
      setForm(blank);
      initialFormRef.current = blank;
    }
  }, [isOpen, report]);

  if (!isOpen) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const close = () => {
    if (saving) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const save = async () => {
    if (!canEdit) {
      toast.error('Only the report owner or a Client Admin can save.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    setSaving(true);
    try {
      let reportId = report?.id;
      if (!reportId) {
        // Auto-generate; collision-protect using existingIds (lesson #30).
        let attempt = makeReportId(form.title);
        let guard = 0;
        while (existingIds.includes(attempt) && guard < 12) {
          attempt = makeReportId(form.title);
          guard += 1;
        }
        reportId = attempt;
      }
      const patch: Record<string, any> = {
        title: form.title.trim(),
        scheme: form.scheme.trim(),
        templateId: form.templateId || null,
        templateLabel: form.templateLabel.trim(),
        forwardPlanItemId: form.forwardPlanItemId || null,
        forwardPlanItemLabel: form.forwardPlanItemLabel.trim(),
        partClassification: form.partClassification,
        isHRB: form.isHRB,
        targetBoardDate: form.targetBoardDate || null,
        targetMeetingId: form.targetMeetingId || null,
        reviewerUid: form.reviewerUid || null,
        reviewerLabel: form.reviewerLabel.trim() || null,
      };
      const res = await api.governanceUpsertReport(reportId, patch);
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      toast.success(isEdit ? 'Report updated' : 'Report created');
      onSaved(res.item as Report);
      // Reset dirty tracker so the next save / close compares fresh.
      initialFormRef.current = form;
    } catch (e: any) {
      console.error('[ReportModal] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.15 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {isEdit ? 'Edit report' : 'New report'}
                  </h2>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        statusStyle.cls,
                      )}
                    >
                      <span className={clsx('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
                      {statusStyle.label}
                    </span>
                    {isEdit && (
                      <span className="text-[10px] text-slate-500">
                        · {report?.id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isLocked && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    This report has moved beyond Draft. Editing in non-Draft
                    states ships in a later sub-phase. Read-only here for now.
                  </span>
                </div>
              )}

              <Section title="Identity">
                <Field label="Title *">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    disabled={isLocked || !canEdit}
                    placeholder="e.g. Aspen Court refurbishment — GW2 contract award"
                    className={inputCls}
                  />
                </Field>
                <Field label="Scheme">
                  <input
                    type="text"
                    value={form.scheme}
                    onChange={(e) => set('scheme', e.target.value)}
                    disabled={isLocked || !canEdit}
                    placeholder="Programme / scheme this report belongs to"
                    className={inputCls}
                  />
                </Field>
              </Section>

              <Section title="Linkage">
                <Field
                  label="Template"
                  hint="Sections from this template will be instantiated when you open the editor."
                >
                  <PickerTrigger
                    icon={FileText}
                    placeholder="Choose a template…"
                    // Only render label as "selected" when a real templateId
                    // exists; seed reports carry a free-text label without
                    // an id and shouldn't look like a real selection.
                    selectedLabel={form.templateId ? form.templateLabel : ''}
                    onClick={() => setTemplatePickerOpen(true)}
                    disabled={isLocked || !canEdit}
                  />
                  {!form.templateId && form.templateLabel && (
                    <UnlinkedLabelHint label={form.templateLabel} kind="template" />
                  )}
                </Field>
                <Field
                  label="Forward Plan item"
                  hint="The report inherits the FP entry's decision pipeline."
                >
                  <PickerTrigger
                    icon={CalendarIcon}
                    placeholder="Choose a Forward Plan item…"
                    selectedLabel={
                      form.forwardPlanItemId ? form.forwardPlanItemLabel : ''
                    }
                    onClick={() => setFpPickerOpen(true)}
                    disabled={isLocked || !canEdit}
                  />
                  {!form.forwardPlanItemId && form.forwardPlanItemLabel && (
                    <UnlinkedLabelHint
                      label={form.forwardPlanItemLabel}
                      kind="Forward Plan item"
                    />
                  )}
                </Field>
              </Section>

              <Section title="Classification">
                <Field label="Part 1 / Part 2">
                  <select
                    value={form.partClassification}
                    onChange={(e) =>
                      set('partClassification', e.target.value as Classification)
                    }
                    disabled={isLocked || !canEdit}
                    className={inputCls}
                  >
                    {CLASSIFICATION_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="HRB project">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.isHRB}
                      onChange={(e) => set('isHRB', e.target.checked)}
                      disabled={isLocked || !canEdit}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                    <span>
                      Building Safety Act HRB — triggers Building Safety Board
                      route + Golden Thread on approval
                    </span>
                  </label>
                </Field>
              </Section>

              <Section title="Routing">
                <Field
                  label="Board meeting"
                  hint="Pick a board, then a date from your PgM's year-ahead schedule. The PgM is notified to confirm."
                >
                  <MeetingPicker
                    value={form.targetMeetingId}
                    onChange={(id) => set('targetMeetingId', id)}
                    disabled={isLocked || !canEdit}
                  />
                </Field>
                {/* Legacy `targetBoardDate` kept for back-compat; only
                    surfaces when there's a value AND no meeting picked
                    (e.g. pre-5.5b reports). New reports use the picker. */}
                {form.targetBoardDate && !form.targetMeetingId && (
                  <Field label="Legacy target board date">
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={form.targetBoardDate}
                        onChange={(e) => set('targetBoardDate', e.target.value)}
                        disabled={isLocked || !canEdit}
                        className={clsx(inputCls, 'pl-9')}
                      />
                    </div>
                  </Field>
                )}
                <Field
                  label="Reviewer"
                  hint="The Programme Manager (or Senior PM / Strategic Director) who'll review this report once submitted."
                >
                  <PickerTrigger
                    icon={UserCheck}
                    placeholder="Pick a reviewer…"
                    selectedLabel={form.reviewerUid ? form.reviewerLabel : ''}
                    onClick={() => setReviewerPickerOpen(true)}
                    disabled={isLocked || !canEdit}
                  />
                  {!form.reviewerUid && form.reviewerLabel && (
                    <UnlinkedLabelHint
                      label={form.reviewerLabel}
                      kind="reviewer"
                    />
                  )}
                </Field>
              </Section>
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || isLocked || !canEdit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {isEdit ? 'Save changes' : 'Create report'}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={discardOpen}
        title="Discard your changes?"
        message="Your edits to this report haven't been saved yet."
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      <TemplatePickerModal
        isOpen={templatePickerOpen}
        selectedId={form.templateId || null}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(t) => {
          const label = t.code ? `${t.code} · ${t.title}` : t.title;
          setForm((f) => ({ ...f, templateId: t.id, templateLabel: label }));
          setTemplatePickerOpen(false);
        }}
      />

      <FpItemPickerModal
        isOpen={fpPickerOpen}
        selectedId={form.forwardPlanItemId || null}
        onClose={() => setFpPickerOpen(false)}
        onSelect={(it) => {
          setForm((f) => ({
            ...f,
            forwardPlanItemId: it.id,
            forwardPlanItemLabel: it.title,
            // Auto-mirror HRB flag from the FP item — saves PMs from re-toggling.
            isHRB: f.isHRB || !!it.isHRB,
            // Default the target board date to the FP entry's decision date if blank.
            targetBoardDate: f.targetBoardDate || it.targetDecisionDate || '',
          }));
          setFpPickerOpen(false);
        }}
      />

      <ReviewerPickerModal
        isOpen={reviewerPickerOpen}
        selectedUid={form.reviewerUid || null}
        onClose={() => setReviewerPickerOpen(false)}
        onSelect={(u) => {
          const display = u.name || u.email || u.uid;
          setForm((f) => ({
            ...f,
            reviewerUid: u.uid,
            reviewerLabel: display,
          }));
          setReviewerPickerOpen(false);
        }}
        onClear={() => {
          setForm((f) => ({ ...f, reviewerUid: '', reviewerLabel: '' }));
          setReviewerPickerOpen(false);
        }}
      />
    </>
  );
}

const inputCls =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10px] italic text-slate-400">{hint}</span>}
    </label>
  );
}

// Inline hint shown beneath a picker when there's a stale text label but
// no real linked id. Common on seeded data — labels look "selected" but
// no template/FP doc was actually attached.
function UnlinkedLabelHint({
  label,
  kind,
}: {
  label: string;
  kind: 'template' | 'Forward Plan item' | 'reviewer';
}) {
  let trailing = 'Pick one above to link it.';
  if (kind === 'template')
    trailing = 'Pick one above to populate sections in the editor.';
  else if (kind === 'Forward Plan item')
    trailing = 'Pick one above to inherit the FP decision pipeline.';
  else if (kind === 'reviewer')
    trailing = 'Pick one above so notifications + state actions resolve correctly.';
  return (
    <p className="mt-1 flex items-start gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        Currently labelled <span className="font-semibold">"{label}"</span> but
        not linked to a real {kind}. {trailing}
      </span>
    </p>
  );
}

// Picker trigger — looks like an input but opens a modal on click. Used
// for template + FP-item linkage. Selected label rendered inline; chevron
// hints at "click for more options".
function PickerTrigger({
  icon: Icon,
  placeholder,
  selectedLabel,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  selectedLabel: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const hasSelection = selectedLabel.length > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
        hasSelection ? 'text-slate-900' : 'text-slate-400',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className={clsx('truncate', hasSelection ? 'font-semibold' : 'font-normal')}>
          {hasSelection ? selectedLabel : placeholder}
        </span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </button>
  );
}

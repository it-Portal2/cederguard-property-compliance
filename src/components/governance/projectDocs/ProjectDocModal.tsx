// Project Governance Doc create/edit modal.
//
// Single modal handling create + edit. Reuses the shared
// GovernanceEditor for the body content, with auto-save wired
// to governanceUpsertProjectDoc on every change.
//
// Read-only surfaces:
//   • Published docs render with the editor in read-only mode + a
//     "Publish new version" hint banner (out of v9 scope to fork; user
//     soft-deletes + recreates for now).
//   • Soft-deleted docs render read-only with a slate banner.
//
// Linked Report / Meeting are simple ID inputs in v9 — switch to real
// pickers when the existing FpItemPickerModal pattern is generalised.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, History, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import ConfirmDialog from '../../table/ConfirmDialog';
import { GovernanceEditor } from '../editor/GovernanceEditor';
import {
  type ProjectDoc,
  type ProjectDocCategory,
  type ProjectDocVersion,
  CATEGORY_OPTIONS,
  STATUS_STYLES,
  makeProjectDocId,
} from './types';

interface FormState {
  title: string;
  category: ProjectDocCategory;
  summary: string;
  linkedReportId: string;
  linkedMeetingId: string;
}

interface ProjectDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: ProjectDoc | null; // null → create
  projectId: string;
  canEdit: boolean;
  onSaved: (doc: ProjectDoc) => void;
}

const DEFAULT_FORM: FormState = {
  title: '',
  category: 'Other',
  summary: '',
  linkedReportId: '',
  linkedMeetingId: '',
};

export function ProjectDocModal({
  isOpen,
  onClose,
  doc,
  projectId,
  canEdit,
  onSaved,
}: ProjectDocModalProps) {
  const isCreate = !doc;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const initialFormRef = useRef<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<ProjectDocVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [docState, setDocState] = useState<ProjectDoc | null>(doc);
  const [publishBusy, setPublishBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  // Memoise initial editor content so the editor doesn't remount on every
  // unrelated state change.
  const initialContent = useMemo(() => doc?.content ?? null, [doc?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const next: FormState = doc
      ? {
          title: doc.title ?? '',
          category: doc.category ?? 'Other',
          summary: doc.summary ?? '',
          linkedReportId: doc.linkedReportId ?? '',
          linkedMeetingId: doc.linkedMeetingId ?? '',
        }
      : DEFAULT_FORM;
    setForm(next);
    initialFormRef.current = next;
    setDocState(doc);
    setShowHistory(false);
    setVersions([]);
  }, [isOpen, doc]);

  if (!isOpen) return null;

  const status = docState?.status ?? 'Draft';
  const isReadOnly = !canEdit || status === 'Published' || !!docState?.softDeleted;
  const isDirty = (() => {
    const a = initialFormRef.current;
    return (
      a.title !== form.title ||
      a.category !== form.category ||
      a.summary !== form.summary ||
      a.linkedReportId !== form.linkedReportId ||
      a.linkedMeetingId !== form.linkedMeetingId
    );
  })();

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const requestClose = () => {
    if (busy) return;
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  const persistMeta = async (overrideContent?: any): Promise<ProjectDoc | null> => {
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return null;
    }
    const id = docState?.id ?? makeProjectDocId(form.title);
    const patch: Record<string, any> = {
      title: form.title.trim(),
      category: form.category,
      summary: form.summary,
      projectId,
      linkedReportId: form.linkedReportId.trim() || null,
      linkedMeetingId: form.linkedMeetingId.trim() || null,
    };
    if (overrideContent !== undefined) patch.content = overrideContent;
    const res = await api.governanceUpsertProjectDoc(id, patch);
    if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
    const next = res.item as ProjectDoc;
    setDocState(next);
    initialFormRef.current = { ...form };
    onSaved(next);
    return next;
  };

  const handleSaveDetails = async () => {
    if (busy || isReadOnly) return;
    setBusy(true);
    try {
      const next = await persistMeta();
      if (next) toast.success(isCreate ? 'Doc created.' : 'Saved.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAutoSaveContent = async (json: any) => {
    // Auto-save fires on every Tiptap change (debounced inside the editor).
    // For a fresh create, persist metadata first so we have a docId to
    // attach the content to.
    try {
      await persistMeta(json);
    } catch (e: any) {
      // Swallow into a toast — the editor's status badge surfaces failure
      // to the user. Don't block typing on transient errors.
      toast.error(e?.message ?? 'Auto-save failed.');
      throw e;
    }
  };

  const handlePublish = async () => {
    if (publishBusy || !docState) return;
    setPublishBusy(true);
    try {
      const res = await api.governancePublishProjectDoc(docState.id);
      if (!res?.success) throw new Error(res?.error ?? 'Publish failed.');
      const next = res.item as ProjectDoc;
      setDocState(next);
      onSaved(next);
      toast.success(`Published v${next.version}.`);
      setConfirmPublish(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Publish failed.');
    } finally {
      setPublishBusy(false);
    }
  };

  const handleToggleHistory = async () => {
    if (!docState) return;
    const next = !showHistory;
    setShowHistory(next);
    if (next && versions.length === 0) {
      setVersionsLoading(true);
      try {
        const res = await api.governanceListProjectDocVersions(docState.id);
        if (res?.success) setVersions((res.versions ?? []) as ProjectDocVersion[]);
      } catch {
        toast.error('Could not load history.');
      } finally {
        setVersionsLoading(false);
      }
    }
  };

  const styles = STATUS_STYLES[status];

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && requestClose()}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.15 }}
          className="relative flex h-[min(92vh,840px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-slate-200"
        >
          {/* Header*/}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {isCreate ? 'New project governance doc' : docState?.title ?? form.title}
                </h2>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                      styles.pill,
                    )}
                  >
                    {styles.label}
                  </span>
                  {docState && docState.version > 0 && (
                    <span>v{docState.version}</span>
                  )}
                  {docState?.softDeleted && (
                    <span className="text-rose-600">Soft-deleted</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isCreate && (
                <button
                  type="button"
                  onClick={handleToggleHistory}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Body*/}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-1 min-w-0 flex-col overflow-y-auto">
              {/* Banners*/}
              {status === 'Published' && (
                <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-xs text-emerald-800">
                  This is the Published v{docState?.version}. The body is read-only — soft-delete and create a new doc to publish a successor.
                </div>
              )}
              {docState?.softDeleted && (
                <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-800">
                  This document is soft-deleted. Restore it from the list to edit again.
                </div>
              )}

              {/* Metadata form*/}
              <div className="grid gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-2">
                <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  Title
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. Aspen Court · Decision log v1"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => update('category', e.target.value as ProjectDocCategory)}
                    disabled={isReadOnly}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  Summary
                  <input
                    type="text"
                    value={form.summary}
                    onChange={(e) => update('summary', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="One-line description"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  Linked report ID (optional)
                  <input
                    type="text"
                    value={form.linkedReportId}
                    onChange={(e) => update('linkedReportId', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. rpt-aspen-km4"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  Linked meeting ID (optional)
                  <input
                    type="text"
                    value={form.linkedMeetingId}
                    onChange={(e) => update('linkedMeetingId', e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. mtg-dpb-2026-05"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  />
                </label>
              </div>

              {/* Editor*/}
              <div className="flex-1 px-5 py-4">
                {isCreate && !docState ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                    Save the doc details first — the editor opens once the doc exists.
                  </div>
                ) : (
                  <GovernanceEditor
                    initialContent={initialContent}
                    editable={!isReadOnly}
                    placeholder="Capture decisions, attendance notes, references…"
                    onAutoSave={handleAutoSaveContent}
                    aiContext={[form.title || docState?.title, form.category]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )}
              </div>
            </div>

            {/* History panel*/}
            {showHistory && (
              <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-slate-50 md:flex md:flex-col">
                <div className="font-mono border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Version history
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {versionsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No published versions yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {versions.map((v) => (
                        <li
                          key={v.version}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                            <span>v{v.version}</span>
                            <span className="text-[11px] font-normal text-slate-500">
                              {new Date(v.publishedAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                            {v.summary || v.title}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Footer*/}
          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Close
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={busy || !form.title.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isCreate ? 'Create doc' : 'Save details'}
              </button>
            )}
            {!isCreate &&
              canEdit &&
              status === 'Draft' &&
              !docState?.softDeleted && (
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={publishBusy || isDirty}
                  title={isDirty ? 'Save details before publishing.' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Publish v{(docState?.version ?? 0) + 1}
                </button>
              )}
          </footer>
        </motion.div>
      </motion.div>

      <ConfirmDialog
        open={confirmClose}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        title="Discard unsaved changes?"
        message="Closing now will lose details edits since the last save."
        confirmLabel="Discard"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmPublish}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={handlePublish}
        title="Publish this version?"
        message={`This snapshots the current draft as v${(docState?.version ?? 0) + 1}. Published versions are read-only — soft-delete and create a new doc to publish a successor.`}
        confirmLabel="Publish"
        variant="success"
        loading={publishBusy}
      />
    </AnimatePresence>
  );
}

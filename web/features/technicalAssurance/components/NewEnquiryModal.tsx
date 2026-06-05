import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, FilePlus2 } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../components/table/ConfirmDialog";
import { AttachmentDropzone } from "./AttachmentDropzone";
import { api } from "../../../lib/api";
import { useStore } from "../../../store/useStore";
import { RIBA_STAGES } from "../../../constants/ribaStages";
import { saveDraft, loadDraft, clearDraft } from "./utils/draftStorage";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import type { Enquiry, EnquiryAttachment } from "../../../../shared/types/technicalAssurance";

// TAC New / Edit Enquiry modal — single-modal CRUD.
//
//  only handles Draft enquiries. Once an enquiry transitions out of
// Draft (Generating / Open / etc.), this modal closes and routing redirects
// to the workspace page (Phases 3-7). All hooks are declared above the
// `if (!isOpen) return null` early return.

interface NewEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry | null;
  onSaved: (item: Enquiry) => void;
}

interface FormState {
  title: string;
  query: string;
  ribaStage: string;
  projectId: string;
}

function emptyState(initialProjectId: string): FormState {
  return {
    title: "",
    query: "",
    ribaStage: "",
    projectId: initialProjectId,
  };
}

function enquiryToForm(e: Enquiry): FormState {
  return {
    title: e.title ?? "",
    query: e.query ?? "",
    ribaStage: (e.ribaStage as string) ?? "",
    projectId: e.projectId ?? "",
  };
}

// File → base64 (data-uri prefix stripped server-side via decodeBase64TacFile).
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected reader result."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export function NewEnquiryModal({
  isOpen,
  onClose,
  enquiry,
  onSaved,
}: NewEnquiryModalProps) {
  const user = useStore((s) => s.user);
  const activeProject = useStore((s) => s.activeProject);
  const projects = useStore((s) => s.projects);
  const initialProjectId = useMemo(() => {
    if (enquiry?.projectId) return enquiry.projectId;
    if (activeProject?.id) return activeProject.id;
    return "";
  }, [enquiry, activeProject]);

  // Focus-trap (WCAG 2.2 AA Success Criterion 2.4.3) — wraps Tab inside
  // the modal when open.
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const [form, setForm] = useState<FormState>(
    enquiry ? enquiryToForm(enquiry) : emptyState(initialProjectId),
  );
  const [attachments, setAttachments] = useState<EnquiryAttachment[]>(
    enquiry?.attachments ?? [],
  );
  // Files queued client-side that will upload on Save click. Avoids orphaning
  // storage blobs + Firestore records if the user picks the wrong file or
  // closes the modal without saving.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [enquiryId, setEnquiryId] = useState<string | null>(
    enquiry?.id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(
    null,
  );
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialRef = useRef<FormState>(form);
  const initialAttachmentsRef = useRef<EnquiryAttachment[]>(attachments);

  // Reset form when modal opens — pull localStorage draft if no server enquiry.
  useEffect(() => {
    if (!isOpen) return;
    if (enquiry) {
      const next = enquiryToForm(enquiry);
      setForm(next);
      setAttachments(enquiry.attachments ?? []);
      setPendingFiles([]);
      setEnquiryId(enquiry.id);
      initialRef.current = next;
      initialAttachmentsRef.current = enquiry.attachments ?? [];
      return;
    }
    // No server enquiry yet — see if we have a 24h localStorage draft.
    const draft = user?.uid ? loadDraft(user.uid) : null;
    const fresh: FormState = draft
      ? {
          title: draft.title,
          query: draft.query,
          ribaStage: draft.ribaStage,
          projectId: draft.projectId || initialProjectId,
        }
      : emptyState(initialProjectId);
    setForm(fresh);
    setAttachments([]);
    setPendingFiles([]);
    setEnquiryId(draft?.enquiryId ?? null);
    initialRef.current = fresh;
    initialAttachmentsRef.current = [];
  }, [isOpen, enquiry, initialProjectId, user]);

  // Persist draft on every form change (24h TTL handled inside helper).
  useEffect(() => {
    if (!isOpen || enquiry || !user?.uid) return;
    saveDraft(user.uid, {
      enquiryId,
      title: form.title,
      query: form.query,
      ribaStage: form.ribaStage,
      projectId: form.projectId,
    });
  }, [isOpen, enquiry, user, form, enquiryId]);

  // ESC key dismisses (with dirty-check).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, form, attachments]);

  const isDirty = () => {
    return (
      JSON.stringify(form) !== JSON.stringify(initialRef.current) ||
      JSON.stringify(attachments) !==
        JSON.stringify(initialAttachmentsRef.current) ||
      pendingFiles.length > 0
    );
  };

  const handleClose = () => {
    if (isDirty()) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): string | null => {
    if (!form.title.trim()) return "Title is required.";
    if (!form.projectId) {
      return "Pick a project before submitting.";
    }
    if (!form.ribaStage) {
      return "RIBA stage is required.";
    }
    return null;
  };

  // Files dropped into the dropzone are queued in-memory until the user
  // clicks Save / Create. This avoids orphaned storage blobs + Firestore
  // records when the user picks the wrong file or closes the modal.
  const handleAddFile = (file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  };

  const handleRemovePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!enquiryId) return;
    try {
      setRemovingId(attachmentId);
      await api.tacRemoveAttachment(enquiryId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      initialAttachmentsRef.current = initialAttachmentsRef.current.filter(
        (a) => a.id !== attachmentId,
      );
      toast.success("Attachment removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove attachment.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleSave = async () => {
    const validation = validate();
    if (validation) {
      toast.error(validation);
      return;
    }
    try {
      setSaving(true);

      // 1. Save metadata first (create or update). Gets us a stable enquiryId
      //    we can attach files to.
      const item = await api
        .tacUpsertEnquiry(enquiryId, {
          title: form.title.trim(),
          query: form.query,
          ribaStage: form.ribaStage,
          projectId: form.projectId,
        })
        .then((r) => r?.item as Enquiry | undefined);
      if (!item) throw new Error("No item returned from server.");
      const idForUploads = item.id;
      setEnquiryId(idForUploads);

      // 2. Upload any pending files sequentially via base64 → API → Admin SDK.
      //    Server decodes, uploads to GCS as a private object, appends
      //    metadata to the enquiry doc, returns the new attachment record.
      //    Per-file failures are surfaced individually so the user knows
      //    which one didn't make it while the rest still get committed.
      const uploaded: EnquiryAttachment[] = [];
      const failedNames: string[] = [];
      for (const file of pendingFiles) {
        setUploadingFileName(file.name);
        try {
          const fileBase64 = await fileToBase64(file);
          const res = await api.tacAttachFile({
            enquiryId: idForUploads,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileBase64,
          });
          const att = res?.attachment as EnquiryAttachment | undefined;
          if (att) uploaded.push(att);
        } catch (e: any) {
          console.error("[handleSave] upload failed for", file.name, e);
          failedNames.push(file.name);
        }
      }
      setUploadingFileName(null);

      const finalAttachments = [...attachments, ...uploaded];
      setAttachments(finalAttachments);
      setPendingFiles((prev) =>
        prev.filter((f) => failedNames.includes(f.name)),
      );
      initialAttachmentsRef.current = finalAttachments;

      const merged: Enquiry = { ...item, attachments: finalAttachments };
      if (user?.uid) clearDraft(user.uid);
      onSaved(merged);

      if (failedNames.length > 0) {
        toast.error(
          `Saved, but ${failedNames.length} file${failedNames.length === 1 ? "" : "s"} failed to upload: ${failedNames.join(", ")}`,
        );
        // Keep the modal open so the user can retry the failed uploads.
      } else {
        toast.success(enquiryId ? "Enquiry saved" : "Enquiry created");
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
      setUploadingFileName(null);
    }
  };

  const handleConfirmDiscard = () => {
    setDiscardOpen(false);
    if (user?.uid && !enquiryId) clearDraft(user.uid);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        aria-modal="true"
        role="dialog"
        aria-labelledby="tac-new-enquiry-title"
      >
        <motion.div
          key="card"
          ref={trapRef}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 220, damping: 25 }}
          className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl"
        >
          {/* Header*/}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <FilePlus2 className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Technical Assurance
                </p>
                <h2
                  id="tac-new-enquiry-title"
                  className="text-lg font-bold tracking-tight text-slate-900"
                >
                  {enquiryId ? "Edit enquiry" : "New enquiry"}
                </h2>
              </div>
            </div>
            <button
              type="button"
              className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body*/}
          <div className="space-y-5 px-6 py-5">
            <div>
              <label className="font-mono block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Bulkhead clash with MVHR duct"
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="font-mono block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.projectId}
                  onChange={(e) => set("projectId", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select project…</option>
                  {(projects ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name ?? p.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  RIBA stage <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.ribaStage}
                  onChange={(e) => set("ribaStage", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select RIBA stage…</option>
                  {RIBA_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-mono block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Query
              </label>
              <textarea
                value={form.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Describe the technical question. Include relevant context — drawings, specs, BSA Gateway stage."
                rows={5}
                maxLength={8000}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {form.query.length} / 8000 characters
              </p>
            </div>

            <div>
              <label className="font-mono mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attachments
              </label>
              <AttachmentDropzone
                attachments={attachments}
                pendingFiles={pendingFiles}
                onAddFile={handleAddFile}
                onRemovePending={handleRemovePending}
                onRemove={handleRemoveAttachment}
                uploadingFileName={uploadingFileName}
                removingId={removingId}
                disabled={saving}
              />
              <p className="mt-2 text-[11px] text-slate-400">
                Files upload when you click Save. Once uploaded, they
                virus-scan in the background — status pill updates when the
                scan completes.
              </p>
              {/* BIM connector placeholders.: no
 OAuth connectors in MVP, surface the button as a clear
 "coming soon" stub so PMs see the affordance is on the
 roadmap. Stays disabled until.*/}
              <div
                className="mt-3 flex flex-wrap gap-2"
                aria-label="External system connectors (coming soon)"
              >
                {[
                  "Pull from BIM 360",
                  "Pull from Procore",
                  "Pull from SharePoint",
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    title="Connector coming in a future release. For now, download from the source tool and drop the file into the dropzone above."
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500"
                  >
                    {label}
                    <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] text-slate-600">
                      SOON
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer*/}
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <p className="text-[11px] text-slate-400">
              Drafts persist for 24 hours on this device.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploadingFileName !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {enquiryId ? "Save changes" : "Create enquiry"}
              </button>
            </div>
          </div>
        </motion.div>

        <ConfirmDialog
          open={discardOpen}
          onCancel={() => setDiscardOpen(false)}
          onConfirm={handleConfirmDiscard}
          title="Discard your changes?"
          message="Your edits to this enquiry will be lost. The 24h draft buffer for new enquiries will also be cleared."
          confirmLabel="Discard"
          variant="danger"
        />
      </motion.div>
    </AnimatePresence>
  );
}

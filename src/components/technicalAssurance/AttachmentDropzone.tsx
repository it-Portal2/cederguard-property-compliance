import { useRef, useState, type DragEvent } from "react";
import {
  UploadCloud,
  Loader2,
  X,
  FileText,
  Trash2,
  Download,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import type { EnquiryAttachment } from "../../types/technicalAssurance";

// TAC enquiry attachment dropzone — drag-drop OR click-to-pick + chip list.
//
// Two-bucket model:
//   - `attachments` are server-side records (already uploaded; carry url +
//     scan-status pill).
//   - `pendingFiles` are client-side `File` objects waiting for the user to
//     click Save / Create. They're queued in-memory and uploaded sequentially
//     by the parent on commit. This avoids orphaned storage blobs + Firestore
//     records when the user picks the wrong file or closes the modal without
//     saving.
//
// Uploaded chips also expose a download button — `<a href={url} download>`.

const ACCEPT = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".heif",
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".ifc",
  ".dwg",
  ".rvt",
  ".nwd",
  ".nwc",
  ".rfa",
];

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB

const SCAN_PILL: Record<EnquiryAttachment["avScanStatus"], string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  clean: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  infected: "bg-rose-50 text-rose-700 border border-rose-200",
  failed: "bg-slate-100 text-slate-600 border border-slate-200",
};

const SCAN_LABEL: Record<EnquiryAttachment["avScanStatus"], string> = {
  pending: "Scan pending",
  clean: "Clean",
  infected: "Quarantined",
  failed: "Scan failed",
};

interface AttachmentDropzoneProps {
  attachments: EnquiryAttachment[];
  /** Files queued client-side that will upload on Save click. */
  pendingFiles?: File[];
  onAddFile: (file: File) => void;
  onRemove: (attachmentId: string) => Promise<void> | void;
  /** Remove a queued (not-yet-uploaded) file at the given index. */
  onRemovePending?: (index: number) => void;
  uploadingFileName?: string | null;
  removingId?: string | null;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentDropzone({
  attachments,
  pendingFiles = [],
  onAddFile,
  onRemove,
  onRemovePending,
  uploadingFileName = null,
  removingId = null,
  disabled = false,
}: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const uploadedBytes = attachments.reduce(
    (acc, a) => acc + (Number(a.fileSize) || 0),
    0,
  );
  const pendingBytes = pendingFiles.reduce((acc, f) => acc + f.size, 0);
  const totalBytes = uploadedBytes + pendingBytes;

  const isBusy = uploadingFileName !== null || disabled;

  const handlePick = (file: File | null | undefined) => {
    setLocalError(null);
    if (!file || isBusy) return;
    if (file.size > MAX_FILE_BYTES) {
      setLocalError(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 50 MB per file.`,
      );
      return;
    }
    if (totalBytes + file.size > MAX_TOTAL_BYTES) {
      setLocalError(
        "Adding this file would exceed the 200 MB total cap for this enquiry.",
      );
      return;
    }
    onAddFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handlePick(e.dataTransfer.files?.[0]);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isBusy) setDragOver(true);
  };

  return (
    <div className="space-y-3">
      {/* Existing (uploaded) attachments */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {a.fileName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatSize(a.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    SCAN_PILL[a.avScanStatus],
                  )}
                  title={
                    a.avScanStatus === "pending"
                      ? "File queued for virus scan."
                      : SCAN_LABEL[a.avScanStatus]
                  }
                >
                  {SCAN_LABEL[a.avScanStatus]}
                </span>
                {a.url && (
                  <a
                    href={a.url}
                    download={a.fileName}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    aria-label={`Download ${a.fileName}`}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  onClick={() => void onRemove(a.id)}
                  disabled={removingId === a.id || disabled}
                  aria-label={`Remove ${a.fileName}`}
                  title="Remove attachment"
                >
                  {removingId === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pending (client-side) files — uploaded on Save click */}
      {pendingFiles.length > 0 && (
        <ul className="space-y-2">
          {pendingFiles.map((f, idx) => {
            const isUploadingThis = uploadingFileName === f.name;
            return (
              <li
                key={`${f.name}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {f.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatSize(f.size)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200"
                    title="This file uploads when you click Save."
                  >
                    {isUploadingThis ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Pending — uploads on Save
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    onClick={() => onRemovePending?.(idx)}
                    disabled={isBusy}
                    aria-label={`Remove ${f.name}`}
                    title="Remove from queue"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isBusy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (isBusy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        className={clsx(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
          isBusy
            ? "cursor-wait border-slate-200 bg-slate-50 text-slate-400"
            : dragOver
              ? "border-indigo-400 bg-indigo-50/60 text-indigo-700"
              : "cursor-pointer border-slate-200 bg-slate-50/60 text-slate-500 hover:border-indigo-300 hover:text-indigo-600",
        )}
      >
        <UploadCloud className="h-6 w-6" strokeWidth={2.25} />
        <p className="text-sm font-semibold">
          Drop a file here, or click to browse
        </p>
        <p className="text-[11px] text-slate-400">
          PDF, JPG, PNG, HEIC, DOCX, XLSX, IFC, DWG, RVT, NWD · up to 50 MB
          per file · uploaded on Save
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPT.join(",")}
          onChange={(e) => {
            handlePick(e.target.files?.[0]);
            // Reset so picking the same file again still triggers onChange.
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {/* Error / total summary */}
      {localError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        {attachments.length + pendingFiles.length} attached
        {pendingFiles.length > 0
          ? ` (${pendingFiles.length} pending upload)`
          : ""}{" "}
        · {formatSize(totalBytes)} of {formatSize(MAX_TOTAL_BYTES)} used
      </p>
    </div>
  );
}

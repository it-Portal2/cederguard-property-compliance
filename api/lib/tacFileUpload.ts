// Technical Assurance Companion — large-file upload helpers.
//
// Handles enquiry attachments: PDF / DWG / IFC / RVT / NWD / DOCX / XLSX /
// JPEG / PNG / HEIC up to 50 MB per file (200 MB per enquiry total — enforced
// at the route layer because that needs the live enquiry doc).
//
// Wraps the existing `uploadAsset` / `deleteAsset` helpers from `./storage.ts`
// without touching them — the original 2 MB cap in `decodeBase64Image` stays
// intact for branding assets (lesson §25 ADD-never-MODIFY).

import { uploadAsset, deleteAsset } from "./storage.js";

// Limits ---------------------------------------------------------------
// Per-file: 3 MB binary cap aligns with Vercel's 4.5 MB serverless body
// limit after ~33% base64 inflation. The original 50 MB cap from PRD
// US-1.2 was aspirational — Vercel rejects any payload above 4.5 MB
// regardless of what this constant says. For larger files, see the
// M-LargeUploads future milestone.
// Per-enquiry: 200 MB total survives because that's the sum across many
// small files, not a single-payload constraint.
export const TAC_MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB per file
export const TAC_MAX_ENQUIRY_BYTES = 200 * 1024 * 1024; // 200 MB total per enquiry

// Allow-list of MIME types (PRD US-1.2) -------------------------------
// Construction file formats + standard office docs + raster images. Treated
// as a whitelist — anything not on this list is rejected at decode.
//
// Note: IFC / DWG / RVT / NWD don't have universally-registered MIME types;
// browsers commonly send `application/octet-stream` for these. We accept that
// fallback and rely on the file extension to disambiguate at the route layer.
export const TAC_ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // legacy .xls (occasionally still uploaded)
  "application/msword", // legacy .doc
  "model/ifc", // IFC standard MIME (when correctly tagged)
  "application/x-dwg",
  "application/acad",
  "application/octet-stream", // catch-all for IFC/DWG/RVT/NWD when browser doesn't know
]);

// File extensions we trust when the MIME is `application/octet-stream`.
// Normalised to lowercase, no leading dot. Used to detect the actual format
// when the browser's MIME guess is generic.
export const TAC_TRUSTED_EXTENSIONS = new Set<string>([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "ifc",
  "dwg",
  "rvt",
  "nwd",
  "nwc",
  "rfa",
]);

// Helpers --------------------------------------------------------------
function fileExtension(fileName: string): string {
  if (typeof fileName !== "string") return "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * Validate + decode a base64 file payload for TAC enquiry attachments.
 *
 * Throws a friendly Error on any validation failure — route handlers catch
 * and convert to the standard `{ success: false, error, code }` shape.
 */
export function decodeBase64TacFile(
  base64: string,
  fileName: string,
  declaredMime: string,
): { buffer: Buffer; mime: string; ext: string } {
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new Error("No file payload provided.");
  }
  if (typeof fileName !== "string" || fileName.length === 0) {
    throw new Error("fileName is required.");
  }

  // Accept both bare base64 and `data:.;base64,.` URIs.
  const match = base64.match(/^data:([\w+\/.\-]+);base64,(.+)$/);
  let mime = (declaredMime || "application/octet-stream").toLowerCase();
  let payload = base64;
  if (match) {
    mime = match[1].toLowerCase();
    payload = match[2];
  }

  if (!TAC_ALLOWED_MIME.has(mime)) {
    throw new Error(
      `File type "${mime}" is not accepted. Allowed: PDF, JPG, PNG, HEIC, DOCX, XLSX, IFC, DWG, RVT, NWD.`,
    );
  }

  // Decode buffer.
  let buffer: Buffer;
  try {
    buffer = Buffer.from(payload, "base64");
  } catch (e: any) {
    throw new Error(`Invalid base64 payload: ${e?.message ?? "unknown error"}`);
  }
  if (buffer.length === 0) {
    throw new Error("Decoded file is empty.");
  }
  if (buffer.length > TAC_MAX_FILE_BYTES) {
    const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
    throw new Error(
      `File is too large (${sizeMb} MB). Maximum is ${TAC_MAX_FILE_BYTES / 1024 / 1024} MB per file.`,
    );
  }

  // Disambiguate generic octet-stream uploads via file extension.
  const ext = fileExtension(fileName);
  if (mime === "application/octet-stream" && !TAC_TRUSTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension ".${ext}". Allowed: ${Array.from(TAC_TRUSTED_EXTENSIONS).join(", ")}.`,
    );
  }

  return { buffer, mime, ext };
}

/**
 * Storage path builder. TAC attachments are scoped under
 * `tac/{clientId}/{enquiryId}/{attachmentId}.{ext}` so retention purges +
 * tenant scoping align with the rest of the platform.
 */
export function tacAttachmentPath(
  clientId: string,
  enquiryId: string,
  attachmentId: string,
  ext: string,
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `tac/${clientId}/${enquiryId}/${attachmentId}.${safeExt}`;
}

/**
 * Upload an attachment buffer to GCS and return the public download URL +
 * storage path. Same pattern as governance branding (`makePublic: true`)
 * because V4 signed URLs are unreliable on this stack — see
 * `api/routes/storage.ts` header for the SignatureDoesNotMatch story.
 *
 * The returned `url` is a stable Google Cloud Storage public URL. Paths
 * include the attachmentId (random suffix) and tenant scoping, so URLs
 * are not practically guessable. If stricter privacy is needed in the
 * future, switch to server-streamed downloads via an API route.
 */
export async function uploadTacAttachment(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ path: string; url: string }> {
  return uploadAsset(storagePath, buffer, contentType, { makePublic: true });
}

/**
 * Delete an attachment from storage. Tolerates "not found" so the calling
 * code can unconditionally clean up after a Firestore-side removal.
 */
export async function deleteTacAttachment(path: string): Promise<void> {
  return deleteAsset(path);
}

// Virus-scan stub ------------------------------------------------------
//  locks ClamAV via a Cloud Function. ships the data shape only —
// `avScanStatus: 'pending'` is recorded on every upload so a later Cloud
// Function (or the retention cron) can pick the doc up, scan it,
// and patch the status to `'clean'` / `'infected'` / `'failed'`. The UI
// shows the status pill so users know the file is queued for scan.
export type TacAvStatus = "pending" | "clean" | "infected" | "failed";

export const TAC_INITIAL_AV_STATUS: TacAvStatus = "pending";

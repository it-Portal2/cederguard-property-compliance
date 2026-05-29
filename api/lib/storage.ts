// Programme Governance — Firebase Storage helpers.
//
// All asset uploads run through this module so we have one chokepoint for
// bucket selection, MIME headers, and signed-URL generation. The frontend
// never talks to Storage directly for governance assets — every byte goes
// through a server route that has already validated + processed the image.

import { getStorage } from 'firebase-admin/storage';

let cachedBucketName: string | null = null;

/**
 * Resolve the canonical Firebase Storage bucket name.
 *
 * Single source of truth for the entire backend — `api/lib/context.ts`
 * `getStorageBucket()` and the legacy in-file `getBucket()` here both
 * delegate to this resolver. Adding a third bucket resolver elsewhere
 * is a code smell; just import this one.
 *
 * Priority:
 *   1. `FIREBASE_STORAGE_BUCKET` env (preferred — explicit, deploy-time)
 *   2. `VITE_FIREBASE_STORAGE_BUCKET` env (fallback — historically only
 *      set as a Vite-time client var, but Vercel exposes it server-side
 *      too if it's added to the function env. Saves having to also
 *      set FIREBASE_STORAGE_BUCKET separately on existing deployments.)
 *   3. Derive from the service account's `project_id`
 *      — defaults to `<projectId>.firebasestorage.app` (the new Firebase
 *        Storage default introduced in Oct 2024)
 *      — set FIREBASE_STORAGE_BUCKET explicitly if your project still
 *        uses the legacy `<projectId>.appspot.com` bucket
 *   4. Throw a clear error if none of the above resolves
 */
export function resolveBucketName(): string {
  if (cachedBucketName) return cachedBucketName;

  const explicit =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET;
  if (explicit) {
    cachedBucketName = explicit;
    return explicit;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      const projectId = parsed.project_id || parsed.projectId;
      if (projectId) {
        cachedBucketName = `${projectId}.firebasestorage.app`;
        return cachedBucketName;
      }
    } catch (e) {
      // fall through to error below
    }
  }

  throw new Error(
    'Firebase Storage bucket not configured. Set FIREBASE_STORAGE_BUCKET in your environment ' +
      '(e.g. "<your-project-id>.firebasestorage.app" or "<your-project-id>.appspot.com").',
  );
}

function getBucket() {
  return getStorage().bucket(resolveBucketName());
}

export interface UploadResult {
  /** Storage path relative to bucket root, e.g. `councilAssets/abc/logo.png`. */
  path: string;
  /**
   * Stable URL for the uploaded asset.
   *
   * - When uploaded with `makePublic: true` (default — branding assets):
   *   a canonical Google Cloud Storage public URL:
   *   `https://storage.googleapis.com/<bucket>/<path>`. Cache-friendly,
   *   embeddable in published documents.
   * - When uploaded with `makePublic: false` (sensitive content —
   *   evidence + TAC attachments): an empty string. Consumers must mint
   *   a short-lived signed download URL on demand via
   *   `api/routes/storage.ts::getStorageDownloadURL` /
   *   `getTacAttachmentDownloadURL` so the server can re-validate
   *   ownership on every download click.
   */
  url: string;
}

export interface UploadAssetOptions {
  /**
   * When `true` (default), the uploaded object is made world-readable via
   * `file.makePublic()` and the returned `url` is the stable public URL.
   * Set to `false` for sensitive content — the object stays private and
   * the returned `url` is empty; callers should mint short-lived signed
   * download URLs via the storage download endpoints when serving the
   * asset to the user.
   */
  makePublic?: boolean;
}

/**
 * Upload a buffer to Firebase Storage and return a download URL (or empty
 * string when stored privately).
 *
 * Notes:
 * - Default behaviour (`makePublic: true`) matches the historical pattern
 *   used by governance branding (logos, stamps, signatures) — objects are
 *   public, URLs are stable + cacheable.
 * - Pass `{ makePublic: false }` for sensitive content (evidence,
 *   TAC attachments). The object stays private; serve it via a fresh
 *   short-lived signed download URL on each access so ownership can be
 *   re-validated server-side every time.
 * - We deliberately do NOT use signed PUT URLs for browser uploads in
 *   this codebase — the @google-cloud/storage V4 signing path against
 *   `.firebasestorage.app` buckets has reproducible `SignatureDoesNotMatch`
 *   failures that no documented fix resolves. All uploads go base64 →
 *   API → here, capped at the Vercel serverless 4.5 MB body limit
 *   (effectively ~3 MB binary after base64 inflation).
 */
export async function uploadAsset(
  path: string,
  buffer: Buffer,
  contentType: string,
  options: UploadAssetOptions = {},
): Promise<UploadResult> {
  const { makePublic = true } = options;
  const bucket = getBucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      contentType,
      cacheControl: makePublic
        ? 'public, max-age=31536000, immutable'
        : 'private, no-cache, no-store, must-revalidate',
    },
  });
  if (makePublic) {
    await file.makePublic();
    return {
      path,
      url: `https://storage.googleapis.com/${bucket.name}/${encodeURI(path)}`,
    };
  }
  return { path, url: '' };
}

/**
 * Delete an asset by Storage path. Tolerates "not found" so calling code can
 * unconditionally clean up without bookkeeping.
 */
export async function deleteAsset(path: string): Promise<void> {
  const bucket = getBucket();
  try {
    await bucket.file(path).delete();
  } catch (e: any) {
    if (e?.code === 404) return;
    throw e;
  }
}

/**
 * Read an asset back as a base64-encoded data URI. Used by the PDF renderer
 * to embed the actual logo / signature bytes in the rendered document.
 */
export async function readAssetAsDataUri(path: string): Promise<string | null> {
  const bucket = getBucket();
  const file = bucket.file(path);
  try {
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [meta] = await file.getMetadata();
    const contentType = (meta.contentType as string | undefined) ?? 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e: any) {
    if (e?.code === 404) return null;
    throw e;
  }
}

// Canonical path builders — the route handlers + PDF renderer share these
// so paths never drift between writers and readers.
export const assetPaths = {
  councilLogo: (clientId: string) => `councilAssets/${clientId}/logo.png`,
  councilStamp: (clientId: string, stampId: string) =>
    `councilAssets/${clientId}/stamps/${stampId}.png`,
  userSignature: (uid: string) => `userAssets/${uid}/signature.png`,
};

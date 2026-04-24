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
 * Priority:
 *   1. `FIREBASE_STORAGE_BUCKET` env (handy for staging / preview deploys)
 *   2. Derive from the service account's `project_id`
 *      — defaults to `<projectId>.firebasestorage.app` (the new Firebase
 *        Storage default introduced in Oct 2024)
 *      — set the env explicitly if your project still uses the legacy
 *        `<projectId>.appspot.com` bucket
 *   3. Throw a clear error if none of the above resolves
 */
function resolveBucketName(): string {
  if (cachedBucketName) return cachedBucketName;

  const explicit = process.env.FIREBASE_STORAGE_BUCKET;
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
  /** Long-lived public URL. */
  url: string;
}

/**
 * Upload a buffer to Firebase Storage and return a download URL.
 *
 * Notes:
 * - We use `makePublic()` so the URL is stable + cache-friendly. Acceptable
 *   for branding assets (logos, signatures, stamps) that are routinely
 *   embedded in published documents anyway.
 * - The URL we return is the canonical Google Cloud Storage media URL.
 *   Format: `https://storage.googleapis.com/<bucket>/<path>`.
 */
export async function uploadAsset(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const bucket = getBucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  await file.makePublic();
  return {
    path,
    url: `https://storage.googleapis.com/${bucket.name}/${encodeURI(path)}`,
  };
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

// Programme Governance — server-side image processing helpers.
//
// All inputs come in as raw Buffer (decoded from base64 on the route layer).
// All outputs are PNG buffers, ready for upload to Firebase Storage.
//
// Performance notes
// -----------------
// `sharp` is a streaming libvips wrapper — it's the standard for Node image
// work and is supported on Vercel out of the box. For Phase-2 limits (≤2 MB
// in, ≤500 KB out, single image at a time) we don't need worker threads.

import sharp from 'sharp';

// Size limits
export const MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB cap on incoming uploads
export const TARGET_OUTPUT_BYTES = 500 * 1024; // ~500 KB target after compression

// Logo dimensions — typical councils use a wide crest at the top of a report.
const LOGO_MAX_DIMENSION = 600;

// Stamp dimensions — usually circular / square, ≈300 px wide is plenty.
const STAMP_MAX_DIMENSION = 400;

// Signature dimensions — typically inserted at ~140×50 pt in the PDF, so
// a 600 px source gives plenty of pixel density without bloating the file.
const SIGNATURE_MAX_DIMENSION = 600;

// Pixels brighter than this on every channel are treated as background and
// turned transparent. 240 is a sensible default that catches scanner noise
// without eating real signature ink.
const WHITE_BG_THRESHOLD = 240;

/**
 * Compress a council logo. Output is always PNG with alpha preserved.
 * Resizes to fit within {@link LOGO_MAX_DIMENSION} (no enlargement).
 */
export async function compressLogo(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();
}

/**
 * Compress a council stamp. Same pipeline as the logo but with a tighter
 * dimension cap.
 */
export async function compressStamp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(STAMP_MAX_DIMENSION, STAMP_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();
}

/**
 * Compress a signature AND knock out the white background so it composites
 * cleanly over a PDF page. Pixels with R, G, and B all above
 * {@link WHITE_BG_THRESHOLD} have their alpha set to 0.
 *
 * Returns a PNG buffer with a transparent background.
 */
export async function processSignature(input: Buffer): Promise<Buffer> {
  // 1. Resize + force RGBA so we can mutate alpha pixel-by-pixel.
  const { data, info } = await sharp(input)
    .resize(SIGNATURE_MAX_DIMENSION, SIGNATURE_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error(`Unexpected channel count after ensureAlpha: ${info.channels}`);
  }

  // 2. Walk the buffer once, knocking near-white pixels transparent.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE_BG_THRESHOLD && g >= WHITE_BG_THRESHOLD && b >= WHITE_BG_THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  // 3. Re-encode as PNG so the alpha is preserved.
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Validate an incoming base64 payload. Throws a friendly Error if anything
 * is wrong — the route handler catches and converts to the standard
 * `{ success: false, error, code }` shape.
 */
export function decodeBase64Image(
  base64: string,
  allowedMime: string[] = ['image/png', 'image/jpeg', 'image/svg+xml'],
): { buffer: Buffer; mime: string } {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new Error('No image payload provided.');
  }
  // Accept both bare base64 and `data:image/...;base64,...` URIs.
  const match = base64.match(/^data:([\w+\/.\-]+);base64,(.+)$/);
  let mime = 'image/png';
  let payload = base64;
  if (match) {
    mime = match[1];
    payload = match[2];
  }
  if (!allowedMime.includes(mime)) {
    throw new Error(
      `Unsupported image format "${mime}". Allowed: ${allowedMime.join(', ')}.`,
    );
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(payload, 'base64');
  } catch (e: any) {
    throw new Error(`Invalid base64 payload: ${e?.message ?? 'unknown error'}`);
  }
  if (buffer.length === 0) {
    throw new Error('Decoded image is empty.');
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new Error(
      `Image is too large (${(buffer.length / 1024 / 1024).toFixed(2)} MB). Maximum is ${MAX_INPUT_BYTES / 1024 / 1024} MB.`,
    );
  }
  return { buffer, mime };
}

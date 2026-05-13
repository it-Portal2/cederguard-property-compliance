// Arial / Arial-equivalent font registration.
//
// jspdf ships with Helvetica (Arial-equivalent metrics — Arial was
// originally a Microsoft clone of Helvetica). For the §16 lock we
// want the actual Arial glyphs in PDFs.
//
// **Why a loader, not a checked-in TTF**: shipping Microsoft Arial
// requires a paid license; bundling it into a public-ish repo would
// breach the EULA. Liberation Sans (SIL OFL) and Arimo (Apache 2.0,
// Google's metric-equivalent of Arial) are the licensed-clean drop-ins.
//
// Install path (ops):
//   1. Download Arimo-Regular.ttf + Arimo-Bold.ttf + Arimo-Italic.ttf
//      + Arimo-BoldItalic.ttf from Google Fonts.
//   2. Drop them into `api/lib/fonts/` (mkdir if needed).
//   3. Redeploy. The loader picks them up automatically; if absent
//      the PDF stays on Helvetica without errors — same visible
//      result as before.
//
// **Cache**: registration runs once per process, gated by
// `__cedarFontsRegistered`.

import type { jsPDF } from 'jspdf';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const FONT_DIR = path.join(process.cwd(), 'api', 'lib', 'fonts');
const FONT_NAME = 'Arimo';

interface FontFile {
  filename: string;
  style: 'normal' | 'bold' | 'italic' | 'bolditalic';
}

const FONT_FILES: FontFile[] = [
  { filename: 'Arimo-Regular.ttf', style: 'normal' },
  { filename: 'Arimo-Bold.ttf', style: 'bold' },
  { filename: 'Arimo-Italic.ttf', style: 'italic' },
  { filename: 'Arimo-BoldItalic.ttf', style: 'bolditalic' },
];

let registrationStatus: 'unattempted' | 'success' | 'unavailable' = 'unattempted';

/**
 * Registers the Arial-equivalent (Arimo) TTFs on a fresh `jsPDF`
 * instance. Returns the actual font family the caller should use:
 *   `Arimo` when TTFs are present (preferred)
 *   `helvetica` fallback (always works; jspdf built-in)
 * Safe to call on every render — the TTF read happens at most once
 * per process.
 */
export function registerCedarFonts(pdf: jsPDF): string {
  if (registrationStatus === 'unavailable') return 'helvetica';

  if (registrationStatus === 'success') {
    // jspdf needs the font registered on every new instance.
    try {
      registerKnownFiles(pdf);
      return FONT_NAME;
    } catch {
      registrationStatus = 'unavailable';
      return 'helvetica';
    }
  }

  // First call — probe the font dir.
  const allPresent = FONT_FILES.every((f) =>
    existsSync(path.join(FONT_DIR, f.filename)),
  );
  if (!allPresent) {
    registrationStatus = 'unavailable';
    return 'helvetica';
  }
  try {
    registerKnownFiles(pdf);
    registrationStatus = 'success';
    return FONT_NAME;
  } catch (err) {
    console.error('[pdfFonts] Arimo registration failed; falling back', err);
    registrationStatus = 'unavailable';
    return 'helvetica';
  }
}

function registerKnownFiles(pdf: jsPDF) {
  for (const f of FONT_FILES) {
    const data = readFileSync(path.join(FONT_DIR, f.filename), { encoding: 'base64' });
    pdf.addFileToVFS(f.filename, data);
    pdf.addFont(f.filename, FONT_NAME, f.style);
  }
}

// Report → PDF helper. Wraps the generic Tiptap-JSON renderer with
// report-specific concerns:
//   • Walks every report section in order, prefixing each with a heading
//   • Resolves the council logo + signer signature(s) from Storage
//   • Applies a status watermark (DRAFT / APPROVED / SEALED) so the
//     reader instantly knows what they're looking at
//   • Auto-populates the audit-trail footer from report metadata
//
// Used by:
//   • governanceRenderReportPdf  — preview only, no state change
//   • governanceSignPartA        — sealed PDF written to Storage on sign

import type { ApiContext } from './context.js';
import { renderReportPdf } from './pdfRenderer.js';
import { readAssetAsDataUri } from './storage.js';

interface ReportPdfInputs {
  reportId: string;
  /** Used to choose the watermark + which signature URLs to resolve. */
  status: string;
  /** Override watermark — defaults derived from `status`. */
  watermarkOverride?: string | null;
  /** Optional: include a specific signer's signature for Part A. The
   *  caller resolves this from `users/{uid}.signatureUrl` via Storage. */
  partASignatureDataUri?: string | null;
}

type Node = Record<string, any>;

const p = (kids: Node[] = []): Node => ({
  type: 'paragraph',
  content: kids.length ? kids : [{ type: 'text', text: '' }],
});

const text = (s: string, marks?: Array<{ type: string }>): Node => ({
  type: 'text',
  text: s,
  ...(marks ? { marks } : {}),
});

const h = (level: 2 | 3, t: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [text(t)],
});

function watermarkForStatus(status: string): string | null {
  switch (status) {
    case 'Draft':
    case 'AmendmentsRequested':
    case 'Withdrawn':
      return 'DRAFT';
    case 'InReview':
      return 'IN REVIEW';
    case 'Approved':
      return 'APPROVED';
    case 'Sealed':
      return null; // sealed = the canonical official copy, no watermark
    case 'Abandoned':
      return 'ABANDONED';
    default:
      return null;
  }
}

// Watermark palette deliberately uses pale-100 tints so the stamp reads
// as a faint background marker rather than overlapping content.
function watermarkColorForStatus(status: string): [number, number, number] {
  switch (status) {
    case 'Approved':
      return [220, 252, 231]; // emerald-100
    case 'Abandoned':
      return [255, 228, 230]; // rose-100
    case 'InReview':
      return [224, 231, 255]; // indigo-100
    default:
      return [241, 245, 249]; // slate-100
  }
}

/**
 * Loads report + sections + assets from Firestore/Storage, builds a merged
 * Tiptap doc, and renders to PDF. Returns the rendered PDF as a Buffer.
 */
export async function buildReportPdfBuffer(
  ctx: ApiContext,
  inputs: ReportPdfInputs,
): Promise<{ buffer: Buffer; meta: any }> {
  const reportRef = ctx.db
    .collection('reports')
    .doc(`${ctx.primaryUid}_${inputs.reportId}`);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) throw new Error('Report not found.');
  const report = reportSnap.data() ?? {};

  const sectionsSnap = await reportRef.collection('sections').get();
  const sections = sectionsSnap.docs
    .map((d) => ({ _id: d.id, ...d.data() } as any))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Resolve council logo from the council owner's user doc → Storage path.
  // councilAssets/{clientId}/logo.png
  let councilLogoDataUri: string | null = null;
  try {
    councilLogoDataUri = await readAssetAsDataUri(
      `councilAssets/${ctx.primaryUid}/logo.png`,
    );
  } catch {
    councilLogoDataUri = null;
  }

  // Build the merged Tiptap doc — for each section, render an H2 heading
  // (so it acts as a section divider in the PDF) followed by its content.
  // Skip the heading prefix for sections that already lead with their own
  // heading (e.g. Header metadata table).
  const merged: Node = {
    type: 'doc',
    content: [
      ...sections.flatMap((s) => {
        const sectionDoc: Node = s.content ?? { type: 'doc', content: [] };
        const sectionContent: Node[] = Array.isArray(sectionDoc.content)
          ? sectionDoc.content
          : [];
        return [
          h(2, `${s.order ?? ''}. ${s.name ?? ''}`.trim()),
          ...sectionContent,
          // Spacer paragraph between sections.
          p([]),
        ];
      }),
    ],
  };

  const sigUris: { A?: string; B?: string } = {};
  if (inputs.partASignatureDataUri) {
    sigUris.A = inputs.partASignatureDataUri;
  }

  const buffer = renderReportPdf({
    doc: merged as any,
    councilLogoDataUri,
    signatureDataUris: sigUris,
    meta: {
      leadOfficer: report.ownerLabel ?? '',
      reportAuthor: report.ownerLabel ?? '',
      version: report.sealedAt
        ? 'Sealed'
        : report.approvedAt
          ? 'Approved'
          : report.submittedAt
            ? 'In review'
            : 'Draft',
      dated: new Date(report.updatedAt ?? report.createdAt ?? Date.now())
        .toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      keyDecision: report.isHRB ? 'Yes' : 'No',
      consultation: report.reviewerLabel ?? 'Programme Manager',
    },
    watermarkText:
      inputs.watermarkOverride !== undefined
        ? inputs.watermarkOverride
        : watermarkForStatus(inputs.status),
    watermarkColor: watermarkColorForStatus(inputs.status),
  });

  return { buffer, meta: { sectionsCount: sections.length, status: inputs.status } };
}

export function reportPdfFilename(report: any): string {
  const slug = (report?.id ?? 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const status = (report?.status ?? 'draft').toLowerCase();
  return `${slug}-${status}.pdf`;
}

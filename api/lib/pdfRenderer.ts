// Programme Governance — server-side PDF renderer.
//
// Walks a Tiptap ProseMirror JSON document and emits a jspdf PDF.
// Placeholders ({{council.logo}}, signature image URLs) are resolved at
// render time using the resolver passed in by the route handler.
//
// Phase 1 prints with Helvetica (metric-equivalent to Arial — Arial was
// originally Microsoft's clone of Helvetica). Full Arial embed lands later
// once the licensed TTF is provisioned.

import { jsPDF } from 'jspdf';

// --- Types matching the Tiptap node shapes from src/components/governance/extensions ----

interface PMTextMark {
  type: string;
  attrs?: Record<string, any>;
}

interface PMNode {
  type: string;
  attrs?: Record<string, any>;
  content?: PMNode[];
  text?: string;
  marks?: PMTextMark[];
}

export interface PDFRenderOptions {
  doc: PMNode;
  /** Resolved at render time. URL must be data URI or accessible PNG. */
  councilLogoDataUri?: string | null;
  /** Resolved Part A / Part B signatures keyed by part. */
  signatureDataUris?: Partial<Record<'A' | 'B', string>>;
  /** Used for the audit trail footer. */
  meta?: {
    leadOfficer?: string;
    reportAuthor?: string;
    version?: string;
    dated?: string;
    keyDecision?: 'Yes' | 'No';
    consultation?: string;
  };
  /** Optional diagonal watermark — e.g. "DRAFT" / "APPROVED" / "SEALED".
   *  Stamped on every page after the walker finishes. */
  watermarkText?: string | null;
  /** Watermark colour as RGB tuple. Defaults to slate-300-ish. */
  watermarkColor?: [number, number, number];
}

// --- Layout constants -----------------------------------------------------

const PAGE_MARGIN_X = 56; // ~20mm at 72dpi
const PAGE_MARGIN_TOP = 56;
const PAGE_MARGIN_BOTTOM = 56;
const LINE_HEIGHT_RATIO = 1.35;
const FONT_FAMILY = 'helvetica'; // jspdf built-in; Arial-equivalent

// --- Public entry point ---------------------------------------------------

export function renderReportPdf(options: PDFRenderOptions): Buffer {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.setFont(FONT_FAMILY, 'normal');
  pdf.setFontSize(11);

  const ctx: RenderContext = {
    pdf,
    cursorY: PAGE_MARGIN_TOP,
    pageWidth: pdf.internal.pageSize.getWidth(),
    pageHeight: pdf.internal.pageSize.getHeight(),
    contentWidth: pdf.internal.pageSize.getWidth() - 2 * PAGE_MARGIN_X,
    options,
    paragraphCounter: 0,
  };

  walkContent(options.doc.content ?? [], ctx);

  // Diagonal watermark on every page (e.g. "DRAFT"). Drawn before page
  // numbers so the page-number text overlays cleanly on top. Designed to
  // be a faint stamp — readable but never obscuring the content beneath.
  const pageCount = (pdf as any).internal.getNumberOfPages();
  if (options.watermarkText) {
    // Default colour is a very-pale slate so the stamp reads as a
    // background marker, not foreground content. Caller-supplied colours
    // are also expected to be pale (>= 220 on each channel).
    const wmColor = options.watermarkColor ?? [241, 245, 249]; // slate-100
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.saveGraphicsState();
      pdf.setFontSize(64);
      pdf.setTextColor(wmColor[0], wmColor[1], wmColor[2]);
      pdf.setFont(FONT_FAMILY, 'bold');
      pdf.text(
        options.watermarkText,
        ctx.pageWidth / 2,
        ctx.pageHeight / 2,
        { align: 'center', angle: 35 },
      );
      pdf.restoreGraphicsState();
      // Restore default font weight + size for whatever runs next.
      pdf.setFont(FONT_FAMILY, 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(0);
    }
  }

  // Page numbers — every page, bottom centre.
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      ctx.pageWidth / 2,
      ctx.pageHeight - 24,
      { align: 'center' },
    );
  }

  const arrayBuffer = pdf.output('arraybuffer');
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// --- Walker ---------------------------------------------------------------

interface RenderContext {
  pdf: jsPDF;
  cursorY: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  options: PDFRenderOptions;
  paragraphCounter: number;
}

function ensureSpace(ctx: RenderContext, needed: number) {
  if (ctx.cursorY + needed > ctx.pageHeight - PAGE_MARGIN_BOTTOM) {
    ctx.pdf.addPage();
    ctx.cursorY = PAGE_MARGIN_TOP;
  }
}

function walkContent(nodes: PMNode[], ctx: RenderContext) {
  for (const node of nodes) {
    walkNode(node, ctx);
  }
}

function walkNode(node: PMNode, ctx: RenderContext) {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node, ctx);
    case 'heading':
      return renderHeading(node, ctx);
    case 'bulletList':
    case 'orderedList':
      return renderList(node, ctx, node.type === 'orderedList');
    case 'blockquote':
      return renderBlockquote(node, ctx);
    case 'horizontalRule':
      return renderHr(ctx);
    case 'table':
      return renderTable(node, ctx);
    case 'councilLogo':
      return renderCouncilLogo(ctx);
    case 'signatureBlock':
      return renderSignatureBlock(node, ctx);
    case 'headerMetadataTable':
      return renderKeyValueTable(node, ctx, 'Header metadata', HEADER_FIELDS);
    case 'auditTrailFooter':
      return renderKeyValueTable(node, ctx, 'Audit trail', AUDIT_FIELDS);
    case 'backgroundDocumentsTable':
      return renderRowsTable(node, ctx, 'Background documents', ['title', 'url']);
    case 'appendicesTable':
      return renderRowsTable(node, ctx, 'Appendices', ['title', 'classification']);
    case 'officerAdviceBlock':
      return renderOfficerAdvice(node, ctx);
    case 'attachment':
      return renderAttachment(node, ctx);
    default:
      // Unknown nodes: walk into their content if any (defensive — keeps PDF valid)
      if (node.content) walkContent(node.content, ctx);
      return;
  }
}

// --- Block renderers ------------------------------------------------------

function renderParagraph(node: PMNode, ctx: RenderContext) {
  if (!node.content || node.content.length === 0) {
    ctx.cursorY += 11 * LINE_HEIGHT_RATIO;
    return;
  }
  ctx.paragraphCounter += 1;
  const text = inlineToText(node.content);
  drawWrappedText(`${ctx.paragraphCounter}. ${text}`, ctx, {
    fontSize: 11,
    style: 'normal',
  });
  ctx.cursorY += 6;
}

function renderHeading(node: PMNode, ctx: RenderContext) {
  const level = Math.max(1, Math.min(3, Number(node.attrs?.level ?? 2)));
  const sizeMap: Record<number, number> = { 1: 18, 2: 14, 3: 12 };
  const size = sizeMap[level];
  const text = inlineToText(node.content ?? []);
  ensureSpace(ctx, size * LINE_HEIGHT_RATIO + 16);
  ctx.cursorY += 10;
  drawWrappedText(text, ctx, { fontSize: size, style: 'bold' });
  ctx.cursorY += 8;
}

function renderList(node: PMNode, ctx: RenderContext, ordered: boolean) {
  const items = node.content ?? [];
  items.forEach((item, idx) => {
    const marker = ordered ? `${idx + 1}.` : '•';
    const text = inlineToText(itemContent(item));
    drawWrappedText(`   ${marker}  ${text}`, ctx, { fontSize: 11, style: 'normal' });
    ctx.cursorY += 4;
  });
  ctx.cursorY += 4;
}

function itemContent(item: PMNode): PMNode[] {
  // listItem typically wraps a paragraph
  if (item.content && item.content[0]?.type === 'paragraph') {
    return item.content[0].content ?? [];
  }
  return item.content ?? [];
}

function renderBlockquote(node: PMNode, ctx: RenderContext) {
  const text = inlineToText(
    (node.content ?? []).flatMap((p) => p.content ?? []),
  );
  ensureSpace(ctx, 24);
  const startY = ctx.cursorY;
  drawWrappedText(`   ${text}`, ctx, { fontSize: 11, style: 'italic' });
  ctx.pdf.setDrawColor(180);
  ctx.pdf.setLineWidth(2);
  ctx.pdf.line(PAGE_MARGIN_X, startY - 8, PAGE_MARGIN_X, ctx.cursorY - 4);
  ctx.cursorY += 6;
}

function renderHr(ctx: RenderContext) {
  ensureSpace(ctx, 16);
  ctx.cursorY += 8;
  ctx.pdf.setDrawColor(220);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.line(PAGE_MARGIN_X, ctx.cursorY, ctx.pageWidth - PAGE_MARGIN_X, ctx.cursorY);
  ctx.cursorY += 12;
}

function renderTable(node: PMNode, ctx: RenderContext) {
  const rows = (node.content ?? []).filter((r) => r.type === 'tableRow');
  if (rows.length === 0) return;

  // Compute column count from the first row.
  const cols = (rows[0].content ?? []).length || 1;
  const colWidth = ctx.contentWidth / cols;
  const lineHeight = 11 * LINE_HEIGHT_RATIO;

  rows.forEach((row, rIdx) => {
    ensureSpace(ctx, lineHeight + 6);
    const startY = ctx.cursorY;
    const cells = row.content ?? [];
    let maxCellHeight = lineHeight;

    cells.forEach((cell, cIdx) => {
      const isHeader = cell.type === 'tableHeader' || rIdx === 0;
      ctx.pdf.setFont(FONT_FAMILY, isHeader ? 'bold' : 'normal');
      ctx.pdf.setFontSize(10);
      ctx.pdf.setTextColor(20);

      const text = inlineToText(
        (cell.content ?? []).flatMap((p) => p.content ?? []),
      );
      const wrapped = ctx.pdf.splitTextToSize(text || '—', colWidth - 8);
      const cellHeight = wrapped.length * lineHeight + 4;
      if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;

      const x = PAGE_MARGIN_X + cIdx * colWidth;
      if (isHeader) {
        ctx.pdf.setFillColor(245, 247, 250);
        ctx.pdf.rect(x, startY, colWidth, lineHeight + 4, 'F');
      }
      ctx.pdf.setDrawColor(220);
      ctx.pdf.rect(x, startY, colWidth, cellHeight);
      ctx.pdf.text(wrapped, x + 4, startY + 12);
    });
    ctx.cursorY = startY + maxCellHeight;
  });
  ctx.cursorY += 8;
}

function renderCouncilLogo(ctx: RenderContext) {
  const uri = ctx.options.councilLogoDataUri;
  ensureSpace(ctx, 60);
  if (uri) {
    try {
      const w = 120;
      const h = 60;
      const x = (ctx.pageWidth - w) / 2;
      ctx.pdf.addImage(uri, 'PNG', x, ctx.cursorY, w, h, undefined, 'FAST');
      ctx.cursorY += h + 12;
      return;
    } catch (e) {
      console.warn('[pdfRenderer] failed to add council logo:', e);
    }
  }
  drawWrappedText('[Council logo placeholder]', ctx, {
    fontSize: 9,
    style: 'italic',
    align: 'center',
    color: 150,
  });
  ctx.cursorY += 6;
}

function renderSignatureBlock(node: PMNode, ctx: RenderContext) {
  const part = (node.attrs?.part as 'A' | 'B') ?? 'A';
  const uri = ctx.options.signatureDataUris?.[part];
  ensureSpace(ctx, 80);
  drawWrappedText(`Part ${part} — Signature`, ctx, {
    fontSize: 11,
    style: 'bold',
  });
  if (uri) {
    try {
      ctx.pdf.addImage(uri, 'PNG', PAGE_MARGIN_X, ctx.cursorY, 140, 50, undefined, 'FAST');
      ctx.cursorY += 56;
    } catch (e) {
      console.warn('[pdfRenderer] failed to add signature:', e);
      ctx.cursorY += 30;
    }
  } else {
    drawWrappedText('[signature pending]', ctx, {
      fontSize: 9,
      style: 'italic',
      color: 150,
    });
  }
  const name = (node.attrs?.signerName as string) || '';
  const designation = (node.attrs?.signerDesignation as string) || '';
  if (name) drawWrappedText(name, ctx, { fontSize: 10, style: 'bold' });
  if (designation) drawWrappedText(designation, ctx, { fontSize: 9, style: 'italic' });
  ctx.cursorY += 8;
}

const HEADER_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'decisionTaker', label: 'Decision Taker' },
  { key: 'date', label: 'Date' },
  { key: 'reportTitle', label: 'Report Title' },
  { key: 'wards', label: 'Wards' },
  { key: 'classification', label: 'Classification' },
  { key: 'reasonForLateness', label: 'Reason for lateness' },
  { key: 'from', label: 'From' },
];

const AUDIT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'leadOfficer', label: 'Lead Officer' },
  { key: 'reportAuthor', label: 'Report Author' },
  { key: 'version', label: 'Version' },
  { key: 'dated', label: 'Dated' },
  { key: 'keyDecision', label: 'Key Decision?' },
  { key: 'consultation', label: 'Consultation' },
];

function renderKeyValueTable(
  node: PMNode,
  ctx: RenderContext,
  caption: string,
  fields: Array<{ key: string; label: string }>,
) {
  ensureSpace(ctx, 24);
  drawWrappedText(caption, ctx, {
    fontSize: 9,
    style: 'bold',
    color: 120,
  });
  ctx.cursorY += 4;

  const labelW = 140;
  const lineHeight = 10 * LINE_HEIGHT_RATIO;
  fields.forEach((f) => {
    ensureSpace(ctx, lineHeight + 2);
    const value = String((node.attrs as any)?.[f.key] ?? '') || '—';
    ctx.pdf.setFontSize(9);
    ctx.pdf.setDrawColor(220);
    ctx.pdf.setFillColor(248, 250, 252);
    ctx.pdf.rect(PAGE_MARGIN_X, ctx.cursorY, labelW, lineHeight + 2, 'FD');
    ctx.pdf.rect(PAGE_MARGIN_X + labelW, ctx.cursorY, ctx.contentWidth - labelW, lineHeight + 2);
    ctx.pdf.setFont(FONT_FAMILY, 'bold');
    ctx.pdf.setTextColor(60);
    ctx.pdf.text(f.label, PAGE_MARGIN_X + 4, ctx.cursorY + 12);
    ctx.pdf.setFont(FONT_FAMILY, 'normal');
    ctx.pdf.setTextColor(20);
    ctx.pdf.text(value, PAGE_MARGIN_X + labelW + 4, ctx.cursorY + 12);
    ctx.cursorY += lineHeight + 2;
  });
  ctx.cursorY += 8;
}

function renderRowsTable(
  node: PMNode,
  ctx: RenderContext,
  caption: string,
  cols: string[],
) {
  ensureSpace(ctx, 24);
  drawWrappedText(caption, ctx, {
    fontSize: 9,
    style: 'bold',
    color: 120,
  });
  ctx.cursorY += 4;
  const rows = (node.attrs?.rows as Record<string, any>[]) ?? [];
  if (rows.length === 0) {
    drawWrappedText('—', ctx, { fontSize: 9, color: 150, style: 'italic' });
    ctx.cursorY += 6;
    return;
  }
  const colW = ctx.contentWidth / cols.length;
  const lineHeight = 10 * LINE_HEIGHT_RATIO;
  rows.forEach((row) => {
    ensureSpace(ctx, lineHeight + 2);
    cols.forEach((c, i) => {
      ctx.pdf.setDrawColor(220);
      ctx.pdf.rect(PAGE_MARGIN_X + i * colW, ctx.cursorY, colW, lineHeight + 2);
      ctx.pdf.setFontSize(9);
      ctx.pdf.setTextColor(20);
      ctx.pdf.text(
        String(row[c] ?? '—').slice(0, 60),
        PAGE_MARGIN_X + i * colW + 4,
        ctx.cursorY + 12,
      );
    });
    ctx.cursorY += lineHeight + 2;
  });
  ctx.cursorY += 8;
}

function renderOfficerAdvice(node: PMNode, ctx: RenderContext) {
  const title = (node.attrs?.officerTitle as string) || 'Officer advice';
  const refCode = (node.attrs?.refCode as string) || '';
  ensureSpace(ctx, 30);
  drawWrappedText(`${title}${refCode ? ` · ${refCode}` : ''}`, ctx, {
    fontSize: 10,
    style: 'bold',
    color: 60,
  });
  walkContent(node.content ?? [], ctx);
  ctx.cursorY += 4;
}

function renderAttachment(node: PMNode, ctx: RenderContext) {
  const filename = (node.attrs?.filename as string) || 'Attachment';
  const url = (node.attrs?.url as string) || '';
  ensureSpace(ctx, 18);
  drawWrappedText(`📎 ${filename}${url ? `  (${url})` : ''}`, ctx, {
    fontSize: 9,
    style: 'normal',
    color: 80,
  });
  ctx.cursorY += 4;
}

// --- Inline + text helpers ------------------------------------------------

function inlineToText(nodes: PMNode[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      out += n.text ?? '';
      continue;
    }
    if (n.type === 'hardBreak') {
      out += '\n';
      continue;
    }
    if (n.type === 'regulationCitation') {
      out += ` [§ ${n.attrs?.code ?? ''}] `;
      continue;
    }
    // Fallback — recurse into any inline content
    if (n.content) out += inlineToText(n.content);
  }
  return out.replace(/\s+/g, ' ').trim();
}

interface DrawTextOpts {
  fontSize: number;
  style: 'normal' | 'bold' | 'italic';
  align?: 'left' | 'center' | 'right';
  color?: number; // 0–255 grey
}

function drawWrappedText(text: string, ctx: RenderContext, opts: DrawTextOpts) {
  if (!text) return;
  ctx.pdf.setFont(FONT_FAMILY, opts.style);
  ctx.pdf.setFontSize(opts.fontSize);
  ctx.pdf.setTextColor(opts.color ?? 20);
  const lines = ctx.pdf.splitTextToSize(text, ctx.contentWidth);
  const lineHeight = opts.fontSize * LINE_HEIGHT_RATIO;
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    let x = PAGE_MARGIN_X;
    if (opts.align === 'center') x = ctx.pageWidth / 2;
    if (opts.align === 'right') x = ctx.pageWidth - PAGE_MARGIN_X;
    ctx.pdf.text(line, x, ctx.cursorY + lineHeight - 2, {
      align: opts.align ?? 'left',
    });
    ctx.cursorY += lineHeight;
  }
}

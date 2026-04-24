// Programme Governance — Framework PDF renderers.
//
// Two independent renderers sharing the same jspdf stack:
//   • renderFrameworkDiagram — 1-page landscape A4 tree of the 4-tier
//     canvas. Quick visual share.
//   • renderFrameworkConstitution — multi-page portrait A4 formal document
//     suitable for appending to the Council Constitution.
//
// Both render with Helvetica (metric-equivalent to Arial — full Arial TTF
// embed is still deferred to the Phase 13 polish pass).

import { jsPDF } from 'jspdf';

export type BodyTier = 'political' | 'corporate' | 'programme' | 'project';

export interface FrameworkBodyForPdf {
  id: string;
  tier: BodyTier;
  name: string;
  cadence: string;
  chair: string;
  authority: string;
  acceptedReportTypes?: string[];
  standingItems?: string[];
  cabinetMemberPortfolio?: string;
}

export interface FrameworkThresholdForPdf {
  id: string;
  bandLabel: string;
  bandMin: number | null;
  bandMax: number | null;
  decisionRoute: string;
  reportTypes?: string[];
  notes?: string;
}

export interface FrameworkTorForPdf {
  ownerBodyId: string;
  version: number;
  publishedAt?: string;
  purpose?: string;
  scope?: string;
  authorityLevel?: string;
  decisionRights?: string;
  operatingPrinciples?: string;
}

export interface FrameworkPdfInput {
  councilName: string;
  version: number;
  publishedAt?: string;
  councilLogoDataUri?: string | null;
  bodies: FrameworkBodyForPdf[];
  thresholds: FrameworkThresholdForPdf[];
  tors: Record<string, FrameworkTorForPdf>;
}

// Tier visual palette — same scheme as the UI (no violet, per §21).
// [fill, text] in jspdf RGB 0-255.
const TIER_COLOURS: Record<BodyTier, { fill: [number, number, number]; text: [number, number, number] }> = {
  political: { fill: [254, 243, 199], text: [146, 64, 14] },    // amber-100 / amber-900
  corporate: { fill: [224, 231, 255], text: [55, 48, 163] },    // indigo-100 / indigo-900
  programme: { fill: [209, 250, 229], text: [6, 78, 59] },       // emerald-100 / emerald-900
  project:   { fill: [241, 245, 249], text: [15, 23, 42] },      // slate-100 / slate-900
};

const TIER_LABEL: Record<BodyTier, string> = {
  political: 'Political',
  corporate: 'Corporate',
  programme: 'Programme',
  project:   'Project',
};

const TIER_ORDER: BodyTier[] = ['political', 'corporate', 'programme', 'project'];

const FONT = 'helvetica';

// ── Diagram renderer ──────────────────────────────────────────────────────

export function renderFrameworkDiagram(input: FrameworkPdfInput): Buffer {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 36;
  const marginTop = 32;

  // Logo — top centre, resilient if missing.
  let cursorY = marginTop;
  if (input.councilLogoDataUri) {
    try {
      const w = 90;
      const h = 40;
      pdf.addImage(input.councilLogoDataUri, 'PNG', (pageWidth - w) / 2, cursorY, w, h, undefined, 'FAST');
      cursorY += h + 8;
    } catch (e) {
      console.warn('[frameworkPdfRenderer] logo render failed:', e);
    }
  }

  // Title
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Governance framework', pageWidth / 2, cursorY + 14, { align: 'center' });
  cursorY += 22;

  // Subtitle
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  const pubLabel = input.publishedAt
    ? `Version ${input.version} · published ${formatDate(input.publishedAt)}`
    : `Version ${input.version}`;
  pdf.text(`${input.councilName} · ${pubLabel}`, pageWidth / 2, cursorY + 12, { align: 'center' });
  cursorY += 24;

  // Tier rows
  const tierLabelWidth = 80;
  const contentWidth = pageWidth - marginX * 2 - tierLabelWidth;
  const contentStartX = marginX + tierLabelWidth;
  const footerReserve = 36;
  const rowsAvail = pageHeight - cursorY - footerReserve;
  const rowHeight = rowsAvail / TIER_ORDER.length;

  TIER_ORDER.forEach((tier, i) => {
    const y = cursorY + i * rowHeight;
    const rowCentreY = y + rowHeight / 2;
    const tierStyle = TIER_COLOURS[tier];
    const tierBodies = input.bodies.filter((b) => b.tier === tier);

    // Tier label
    pdf.setFont(FONT, 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...tierStyle.text);
    pdf.text(TIER_LABEL[tier], marginX, rowCentreY - 6);
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`${tierBodies.length} ${tierBodies.length === 1 ? 'body' : 'bodies'}`, marginX, rowCentreY + 6);

    // Divider
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(marginX, y + rowHeight, pageWidth - marginX, y + rowHeight);

    // Bodies — flex-grid layout, wrapping if too many per row
    if (tierBodies.length > 0) {
      const perRow = Math.min(tierBodies.length, Math.max(3, Math.floor(contentWidth / 130)));
      const cellW = contentWidth / perRow - 6;
      const visibleRows = Math.ceil(tierBodies.length / perRow);
      const cellH = Math.min(34, (rowHeight - 12) / visibleRows);

      tierBodies.forEach((body, idx) => {
        const col = idx % perRow;
        const row = Math.floor(idx / perRow);
        const cellX = contentStartX + col * (cellW + 6);
        const cellY = y + 6 + row * (cellH + 4);

        pdf.setFillColor(...tierStyle.fill);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(cellX, cellY, cellW, cellH, 4, 4, 'FD');
        pdf.setFont(FONT, 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(...tierStyle.text);
        const nameLines = pdf.splitTextToSize(body.name, cellW - 8);
        pdf.text(nameLines.slice(0, 2), cellX + 5, cellY + 12);
        pdf.setFont(FONT, 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100);
        const sub = body.cadence || body.chair || '';
        if (sub) pdf.text(sub.slice(0, 40), cellX + 5, cellY + cellH - 5);
      });
    } else {
      pdf.setFont(FONT, 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(180);
      pdf.text('— no bodies in this tier —', contentStartX, rowCentreY);
    }
  });

  // Legend footer
  const legendY = pageHeight - 22;
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(120);
  let legendX = marginX;
  TIER_ORDER.forEach((t) => {
    const c = TIER_COLOURS[t];
    pdf.setFillColor(...c.fill);
    pdf.roundedRect(legendX, legendY - 7, 10, 10, 2, 2, 'F');
    pdf.text(TIER_LABEL[t], legendX + 14, legendY);
    legendX += 70;
  });
  pdf.text(
    `Generated ${new Date().toLocaleString('en-GB')}`,
    pageWidth - marginX,
    legendY,
    { align: 'right' },
  );

  const arrayBuffer = pdf.output('arraybuffer');
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// ── Constitution renderer ─────────────────────────────────────────────────

export function renderFrameworkConstitution(input: FrameworkPdfInput): Buffer {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 56;
  const marginTop = 56;
  const marginBottom = 56;
  const contentWidth = pageWidth - marginX * 2;

  // ── Cover page
  if (input.councilLogoDataUri) {
    try {
      const w = 140;
      const h = 70;
      pdf.addImage(input.councilLogoDataUri, 'PNG', (pageWidth - w) / 2, 180, w, h, undefined, 'FAST');
    } catch (e) {
      console.warn('[frameworkPdfRenderer] logo render failed:', e);
    }
  }
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Governance framework', pageWidth / 2, 310, { align: 'center' });
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(14);
  pdf.setTextColor(80);
  pdf.text(input.councilName, pageWidth / 2, 336, { align: 'center' });
  pdf.setFontSize(11);
  pdf.setTextColor(120);
  pdf.text(`Version ${input.version}`, pageWidth / 2, 364, { align: 'center' });
  if (input.publishedAt) {
    pdf.text(`Published ${formatDate(input.publishedAt)}`, pageWidth / 2, 380, { align: 'center' });
  }
  pdf.setFontSize(9);
  pdf.setTextColor(150);
  pdf.text(
    'For appending to the Council Constitution',
    pageWidth / 2,
    pageHeight - marginBottom,
    { align: 'center' },
  );

  // ── Authority thresholds page
  pdf.addPage();
  let y = marginTop;
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Authority thresholds', marginX, y);
  y += 20;
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(
    'Decision route by project value. Drives template auto-pick and key-decision flagging.',
    marginX,
    y,
  );
  y += 20;

  const thresholdCols = [
    { label: 'Band', width: 120 },
    { label: 'Range', width: 100 },
    { label: 'Decision route', width: 180 },
    { label: 'Report types', width: 143 },
  ];
  // Header row
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(marginX, y, contentWidth, 20, 'FD');
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(80);
  let x = marginX;
  for (const col of thresholdCols) {
    pdf.text(col.label.toUpperCase(), x + 6, y + 13);
    x += col.width;
  }
  y += 20;

  // Sort bands: HRB-style (both null) last, otherwise by lower bound.
  const sortedThresholds = [...input.thresholds].sort((a, b) => {
    const aOpen = a.bandMin == null && a.bandMax == null ? 1 : 0;
    const bOpen = b.bandMin == null && b.bandMax == null ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return (a.bandMin ?? 0) - (b.bandMin ?? 0);
  });

  for (const band of sortedThresholds) {
    const rangeText = formatBand(band);
    const reportTypesText = (band.reportTypes ?? []).join(', ');
    const rowCells = [band.bandLabel, rangeText, band.decisionRoute, reportTypesText];

    // Pre-compute wrap heights per cell so row grows to fit the tallest.
    const wrappedCells = rowCells.map((text, i) =>
      pdf.splitTextToSize(text || '—', thresholdCols[i].width - 12),
    );
    const cellHeight = Math.max(22, Math.max(...wrappedCells.map((w) => w.length)) * 11 + 8);

    if (y + cellHeight > pageHeight - marginBottom) {
      pdf.addPage();
      y = marginTop;
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(marginX, y, contentWidth, cellHeight);
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(20);
    x = marginX;
    wrappedCells.forEach((lines, i) => {
      pdf.text(lines, x + 6, y + 13);
      x += thresholdCols[i].width;
    });
    y += cellHeight;

    if (band.notes) {
      const noteLines = pdf.splitTextToSize(`Note: ${band.notes}`, contentWidth - 12);
      const noteHeight = noteLines.length * 10 + 6;
      if (y + noteHeight > pageHeight - marginBottom) {
        pdf.addPage();
        y = marginTop;
      }
      pdf.setFillColor(248, 250, 252);
      pdf.rect(marginX, y, contentWidth, noteHeight, 'F');
      pdf.setFont(FONT, 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(90);
      pdf.text(noteLines, marginX + 6, y + 11);
      y += noteHeight;
    }
  }

  // ── Per-body pages, grouped by tier
  for (const tier of TIER_ORDER) {
    const tierBodies = input.bodies.filter((b) => b.tier === tier);
    if (tierBodies.length === 0) continue;

    pdf.addPage();
    y = marginTop;
    const tierStyle = TIER_COLOURS[tier];
    pdf.setFillColor(...tierStyle.fill);
    pdf.rect(marginX, y, contentWidth, 28, 'F');
    pdf.setFont(FONT, 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...tierStyle.text);
    pdf.text(`${TIER_LABEL[tier]} tier`, marginX + 10, y + 18);
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(9);
    pdf.text(
      `${tierBodies.length} ${tierBodies.length === 1 ? 'body' : 'bodies'}`,
      pageWidth - marginX - 10,
      y + 18,
      { align: 'right' },
    );
    y += 40;

    for (const body of tierBodies) {
      // Ensure minimum room for the body block; otherwise break page.
      if (y + 60 > pageHeight - marginBottom) {
        pdf.addPage();
        y = marginTop;
      }
      // Body name
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(15, 23, 42);
      const nameLines = pdf.splitTextToSize(body.name, contentWidth);
      pdf.text(nameLines, marginX, y + 12);
      y += nameLines.length * 14 + 4;

      // Meta line
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      const metaParts = [
        body.cadence && `Cadence: ${body.cadence}`,
        body.chair && `Chair: ${body.chair}`,
        body.cabinetMemberPortfolio && `Portfolio: ${body.cabinetMemberPortfolio}`,
      ].filter(Boolean) as string[];
      if (metaParts.length > 0) {
        const metaLines = pdf.splitTextToSize(metaParts.join('  ·  '), contentWidth);
        pdf.text(metaLines, marginX, y + 10);
        y += metaLines.length * 11 + 4;
      }

      // Authority
      if (body.authority) {
        y = drawLabeledBlock(pdf, 'Authority', body.authority, marginX, y, contentWidth, pageHeight, marginTop, marginBottom);
      }
      // Accepted types
      if (body.acceptedReportTypes && body.acceptedReportTypes.length > 0) {
        y = drawLabeledBlock(
          pdf,
          'Accepted report types',
          body.acceptedReportTypes.join(', '),
          marginX,
          y,
          contentWidth,
          pageHeight,
          marginTop,
          marginBottom,
        );
      }
      // Standing items
      if (body.standingItems && body.standingItems.length > 0) {
        y = drawLabeledBlock(
          pdf,
          'Standing items',
          body.standingItems.map((s) => `• ${s}`).join('\n'),
          marginX,
          y,
          contentWidth,
          pageHeight,
          marginTop,
          marginBottom,
        );
      }

      // ToR — if published exists for this body
      const tor = input.tors[body.id];
      if (tor) {
        if (y + 40 > pageHeight - marginBottom) {
          pdf.addPage();
          y = marginTop;
        }
        pdf.setFont(FONT, 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(55, 48, 163); // indigo-900
        pdf.text(
          `Terms of Reference · v${tor.version}${tor.publishedAt ? ` · published ${formatDate(tor.publishedAt)}` : ''}`,
          marginX,
          y + 10,
        );
        y += 18;
        const torFields: Array<[string, string | undefined]> = [
          ['Purpose', tor.purpose],
          ['Scope', tor.scope],
          ['Authority level', tor.authorityLevel],
          ['Decision rights', tor.decisionRights],
          ['Operating principles', tor.operatingPrinciples],
        ];
        for (const [label, value] of torFields) {
          if (value && value.trim()) {
            y = drawLabeledBlock(pdf, label, value, marginX, y, contentWidth, pageHeight, marginTop, marginBottom);
          }
        }
      } else {
        pdf.setFont(FONT, 'italic');
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text('Terms of Reference: not yet published for this body.', marginX, y + 10);
        y += 18;
      }

      // Spacer between bodies
      y += 18;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 12;
    }
  }

  // ── Page numbers
  const pageCount = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: 'center' },
    );
  }

  const arrayBuffer = pdf.output('arraybuffer');
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function drawLabeledBlock(
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  startY: number,
  width: number,
  pageHeight: number,
  marginTop: number,
  marginBottom: number,
): number {
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  const labelText = label.toUpperCase();
  if (startY + 24 > pageHeight - marginBottom) {
    pdf.addPage();
    startY = marginTop;
  }
  pdf.text(labelText, x, startY + 9);

  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(30);
  const lines = pdf.splitTextToSize(value, width);
  let y = startY + 20;
  const lineHeight = 13;
  for (const line of lines) {
    if (y + lineHeight > pageHeight - marginBottom) {
      pdf.addPage();
      y = marginTop;
    }
    pdf.text(line, x, y);
    y += lineHeight;
  }
  return y + 6;
}

function formatBand(t: FrameworkThresholdForPdf): string {
  if (t.bandMin == null && t.bandMax == null) return 'Any value';
  if (t.bandMin == null) return `Up to £${(t.bandMax as number).toLocaleString()}`;
  if (t.bandMax == null) return `Over £${t.bandMin.toLocaleString()}`;
  return `£${t.bandMin.toLocaleString()} – £${t.bandMax.toLocaleString()}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

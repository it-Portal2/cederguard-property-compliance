// Phase 7 — Compliance pack PDF renderer.
//
// Hand-rolls a structured A4 PDF with jspdf (already in stack — same dep
// `pdfRenderer.ts` uses for the report renderer). NOT a Tiptap walker —
// the compliance pack is a fixed-layout document (cover · checks ·
// citations · footer). Auto-paginates when content overflows.

import { jsPDF } from "jspdf";
import type {
  InsightSummary,
  InsightComplianceCheck,
} from "./tacInsightGenerator.js";

interface CompliancePackInput {
  enquiry: {
    id: string;
    title: string;
    ribaStage: string;
    query: string;
    projectName?: string;
    isHRB?: boolean;
  };
  summary: InsightSummary;
  generatedAt: string;
}

const PAGE_WIDTH = 595; // A4 portrait pt
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;

const COLOUR_INDIGO: [number, number, number] = [79, 70, 229];
const COLOUR_SLATE_900: [number, number, number] = [15, 23, 42];
const COLOUR_SLATE_700: [number, number, number] = [51, 65, 85];
const COLOUR_SLATE_500: [number, number, number] = [100, 116, 139];
const COLOUR_SLATE_400: [number, number, number] = [148, 163, 184];
const COLOUR_SLATE_200: [number, number, number] = [226, 232, 240];
const COLOUR_EMERALD: [number, number, number] = [5, 150, 105];
const COLOUR_AMBER: [number, number, number] = [217, 119, 6];
const COLOUR_ROSE: [number, number, number] = [225, 29, 72];

function statusColour(status: InsightComplianceCheck["status"]) {
  if (status === "pass") return COLOUR_EMERALD;
  if (status === "warn") return COLOUR_AMBER;
  return COLOUR_ROSE;
}

function statusLabel(status: InsightComplianceCheck["status"]): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

function categoriseCheck(c: InsightComplianceCheck): "dimensional" | "system" {
  if (c.category) return c.category;
  const blob = `${c.check} ${c.evidence ?? ""}`.toLowerCase();
  if (
    /\b(mm|metre|m\b|m2|m\^2|width|height|tread|rise|clearance|span|fall|gradient|lux|db|kn|head\b)/.test(
      blob,
    )
  ) {
    return "dimensional";
  }
  return "system";
}

export function renderCompliancePackPdf(input: CompliancePackInput): Buffer {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  pdf.setFont("helvetica", "normal");

  let cursorY = MARGIN_TOP;
  let pageNum = 1;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
      drawFooter();
      pdf.addPage();
      pageNum++;
      cursorY = MARGIN_TOP;
    }
  };

  const drawFooter = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOUR_SLATE_400);
    pdf.text(
      `CedarGuard · Technical Assurance · Page ${pageNum}`,
      MARGIN_X,
      PAGE_HEIGHT - 28,
    );
    pdf.text(
      `Generated ${new Date(input.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
      PAGE_WIDTH - MARGIN_X,
      PAGE_HEIGHT - 28,
      { align: "right" },
    );
  };

  // ── Cover header ──────────────────────────────────────────────────────
  pdf.setFillColor(...COLOUR_INDIGO);
  pdf.rect(MARGIN_X, cursorY, 4, 56, "F");
  pdf.setTextColor(...COLOUR_INDIGO);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("COMPLIANCE PACK", MARGIN_X + 16, cursorY + 12);
  pdf.setTextColor(...COLOUR_SLATE_900);
  pdf.setFontSize(20);
  const titleLines = pdf.splitTextToSize(
    input.enquiry.title || "Untitled enquiry",
    PAGE_WIDTH - MARGIN_X * 2 - 16,
  );
  pdf.text(titleLines, MARGIN_X + 16, cursorY + 32);
  cursorY += 32 + titleLines.length * 22 + 8;

  // Meta row
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLOUR_SLATE_500);
  const metaParts = [
    input.enquiry.projectName
      ? `Project: ${input.enquiry.projectName}`
      : null,
    `Stage: ${input.enquiry.ribaStage}`,
    input.enquiry.isHRB ? "HRB" : null,
  ].filter(Boolean);
  pdf.text(metaParts.join("  ·  "), MARGIN_X + 16, cursorY);
  cursorY += 22;

  // Lede
  if (input.summary.lede) {
    pdf.setTextColor(...COLOUR_SLATE_700);
    pdf.setFontSize(11);
    const ledeLines = pdf.splitTextToSize(
      input.summary.lede,
      PAGE_WIDTH - MARGIN_X * 2 - 16,
    );
    pdf.text(ledeLines, MARGIN_X + 16, cursorY);
    cursorY += ledeLines.length * 14 + 14;
  }

  // Divider
  pdf.setDrawColor(...COLOUR_SLATE_200);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
  cursorY += 16;

  // ── Compliance checks (split into dimensional + system) ───────────────
  const dimChecks: InsightComplianceCheck[] = [];
  const sysChecks: InsightComplianceCheck[] = [];
  for (const c of input.summary.complianceSnapshot ?? []) {
    if (categoriseCheck(c) === "dimensional") dimChecks.push(c);
    else sysChecks.push(c);
  }

  const drawSection = (
    title: string,
    items: InsightComplianceCheck[],
  ) => {
    ensureSpace(28);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLOUR_SLATE_900);
    pdf.text(title, MARGIN_X, cursorY);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLOUR_SLATE_500);
    pdf.text(`${items.length} items`, PAGE_WIDTH - MARGIN_X, cursorY, {
      align: "right",
    });
    cursorY += 14;

    if (items.length === 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOUR_SLATE_400);
      pdf.text("No checks in this category.", MARGIN_X, cursorY);
      cursorY += 18;
      return;
    }

    for (const c of items) {
      const checkLines = pdf.splitTextToSize(
        c.check,
        PAGE_WIDTH - MARGIN_X * 2 - 64,
      );
      const evidenceLines = c.evidence
        ? pdf.splitTextToSize(
            c.evidence,
            PAGE_WIDTH - MARGIN_X * 2 - 16,
          )
        : [];
      const blockHeight =
        14 + checkLines.length * 12 + evidenceLines.length * 11 + 10;
      ensureSpace(blockHeight);

      // Status pill
      const [r, g, b] = statusColour(c.status);
      pdf.setFillColor(r, g, b);
      pdf.roundedRect(MARGIN_X, cursorY, 44, 14, 3, 3, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(statusLabel(c.status), MARGIN_X + 22, cursorY + 9.5, {
        align: "center",
      });

      // Check title
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLOUR_SLATE_900);
      pdf.text(checkLines, MARGIN_X + 56, cursorY + 10);
      let blockCursor = cursorY + 10 + checkLines.length * 11;

      if (c.regId) {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...COLOUR_INDIGO);
        pdf.text(`[${c.regId}]`, MARGIN_X + 56, blockCursor);
        blockCursor += 11;
      }
      if (evidenceLines.length > 0) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...COLOUR_SLATE_500);
        pdf.text(evidenceLines, MARGIN_X + 56, blockCursor);
        blockCursor += evidenceLines.length * 11;
      }

      cursorY = blockCursor + 8;
    }
    cursorY += 6;
  };

  drawSection("Dimensional checks", dimChecks);
  drawSection("System checks", sysChecks);

  // ── Citations ─────────────────────────────────────────────────────────
  const citations = input.summary.citations ?? [];
  if (citations.length > 0) {
    ensureSpace(28);
    pdf.setDrawColor(...COLOUR_SLATE_200);
    pdf.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
    cursorY += 16;

    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLOUR_SLATE_900);
    pdf.text("Cited regulations", MARGIN_X, cursorY);
    cursorY += 18;

    for (const c of citations) {
      const appliedLines = pdf.splitTextToSize(
        c.appliedTo || "",
        PAGE_WIDTH - MARGIN_X * 2 - 16,
      );
      const quoteLines = c.quote
        ? pdf.splitTextToSize(
            `“${c.quote}”`,
            PAGE_WIDTH - MARGIN_X * 2 - 16,
          )
        : [];
      const blockHeight =
        14 + appliedLines.length * 12 + quoteLines.length * 12 + 14;
      ensureSpace(blockHeight);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLOUR_INDIGO);
      pdf.text(c.regId, MARGIN_X, cursorY);
      cursorY += 12;

      if (appliedLines.length > 0) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...COLOUR_SLATE_700);
        pdf.text(appliedLines, MARGIN_X, cursorY);
        cursorY += appliedLines.length * 12;
      }
      if (quoteLines.length > 0) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(...COLOUR_SLATE_500);
        pdf.text(quoteLines, MARGIN_X, cursorY);
        cursorY += quoteLines.length * 12;
      }
      cursorY += 10;
    }
  }

  // ── Honesty footer on the LAST page ───────────────────────────────────
  ensureSpace(60);
  pdf.setDrawColor(...COLOUR_SLATE_200);
  pdf.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
  cursorY += 14;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...COLOUR_SLATE_500);
  const disclaimer = pdf.splitTextToSize(
    "Compliance checks generated by CedarGuard Technical Assurance from the live regulations corpus. Augments professional judgement; does not replace it. Cross-check against the source regulations before issuing for tender or board approval. For HRB projects, this pack should be filed alongside the BSA Gateway 2 / 3 submission.",
    PAGE_WIDTH - MARGIN_X * 2,
  );
  pdf.text(disclaimer, MARGIN_X, cursorY);

  drawFooter();

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function compliancePackFilename(enquiryId: string): string {
  return `compliance-${String(enquiryId).slice(0, 24)}.pdf`;
}

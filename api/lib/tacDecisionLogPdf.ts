// Phase 9 — Decision log PDF renderer.
//
// Per-project chronological PDF of every Closed enquiry. Same hand-rolled
// jspdf approach as Phase 7's compliance pack — fixed-layout document with
// auto-pagination. Suitable for BSA Gateway 2 / 3 submission packs on HRB
// projects.

import { jsPDF } from "jspdf";

interface DecisionLogEnquiry {
  id: string;
  title: string;
  ribaStage: string;
  closedAt: string;
  lede: string;
  recommendedOption: string;
  citationCount: number;
}

interface DecisionLogInput {
  project: { id: string; name: string; isHRB: boolean };
  enquiries: DecisionLogEnquiry[];
  generatedAt: string;
}

const PAGE_WIDTH = 595;
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
const COLOUR_ROSE: [number, number, number] = [225, 29, 72];

export function renderDecisionLogPdf(input: DecisionLogInput): Buffer {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  pdf.setFont("helvetica", "normal");

  let cursorY = MARGIN_TOP;
  let pageNum = 1;

  const drawFooter = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOUR_SLATE_400);
    pdf.text(
      `CedarGuard · Technical Assurance · Decision Log · Page ${pageNum}`,
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

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
      drawFooter();
      pdf.addPage();
      pageNum++;
      cursorY = MARGIN_TOP;
    }
  };

  // ── Cover ─────────────────────────────────────────────────────────────
  pdf.setFillColor(...COLOUR_INDIGO);
  pdf.rect(MARGIN_X, cursorY, 4, 64, "F");
  pdf.setTextColor(...COLOUR_INDIGO);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("DECISION LOG", MARGIN_X + 16, cursorY + 12);
  pdf.setTextColor(...COLOUR_SLATE_900);
  pdf.setFontSize(22);
  const titleLines = pdf.splitTextToSize(
    input.project.name || "Untitled project",
    PAGE_WIDTH - MARGIN_X * 2 - 16,
  );
  pdf.text(titleLines, MARGIN_X + 16, cursorY + 34);
  cursorY += 34 + titleLines.length * 24 + 8;

  // HRB pill
  if (input.project.isHRB) {
    pdf.setFillColor(...COLOUR_ROSE);
    pdf.roundedRect(MARGIN_X + 16, cursorY, 80, 18, 4, 4, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("HRB · BSR scope", MARGIN_X + 16 + 40, cursorY + 12.5, {
      align: "center",
    });
    cursorY += 28;
  }

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLOUR_SLATE_500);
  pdf.text(
    `${input.enquiries.length} closed enquiry${input.enquiries.length === 1 ? "" : " entries"} on this project.`,
    MARGIN_X + 16,
    cursorY,
  );
  cursorY += 22;

  // BSA Gateway references for HRB
  if (input.project.isHRB) {
    pdf.setTextColor(...COLOUR_SLATE_700);
    pdf.setFontSize(10);
    const bsaText = pdf.splitTextToSize(
      "This decision log forms part of the Building Safety Act 2022 audit chain. Each closed enquiry is preserved in the Golden Thread WORM ledger and is suitable for inclusion in BSA Gateway 2 (design) and Gateway 3 (completion) submission packs to the Building Safety Regulator.",
      PAGE_WIDTH - MARGIN_X * 2 - 16,
    );
    pdf.text(bsaText, MARGIN_X + 16, cursorY);
    cursorY += bsaText.length * 14 + 14;
  }

  pdf.setDrawColor(...COLOUR_SLATE_200);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
  cursorY += 18;

  // ── Per-enquiry sections ──────────────────────────────────────────────
  if (input.enquiries.length === 0) {
    pdf.setFontSize(11);
    pdf.setTextColor(...COLOUR_SLATE_400);
    pdf.text(
      "No closed enquiries on this project yet.",
      MARGIN_X,
      cursorY,
    );
    cursorY += 18;
  } else {
    input.enquiries.forEach((entry, idx) => {
      const headerHeight = 24;
      const titleLines = pdf.splitTextToSize(
        `${idx + 1}. ${entry.title || "(Untitled enquiry)"}`,
        PAGE_WIDTH - MARGIN_X * 2,
      );
      const ledeLines = entry.lede
        ? pdf.splitTextToSize(entry.lede, PAGE_WIDTH - MARGIN_X * 2)
        : [];
      const recOptLines = entry.recommendedOption
        ? pdf.splitTextToSize(
            `Recommended: ${entry.recommendedOption}`,
            PAGE_WIDTH - MARGIN_X * 2,
          )
        : [];
      const blockHeight =
        headerHeight +
        titleLines.length * 16 +
        ledeLines.length * 13 +
        recOptLines.length * 13 +
        28;
      ensureSpace(blockHeight);

      // Stage + closed date chips
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLOUR_INDIGO);
      pdf.text(
        `${entry.ribaStage}  ·  Closed ${entry.closedAt ? new Date(entry.closedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}  ·  ${entry.citationCount} citation${entry.citationCount === 1 ? "" : "s"}`,
        MARGIN_X,
        cursorY,
      );
      cursorY += 14;

      // Title
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLOUR_SLATE_900);
      pdf.text(titleLines, MARGIN_X, cursorY);
      cursorY += titleLines.length * 16;

      // Lede
      if (ledeLines.length > 0) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...COLOUR_SLATE_700);
        pdf.text(ledeLines, MARGIN_X, cursorY + 4);
        cursorY += 4 + ledeLines.length * 13;
      }

      // Recommended option
      if (recOptLines.length > 0) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(...COLOUR_SLATE_500);
        pdf.text(recOptLines, MARGIN_X, cursorY + 4);
        cursorY += 4 + recOptLines.length * 13;
      }

      // Reference id
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...COLOUR_SLATE_400);
      pdf.text(`Ref: ${entry.id}`, MARGIN_X, cursorY + 8);
      cursorY += 18;

      // Divider
      pdf.setDrawColor(...COLOUR_SLATE_200);
      pdf.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
      cursorY += 12;
    });
  }

  // ── Footer disclaimer ────────────────────────────────────────────────
  ensureSpace(56);
  pdf.setDrawColor(...COLOUR_SLATE_200);
  pdf.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
  cursorY += 14;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...COLOUR_SLATE_500);
  const disclaimer = pdf.splitTextToSize(
    "Each entry summarises an AI-generated technical assurance insight reviewed and closed by the project manager. Augments professional judgement; does not replace it. Cross-check the cited source regulations directly before relying on this log for tender, board, or BSR submission.",
    PAGE_WIDTH - MARGIN_X * 2,
  );
  pdf.text(disclaimer, MARGIN_X, cursorY);

  drawFooter();

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function decisionLogFilename(projectId: string): string {
  return `decision-log-${String(projectId).slice(0, 32)}.pdf`;
}

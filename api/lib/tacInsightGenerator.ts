// Technical Assurance Companion — insight orchestration helpers (Phase 2).
//
// The actual Gemini call is delegated to the existing repo-wide route
// `aiRoutes.geminiPrompt` in `api/routes/ai.ts` so all AI traffic benefits
// from the same dual-key + dual-model + retry rotation. This module only
// owns:
//   1. Prompt building (stage-aware per PRD US-2.1).
//   2. Server-side validation of the AI response (≥1 corpus-resolvable
//      citation per PRD US-2.2).
//   3. Persistence of the Summary deliverable to
//      `enquiries/{docId}/tabs/summary` + status flips.
//
// Pipeline split across two server endpoints:
//   - tacBuildInsightPrompt(enquiryId) → flips Draft → Generating, returns
//     the prompt for the client to send through `aiRoutes.geminiPrompt`.
//   - tacFinaliseInsight(enquiryId, summary) → validates the AI response
//     and either writes the deliverable + flips Generating → Open, or
//     rolls status back to Draft on validation failure.

import type { ApiContext } from "./context.js";
import {
  loadRegulationsCorpus,
  seedRegulationsCorpusIfMissing,
  type RegulationCorpusEntry,
} from "./regulationsCorpusSeed.js";

// --- Types -----------------------------------------------------------------

export interface InsightCitation {
  regId: string;
  /** Human-readable rationale for why this citation applies. */
  appliedTo: string;
  /** Verbatim quote excerpt (≤300 chars) from the corpus entry. */
  quote: string;
}

export interface InsightOption {
  id: string;
  label: string;
  summary: string;
  compliance: "compliant" | "borderline" | "non-compliant";
  costDelta: number;
  programmeDelta: number;
  rationale: string;
  /** Server marks the recommended one — first compliant + lowest cost+prog. */
  recommended?: boolean;
}

export interface InsightDrawingAnnotation {
  id: string;
  /** Display number ("1", "2", …) the AI assigns; clients render in this order. */
  number: string;
  label: string;
  page: number;
  dimension?: string;
  note?: string;
  severity: "info" | "warning" | "critical";
  regId?: string;
}

export interface InsightDrawing {
  basePdfPath?: string;
  basePdfUrl?: string;
  basePdfFileName?: string;
  annotations: InsightDrawingAnnotation[];
  summaryNote?: string;
}

export interface InsightRfiWalkthroughChapter {
  id: string;
  number: string;
  caption: string;
  description: string;
}

export interface InsightRfi {
  rfiNumber: string;
  status: "Draft" | "Issued" | "Responded" | "Closed";
  subject: string;
  body: string;
  priority: "high" | "medium" | "low";
  recipients: Array<{
    uid?: string;
    email: string;
    name?: string;
    role?: string;
  }>;
  walkthroughChapters?: InsightRfiWalkthroughChapter[];
  issuedAt?: string;
  issuedBy?: string;
}

export interface InsightSummary {
  /** Stage-prefixed lede shown at the top of the Summary tab. */
  lede: string;
  options: InsightOption[];
  citations: InsightCitation[];
  complianceSnapshot: Array<{
    check: string;
    status: "pass" | "warn" | "fail";
  }>;
  nextActions: string[];
  /** Drawing tab content. Populated only when the enquiry has a PDF
   *  attachment; otherwise the AI is told to omit the field. */
  drawing?: InsightDrawing;
  /** RFI tab content. Auto-populated from the same generation; the user
   *  edits it on the RFI tab and presses Issue to commit a numbered RFI. */
  rfi?: InsightRfi;
}

// --- Stage-aware prompt branching -----------------------------------------

const STAGE_GUIDANCE: Record<string, string> = {
  S0: "Stage 0 (Strategic Definition) — frame the answer around feasibility, business case alignment and high-level risk identification. No detailed specifications.",
  S1: "Stage 1 (Preparation & Briefing) — prioritise project brief implications, site constraints and statutory obligations.",
  S2: "Stage 2 (Concept Design) — feasibility and optioneering language. Compare 2-4 design options. Highlight which option each regulation rules in or out.",
  S3: "Stage 2/3 framing — moving from concept to spatial coordination. Identify clashes, system interfaces and statutory submissions due.",
  S4: "Stage 4 (Technical Design) — specification-ready clause language. Quote exact regulation clauses verbatim. Include drawing references where the response is geometric.",
  S5: "Stage 5 (Manufacturing & Construction) — sequencing, method statement, site-risk framing. Reference inspection regimes and Gateway 3 readiness for HRBs.",
  S6: "Stage 6 (Handover) — handover documentation, asset information requirements, Golden Thread completeness for HRBs.",
  S7: "Stage 7 (Use) — in-use safety, RSH consumer-standards alignment, hazard-response timescales (Awaab's Law).",
};

function getStageGuidance(stage: string): string {
  return (
    STAGE_GUIDANCE[stage] ??
    "Provide a balanced response covering feasibility, design implications and statutory compliance."
  );
}

function summariseCorpus(corpus: RegulationCorpusEntry[]): string {
  if (corpus.length === 0) {
    return "(corpus is empty — generation should fail with INSUFFICIENT_CITATIONS)";
  }
  return corpus
    .map(
      (c) =>
        `- regId: ${c.regId}\n  Document: ${c.documentLabel}\n  Clause: ${c.clause}\n  Text: ${c.text}\n  Applies to: ${(c.appliesTo ?? []).join(", ")}\n  RIBA stages: ${(c.ribaRelevance ?? []).join(", ")}`,
    )
    .join("\n\n");
}

function summariseAttachments(attachments: any[]): string {
  if (!attachments || attachments.length === 0) {
    return "(no attachments)";
  }
  return attachments
    .map(
      (a, idx) =>
        `${idx + 1}. ${a.fileName} (${a.mimeType}, ${(a.fileSize / 1024 / 1024).toFixed(1)} MB) — scan: ${a.avScanStatus}`,
    )
    .join("\n");
}

/** Picks the first PDF attachment as the source drawing for the Drawing tab.
 *  Phase 4 MVP — single drawing per enquiry. Multi-drawing support deferred. */
function pickPrimaryDrawing(attachments: any[]):
  | { fileName: string; storagePath: string; url?: string }
  | null {
  if (!Array.isArray(attachments)) return null;
  const pdf = attachments.find(
    (a) =>
      a?.mimeType === "application/pdf" ||
      String(a?.fileName ?? "").toLowerCase().endsWith(".pdf"),
  );
  if (!pdf) return null;
  return {
    fileName: String(pdf.fileName ?? "drawing.pdf"),
    storagePath: String(pdf.storagePath ?? ""),
    url: pdf.url ? String(pdf.url) : undefined,
  };
}

function buildInsightPrompt(args: {
  query: string;
  title: string;
  ribaStage: string;
  attachments: any[];
  corpus: RegulationCorpusEntry[];
  projectName: string;
}): string {
  const { query, title, ribaStage, attachments, corpus, projectName } = args;
  const primaryDrawing = pickPrimaryDrawing(attachments);
  const drawingBlock = primaryDrawing
    ? `\n\nDrawing in scope: ${primaryDrawing.fileName} (annotate this PDF in the \`drawing\` block — at least 3 numbered callouts).`
    : `\n\nNo PDF drawing is attached — set \`drawing\` to null in the response.`;
  return `You are CedarGuard's Technical Assurance Companion — a chartered-grade construction technical advisor for UK social-housing programmes. Augment the project manager's professional judgement; you do not replace it.

============================================================
CONTEXT
============================================================
Project: ${projectName || "(unspecified)"}
RIBA stage: ${ribaStage}
${getStageGuidance(ribaStage)}

Enquiry title: ${title}
Enquiry query:
"""
${query || "(no query text provided)"}
"""

Attachments:
${summariseAttachments(attachments)}${drawingBlock}

============================================================
REGULATIONS CORPUS — ONLY CITE FROM THIS LIST
============================================================
You MUST NOT cite any regulation outside this corpus. Every citation must
include a \`regId\` that appears verbatim in this list. Do not invent regIds.
If you cannot find a corpus entry that supports your answer, return an empty
options array — the system will block generation.

${summariseCorpus(corpus)}

============================================================
RESPONSE SHAPE — STRICT JSON ONLY
============================================================
Return a single JSON object with this shape (no markdown, no code fences):

{
  "lede": "Stage {N} · {short stage label}: A 1-2 sentence answer headline.",
  "options": [
    {
      "id": "option-a",
      "label": "Short option name",
      "summary": "1-2 sentences",
      "compliance": "compliant" | "borderline" | "non-compliant",
      "costDelta": 0,
      "programmeDelta": 0,
      "rationale": "Why this option works/doesn't, citing corpus regIds in the prose."
    }
  ],
  "citations": [
    {
      "regId": "must-match-a-corpus-regId",
      "appliedTo": "Short reason this citation applies",
      "quote": "Verbatim ≤300-char excerpt from the corpus entry"
    }
  ],
  "complianceSnapshot": [
    { "check": "Short check name", "status": "pass" | "warn" | "fail" }
  ],
  "nextActions": [ "Imperative bullet 1", "Imperative bullet 2" ],
  "drawing": ${
    primaryDrawing
      ? `{
    "summaryNote": "1-2 sentence framing of what the markup is calling out across the whole drawing.",
    "annotations": [
      {
        "id": "ann-1",
        "number": "1",
        "label": "Short callout title (≤60 chars)",
        "page": 1,
        "dimension": "Optional measurement, e.g. '60mm' or '1.2m'",
        "note": "1-2 sentence explanation",
        "severity": "info" | "warning" | "critical",
        "regId": "Optional — link to a corpus regId if the callout cites one"
      }
    ]
  }`
      : "null"
  },
  "rfi": {
    "subject": "Short RFI subject (≤90 chars), prefixed with the project context",
    "body": "Multi-paragraph RFI body addressed to the architect / contractor. Plain text, no markdown. Reference cited regulations by regId in prose.",
    "priority": "high" | "medium" | "low",
    "walkthroughChapters": [
      {
        "id": "ch-1",
        "number": "1",
        "caption": "Setting out the drop (≤80 chars)",
        "description": "1-2 sentences for site teams describing this install / inspection step."
      }
    ]
  }
}

Rules:
1. Return between 10 and 15 options. Include a non-compliant option (if any) so the user sees what's been ruled out.
2. citations.length must be ≥ 1. Every regId must match the corpus.
3. Keep lede ≤ 200 characters. Keep each option summary ≤ 280 characters.
4. NEVER invent regulations or clause numbers. NEVER cite a regId not in the corpus above.
5. NEVER recommend bypassing statutory compliance. If the answer requires a chartered review, say so in nextActions.
6. Use British English. UK construction terminology.${
    primaryDrawing
      ? `
7. drawing.annotations MUST contain ≥ 3 numbered callouts referring to the attached drawing. Use stable "number" values starting at "1". If a callout cites a regulation, set its regId to a corpus regId (must match exactly).`
      : `
7. No PDF drawing is attached — set the "drawing" field to null. Do NOT fabricate annotations.`
  }
8. rfi MUST be populated. subject ≤ 90 chars, body ≥ 60 chars (multi-paragraph). priority must be one of "high" | "medium" | "low" — pick "high" if any compliance check failed or any drawing annotation severity is "critical", otherwise "medium" by default. walkthroughChapters: produce 4-6 numbered install / inspection steps the site team can follow. Captions should be imperative (e.g. "Set out the drop", "Frame the bulkhead"). DO NOT include video URLs — text only (Q11=B locked).

Now return the JSON object.`;
}

// --- Validation ------------------------------------------------------------
//
// MIN / MAX must accept whatever the prompt asks for. The prompt currently
// requests "between 10 and 15 options"; the validator accepts the wider band
// 1-20 so casual prompt edits don't immediately break generation. Citations
// are still hard-gated: ≥1 + every regId must resolve in the corpus.
const MIN_OPTIONS = 1;
const MAX_OPTIONS = 20;

type ValidateOk = { ok: true; insight: InsightSummary };
type ValidateFail = { ok: false; error: string; code: string };
type ValidateResult = ValidateOk | ValidateFail;

export function validateInsight(
  parsed: any,
  corpus: RegulationCorpusEntry[],
): ValidateResult {
  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false as const,
      error: "AI returned a non-object response.",
      code: "BAD_AI_RESPONSE",
    };
  }
  if (typeof parsed.lede !== "string" || parsed.lede.trim() === "") {
    return {
      ok: false as const,
      error: "AI response missing lede.",
      code: "BAD_AI_RESPONSE",
    };
  }
  if (!Array.isArray(parsed.options)) {
    return {
      ok: false as const,
      error: "AI response missing options array.",
      code: "BAD_AI_RESPONSE",
    };
  }
  if (
    parsed.options.length < MIN_OPTIONS ||
    parsed.options.length > MAX_OPTIONS
  ) {
    return {
      ok: false as const,
      error: `Insight must contain ${MIN_OPTIONS}-${MAX_OPTIONS} options (got ${parsed.options.length}).`,
      code: "INVALID_OPTIONS_COUNT",
    };
  }
  if (!Array.isArray(parsed.citations) || parsed.citations.length === 0) {
    return {
      ok: false as const,
      error: "Insight must include at least one citation. Generation blocked.",
      code: "INSUFFICIENT_CITATIONS",
    };
  }
  // Every cited regId must resolve to a corpus entry.
  const corpusIds = new Set(corpus.map((c) => c.regId));
  for (const cite of parsed.citations) {
    if (!cite || typeof cite.regId !== "string" || !corpusIds.has(cite.regId)) {
      return {
        ok: false as const,
        error: `Citation "${cite?.regId ?? "(missing)"}" does not resolve in the regulations corpus. Generation blocked.`,
        code: "INSUFFICIENT_CITATIONS",
      };
    }
  }

  // Mark the first compliant + lowest (costDelta + programmeDelta) option as
  // recommended (server-side, deterministic). Falls back to first option.
  const compliant = parsed.options.filter(
    (o: any) => o?.compliance === "compliant",
  );
  const pool = compliant.length > 0 ? compliant : parsed.options;
  const sorted = [...pool].sort(
    (a: any, b: any) =>
      Number(a.costDelta || 0) +
      Number(a.programmeDelta || 0) -
      (Number(b.costDelta || 0) + Number(b.programmeDelta || 0)),
  );
  const recommendedId = sorted[0]?.id;
  const options: InsightOption[] = parsed.options.map((o: any) => ({
    id: String(o.id ?? `opt-${Math.random().toString(36).slice(2, 8)}`),
    label: String(o.label ?? "Option"),
    summary: String(o.summary ?? ""),
    compliance:
      o.compliance === "compliant" ||
      o.compliance === "borderline" ||
      o.compliance === "non-compliant"
        ? o.compliance
        : "borderline",
    costDelta: Number(o.costDelta ?? 0),
    programmeDelta: Number(o.programmeDelta ?? 0),
    rationale: String(o.rationale ?? ""),
    recommended: o.id === recommendedId,
  }));

  const citations: InsightCitation[] = parsed.citations.map((c: any) => ({
    regId: String(c.regId),
    appliedTo: String(c.appliedTo ?? ""),
    quote: String(c.quote ?? "").slice(0, 300),
  }));

  const complianceSnapshot = Array.isArray(parsed.complianceSnapshot)
    ? parsed.complianceSnapshot.map((s: any) => ({
        check: String(s?.check ?? ""),
        status:
          s?.status === "pass" || s?.status === "warn" || s?.status === "fail"
            ? s.status
            : "warn",
      }))
    : [];

  const nextActions = Array.isArray(parsed.nextActions)
    ? parsed.nextActions.map((s: any) => String(s)).filter(Boolean)
    : [];

  // Drawing block — optional. If the AI returned `null` (no PDF attached),
  // skip. If returned with annotations, sanitise + enforce the ≥3-callout
  // rule (PRD US-3.2). Per-annotation severity defaults to "info".
  let drawing: InsightDrawing | undefined;
  const rawDrawing = parsed.drawing;
  if (rawDrawing && typeof rawDrawing === "object") {
    const rawAnns = Array.isArray(rawDrawing.annotations)
      ? rawDrawing.annotations
      : [];
    const annotations: InsightDrawingAnnotation[] = rawAnns
      .map((a: any, idx: number) => ({
        id: String(a?.id ?? `ann-${idx + 1}`),
        number: String(a?.number ?? String(idx + 1)),
        label: String(a?.label ?? "Callout").slice(0, 80),
        page: Math.max(1, Math.floor(Number(a?.page) || 1)),
        dimension:
          typeof a?.dimension === "string" && a.dimension.trim()
            ? a.dimension.trim().slice(0, 40)
            : undefined,
        note: typeof a?.note === "string" ? String(a.note).slice(0, 600) : undefined,
        severity:
          a?.severity === "critical" ||
          a?.severity === "warning" ||
          a?.severity === "info"
            ? a.severity
            : "info",
        regId:
          typeof a?.regId === "string" && corpusIds.has(a.regId)
            ? a.regId
            : undefined,
      }))
      .filter((a: InsightDrawingAnnotation) => a.label && a.label.length > 0);
    if (annotations.length < 3) {
      return {
        ok: false as const,
        error: `Drawing markup requires at least 3 callouts (got ${annotations.length}).`,
        code: "INSUFFICIENT_DRAWING_ANNOTATIONS",
      };
    }
    drawing = {
      annotations,
      summaryNote:
        typeof rawDrawing.summaryNote === "string"
          ? rawDrawing.summaryNote.slice(0, 320)
          : undefined,
    };
  }

  // RFI block — required (PRD US-3.3). Sanitise everything; fall back to
  // permissive defaults rather than rejecting the whole insight if a single
  // sub-field is malformed.
  let rfi: InsightRfi | undefined;
  const rawRfi = parsed.rfi;
  if (rawRfi && typeof rawRfi === "object") {
    const subject =
      typeof rawRfi.subject === "string" && rawRfi.subject.trim()
        ? rawRfi.subject.trim().slice(0, 200)
        : "";
    const body =
      typeof rawRfi.body === "string" && rawRfi.body.trim()
        ? rawRfi.body.trim().slice(0, 8000)
        : "";
    if (!subject || body.length < 60) {
      return {
        ok: false as const,
        error:
          "RFI subject + body are required (body must be ≥60 chars). Generation blocked.",
        code: "BAD_AI_RESPONSE",
      };
    }
    const priority: InsightRfi["priority"] =
      rawRfi.priority === "high" ||
      rawRfi.priority === "low" ||
      rawRfi.priority === "medium"
        ? rawRfi.priority
        : "medium";
    const rawChapters = Array.isArray(rawRfi.walkthroughChapters)
      ? rawRfi.walkthroughChapters
      : [];
    const walkthroughChapters: InsightRfiWalkthroughChapter[] = rawChapters
      .map((c: any, idx: number) => ({
        id: String(c?.id ?? `ch-${idx + 1}`),
        number: String(c?.number ?? String(idx + 1)),
        caption: String(c?.caption ?? "").slice(0, 100),
        description: String(c?.description ?? "").slice(0, 600),
      }))
      .filter((c: InsightRfiWalkthroughChapter) => c.caption.length > 0);
    rfi = {
      rfiNumber: "",
      status: "Draft",
      subject,
      body,
      priority,
      recipients: [],
      walkthroughChapters:
        walkthroughChapters.length > 0 ? walkthroughChapters : undefined,
    };
  } else {
    return {
      ok: false as const,
      error: "RFI block missing from AI response. Generation blocked.",
      code: "BAD_AI_RESPONSE",
    };
  }

  const insight: InsightSummary = {
    lede: String(parsed.lede),
    options,
    citations,
    complianceSnapshot,
    nextActions,
    drawing,
    rfi,
  };
  return { ok: true as const, insight };
}

// --- Pipeline step 1: build the prompt + flip status -----------------------

export type BuildPromptOk = {
  ok: true;
  prompt: string;
  corpusRegIds: string[];
};
export type BuildPromptFail = { ok: false; error: string; code: string };
export type BuildPromptOutcome = BuildPromptOk | BuildPromptFail;

/**
 * Step 1 of the insight pipeline. Server-side: ensures corpus exists, builds
 * the prompt + flips the enquiry status to `Generating`. Client takes the
 * returned prompt and sends it through `api.geminiPrompt` (existing route).
 */
export async function prepareInsightGeneration(args: {
  ctx: ApiContext;
  docRef: any;
  doc: any;
}): Promise<BuildPromptOutcome> {
  const { ctx, docRef, doc } = args;
  await seedRegulationsCorpusIfMissing(ctx);
  const corpus = await loadRegulationsCorpus(ctx);
  if (corpus.length === 0) {
    return {
      ok: false as const,
      error: "Regulations corpus is empty. Insight generation blocked.",
      code: "EMPTY_CORPUS",
    };
  }

  let projectName = "";
  try {
    if (doc.projectId) {
      const proj = await ctx.db
        .collection("projects")
        .doc(doc.projectId)
        .get();
      projectName = (proj.data()?.name as string | undefined) ?? "";
    }
  } catch {
    // ignore — project name is best-effort context
  }

  const prompt = buildInsightPrompt({
    query: doc.query ?? "",
    title: doc.title ?? "",
    ribaStage: doc.ribaStage ?? "S0",
    attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
    corpus,
    projectName,
  });

  await docRef.set(
    { status: "Generating", updatedAt: new Date().toISOString() },
    { merge: true },
  );

  return {
    ok: true as const,
    prompt,
    corpusRegIds: corpus.map((c) => c.regId),
  };
}

// --- Pipeline step 2: validate + persist + flip status --------------------

export type FinaliseOk = { ok: true; enquiry: any; summary: InsightSummary };
export type FinaliseFail = { ok: false; error: string; code: string };
export type FinaliseOutcome = FinaliseOk | FinaliseFail;

/**
 * Step 2 of the insight pipeline. Validates the AI response (citations
 * resolve in the corpus, options count in range), writes the Summary
 * deliverable to `tabs/summary`, and flips status to `Open`. On any
 * validation failure, status rolls back to `Draft`.
 */
export async function finaliseInsightGeneration(args: {
  ctx: ApiContext;
  docRef: any;
  doc: any;
  summary: any;
}): Promise<FinaliseOutcome> {
  const { ctx, docRef, doc, summary } = args;
  const corpus = await loadRegulationsCorpus(ctx);

  const validated = validateInsight(summary, corpus);
  if (validated.ok === false) {
    await docRef.set(
      { status: "Draft", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return {
      ok: false as const,
      error: validated.error,
      code: validated.code,
    };
  }

  const now = new Date().toISOString();

  // Attach the source-PDF reference to the drawing block so the client can
  // render it in the EmbedPDF viewer without re-walking the attachments.
  const primaryDrawing = pickPrimaryDrawing(
    Array.isArray(doc.attachments) ? doc.attachments : [],
  );
  if (validated.insight.drawing && primaryDrawing) {
    validated.insight.drawing = {
      ...validated.insight.drawing,
      basePdfPath: primaryDrawing.storagePath,
      basePdfUrl: primaryDrawing.url,
      basePdfFileName: primaryDrawing.fileName,
    };
  }

  // Write the Summary deliverable (always).
  const summaryTabRef = docRef.collection("tabs").doc("summary");
  await summaryTabRef.set(
    {
      tabId: "summary",
      content: validated.insight,
      generatedAt: now,
      generatedBy: "ai",
      versionNumber: 1,
    },
    { merge: false },
  );

  // Drawing + RFI deliverables live INSIDE `tabs/summary.content` — the UI
  // reads from there on every reload, so writing separate `tabs/drawing` /
  // `tabs/rfi` docs would just create stale duplicates. Single source of
  // truth = `tabs/summary.content` (lesson locked Phase 5).

  await docRef.set({ status: "Open", updatedAt: now }, { merge: true });
  const updated = await docRef.get();
  return {
    ok: true as const,
    enquiry: { ...updated.data(), id: doc.id },
    summary: validated.insight,
  };
}

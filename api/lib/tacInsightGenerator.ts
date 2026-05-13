// Technical Assurance Companion — insight orchestration helpers.
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
//   tacBuildInsightPrompt(enquiryId) → flips Draft → Generating, returns
//     the prompt for the client to send through `aiRoutes.geminiPrompt`.
//   tacFinaliseInsight(enquiryId, summary) → validates the AI response
//     and either writes the deliverable + flips Generating → Open, or
//     rolls status back to Draft on validation failure.

import type { ApiContext } from "./context.js";
import {
  loadRegulationsCorpus,
  seedRegulationsCorpusIfMissing,
  type RegulationCorpusEntry,
} from "./regulationsCorpusSeed.js";
import {
  loadCostRates,
  seedCostRatesIfMissing,
  type CostRate,
} from "./costRatesSeed.js";

// Types
export interface InsightCitation {
  regId: string;
  /** Human-readable rationale for why this citation applies.*/
  appliedTo: string;
  /** Verbatim quote excerpt (≤300 chars) from the corpus entry.*/
  quote: string;
  /** Server-enriched from corpus at validation time (NOT AI-supplied) —
   *  drive the citation card's heading + external "Open source" link.*/
  documentLabel?: string;
  clause?: string;
  sourceUrl?: string;
}

export interface InsightOption {
  id: string;
  label: string;
  summary: string;
  compliance: "compliant" | "borderline" | "non-compliant";
  costDelta: number;
  programmeDelta: number;
  rationale: string;
  /** Server marks the recommended one — first compliant + lowest cost+prog.*/
  recommended?: boolean;
}

export interface InsightDrawingAnnotation {
  id: string;
  /** Display number ("1", "2", …) the AI assigns; clients render in this order.*/
  number: string;
  label: string;
  page: number;
  /** 0-100 percent across the page width (left-edge = 0). only
   *  set when Gemini sees the PDF visually via inlineData.*/
  xPct?: number;
  /** 0-100 percent down the page height (top = 0).*/
  yPct?: number;
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

// cost + programme tab content. Generated alongside the rest of
// the insight so the user sees indicative pounds-and-weeks impact for the
// recommended option without having to re-prompt.
export interface InsightCostLine {
  /** Optional reference back to a `costRates` library entry. May be `null`
   *  if the AI invents a line that doesn't match the council library.*/
  rateId?: string;
  description: string;
  unit: "m" | "m2" | "m3" | "no" | "hr" | "item";
  quantity: number;
  rate: number;
  total: number;
}

export interface InsightProgrammeBar {
  /** Short label, e.g. "Existing programme", "Recommended option", "Float".*/
  label: string;
  /** ISO date (YYYY-MM-DD).*/
  startDate: string;
  /** ISO date (YYYY-MM-DD).*/
  endDate: string;
  /** Vertical track index (0.N). 0 = master schedule, 1+ = options/floats.*/
  track: number;
  /** Optional severity-style colour cue (`info` | `warning` | `critical`).*/
  emphasis?: "info" | "warning" | "critical";
}

export interface InsightCostProgramme {
  costLines: InsightCostLine[];
  /** Sum of all costLines (server-recomputed; AI value ignored).*/
  totalDelta: number;
  programmeBars: InsightProgrammeBar[];
  /** Working days remaining of float on the master schedule after the
   *  recommended option is absorbed. Negative = critical-path slip.*/
  floatRemaining: number;
  /** Estimated contingency draw (% of project value) implied by totalDelta.*/
  contingencyDrawPct?: number;
  /** Brief 1-2 sentence framing of how the option's cost+programme impact
   *  was assembled (referenced rates, unknown items, assumptions).*/
  summaryNote?: string;
}

// Compliance & citations tab. Adds optional categorisation +
// optional regId linkage so each check can resolve to the regulation that
// drove its pass/warn/fail outcome. Both fields are optional so the
// existing Summary tab (which iterates the flat list) keeps rendering
// without changes.
export type InsightComplianceCategory = "dimensional" | "system";

export interface InsightComplianceCheck {
  check: string;
  status: "pass" | "warn" | "fail";
  /** Optional grouping for the Compliance tab. When absent, the
   *  Compliance tab heuristically buckets the check into "system".*/
  category?: InsightComplianceCategory;
  /** Optional reference to a corpus regId that drove the verdict.*/
  regId?: string;
  /** 1-line evidence snippet — what dimension or system was checked.*/
  evidence?: string;
}

export interface InsightSummary {
  /** Stage-prefixed lede shown at the top of the Summary tab.*/
  lede: string;
  options: InsightOption[];
  citations: InsightCitation[];
  complianceSnapshot: InsightComplianceCheck[];
  nextActions: string[];
  /** Drawing tab content. Populated only when the enquiry has a PDF
   *  attachment; otherwise the AI is told to omit the field.*/
  drawing?: InsightDrawing;
  /** RFI tab content. Auto-populated from the same generation; the user
   *  edits it on the RFI tab and presses Issue to commit a numbered RFI.*/
  rfi?: InsightRfi;
  /** Cost + programme impact for the recommended option. Optional — the
   *  AI may omit it for purely advisory enquiries with no cost or
   *  programme implications, in which case the tab renders an empty state.*/
  costProgramme?: InsightCostProgramme;
}

// Stage-aware prompt branching -----------------------------------------

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
 *   MVP — single drawing per enquiry. Multi-drawing support deferred.*/
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

function summariseCostRates(rates: CostRate[]): string {
  if (rates.length === 0) {
    return "(no rates library — costProgramme will be best-effort)";
  }
  // Cap the prompt size — only ship the rateId / unit / rate triple per row.
  // Description is recoverable from rateId on the client; AI can echo it.
  return rates
    .map((r) => `- ${r.rateId} | ${r.description} | ${r.unit} @ £${r.rate}`)
    .join("\n");
}

function buildInsightPrompt(args: {
  query: string;
  title: string;
  ribaStage: string;
  attachments: any[];
  corpus: RegulationCorpusEntry[];
  rates: CostRate[];
  projectName: string;
  projectValue?: number;
}): string {
  const { query, title, ribaStage, attachments, corpus, rates, projectName, projectValue } = args;
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

The PDF you read may reference clause numbers that look like regIds (e.g.
"K1.15", "B3.2.4") but are NOT in the corpus below. Do NOT use those as
\`regId\` values — only the ones explicitly listed below are valid. If you
need to mention a clause that's not in the corpus, do so in PROSE inside
the option's rationale or the citation's "appliedTo" — never as a regId.

If no corpus entry supports your answer at all, return an empty citations
array — the system will block generation cleanly.

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
    {
      "check": "Short check name",
      "status": "pass" | "warn" | "fail",
      "category": "dimensional" | "system",
      "regId": "Optional — corpus regId that drove this verdict",
      "evidence": "1-line snippet — what dimension or system was checked"
    }
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
        "xPct": 38.5,
        "yPct": 64.2,
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
  },
  "costProgramme": {
    "summaryNote": "1-2 sentence framing of how the indicative cost+programme impact was assembled (rates referenced, assumptions, unknowns).",
    "costLines": [
      {
        "rateId": "Optional — must match a rateId from the rates library below if used",
        "description": "Short line description",
        "unit": "m" | "m2" | "m3" | "no" | "hr" | "item",
        "quantity": 0,
        "rate": 0,
        "total": 0
      }
    ],
    "totalDelta": 0,
    "programmeBars": [
      {
        "label": "Existing programme",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "track": 0,
        "emphasis": "info" | "warning" | "critical"
      },
      {
        "label": "Recommended option",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "track": 1,
        "emphasis": "info"
      }
    ],
    "floatRemaining": 0,
    "contingencyDrawPct": 0
  }
}

Rules:
1. Return between 10 and 15 options. Include a non-compliant option (if any) so the user sees what's been ruled out.
2. citations: cite **AT LEAST 20 distinct corpus regIds** per insight. The corpus is small (~23 entries) and your job is to surface every entry that has even tangential bearing on the enquiry — UK construction governance is densely interconnected, so almost every corpus entry is adjacent to a typical council-housing enquiry. For each citation, give a SHORT distinct "appliedTo" reason explaining why that specific regulation applies in this specific context. Do NOT repeat the same regId twice — the validator drops duplicates silently. Do NOT pad with irrelevant citations either; if a corpus entry truly has no bearing, omit it. The validator caps at 25 distinct regIds.
3. Keep lede ≤ 200 characters. Keep each option summary ≤ 280 characters.
4. NEVER invent regulations or clause numbers. NEVER cite a regId not in the corpus above.
5. NEVER recommend bypassing statutory compliance. If the answer requires a chartered review, say so in nextActions.
6. Use British English. UK construction terminology.${
    primaryDrawing
      ? `
7. drawing.annotations MUST contain BETWEEN 8 AND 15 numbered callouts referring to the attached drawing. The 3-callout floor is the absolute minimum — it is NOT the target. Your job is to surface every dimension, diagram, table, clause illustration, and compliance-critical detail visible in the document. The source PDF is provided to you as inline binary data — READ IT VISUALLY and place each annotation at a SPECIFIC location on the relevant page.

   USE THE WHOLE DOCUMENT. Walk through EVERY page of the PDF and identify content worth annotating. A 30-page Approved Document has dozens of dimensions, diagrams, and worked examples — pull out 8-15 of the most relevant ones distributed across pages. Do NOT cluster on page 1. Do NOT settle for 3 callouts when the document has more.

   For each callout, set:
   • "page": the 1-indexed page number where the issue appears in the PDF
   • "xPct": 0-100, percentage from the LEFT edge of that page
   • "yPct": 0-100, percentage from the TOP edge of that page
   • "severity": one of "info" | "warning" | "critical" — USE A MIX (see below)

   SEVERITY ASSIGNMENT — every batch should contain a mix:
   • "critical" — direct non-compliance, life-safety, fire-stopping defect, or HRB Gateway-blocking issue. Rose marker on the PDF.
   • "warning" — borderline value, dimension at the regulation's minimum that needs verification, or a routing/clearance that's tight. Amber marker.
   • "info" — illustrative reference, neutral dimension callout, or general guidance. Indigo marker.

   Aim for roughly 1 critical : 2 warnings : 2-4 info per batch. If everything is "info", you are not reading the document carefully enough.

   Coordinates must reflect where on the drawing the issue actually is — not abstract guesses or page-1 defaults. Use stable "number" values starting at "1" in document order (left-to-right, top-to-bottom across pages). If a callout cites a regulation, set its regId to a corpus regId (must match exactly).`
      : `
7. No PDF drawing is attached — set the "drawing" field to null. Do NOT fabricate annotations.`
  }
8. rfi MUST be populated. subject ≤ 90 chars, body ≥ 60 chars (multi-paragraph). priority must be one of "high" | "medium" | "low" — pick "high" if any compliance check failed or any drawing annotation severity is "critical", otherwise "medium" by default. walkthroughChapters: produce 4-6 numbered install / inspection steps the site team can follow. Captions should be imperative (e.g. "Set out the drop", "Frame the bulkhead"). Text only — DO NOT include video URLs.

9. costProgramme is REQUIRED. UK social-housing enquiries virtually always carry a cost or programme implication — even an advisory query about a regulation interpretation has compliance-checking cost, design-review time, or a downstream works cost worth flagging. DO NOT set costProgramme to null unless the enquiry is a pure definitions question with absolutely no implementation pathway (e.g. "what is the difference between Approved Doc B Vol 1 and Vol 2?"). Speculative-but-defensible figures are MORE useful to the PM than nothing — frame them honestly via summaryNote.

   Required for the recommended option (the option you set the lowest costDelta + programmeDelta on — the server marks "recommended" deterministically from your numbers, so make them honest):
   • costLines: 5-12 line items that, summed, approximate the recommended option's total works cost. EVERY line must have quantity > 0 and rate ≥ 0 — lines with quantity 0 are silently dropped by the validator and waste the slot. Where possible, set "rateId" to a rateId from the COST RATES LIBRARY below and use that exact rate as the line's "rate" — this lets the council audit the calculation against their own schedule. If no library rateId fits, omit "rateId" and provide a defensible "rate" + "description" (e.g. "PS / specialist quote — indicative"). The "total" must equal "quantity × rate".
   • totalDelta: sum of every line's "total". Round to the nearest £. (Server recomputes this — don't worry about minor arithmetic mistakes.)
   • programmeBars: at least 2 bars — track 0 = master schedule (existing programme), track 1+ = recommended option / sequenced sub-tasks. Dates MUST be valid ISO YYYY-MM-DD with endDate ≥ startDate. Bars with malformed dates are silently dropped. Use realistic dates from approximately the current quarter forward; the user's project start date may be implied by context.
   • floatRemaining: integer — working days of slack on the master schedule after the option is absorbed. Negative means the recommended option pushes into critical-path territory.
   • contingencyDrawPct: 0-100, integer — % of typical project contingency the totalDelta would consume. Project value is provided as context where known; if not, give a defensible estimate.
   • summaryNote: short prose framing of the assumption set (1-2 sentences). Acknowledge unknowns honestly — "Indicative based on standard 12-flat block dimensions" is fine.

10. complianceSnapshot — produce 5-10 checks. Categorise EACH one:
    • "dimensional" for clearance / height / width / span / fall-protection / DDA / structural-load checks (anything measurable in mm, m, kN, lux, dB).
    • "system" for systems / installations / certifications / processes (electrical, fire-stopping, MVHR commissioning, asbestos R&D, BSR Gateway readiness, RSH consumer-standard alignment).
    Set "regId" to the corpus regId that drove the verdict where one applies. Set "evidence" to a 1-line snippet naming the actual dimension or system checked (e.g. "Stair tread 220mm — within AD K1.5 minimum 220mm" / "MVHR commissioning sheet not yet on file"). Mix pass / warn / fail honestly — at least 1 warn or fail unless the enquiry is genuinely a green-light question.

============================================================
COST RATES LIBRARY — REFERENCE FOR costProgramme.costLines
============================================================
${summariseCostRates(rates)}${
    typeof projectValue === "number" && projectValue > 0
      ? `\n\nProject value (context for contingencyDrawPct): £${projectValue.toLocaleString("en-GB")}`
      : ""
  }

Now return the JSON object.`;
}

// Defensive markdown stripping ----------------------------------------
//
// The prompt tells Gemini to return plain text, but it routinely ignores the
// rule and emits "**bold**" / "*italic*" / "# heading" inside RFI bodies +
// option rationales. Strip on persistence so the saved deliverable is
// always clean — render-time fallback would mean every UI surface needs to
// remember to call it.

function stripMarkdown(text: string): string {
  if (!text) return "";
  if (typeof text !== "string") return String(text);
  return text
    // Heading markers (# / ## / ### …)
    .replace(/^#{1,6}\s+/gm, "")
    // Bold ** … ** or __ … __
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // Italic * … * or _ … _
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    // Inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Blockquote markers
    .replace(/^>\s*/gm, "")
    // Markdown links [label](url) → label (url) — keep URL visible
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- Validation ------------------------------------------------------------
//
// MIN / MAX must accept whatever the prompt asks for. The prompt currently
// requests "between 10 and 15 options"; the validator accepts the wider band
// 1-20 so casual prompt edits don't immediately break generation. Citations
// are still hard-gated: ≥1 + every regId must resolve in the corpus.
const MIN_OPTIONS = 1;
const MAX_OPTIONS = 20;
// MAX_CITATIONS is set just above the corpus size (~23 entries today) so
// the prompt's "at least 20" target can fully populate without spam, while
// future corpus growth gets a sensible upper bound. Validator dedups by
// regId before applying the cap; user-locked floor stays at 1 because
// narrow enquiries legitimately have few relevant entries.
const MAX_CITATIONS = 25;

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
  // Drop any citation whose regId doesn't resolve in the corpus — the AI
  // routinely references clause numbers it spots inside the PDF (e.g.
  // "K1.15" from Approved Doc K) that aren't in the curated set. We keep
  // only the resolvable ones rather than failing the whole insight, then
  // gate on having at least one survivor.
  const corpusIds = new Set(corpus.map((c) => c.regId));
  const rawCitations = Array.isArray(parsed.citations)
    ? parsed.citations
    : [];
  const droppedRegIds: string[] = [];
  // Step 1: drop non-corpus regIds — hallucination guard.
  const corpusFilteredCitations = rawCitations.filter((c: any) => {
    if (!c || typeof c.regId !== "string") return false;
    if (!corpusIds.has(c.regId)) {
      droppedRegIds.push(c.regId);
      return false;
    }
    return true;
  });
  if (droppedRegIds.length > 0) {
    console.warn(
      `[validateInsight] dropped ${droppedRegIds.length} citation(s) not in corpus: ${droppedRegIds.join(", ")}`,
    );
  }
  // Step 2 — dedupe by regId, keeping the entry with the longest non-empty
  // appliedTo (the "best signal" representative). Without dedup, the AI can
  // cite the same regId 50× with slightly different phrasings and every
  // duplicate passes through (the "57 citations" pathological case).
  const dedupMap = new Map<string, any>();
  let dedupDuplicates = 0;
  for (const c of corpusFilteredCitations) {
    const existing = dedupMap.get(c.regId);
    const incomingApplied = String(c.appliedTo ?? "").trim();
    if (!existing) {
      dedupMap.set(c.regId, c);
    } else {
      dedupDuplicates++;
      const existingApplied = String(existing.appliedTo ?? "").trim();
      if (incomingApplied.length > existingApplied.length) {
        dedupMap.set(c.regId, c);
      }
    }
  }
  if (dedupDuplicates > 0) {
    console.warn(
      `[validateInsight] dropped ${dedupDuplicates} duplicate citation(s) by regId.`,
    );
  }
  // Step 3 — cap at MAX_CITATIONS. Sort by appliedTo length descending so
  // the most-informative survivors are kept when the cap fires.
  let validCitations = Array.from(dedupMap.values());
  if (validCitations.length > MAX_CITATIONS) {
    const overCap = validCitations.length - MAX_CITATIONS;
    validCitations.sort((a, b) => {
      const al = String(a.appliedTo ?? "").length;
      const bl = String(b.appliedTo ?? "").length;
      return bl - al;
    });
    validCitations = validCitations.slice(0, MAX_CITATIONS);
    console.warn(
      `[validateInsight] capped citations at ${MAX_CITATIONS} (dropped ${overCap} over-cap entries).`,
    );
  }
  if (validCitations.length === 0) {
    return {
      ok: false as const,
      error:
        "AI did not cite any regulation that resolves in the corpus. Generation blocked.",
      code: "INSUFFICIENT_CITATIONS",
    };
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
    label: stripMarkdown(String(o.label ?? "Option")),
    summary: stripMarkdown(String(o.summary ?? "")),
    compliance:
      o.compliance === "compliant" ||
      o.compliance === "borderline" ||
      o.compliance === "non-compliant"
        ? o.compliance
        : "borderline",
    costDelta: Number(o.costDelta ?? 0),
    programmeDelta: Number(o.programmeDelta ?? 0),
    rationale: stripMarkdown(String(o.rationale ?? "")),
    recommended: o.id === recommendedId,
  }));

  // Enrich each citation with corpus metadata so the client can render the
  // proper document label, clause, and source URL on the CitationCard
  // without doing its own corpus lookup. The AI never supplies these
  // fields — they come exclusively from the corpus entry, so they're
  // tamper-proof.
  const corpusByRegId = new Map<string, RegulationCorpusEntry>();
  for (const c of corpus) corpusByRegId.set(c.regId, c);
  const citations: InsightCitation[] = validCitations.map((c: any) => {
    const corpusEntry = corpusByRegId.get(String(c.regId));
    return {
      regId: String(c.regId),
      appliedTo: stripMarkdown(String(c.appliedTo ?? "")),
      quote: stripMarkdown(String(c.quote ?? "")).slice(0, 300),
      documentLabel: corpusEntry?.documentLabel,
      clause: corpusEntry?.clause,
      sourceUrl: corpusEntry?.source?.url,
    };
  });

  const complianceSnapshot: InsightComplianceCheck[] = Array.isArray(
    parsed.complianceSnapshot,
  )
    ? parsed.complianceSnapshot
        .map((s: any): InsightComplianceCheck | null => {
          const check = stripMarkdown(String(s?.check ?? "")).slice(0, 120);
          if (!check) return null;
          const status: InsightComplianceCheck["status"] =
            s?.status === "pass" ||
            s?.status === "warn" ||
            s?.status === "fail"
              ? s.status
              : "warn";
          const category: InsightComplianceCategory | undefined =
            s?.category === "dimensional" || s?.category === "system"
              ? s.category
              : undefined;
          const regId =
            typeof s?.regId === "string" && corpusIds.has(s.regId)
              ? s.regId
              : undefined;
          const evidence =
            typeof s?.evidence === "string" && s.evidence.trim()
              ? stripMarkdown(s.evidence).slice(0, 200)
              : undefined;
          return { check, status, category, regId, evidence };
        })
        .filter(
          (s: InsightComplianceCheck | null): s is InsightComplianceCheck =>
            s !== null,
        )
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
    const clampPct = (v: any): number | undefined => {
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      return Math.max(0, Math.min(100, n));
    };
    const annotations: InsightDrawingAnnotation[] = rawAnns
      .map((a: any, idx: number) => ({
        id: String(a?.id ?? `ann-${idx + 1}`),
        number: String(a?.number ?? String(idx + 1)),
        label: stripMarkdown(String(a?.label ?? "Callout")).slice(0, 80),
        page: Math.max(1, Math.floor(Number(a?.page) || 1)),
        xPct: clampPct(a?.xPct),
        yPct: clampPct(a?.yPct),
        dimension:
          typeof a?.dimension === "string" && a.dimension.trim()
            ? a.dimension.trim().slice(0, 40)
            : undefined,
        note: typeof a?.note === "string" ? stripMarkdown(String(a.note)).slice(0, 600) : undefined,
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
          ? stripMarkdown(rawDrawing.summaryNote).slice(0, 320)
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
        ? stripMarkdown(rawRfi.subject).trim().slice(0, 200)
        : "";
    const body =
      typeof rawRfi.body === "string" && rawRfi.body.trim()
        ? stripMarkdown(rawRfi.body).trim().slice(0, 8000)
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
        caption: stripMarkdown(String(c?.caption ?? "")).slice(0, 100),
        description: stripMarkdown(String(c?.description ?? "")).slice(0, 600),
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

  // Cost + programme — optional. AI may legitimately return null for purely
  // advisory enquiries. When present, we sanitise + recompute totals
  // server-side so the totalDelta / line totals are guaranteed consistent.
  // Diagnostic logging: distinguishes AI-returned-null from
  // AI-returned-but-all-dropped, since both end up with no costProgramme on
  // the deliverable but mean very different things for prompt tuning.
  let costProgramme: InsightCostProgramme | undefined;
  const rawCp = parsed.costProgramme;
  if (rawCp == null) {
    console.warn(
      "[validateInsight] costProgramme: AI returned null/absent — enquiry treated as advisory.",
    );
  } else if (rawCp && typeof rawCp === "object") {
    const VALID_UNITS = new Set(["m", "m2", "m3", "no", "hr", "item"]);
    const rawLines = Array.isArray(rawCp.costLines) ? rawCp.costLines : [];
    const costLines: InsightCostLine[] = rawLines
      .map((l: any): InsightCostLine | null => {
        const description = stripMarkdown(String(l?.description ?? "")).slice(
          0,
          160,
        );
        if (!description) return null;
        const unit = VALID_UNITS.has(String(l?.unit)) ? l.unit : "item";
        const quantity = Number(l?.quantity);
        const rate = Number(l?.rate);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        if (!Number.isFinite(rate) || rate < 0) return null;
        const total = Math.round(quantity * rate);
        return {
          rateId:
            typeof l?.rateId === "string" && l.rateId.trim()
              ? l.rateId.trim().slice(0, 80)
              : undefined,
          description,
          unit,
          quantity: Number(quantity.toFixed(2)),
          rate: Number(rate.toFixed(2)),
          total,
        };
      })
      .filter((l: InsightCostLine | null): l is InsightCostLine => l !== null);

    const totalDelta = costLines.reduce((sum, l) => sum + l.total, 0);

    const rawBars = Array.isArray(rawCp.programmeBars)
      ? rawCp.programmeBars
      : [];
    const isoDate = (v: any): string | null => {
      const s = typeof v === "string" ? v.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return s;
    };
    const programmeBars: InsightProgrammeBar[] = rawBars
      .map((b: any): InsightProgrammeBar | null => {
        const label = stripMarkdown(String(b?.label ?? "")).slice(0, 80);
        if (!label) return null;
        const startDate = isoDate(b?.startDate);
        const endDate = isoDate(b?.endDate);
        if (!startDate || !endDate) return null;
        if (new Date(endDate) < new Date(startDate)) return null;
        const track = Math.max(0, Math.floor(Number(b?.track) || 0));
        const emphasis: InsightProgrammeBar["emphasis"] =
          b?.emphasis === "critical" ||
          b?.emphasis === "warning" ||
          b?.emphasis === "info"
            ? b.emphasis
            : undefined;
        return { label, startDate, endDate, track, emphasis };
      })
      .filter(
        (b: InsightProgrammeBar | null): b is InsightProgrammeBar =>
          b !== null,
      );

    const floatRemaining = Number.isFinite(Number(rawCp.floatRemaining))
      ? Math.round(Number(rawCp.floatRemaining))
      : 0;

    const rawContingency = Number(rawCp.contingencyDrawPct);
    const contingencyDrawPct = Number.isFinite(rawContingency)
      ? Math.max(0, Math.min(100, Math.round(rawContingency)))
      : undefined;

    const summaryNote =
      typeof rawCp.summaryNote === "string" && rawCp.summaryNote.trim()
        ? stripMarkdown(rawCp.summaryNote).slice(0, 320)
        : undefined;

    // Only persist if there's something meaningful — at least one cost line
    // OR at least one programme bar. Otherwise drop with a loud warning so
    // we can spot AI responses that look populated but are entirely junk.
    const rawLineCount = Array.isArray(rawCp.costLines)
      ? rawCp.costLines.length
      : 0;
    const rawBarCount = Array.isArray(rawCp.programmeBars)
      ? rawCp.programmeBars.length
      : 0;
    if (costLines.length > 0 || programmeBars.length > 0) {
      costProgramme = {
        costLines,
        totalDelta,
        programmeBars,
        floatRemaining,
        contingencyDrawPct,
        summaryNote,
      };
      if (
        costLines.length < rawLineCount ||
        programmeBars.length < rawBarCount
      ) {
        console.warn(
          `[validateInsight] costProgramme: kept ${costLines.length}/${rawLineCount} cost lines, ${programmeBars.length}/${rawBarCount} programme bars (others dropped for invalid quantity / rate / date).`,
        );
      }
    } else {
      console.warn(
        `[validateInsight] costProgramme: AI returned a block but every entry was dropped (rawLines=${rawLineCount}, rawBars=${rawBarCount}). Common causes: quantity 0, missing description, malformed dates.`,
      );
    }
  }

  const insight: InsightSummary = {
    lede: stripMarkdown(String(parsed.lede)),
    options,
    citations,
    complianceSnapshot,
    nextActions,
    drawing,
    rfi,
    costProgramme,
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
  await seedCostRatesIfMissing(ctx);
  const [corpus, rates] = await Promise.all([
    loadRegulationsCorpus(ctx),
    loadCostRates(ctx),
  ]);
  if (corpus.length === 0) {
    return {
      ok: false as const,
      error: "Regulations corpus is empty. Insight generation blocked.",
      code: "EMPTY_CORPUS",
    };
  }

  let projectName = "";
  let projectValue: number | undefined;
  try {
    if (doc.projectId) {
      const proj = await ctx.db
        .collection("projects")
        .doc(doc.projectId)
        .get();
      const data = proj.data();
      projectName = (data?.name as string | undefined) ?? "";
      // `Project.contractValue` is stored as string in some docs (legacy
      // input), number in others. Coerce defensively.
      const rawValue = data?.contractValue;
      const numeric = Number(
        typeof rawValue === "string"
          ? rawValue.replace(/[^\d.-]/g, "")
          : rawValue,
      );
      if (Number.isFinite(numeric) && numeric > 0) projectValue = numeric;
    }
  } catch {
    // ignore — project name + value are best-effort context
  }

  const prompt = buildInsightPrompt({
    query: doc.query ?? "",
    title: doc.title ?? "",
    ribaStage: doc.ribaStage ?? "S0",
    attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
    corpus,
    rates,
    projectName,
    projectValue,
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
  // `tabs/rfi` docs would only create stale duplicates. The summary doc is
  // the single source of truth.

  await docRef.set({ status: "Open", updatedAt: now }, { merge: true });
  const updated = await docRef.get();
  return {
    ok: true as const,
    enquiry: { ...updated.data(), id: doc.id },
    summary: validated.insight,
  };
}

// Technical Assurance Companion — insight orchestrator (Phase 2).
//
// One Gemini round-trip per enquiry. Pipeline:
//   1. Load enquiry doc + cross-tenant guard.
//   2. Pull regulations corpus (Phase 0 + corpus seed).
//   3. Build a stage-aware prompt (S2 / S4 / S5 branching per PRD US-2.1).
//   4. Call Gemini with a strict JSON-shaped responseSchema.
//   5. Validate response: 2-4 ranked options (PRD US-2.3); ≥1 citation per
//      insight + every cited regId resolves in the corpus (PRD US-2.2 — the
//      hard "no citation, no insight" gate).
//   6. Write the Summary deliverable to
//      `enquiries/{docId}/tabs/summary` so Phase 3 can render it.
//   7. Flip enquiry status `Draft` → `Open`. Failures revert to `Draft`.
//
// Stays separate from `api/routes/ai.ts` so we don't disturb existing
// compliance / risk / control / chatWithAI flows (lesson §25 ADD-never-MODIFY).

import { GoogleGenAI } from "@google/genai";
import type { ApiContext } from "./context.js";
import { parseAIResponse } from "./context.js";
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

function buildInsightPrompt(args: {
  query: string;
  title: string;
  ribaStage: string;
  attachments: any[];
  corpus: RegulationCorpusEntry[];
  projectName: string;
}): string {
  const { query, title, ribaStage, attachments, corpus, projectName } = args;
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
${summariseAttachments(attachments)}

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
  "nextActions": [ "Imperative bullet 1", "Imperative bullet 2" ]
}

Rules:
1. Return between 10 and 15 options. Include a non-compliant option (if any) so the user sees what's been ruled out.
2. citations.length must be ≥ 1. Every regId must match the corpus.
3. Keep lede ≤ 200 characters. Keep each option summary ≤ 280 characters.
4. NEVER invent regulations or clause numbers. NEVER cite a regId not in the corpus above.
5. NEVER recommend bypassing statutory compliance. If the answer requires a chartered review, say so in nextActions.
6. Use British English. UK construction terminology.

Now return the JSON object.`;
}

// --- Validation ------------------------------------------------------------

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

type ValidateOk = { ok: true; insight: InsightSummary };
type ValidateFail = { ok: false; error: string; code: string };
type ValidateResult = ValidateOk | ValidateFail;

function validateInsight(
  parsed: any,
  corpus: RegulationCorpusEntry[],
): ValidateResult {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false as const, error: "AI returned a non-object response.", code: "BAD_AI_RESPONSE" };
  }
  if (typeof parsed.lede !== "string" || parsed.lede.trim() === "") {
    return { ok: false as const, error: "AI response missing lede.", code: "BAD_AI_RESPONSE" };
  }
  if (!Array.isArray(parsed.options)) {
    return { ok: false as const, error: "AI response missing options array.", code: "BAD_AI_RESPONSE" };
  }
  if (parsed.options.length < MIN_OPTIONS || parsed.options.length > MAX_OPTIONS) {
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
      (Number(a.costDelta || 0) + Number(a.programmeDelta || 0)) -
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

  const insight: InsightSummary = {
    lede: String(parsed.lede),
    options,
    citations,
    complianceSnapshot,
    nextActions,
  };
  return { ok: true as const, insight };
}

// --- Gemini call -----------------------------------------------------------
//
// Mirrors the dual-key + dual-model + retry pattern in `api/routes/ai.ts`
// `geminiPrompt`. System env key is tried first; user's personal
// `geminiBackupKey` (set via Profile Settings) is the fallback. If the primary
// model fails on a retryable error (overloaded / 503 / parse-critical) we
// retry once on the same key+model; on non-retryable failure we swap to the
// backup key + the smaller `gemini-2.5-flash-lite` backup model.

const PRIMARY_MODEL = "gemini-2.5-flash";
const BACKUP_MODEL = "gemini-2.5-flash-lite";
const TIMEOUT_MS = 25_000; // Q5=A target P95 < 20s; hard cap at 25s.

const GENERATION_CONFIG = {
  temperature: 0.3,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

async function tryGenerate(
  ai: GoogleGenAI,
  modelName: string,
  prompt: string,
  maxRetries: number = 1,
): Promise<any> {
  let attempts = 0;
  while (attempts <= maxRetries) {
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: GENERATION_CONFIG,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("AI request timed out (>25s).")),
          TIMEOUT_MS,
        ),
      );
      const result: any = await Promise.race([generatePromise, timeoutPromise]);
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text;
      return parseAIResponse(raw || "", {});
    } catch (err: any) {
      attempts++;
      const isRetryable =
        err?.message?.includes("AI_PARSE_CRITICAL_FAILURE") ||
        err?.status === 503 ||
        err?.message?.includes("overloaded") ||
        err?.message?.includes("503");
      if (isRetryable && attempts <= maxRetries) {
        console.warn(
          `[tacInsight retry] ${modelName} failed retryable error, attempt ${attempts}/${maxRetries}`,
        );
        if (err?.status === 503 || err?.message?.includes("overloaded")) {
          await new Promise((r) => setTimeout(r, 5000));
        }
        continue;
      }
      throw err;
    }
  }
}

async function callGemini(prompt: string, ctx: ApiContext): Promise<any> {
  const systemKey = process.env.GEMINI_API_KEY;
  const userPersonalKey = (ctx.userData?.geminiBackupKey || "").trim();

  // System key first, fall back to user's personal key if available.
  const primaryKey = systemKey || userPersonalKey;
  // Backup key is only used if primary was the system key — gives us a
  // genuine fallback (not the same key twice).
  const backupKey = primaryKey === systemKey ? userPersonalKey : null;

  if (!primaryKey) {
    throw new Error(
      "No Gemini API key configured. Add a personal key in Profile Settings or contact support.",
    );
  }

  // Attempt 1 — system (or only available) key + primary model.
  try {
    const primaryAI = new GoogleGenAI({ apiKey: primaryKey });
    return await tryGenerate(primaryAI, PRIMARY_MODEL, prompt);
  } catch (initialError: any) {
    console.error("[tacInsight primary] failed", {
      status: initialError?.status,
      message: initialError?.message,
      source: userPersonalKey ? "user" : "system",
    });

    // Attempt 2 — user's personal key + the smaller backup model. Only fires
    // when the user has actually configured a personal key.
    if (backupKey && backupKey !== primaryKey) {
      try {
        console.log("[tacInsight] attempting fallback to user backup key + backup model");
        const backupAI = new GoogleGenAI({ apiKey: backupKey });
        return await tryGenerate(backupAI, BACKUP_MODEL, prompt);
      } catch (backupError: any) {
        console.error("[tacInsight backup] failed", {
          status: backupError?.status,
          message: backupError?.message,
        });
        throw friendlyAiError(backupError, "system");
      }
    }
    // No backup configured — surface the friendly variant of the primary error.
    throw friendlyAiError(initialError, userPersonalKey ? "user" : "system");
  }
}

function friendlyAiError(err: any, source: "user" | "system"): Error {
  const isQuotaError =
    err?.status === 429 ||
    err?.message?.includes("429") ||
    err?.message?.includes("quota");
  const isTimeout =
    err?.status === 408 ||
    err?.message?.includes("deadline") ||
    err?.message?.includes("timeout");

  let msg = "AI engine encountered an error.";
  if (isQuotaError) {
    msg =
      source === "user"
        ? "Your personal Gemini API quota is exceeded. Wait ~60s or check AI Studio billing."
        : "System AI quota exceeded. Add your own Gemini API key in Profile Settings for higher limits.";
  } else if (isTimeout) {
    msg = "AI engine timed out. The query is complex — try again in a moment.";
  } else if (err?.message?.includes("overloaded")) {
    msg = "Gemini is currently overloaded. Try again in a moment.";
  } else if (err?.message) {
    // Pass through the Gemini-side message verbatim (sliced) for diagnostics.
    msg = String(err.message).slice(0, 280);
  }
  const wrapped = new Error(msg);
  // Keep the original status / code accessible for the route handler.
  (wrapped as any).status = err?.status;
  return wrapped;
}

// --- Orchestrator ----------------------------------------------------------

export interface GenerateInsightResult {
  enquiry: any;
  summary: InsightSummary;
}

export type GenerateInsightOk = { ok: true; result: GenerateInsightResult };
export type GenerateInsightFail = { ok: false; error: string; code: string };
export type GenerateInsightOutcome =
  | GenerateInsightOk
  | GenerateInsightFail;

/**
 * Run the full insight pipeline for a single enquiry. Caller (the route
 * handler) is responsible for cross-tenant + state guards via
 * `loadEnquiryForMutation` before invoking this.
 */
export async function generateInsightForEnquiry(args: {
  ctx: ApiContext;
  docRef: any;
  doc: any;
}): Promise<GenerateInsightOutcome> {
  const { ctx, docRef, doc } = args;

  // Ensure corpus exists. Idempotent — short-circuits if any entry is present.
  await seedRegulationsCorpusIfMissing(ctx);
  const corpus = await loadRegulationsCorpus(ctx);
  if (corpus.length === 0) {
    return {
      ok: false as const,
      error: "Regulations corpus is empty. Insight generation blocked.",
      code: "EMPTY_CORPUS",
    };
  }

  // Project name for prompt context (best-effort, never blocks generation).
  let projectName = "";
  try {
    if (doc.projectId) {
      const proj = await ctx.db.collection("projects").doc(doc.projectId).get();
      projectName = (proj.data()?.name as string | undefined) ?? "";
    }
  } catch {
    // ignore
  }

  // Optimistic status flip → 'Generating' so the UI shows the pulse pill.
  await docRef.set(
    { status: "Generating", updatedAt: new Date().toISOString() },
    { merge: true },
  );

  let parsed: any;
  try {
    const prompt = buildInsightPrompt({
      query: doc.query ?? "",
      title: doc.title ?? "",
      ribaStage: doc.ribaStage ?? "S0",
      attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
      corpus,
      projectName,
    });
    parsed = await callGemini(prompt, ctx);
  } catch (e: any) {
    // Roll status back to Draft on any AI failure.
    await docRef.set(
      { status: "Draft", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return {
      ok: false as const,
      error: e?.message ?? "AI insight generation failed.",
      code: "AI_FAILED",
    };
  }

  const validated = validateInsight(parsed, corpus);
  if (validated.ok === false) {
    await docRef.set(
      { status: "Draft", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { ok: false as const, error: validated.error, code: validated.code };
  }

  // Persist the Summary deliverable doc.
  const now = new Date().toISOString();
  const tabRef = docRef.collection("tabs").doc("summary");
  await tabRef.set(
    {
      tabId: "summary",
      content: validated.insight,
      generatedAt: now,
      generatedBy: "ai",
      versionNumber: 1,
    },
    { merge: false },
  );

  // Flip status to 'Open' so the UI shows the green pill + Workspace becomes
  // openable. Phase 3-7 hydrate the other 4 tabs (drawing / RFI / cost /
  // compliance) from the same insight payload.
  await docRef.set(
    { status: "Open", updatedAt: now },
    { merge: true },
  );

  const updated = await docRef.get();
  return {
    ok: true as const,
    result: {
      enquiry: { ...updated.data(), id: doc.id },
      summary: validated.insight,
    },
  };
}

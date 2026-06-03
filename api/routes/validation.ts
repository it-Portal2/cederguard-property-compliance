// Fact-Check / Validation route map.
//
// Backs the Mandatory Fact-Check / Validation feature. The engine (B3) runs a
// TWO-CALL fact-check — Call 1 is a web-grounded gather via aiOperationRouter
// (`webSearch:true`, free-form text), Call 2 structures a strict-JSON verdict
// (no web) — then persists a ValidationRecord to the `validations` collection
// with status "awaiting_validation". Final approval on each surface stays
// blocked until a PM+ marks the record "validated" (B5). All write actions
// audit-log via logActivity, awaited BEFORE the response.
//
// Boundary: ALL AI work goes through api/lib/aiOperationRouter.ts — NEVER
// api/routes/ai.ts (out of bounds).

import { FieldValue } from "firebase-admin/firestore";
import { ApiContext, parseAIResponse } from "../lib/context.js";
import { runAIOperation } from "../lib/aiOperationRouter.js";
import { logActivity } from "../lib/activityLog.js";
import { uploadAsset, deleteAsset } from "../lib/storage.js";
import { ROLE_STRINGS } from "../../src/lib/roleConstants.js";

/** Per-file cap for validation attachments (Vercel 4.5 MB body / base64 inflation). */
const VALIDATION_MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB

// Server-side mirror of roles.ts `isAtLeastPM` (PM and above). Kept inline
// because roles.ts pulls in Vite `import.meta.env` and can't run server-side.
const PM_PLUS = new Set<string>([
  ROLE_STRINGS.ADMIN,
  ROLE_STRINGS.CLIENT_ADMIN,
  ROLE_STRINGS.PROJECT_MANAGER,
  ROLE_STRINGS.SENIOR_PM,
  ROLE_STRINGS.SENIOR_PROJECT_MANAGER,
  ROLE_STRINGS.ASSISTANT_PM,
  ROLE_STRINGS.PROJECT_COORDINATOR,
]);

/** PM and above (or super-admin) may clear validation (Q3=A). */
function canValidate(ctx: ApiContext): boolean {
  return !!ctx.isAdmin || PM_PLUS.has(String(ctx.userData?.role || ""));
}

/** Firestore collection holding one ValidationRecord per fact-checked artifact. */
export const VALIDATIONS_COLLECTION = "validations";

type Handler = (req: any, res: any, ctx: ApiContext) => Promise<any>;

const stub =
  (action: string): Handler =>
  async (_req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    return res.status(200).json({ success: true, stub: action });
  };

// ── Helpers ──────────────────────────────────────────────────────────────

/** One deterministic record per (tenant, surface, target) — re-running overwrites. */
function validationDocId(
  clientId: string,
  surface: string,
  targetId: string,
): string {
  return `${clientId}__${surface}__${targetId}`
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 240);
}

const FACTCHECK_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" }, // the input item's number (for 1:1 coverage)
          claim: { type: "string" },
          verdict: { type: "string" }, // supported | unsupported | uncertain
          note: { type: "string" },
        },
        required: ["claim", "verdict"],
      },
    },
    ratingFlags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          observed: { type: "string" },
          note: { type: "string" },
        },
        required: ["field", "note"],
      },
    },
    overallConfidence: { type: "number" },
    summary: { type: "string" },
  },
  required: ["claims", "overallConfidence", "summary"],
};

const VALID_VERDICTS = new Set(["supported", "unsupported", "uncertain"]);

/** Coerce a healed AI JSON object into a safe FactCheckResult shape. */
function coerceFactCheck(raw: any, fallbackSummary: string) {
  const claims = Array.isArray(raw?.claims)
    ? raw.claims
        .filter((c: any) => c && typeof c.claim === "string")
        .map((c: any) => {
          const v = String(c.verdict || "uncertain").toLowerCase();
          return {
            claim: c.claim,
            verdict: VALID_VERDICTS.has(v) ? v : "uncertain",
            note: typeof c.note === "string" ? c.note : "",
            ...(typeof c.index === "number" ? { index: c.index } : {}),
          };
        })
    : [];
  const ratingFlags = Array.isArray(raw?.ratingFlags)
    ? raw.ratingFlags
        .filter((f: any) => f && (typeof f.field === "string" || typeof f.note === "string"))
        .map((f: any) => ({
          field: String(f.field ?? ""),
          observed: String(f.observed ?? ""),
          note: String(f.note ?? ""),
        }))
    : [];
  let overallConfidence =
    typeof raw?.overallConfidence === "number" ? raw.overallConfidence : 0.5;
  if (overallConfidence > 1) overallConfidence = overallConfidence / 100; // model gave 0-100
  overallConfidence = Math.max(0, Math.min(1, overallConfidence));
  const summary =
    typeof raw?.summary === "string" && raw.summary.trim()
      ? raw.summary
      : fallbackSummary.slice(0, 600);
  return { claims, ratingFlags, overallConfidence, summary };
}

// ── Chunked fact-check (covers ANY number of items, not just one window) ───

const FACTCHECK_CHUNK_ITEMS = 25; //   list items per batch
const FACTCHECK_CONCURRENCY = 3; //    batches in flight at once (120s budget + rate limits)
const FACTCHECK_MAX_ITEMS = 200; //    hard ceiling (8 batches) — noted if exceeded
const FACTCHECK_INPUT_CHARS = 24000; // per-call input cap (~6k tokens)

/** Split content into batches: one item per line; prose stays a single batch. */
function buildFactCheckChunks(content: string): {
  chunks: string[];
  droppedNote: string;
} {
  const lines = String(content)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  // Few lines / prose (chat, risk, technical, small lists) → single pass.
  if (lines.length <= FACTCHECK_CHUNK_ITEMS) {
    return {
      chunks: [String(content).slice(0, FACTCHECK_INPUT_CHARS)],
      droppedNote: "",
    };
  }
  let kept = lines;
  let droppedNote = "";
  if (lines.length > FACTCHECK_MAX_ITEMS) {
    droppedNote = ` Note: ${lines.length} items submitted; the first ${FACTCHECK_MAX_ITEMS} were fact-checked — re-run for the remainder.`;
    kept = lines.slice(0, FACTCHECK_MAX_ITEMS);
  }
  const chunks: string[] = [];
  for (let i = 0; i < kept.length; i += FACTCHECK_CHUNK_ITEMS) {
    chunks.push(kept.slice(i, i + FACTCHECK_CHUNK_ITEMS).join("\n"));
  }
  return { chunks, droppedNote };
}

/** Run async tasks with a fixed max concurrency, preserving input order. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => lane()),
  );
  return results;
}

/** One gather→structure fact-check pass over a single chunk of content. */
async function factCheckChunk(
  ctx: ApiContext,
  chunkText: string,
  surface: string,
  ratingsContext?: string,
): Promise<{
  claims: any[];
  ratingFlags: any[];
  overallConfidence: number;
  summary: string;
  citations: any[];
  backend: string;
}> {
  // Call 1 — web-grounded gather (free-form text, web search ON).
  const gatherPrompt = [
    "You are a compliance fact-checker for a UK construction / property compliance & risk platform.",
    `Below is an AI-generated "${surface}" output. Identify every factual claim it makes (named regulations, legal duties, statutory deadlines, numeric thresholds, obligations) and verify each against authoritative UK sources.`,
    "Use web search and prefer primary sources: legislation.gov.uk, gov.uk, HSE, the Building Safety Regulator, and the relevant regulators.",
    ratingsContext
      ? `Also review these stated ratings/scores and FLAG any that look inconsistent or out of line — do NOT change them, only note them for human review:\n${String(ratingsContext).slice(0, 1500)}`
      : "",
    "",
    "CONTENT TO VERIFY:",
    chunkText.slice(0, FACTCHECK_INPUT_CHARS),
    "",
    "Verify EVERY distinct item/requirement listed above — do not skip or merge items.",
    "Write a thorough analysis: for each claim state whether it is supported, unsupported, or uncertain, and cite the source you relied on. End with a one-paragraph overall assessment and your confidence (0-100%).",
  ]
    .filter(Boolean)
    .join("\n");

  const gather = await runAIOperation({
    ctx,
    prompt: gatherPrompt,
    webSearch: true,
    action: "validationFactCheckGather",
    config: { temperature: 0.3, maxOutputTokens: 8192 },
  });

  // Parse numbered input items ("12. …") so we can enforce 1:1 coverage.
  const numbered = chunkText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d+)\.\s*(.*)$/);
      return m ? { idx: Number(m[1]), text: m[2] } : null;
    })
    .filter(Boolean) as { idx: number; text: string }[];

  // Call 2 — structure the analysis into strict JSON (no web).
  const structurePrompt = [
    "Convert the following compliance fact-check analysis into the required JSON.",
    "verdict must be one of: supported | unsupported | uncertain.",
    "overallConfidence is a number between 0 and 1.",
    "ratingFlags lists any scores/ratings that looked off (empty array if none).",
    numbered.length > 1
      ? `The items below are NUMBERED. Return EXACTLY one claim per item and set each claim's \`index\` to that item's number. Do NOT skip, merge, or renumber — output ${numbered.length} claims covering indexes ${numbered[0].idx}–${numbered[numbered.length - 1].idx}.\n\nITEMS:\n${numbered.map((n) => `${n.idx}. ${n.text}`).join("\n")}`
      : "Include one claim entry for EVERY distinct requirement/item assessed — do not omit or merge any.",
    "",
    "ANALYSIS:",
    gather.text.slice(0, FACTCHECK_INPUT_CHARS),
  ].join("\n");

  const structured = await runAIOperation({
    ctx,
    prompt: structurePrompt,
    action: "validationFactCheckStructure",
    config: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: FACTCHECK_SCHEMA,
    },
  });

  const fc = coerceFactCheck(
    parseAIResponse(structured.text || "", {}),
    gather.text,
  );

  // Reconcile to EXACTLY one claim per numbered input item — guarantees the
  // displayed count matches the item count even if the model dropped/merged some.
  if (numbered.length >= 2) {
    const byIdx = new Map<number, any>();
    for (const c of fc.claims) {
      if (typeof (c as any).index === "number") byIdx.set((c as any).index, c);
    }
    const placeholder = (item: { idx: number; text: string }) => ({
      index: item.idx,
      claim: item.text.slice(0, 200),
      verdict: "uncertain" as const,
      note: "Not explicitly assessed in the analysis — please review.",
    });
    if (byIdx.size > 0) {
      // Index-based: rebuild in item order, back-filling any the model skipped.
      fc.claims = numbered.map((item) => byIdx.get(item.idx) ?? placeholder(item));
    } else if (fc.claims.length < numbered.length) {
      // No indexes returned — pad to the item count from the tail items.
      for (let i = fc.claims.length; i < numbered.length; i++) {
        fc.claims.push(placeholder(numbered[i]));
      }
    }
  }

  const citations = (gather.citations || []).map((c) => ({
    kind: "web" as const,
    label: c.title || c.url,
    url: c.url,
    title: c.title,
    snippet: c.snippet,
  }));
  return { ...fc, citations, backend: structured.backend };
}

// ── B3 — the two-call fact-check engine ────────────────────────────────────

const validationRunFactCheck: Handler = async (req, res, ctx) => {
  if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
  const { db, uid, primaryUid, userData } = ctx;
  const {
    surface,
    targetType,
    targetId,
    contextId,
    label,
    content,
    ratingsContext,
  } = req.body || {};

  if (!surface || !targetId || !content) {
    return res
      .status(400)
      .json({ error: "Missing surface, targetId or content" });
  }
  const userName =
    userData?.displayName || userData?.name || userData?.companyName || null;

  try {
    // Batch the items so EVERY one is covered regardless of count, then merge.
    const { chunks, droppedNote } = buildFactCheckChunks(String(content));
    const partials = await runWithConcurrency(
      chunks,
      FACTCHECK_CONCURRENCY,
      (chunk, i) =>
        factCheckChunk(
          ctx,
          chunk,
          String(surface),
          // ratingsContext only on the first batch (avoid repeat score flags).
          i === 0 && ratingsContext ? String(ratingsContext) : undefined,
        ),
    );

    const allClaims: any[] = [];
    const allFlags: any[] = [];
    const allCitations: any[] = [];
    const summaries: string[] = [];
    let confSum = 0;
    let confWeight = 0;
    let backend = "";
    for (const p of partials) {
      allClaims.push(...p.claims);
      allFlags.push(...p.ratingFlags);
      allCitations.push(...p.citations);
      if (p.summary) summaries.push(p.summary);
      const w = Math.max(1, p.claims.length);
      confSum += p.overallConfidence * w;
      confWeight += w;
      backend = backend || p.backend;
    }

    // Dedupe citations by url (cap 60).
    const seenUrls = new Set<string>();
    const citations: any[] = [];
    for (const c of allCitations) {
      if (c.url && !seenUrls.has(c.url)) {
        seenUrls.add(c.url);
        citations.push(c);
        if (citations.length >= 60) break;
      }
    }

    const overallConfidence = confWeight
      ? Math.max(0, Math.min(1, confSum / confWeight))
      : 0.5;
    const mergedSummary = (
      (chunks.length > 1
        ? `Fact-checked ${allClaims.length} claims across ${chunks.length} batches.${droppedNote} `
        : "") + (summaries[0] || "")
    ).slice(0, 1500);
    const factCheck = {
      claims: allClaims.slice(0, 1000),
      ratingFlags: allFlags.slice(0, 200),
      overallConfidence,
      summary: mergedSummary,
    };

    const now = new Date().toISOString();
    const recordLabel = String(label || `${surface} fact-check`);
    const id = validationDocId(primaryUid, surface, targetId);
    const record = {
      id,
      clientId: primaryUid, // tenant boundary
      contextId: contextId ? String(contextId) : "",
      surface: String(surface),
      targetType: String(targetType || surface),
      targetId: String(targetId),
      label: recordLabel,
      status: "awaiting_validation" as const,
      factCheck,
      citations,
      attachments: [],
      initiatedBy: uid,
      initiatedAt: now,
      events: [
        { type: "fact_check_run", by: uid, byName: userName, at: now },
      ],
    };

    await db.collection(VALIDATIONS_COLLECTION).doc(id).set(record);

    // Audit log — awaited BEFORE the response (serverless teardown safety).
    const unsupported = factCheck.claims.filter(
      (c) => c.verdict === "unsupported",
    ).length;
    await logActivity(ctx, "fact_check_run", {
      category: "update",
      entityType: String(surface),
      entityId: String(targetId),
      entityName: recordLabel,
      details: {
        confidence: factCheck.overallConfidence,
        claims: factCheck.claims.length,
        unsupported,
        ratingFlags: factCheck.ratingFlags.length,
        sources: citations.length,
        batches: chunks.length,
        backend,
      },
    });

    return res.status(200).json({ success: true, record });
  } catch (err: any) {
    console.error("[validationRunFactCheck] failed:", err?.message ?? err);
    const status = err?.status === 429 ? 429 : 500;
    return res.status(status).json({
      error:
        status === 429
          ? "AI engine is rate-limited. Please retry in a moment."
          : "Fact-check could not be completed. Please try again.",
    });
  }
};

// ── Route map ───────────────────────────────────────────────────────────────

export const validationRoutes: Record<string, Handler> = {
  validationRunFactCheck, // B3

  // B4 — read a single validation by surface + targetId.
  validationGet: async (req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    const { surface, targetId } = req.body || {};
    if (!surface || !targetId)
      return res.status(400).json({ error: "Missing surface or targetId" });
    const id = validationDocId(ctx.primaryUid, String(surface), String(targetId));
    const doc = await ctx.db.collection(VALIDATIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return res.status(200).json({ success: true, record: null });
    const data: any = doc.data();
    if (data?.clientId !== ctx.primaryUid)
      return res.status(403).json({ error: "Forbidden" });
    return res.status(200).json({ success: true, record: { id: doc.id, ...data } });
  },

  // B4 — read all validations for a project/programme context.
  // Equality-only filters (clientId [+ contextId]) so Firestore serves it via
  // single-field index merge — NO composite index required. Sorted in memory.
  validationGetForContext: async (req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    const { contextId } = req.body || {};
    let q: any = ctx.db
      .collection(VALIDATIONS_COLLECTION)
      .where("clientId", "==", ctx.primaryUid);
    if (contextId) q = q.where("contextId", "==", String(contextId));
    const snap = await q.get();
    const records = snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        String(b.initiatedAt || "").localeCompare(String(a.initiatedAt || "")),
      );
    return res.status(200).json({ success: true, records });
  },

  // B5 — PM+ marks a record validated / rejected (gated).
  validationSetStatus: async (req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    const { surface, targetId, status, note } = req.body || {};
    if (status !== "validated" && status !== "rejected")
      return res
        .status(400)
        .json({ error: "status must be 'validated' or 'rejected'" });
    if (!surface || !targetId)
      return res.status(400).json({ error: "Missing surface or targetId" });
    if (!canValidate(ctx))
      return res.status(403).json({
        error: "Only Project Manager and above can validate.",
      });

    const id = validationDocId(ctx.primaryUid, String(surface), String(targetId));
    const ref = ctx.db.collection(VALIDATIONS_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: "Validation record not found" });
    const data: any = doc.data();
    if (data?.clientId !== ctx.primaryUid)
      return res.status(403).json({ error: "Forbidden" });

    // Idempotency: re-applying the status it's already in is a no-op — skip the
    // re-stamp + duplicate audit-log entry. (Flipping to the other status is fine.)
    if (data?.status === status) {
      return res.status(200).json({ success: true, status, unchanged: true });
    }

    const now = new Date().toISOString();
    const userName =
      ctx.userData?.displayName ||
      ctx.userData?.name ||
      ctx.userData?.companyName ||
      null;
    await ref.update({
      status,
      validatedBy: ctx.uid,
      validatedAt: now,
      events: FieldValue.arrayUnion({
        type: status,
        by: ctx.uid,
        byName: userName,
        at: now,
        note: note ? String(note) : null,
      }),
    });

    await logActivity(
      ctx,
      status === "validated" ? "validation_validated" : "validation_rejected",
      {
        category: "approve",
        entityType: String(surface),
        entityId: String(targetId),
        entityName: data?.label || `${surface} fact-check`,
        details: { note: note ? String(note) : null },
      },
    );
    return res.status(200).json({ success: true, status });
  },

  // B6 — attach a source link or uploaded file to a record (Q7=A).
  validationAttachSource: async (req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    const { surface, targetId, attachment } = req.body || {};
    if (!surface || !targetId || !attachment)
      return res
        .status(400)
        .json({ error: "Missing surface, targetId or attachment" });

    const id = validationDocId(ctx.primaryUid, String(surface), String(targetId));
    const ref = ctx.db.collection(VALIDATIONS_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: "Validation record not found" });
    if ((doc.data() as any)?.clientId !== ctx.primaryUid)
      return res.status(403).json({ error: "Forbidden" });

    const now = new Date().toISOString();
    const userName =
      ctx.userData?.displayName || ctx.userData?.name || null;
    let entry: any;

    if (attachment.kind === "link") {
      if (!attachment.url)
        return res.status(400).json({ error: "Missing link url" });
      entry = {
        kind: "link",
        url: String(attachment.url),
        title: String(attachment.title || attachment.url),
        addedBy: ctx.uid,
        addedAt: now,
      };
    } else if (attachment.kind === "file") {
      if (!attachment.base64)
        return res.status(400).json({ error: "Missing file data" });
      const raw = String(attachment.base64);
      const payload = raw.includes(",") ? raw.split(",")[1] : raw;
      const buffer = Buffer.from(payload, "base64");
      if (buffer.length > VALIDATION_MAX_FILE_BYTES)
        return res.status(413).json({
          error: `File too large. Maximum is ${VALIDATION_MAX_FILE_BYTES / 1024 / 1024} MB.`,
        });
      const safeName = String(attachment.title || "document")
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .slice(0, 80);
      const path = `validations/${ctx.primaryUid}/${id}/${Date.now()}-${safeName}`;
      const { url } = await uploadAsset(
        path,
        buffer,
        String(attachment.mime || "application/octet-stream"),
        { makePublic: true },
      );
      entry = {
        kind: "file",
        url,
        title: String(attachment.title || safeName),
        storagePath: path,
        addedBy: ctx.uid,
        addedAt: now,
      };
    } else {
      return res.status(400).json({ error: "attachment.kind must be 'link' or 'file'" });
    }

    await ref.update({
      attachments: FieldValue.arrayUnion(entry),
      events: FieldValue.arrayUnion({
        type: "source_added",
        by: ctx.uid,
        byName: userName,
        at: now,
      }),
    });
    await logActivity(ctx, "validation_source_added", {
      category: "update",
      entityType: String(surface),
      entityId: String(targetId),
      entityName: (doc.data() as any)?.label || `${surface} fact-check`,
      details: { kind: entry.kind },
    });
    return res.status(200).json({ success: true, attachment: entry });
  },

  // B6 — remove an attached source (and its GCS object if a file).
  validationRemoveAttachment: async (req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    const { surface, targetId, url } = req.body || {};
    if (!surface || !targetId || !url)
      return res.status(400).json({ error: "Missing surface, targetId or url" });

    const id = validationDocId(ctx.primaryUid, String(surface), String(targetId));
    const ref = ctx.db.collection(VALIDATIONS_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: "Validation record not found" });
    const data: any = doc.data();
    if (data?.clientId !== ctx.primaryUid)
      return res.status(403).json({ error: "Forbidden" });

    const attachments: any[] = Array.isArray(data?.attachments)
      ? data.attachments
      : [];
    const target = attachments.find((a) => a.url === url);
    if (!target)
      return res.status(404).json({ error: "Attachment not found" });
    // Clean up the GCS object for uploaded files (close the orphan).
    if (target.kind === "file" && target.storagePath) {
      try {
        await deleteAsset(target.storagePath);
      } catch (e: any) {
        console.warn(
          "[validationRemoveAttachment] deleteAsset failed:",
          e?.message ?? e,
        );
      }
    }
    const now = new Date().toISOString();
    const userName =
      ctx.userData?.displayName || ctx.userData?.name || null;
    await ref.update({
      attachments: attachments.filter((a) => a.url !== url),
      events: FieldValue.arrayUnion({
        type: "source_removed",
        by: ctx.uid,
        byName: userName,
        at: now,
      }),
    });
    await logActivity(ctx, "validation_source_removed", {
      category: "update",
      entityType: String(surface),
      entityId: String(targetId),
      entityName: data?.label || `${surface} fact-check`,
    });
    return res.status(200).json({ success: true });
  },
};

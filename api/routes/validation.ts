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
  const safeContent = String(content).slice(0, 8000);
  const userName =
    userData?.displayName || userData?.name || userData?.companyName || null;

  try {
    // ── Call 1 — web-grounded gather (free-form text, web search ON) ───────
    const gatherPrompt = [
      "You are a compliance fact-checker for a UK construction / property compliance & risk platform.",
      `Below is an AI-generated "${surface}" output. Identify every factual claim it makes (named regulations, legal duties, statutory deadlines, numeric thresholds, obligations) and verify each against authoritative UK sources.`,
      "Use web search and prefer primary sources: legislation.gov.uk, gov.uk, HSE, the Building Safety Regulator, and the relevant regulators.",
      ratingsContext
        ? `Also review these stated ratings/scores and FLAG any that look inconsistent or out of line — do NOT change them, only note them for human review:\n${String(ratingsContext).slice(0, 1500)}`
        : "",
      "",
      "CONTENT TO VERIFY:",
      safeContent,
      "",
      "Write a thorough analysis: for each claim state whether it is supported, unsupported, or uncertain, and cite the source you relied on. End with a one-paragraph overall assessment and your confidence (0-100%).",
    ]
      .filter(Boolean)
      .join("\n");

    const gather = await runAIOperation({
      ctx,
      prompt: gatherPrompt,
      webSearch: true,
      action: "validationFactCheckGather",
      config: { temperature: 0.3, maxOutputTokens: 4096 },
    });

    // ── Call 2 — structure the analysis into strict JSON (no web) ──────────
    const structurePrompt = [
      "Convert the following compliance fact-check analysis into the required JSON.",
      "verdict must be one of: supported | unsupported | uncertain.",
      "overallConfidence is a number between 0 and 1.",
      "ratingFlags lists any scores/ratings that looked off (empty array if none).",
      "",
      "ANALYSIS:",
      gather.text.slice(0, 8000),
    ].join("\n");

    const structured = await runAIOperation({
      ctx,
      prompt: structurePrompt,
      action: "validationFactCheckStructure",
      config: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: FACTCHECK_SCHEMA,
      },
    });

    const factCheck = coerceFactCheck(
      parseAIResponse(structured.text || "", {}),
      gather.text,
    );

    // Web citations from Call 1 → unified ValidationCitation shape.
    const citations = (gather.citations || []).map((c) => ({
      kind: "web" as const,
      label: c.title || c.url,
      url: c.url,
      title: c.title,
      snippet: c.snippet,
    }));

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
        backend: structured.backend,
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

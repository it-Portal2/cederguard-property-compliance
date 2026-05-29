// Technical Assurance Companion (TAC) — backend route handler map.
//
// Enquiry capture (E1). Six endpoints for the CRUD shell:
//   1. tacListEnquiries — list scoped by clientId; optional `mine`
//   2. tacGetEnquiry — single read, cross-tenant guard
//   3. tacUpsertEnquiry — Draft only; field whitelist; auto-id on create
//   4. tacAttachFile — base64 → storage → append to enquiry doc
//   5. tacRemoveAttachment — delete from storage + remove from doc
//   6. tacSoftDeleteEnquiry — soft-delete + restore via the same endpoint
//
//  lands `tacBuildInsightPrompt` + `tacFinaliseInsight`. The actual
// Gemini call goes through the existing `aiRoutes.geminiPrompt` route so
// all AI traffic shares the dual-key + dual-model + retry rotation.
// Phases 4-9 layer state-transition,
// share, close, unlock and audit endpoints on top.
//
// Standard return shape:
//   success → { success: true, .payload }
//   failure → { success: false, error: string, code?: string }

import type { ApiContext } from "../lib/context.js";
import {
  decodeBase64TacFile,
  tacAttachmentPath,
  uploadTacAttachment,
  deleteTacAttachment,
  TAC_MAX_ENQUIRY_BYTES,
  TAC_INITIAL_AV_STATUS,
} from "../lib/tacFileUpload.js";
import { seedTacEnquiriesIfMissing } from "../lib/tacEnquiriesSeed.js";
import {
  prepareInsightGeneration,
  finaliseInsightGeneration,
} from "../lib/tacInsightGenerator.js";
import { readAssetAsDataUri } from "../lib/storage.js";
import {
  loadCostRates,
  seedCostRatesIfMissing,
} from "../lib/costRatesSeed.js";
import {
  loadRegulationsCorpus,
  seedRegulationsCorpusIfMissing,
} from "../lib/regulationsCorpusSeed.js";
import {
  renderCompliancePackPdf,
  compliancePackFilename,
} from "../lib/tacCompliancePackPdf.js";
import {
  renderDecisionLogPdf,
  decisionLogFilename,
} from "../lib/tacDecisionLogPdf.js";

// Constants ------------------------------------------------------------

const RIBA_STAGES = new Set([
  "S0",
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
]);

// Whitelisted fields client may set on an enquiry via tacUpsertEnquiry.
// Anything not on this list is silently dropped.
const ENQUIRY_WRITABLE_FIELDS = [
  "title",
  "query",
  "ribaStage",
  "projectId",
] as const;

const ENQUIRY_TITLE_MAX = 200;
const ENQUIRY_QUERY_MAX = 8000;

// Helpers --------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function pickFields(
  input: Record<string, any>,
  allowed: readonly string[],
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (key in input) out[key] = input[key];
  }
  return out;
}

function makeEnquiryId(): string {
  // Short, collision-resistant: 7 base36 chars + ms timestamp tail.
  const rand = Math.random().toString(36).slice(2, 9);
  const tail = (Date.now() % 1_000_000).toString(36);
  return `tac-${rand}-${tail}`;
}

function makeAttachmentId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const tail = (Date.now() % 1_000_000).toString(36);
  return `att-${rand}-${tail}`;
}

function compositeId(clientId: string, enquiryId: string): string {
  return `${clientId}_${enquiryId}`;
}

/**
 * Load an enquiry doc + run the standard tenant + state guard.
 * Mirrors the `loadEditableMeeting` / `loadFpItemForTransition` pattern from
 *  / 5.5b governance — centralises ID validation + cross-tenant
 * scoping + owner-or-admin check + state-machine guard so each endpoint
 * stays focused on its own logic.
 * Returns `{ docRef, doc }` on success, or `null` after writing the error
 * response (the caller just `return`s).
 */
async function loadEnquiryForMutation(
  ctx: ApiContext,
  enquiryId: string,
  res: any,
  options: {
    allowedStatuses?: string[];
    requireOwnerOrAdmin?: boolean;
  } = {},
): Promise<{ docRef: any; doc: any } | null> {
  if (!enquiryId || typeof enquiryId !== "string" || enquiryId.length > 128) {
    res.status(400).json({
      success: false,
      error: "enquiryId is required (string, ≤128 chars).",
      code: "INVALID_INPUT",
    });
    return null;
  }
  const docId = compositeId(ctx.primaryUid, enquiryId);
  const docRef = ctx.db.collection("enquiries").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) {
    res.status(404).json({
      success: false,
      error: "Enquiry not found.",
      code: "NOT_FOUND",
    });
    return null;
  }
  const doc = snap.data() ?? {};
  if (doc.clientId !== ctx.primaryUid) {
    // Defence-in-depth — composite-id pattern means cross-tenant docs can't
    // share an ID with this client's docs, but explicit check anyway.
    res.status(403).json({
      success: false,
      error: "Forbidden.",
      code: "CROSS_TENANT",
    });
    return null;
  }
  if (
    options.requireOwnerOrAdmin !== false &&
    !ctx.isAdmin &&
    !ctx.isClientAdmin &&
    doc.ownerUid !== ctx.uid
  ) {
    res.status(403).json({
      success: false,
      error: "Only the enquiry owner or a Client Admin can perform this action.",
      code: "FORBIDDEN",
    });
    return null;
  }
  if (
    options.allowedStatuses &&
    !options.allowedStatuses.includes(doc.status ?? "Draft")
  ) {
    res.status(400).json({
      success: false,
      error: `Action not allowed in status "${doc.status}". Allowed: ${options.allowedStatuses.join(", ")}.`,
      code: "INVALID_STATE",
    });
    return null;
  }
  return { docRef, doc };
}

// Endpoint 1: tacListEnquiries ----------------------------------------

async function tacListEnquiries(req: any, res: any, ctx: ApiContext) {
  try {
    const { mine } = req.body ?? {};
    // Seed-on-first-read — gives a fresh workspace 2 sample enquiries so the
    // table chrome + StatsCards are visually verifiable from first load.
    // probe-then-batch pattern, idempotent — never duplicates.
    await seedTacEnquiriesIfMissing(ctx);
    let q: any = ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid);
    if (mine === true) {
      q = q.where("ownerUid", "==", ctx.uid);
    }
    const snap = await q.get();
    const items = snap.docs.map((d: any) => ({
      ...d.data(),
      // Strip the composite Firestore doc id; expose only the bare entity id
      // (e.g. `tac-abc-1234`) which is what the client routes are built on.
      id: (d.data()?.id as string) ?? d.id.replace(`${ctx.primaryUid}_`, ""),
    }));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error("[tacListEnquiries] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load enquiries.",
      code: "LIST_FAILED",
    });
  }
}

// Endpoint 2: tacGetEnquiry -------------------------------------------

async function tacGetEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    if (!enquiryId || typeof enquiryId !== "string") {
      return res.status(400).json({
        success: false,
        error: "enquiryId is required.",
        code: "INVALID_INPUT",
      });
    }
    const docId = compositeId(ctx.primaryUid, enquiryId);
    const snap = await ctx.db.collection("enquiries").doc(docId).get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Enquiry not found.",
        code: "NOT_FOUND",
      });
    }
    const doc = snap.data() ?? {};
    if (doc.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: "Forbidden.",
        code: "CROSS_TENANT",
      });
    }
    return res.status(200).json({ success: true, item: doc });
  } catch (e: any) {
    console.error("[tacGetEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load enquiry.",
      code: "GET_FAILED",
    });
  }
}

// Endpoint 3: tacUpsertEnquiry ----------------------------------------

async function tacUpsertEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, patch } = req.body ?? {};
    if (!patch || typeof patch !== "object") {
      return res.status(400).json({
        success: false,
        error: "patch is required.",
        code: "INVALID_INPUT",
      });
    }

    const safePatch = pickFields(patch, ENQUIRY_WRITABLE_FIELDS);

    // Per-field validation.
    if (safePatch.ribaStage !== undefined) {
      if (!RIBA_STAGES.has(safePatch.ribaStage)) {
        return res.status(400).json({
          success: false,
          error: "ribaStage must be one of S0…S7.",
          code: "INVALID_INPUT",
        });
      }
    }
    if (safePatch.title !== undefined) {
      if (typeof safePatch.title !== "string") {
        return res.status(400).json({
          success: false,
          error: "title must be a string.",
          code: "INVALID_INPUT",
        });
      }
      safePatch.title = safePatch.title.trim().slice(0, ENQUIRY_TITLE_MAX);
    }
    if (safePatch.query !== undefined) {
      if (typeof safePatch.query !== "string") {
        return res.status(400).json({
          success: false,
          error: "query must be a string.",
          code: "INVALID_INPUT",
        });
      }
      safePatch.query = safePatch.query.slice(0, ENQUIRY_QUERY_MAX);
    }
    if (safePatch.projectId !== undefined) {
      if (typeof safePatch.projectId !== "string" || !safePatch.projectId) {
        return res.status(400).json({
          success: false,
          error: "projectId is required.",
          code: "INVALID_INPUT",
        });
      }
      const ok = await ctx.isAuthorizedForContext(safePatch.projectId);
      if (!ok) {
        return res.status(403).json({
          success: false,
          error: "You don't have access to that project.",
          code: "FORBIDDEN",
        });
      }
    }

    const isCreate = !enquiryId;
    const id = isCreate ? makeEnquiryId() : enquiryId;
    const docId = compositeId(ctx.primaryUid, id);
    const docRef = ctx.db.collection("enquiries").doc(docId);

    if (isCreate) {
      // Create — title + projectId required, ribaStage strongly recommended.
      if (!safePatch.title) {
        return res.status(400).json({
          success: false,
          error: "title is required.",
          code: "INVALID_INPUT",
        });
      }
      if (!safePatch.projectId) {
        return res.status(400).json({
          success: false,
          error: "projectId is required.",
          code: "INVALID_INPUT",
        });
      }
      const newDoc = {
        ...safePatch,
        id,
        clientId: ctx.primaryUid,
        ownerUid: ctx.uid,
        status: "Draft" as const,
        attachments: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await docRef.set(newDoc);
      return res.status(200).json({ success: true, item: newDoc });
    }

    // Update — only Draft enquiries are mutable here. State transitions go
    // through dedicated endpoints in later phases.
    const guard = await loadEnquiryForMutation(ctx, id, res, {
      allowedStatuses: ["Draft"],
    });
    if (!guard) return; // response already sent
    const merged = {
      ...safePatch,
      updatedAt: nowIso(),
    };
    await guard.docRef.set(merged, { merge: true });
    const next = { ...guard.doc, ...merged };
    return res.status(200).json({ success: true, item: next });
  } catch (e: any) {
    console.error("[tacUpsertEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to save enquiry.",
      code: "UPSERT_FAILED",
    });
  }
}

// Endpoint 4: tacAttachFile -------------------------------------------
//
// Decodes a base64 file payload, uploads it to GCS via the Admin SDK with
// `makePublic: true` so the returned URL is stable + browser-openable, and
// appends the attachment metadata (including that URL) to the enquiry doc.
// Capped at TAC_MAX_FILE_BYTES (3 MB) per file due to Vercel's 4.5 MB
// serverless body limit; per-enquiry total cap TAC_MAX_ENQUIRY_BYTES
// (200 MB) is also enforced here.
//
// Downloads: the stored `attachment.url` is the public GCS URL — clients
// just open it directly. Paths include the random `attachmentId` so URLs
// are not practically guessable.
//
// History (2026-05-30): briefly migrated to V4 signed PUT + signed GET URLs
// but rolled back due to reproducible `SignatureDoesNotMatch` failures
// in the @google-cloud/storage V4 signing path against `.firebasestorage.app`
// buckets — BOTH write and read URLs were affected. See M1.9 in
// `~/.claude/plans/cuddly-watching-lantern.md`.

async function tacAttachFile(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, fileName, mimeType, fileBase64 } = req.body ?? {};
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({
        success: false,
        error: "fileName is required.",
        code: "INVALID_INPUT",
      });
    }
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      allowedStatuses: ["Draft"],
    });
    if (!guard) return;

    // Per-enquiry total size cap (PRD US-1.2 — 200 MB).
    const existing = (guard.doc.attachments ?? []) as any[];
    const existingTotal = existing.reduce(
      (acc, a) => acc + (Number(a.fileSize) || 0),
      0,
    );

    // Decode + validate.
    const { buffer, mime, ext } = decodeBase64TacFile(
      fileBase64,
      fileName,
      mimeType,
    );
    if (existingTotal + buffer.length > TAC_MAX_ENQUIRY_BYTES) {
      const maxMb = (TAC_MAX_ENQUIRY_BYTES / 1024 / 1024).toFixed(0);
      return res.status(400).json({
        success: false,
        error: `Adding this file would exceed the ${maxMb} MB total cap for this enquiry.`,
        code: "MAX_ENQUIRY_SIZE",
      });
    }

    const attachmentId = makeAttachmentId();
    const path = tacAttachmentPath(ctx.primaryUid, enquiryId, attachmentId, ext);

    // Upload + makePublic via uploadAsset → returns the stable GCS URL.
    // Store the URL on the attachment record so the client can render the
    // download link without an extra API hop.
    const { url } = await uploadTacAttachment(path, buffer, mime);

    const attachment = {
      id: attachmentId,
      storagePath: path,
      url,
      fileName: String(fileName).slice(0, 200),
      fileSize: buffer.length,
      mimeType: mime,
      avScanStatus: TAC_INITIAL_AV_STATUS,
      uploadedAt: nowIso(),
      uploadedBy: ctx.uid,
    };

    const nextAttachments = [...existing, attachment];
    await guard.docRef.set(
      { attachments: nextAttachments, updatedAt: nowIso() },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      attachment,
    });
  } catch (e: any) {
    console.error("[tacAttachFile] failed:", e);
    const code =
      typeof e?.message === "string" && e.message.startsWith("File")
        ? "INVALID_INPUT"
        : "ATTACH_FAILED";
    return res.status(400).json({
      success: false,
      error: e?.message ?? "Attachment upload failed.",
      code,
    });
  }
}


// Endpoint 5: tacRemoveAttachment -------------------------------------

async function tacRemoveAttachment(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, attachmentId } = req.body ?? {};
    if (!attachmentId || typeof attachmentId !== "string") {
      return res.status(400).json({
        success: false,
        error: "attachmentId is required.",
        code: "INVALID_INPUT",
      });
    }
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      allowedStatuses: ["Draft"],
    });
    if (!guard) return;

    const existing = (guard.doc.attachments ?? []) as any[];
    const target = existing.find((a) => a.id === attachmentId);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "Attachment not found.",
        code: "NOT_FOUND",
      });
    }

    // Best-effort storage delete — file may already be gone if the upload
    // half-completed. We still strip it from the doc so the UI clears.
    if (target.storagePath) {
      try {
        await deleteTacAttachment(target.storagePath);
      } catch (storageErr) {
        console.warn(
          "[tacRemoveAttachment] storage delete failed (non-fatal):",
          storageErr,
        );
      }
    }

    const next = existing.filter((a) => a.id !== attachmentId);
    await guard.docRef.set(
      { attachments: next, updatedAt: nowIso() },
      { merge: true },
    );

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error("[tacRemoveAttachment] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to remove attachment.",
      code: "REMOVE_FAILED",
    });
  }
}

// Endpoint 6: tacDeleteEnquiry ----------------------------------------
//
// Permanent (hard) delete — removes the enquiry doc, every `tabs/*`
// sub-collection deliverable, every Firebase Storage file referenced by the
// enquiry's attachments, AND every issued RFI in the workspace `rfis/`
// register that points back at this enquiry. Nothing is preserved
// client-side; the row disappears from the list, the storage tier stops
// billing for those blobs, and the RFI register no longer carries orphaned
// rows pointing at a deleted enquiry.

async function tacDeleteEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    const doc = guard.doc;

    // 1. Delete every storage attachment best-effort (a single failed
    //    delete doesn't abort the operation; the storage path is logged).
    const attachments = Array.isArray(doc.attachments) ? doc.attachments : [];
    await Promise.all(
      attachments.map(async (a: any) => {
        if (!a?.storagePath) return;
        try {
          await deleteTacAttachment(String(a.storagePath));
        } catch (storageErr) {
          console.warn(
            "[tacDeleteEnquiry] storage delete failed (non-fatal):",
            a.storagePath,
            storageErr,
          );
        }
      }),
    );

    // 2. Delete all `tabs/*` deliverable docs (Firestore doesn't auto-purge
    //    sub-collections on parent delete).
    try {
      const tabsSnap = await guard.docRef.collection("tabs").get();
      if (!tabsSnap.empty) {
        const batch = ctx.db.batch();
        tabsSnap.docs.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (tabsErr) {
      console.warn(
        "[tacDeleteEnquiry] tabs subcollection delete failed (non-fatal):",
        tabsErr,
      );
    }

    // 3. Cascade-delete every RFI in the workspace register that references
    //    this enquiry. Without this, deleting an enquiry leaves zombie rows
    //    on RfiRegisterPage that link to a non-existent enquiry.
    try {
      const rfisSnap = await ctx.db
        .collection("rfis")
        .where("clientId", "==", ctx.primaryUid)
        .where("enquiryId", "==", doc.id)
        .get();
      if (!rfisSnap.empty) {
        const batch = ctx.db.batch();
        rfisSnap.docs.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (rfisErr) {
      console.warn(
        "[tacDeleteEnquiry] rfi register cascade delete failed (non-fatal):",
        rfisErr,
      );
    }

    // 4. Delete the parent enquiry doc.
    await guard.docRef.delete();

    return res.status(200).json({ success: true, deleted: true });
  } catch (e: any) {
    console.error("[tacDeleteEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to delete enquiry.",
      code: "DELETE_FAILED",
    });
  }
}

// Endpoint 7: tacBuildInsightPrompt (step 1) -------------------
//
// Two-step pipeline (the actual Gemini call happens via the existing
// `aiRoutes.geminiPrompt` route — single source of truth for AI traffic +
// the dual-key + dual-model + retry rotation).
//
//   step 1 → tacBuildInsightPrompt (this endpoint)
//                ↓
//            client calls existing api.geminiPrompt(prompt, config)
//                ↓
//   step 2 → tacFinaliseInsight (writes deliverable + flips status)

// Hard cap on PDF base64 payload size — Vercel serverless has a body limit
// and Gemini handles inline binary up to a few MB cleanly. Larger PDFs fall
// back to the side-by-side rendering (no overlay coordinates).
const PDF_INLINE_MAX_BYTES = 6 * 1024 * 1024; // 6 MB raw → ~8 MB base64

/** Pulls the first PDF attachment from the enquiry doc + tries to load its
 *  bytes from Storage as a base64 string suitable for `inlineData`. Returns
 *  null on any failure (PDF too big / not present / read error) so the
 *  insight generation degrades gracefully to no overlay.*/
async function loadPrimaryPdfInline(
  ctx: ApiContext,
  doc: any,
): Promise<{ mimeType: string; data: string; fileName: string } | null> {
  const attachments = Array.isArray(doc.attachments) ? doc.attachments : [];
  const pdf = attachments.find(
    (a: any) =>
      a?.mimeType === "application/pdf" ||
      String(a?.fileName ?? "").toLowerCase().endsWith(".pdf"),
  );
  if (!pdf?.storagePath) return null;
  // Only attempt inline send when storage-side size is below the cap.
  const sizeBytes = Number(pdf.fileSize) || 0;
  if (sizeBytes > 0 && sizeBytes > PDF_INLINE_MAX_BYTES) return null;
  try {
    const dataUri = await readAssetAsDataUri(pdf.storagePath);
    if (!dataUri) return null;
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
    if (!match) return null;
    const [, mimeType, data] = match;
    return {
      mimeType,
      data,
      fileName: String(pdf.fileName ?? "drawing.pdf"),
    };
  } catch (e) {
    console.warn("[loadPrimaryPdfInline] failed (non-fatal):", e);
    return null;
  }
}

async function tacBuildInsightPrompt(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      allowedStatuses: ["Draft"],
    });
    if (!guard) return;

    const result = await prepareInsightGeneration({
      ctx,
      docRef: guard.docRef,
      doc: guard.doc,
    });
    if (result.ok === false) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }

    // also try to load the source PDF inline so the client can
    // pass it to Gemini for visual analysis (yields per-annotation x/y
    // coordinates). Best-effort: null on any failure.
    const pdfInlineData = await loadPrimaryPdfInline(ctx, guard.doc);

    //  hot-fix #2 — flag whether the enquiry has substantive context
    // that warrants a one-shot retry if costProgramme comes back null. The
    // client uses this to decide whether to re-prompt for cost+programme.
    const queryLen = String(guard.doc.query ?? "").length;
    const attachmentCount = Array.isArray(guard.doc.attachments)
      ? guard.doc.attachments.length
      : 0;
    const isSubstantive = queryLen > 100 || attachmentCount > 0;

    return res.status(200).json({
      success: true,
      prompt: result.prompt,
      corpusRegIds: result.corpusRegIds,
      pdfInlineData,
      isSubstantive,
    });
  } catch (e: any) {
    console.error("[tacBuildInsightPrompt] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to build insight prompt.",
      code: "BUILD_PROMPT_FAILED",
    });
  }
}

// Endpoint 7b: tacFinaliseInsight (step 2) --------------------

async function tacFinaliseInsight(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, summary } = req.body ?? {};
    if (!summary || typeof summary !== "object") {
      return res.status(400).json({
        success: false,
        error: "summary (AI response) is required.",
        code: "INVALID_INPUT",
      });
    }
    // Allow Generating or Draft (in case the user retries after a transient
    // network failure that left the client in Generating but the server
    // already rolled back).
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      allowedStatuses: ["Generating", "Draft"],
    });
    if (!guard) return;

    const result = await finaliseInsightGeneration({
      ctx,
      docRef: guard.docRef,
      doc: guard.doc,
      summary,
    });
    if (result.ok === false) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
    return res.status(200).json({
      success: true,
      enquiry: result.enquiry,
      summary: result.summary,
    });
  } catch (e: any) {
    console.error("[tacFinaliseInsight] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to save insight.",
      code: "FINALISE_FAILED",
    });
  }
}

// Endpoint 8: tacGetEnquiryDeliverable ----------------------
// Reads a single tab's deliverable doc (7 will use this for the
// Drawing / RFI / Cost / Compliance tabs as they land).

async function tacGetEnquiryDeliverable(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, tabId } = req.body ?? {};
    if (!enquiryId || typeof enquiryId !== "string") {
      return res.status(400).json({
        success: false,
        error: "enquiryId is required.",
        code: "INVALID_INPUT",
      });
    }
    const tab = String(tabId ?? "summary");
    if (
      !["summary", "drawing", "rfi", "costProgramme", "compliance"].includes(
        tab,
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "tabId must be one of summary | drawing | rfi | costProgramme | compliance.",
        code: "INVALID_INPUT",
      });
    }
    const docId = compositeId(ctx.primaryUid, enquiryId);
    const enqSnap = await ctx.db.collection("enquiries").doc(docId).get();
    if (!enqSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Enquiry not found.",
        code: "NOT_FOUND",
      });
    }
    const enqData = enqSnap.data() ?? {};
    if (enqData.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: "Forbidden.",
        code: "CROSS_TENANT",
      });
    }

    const tabSnap = await ctx.db
      .collection("enquiries")
      .doc(docId)
      .collection("tabs")
      .doc(tab)
      .get();

    return res.status(200).json({
      success: true,
      enquiry: enqData,
      deliverable: tabSnap.exists ? tabSnap.data() : null,
    });
  } catch (e: any) {
    console.error("[tacGetEnquiryDeliverable] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load deliverable.",
      code: "LOAD_FAILED",
    });
  }
}

// Endpoint 9: tacUpsertRfiDraft -----------------------------
//
// User-edited tweaks to the auto-populated RFI on the RFI tab. Patches
// the `tabs/rfi.content` deliverable in place. Status must remain `Draft`
// once Issued, the RFI is locked + lives in `rfis/{rfiNumber}`.

const RFI_WRITABLE_FIELDS = [
  "subject",
  "body",
  "priority",
  "recipients",
] as const;

async function tacUpsertRfiDraft(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, rfi } = req.body ?? {};
    if (!rfi || typeof rfi !== "object") {
      return res.status(400).json({
        success: false,
        error: "rfi patch is required.",
        code: "INVALID_INPUT",
      });
    }
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      // Allow saving edits even after the enquiry was Closed/Archived in
      // case the user reopens for correction in a later phase.
      allowedStatuses: ["Open", "AwaitingReview", "Approved", "Closed"],
    });
    if (!guard) return;
    // Edits are persisted into `tabs/summary.content.rfi` — single source of
    // truth read by the workspace UI on every reload.
    const summaryTabRef = guard.docRef.collection("tabs").doc("summary");
    const tabSnap = await summaryTabRef.get();
    if (!tabSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Summary deliverable not found. Run Generate insight first.",
        code: "NOT_FOUND",
      });
    }
    const summaryContent = (tabSnap.data()?.content ?? {}) as any;
    const existing = (summaryContent.rfi ?? {}) as any;
    if ((existing.status ?? "Draft") !== "Draft") {
      return res.status(400).json({
        success: false,
        error: "Issued RFIs cannot be edited.",
        code: "INVALID_STATE",
      });
    }
    const safe: Record<string, any> = {};
    for (const k of RFI_WRITABLE_FIELDS) if (k in rfi) safe[k] = rfi[k];
    if (typeof safe.subject === "string") {
      safe.subject = safe.subject.trim().slice(0, 200);
    }
    if (typeof safe.body === "string") {
      safe.body = safe.body.trim().slice(0, 8000);
    }
    if (
      safe.priority &&
      !["high", "medium", "low"].includes(safe.priority)
    ) {
      delete safe.priority;
    }
    if (Array.isArray(safe.recipients)) {
      safe.recipients = safe.recipients
        .map((r: any) => ({
          uid: r?.uid ? String(r.uid) : undefined,
          email: String(r?.email ?? "").trim().toLowerCase().slice(0, 200),
          name: r?.name ? String(r.name).slice(0, 80) : undefined,
          role: r?.role ? String(r.role).slice(0, 80) : undefined,
        }))
        .filter((r: any) => /^.+@.+\..+$/.test(r.email));
    }
    const nextRfi = { ...existing, ...safe };
    await summaryTabRef.set(
      {
        content: { ...summaryContent, rfi: nextRfi },
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return res.status(200).json({ success: true, content: nextRfi });
  } catch (e: any) {
    console.error("[tacUpsertRfiDraft] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to save RFI draft.",
      code: "RFI_SAVE_FAILED",
    });
  }
}

// Endpoint 10: tacIssueRfi ----------------------------------
//
// Generates an `RFI-{XXXX}-{NNN}` number, persists the RFI to the top-level
// `rfis/{clientId_rfiNumber}` collection (rules + indexes already provisioned
// in ), flips `tabs/rfi.content.status` to `Issued`, and stamps
// issuedAt + issuedBy.

function makeRfiNumber(projectId: string, sequence: number): string {
  // Project short-id: last 4 base36 chars of the projectId, uppercased.
  // Sequence: zero-padded to 3 digits.
  const shortId = (projectId || "TAC").slice(-4).toUpperCase();
  const seq = String(sequence).padStart(3, "0");
  return `RFI-${shortId}-${seq}`;
}

async function tacIssueRfi(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      allowedStatuses: ["Open", "AwaitingReview", "Approved"],
    });
    if (!guard) return;
    // Source of truth: tabs/summary.content.rfi (kept in sync with edits via
    // tacUpsertRfiDraft). The separate top-level `rfis/{rfiNumber}` write is
    // for the workspace-wide register page only.
    const summaryTabRef = guard.docRef.collection("tabs").doc("summary");
    const tabSnap = await summaryTabRef.get();
    if (!tabSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Summary deliverable not found. Run Generate insight first.",
        code: "NOT_FOUND",
      });
    }
    const summaryContent = (tabSnap.data()?.content ?? {}) as any;
    const existing = (summaryContent.rfi ?? {}) as any;
    if ((existing.status ?? "Draft") !== "Draft") {
      return res.status(400).json({
        success: false,
        error: "RFI has already been issued.",
        code: "INVALID_STATE",
      });
    }
    if (
      !existing.subject ||
      !existing.body ||
      !Array.isArray(existing.recipients) ||
      existing.recipients.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "RFI is incomplete: subject, body, and at least one recipient are required.",
        code: "INVALID_INPUT",
      });
    }

    // Per-project RFI counter — looks at existing rfis for this clientId +
    // projectId and picks max(sequence) + 1. For a v1 with low write volume
    // this is fine; can be replaced with a Firestore counter doc in
    // if concurrent issues are a concern.
    const projectId = String(guard.doc.projectId ?? "TAC");
    const existingRfisSnap = await ctx.db
      .collection("rfis")
      .where("clientId", "==", ctx.primaryUid)
      .where("projectId", "==", projectId)
      .get();
    const sequence = existingRfisSnap.size + 1;
    const rfiNumber = makeRfiNumber(projectId, sequence);

    const now = new Date().toISOString();
    const issuedRfi = {
      ...existing,
      rfiNumber,
      status: "Issued",
      issuedAt: now,
      issuedBy: ctx.uid,
    };

    const rfiRegisterRef = ctx.db
      .collection("rfis")
      .doc(`${ctx.primaryUid}_${rfiNumber}`);
    await rfiRegisterRef.set({
      rfiNumber,
      clientId: ctx.primaryUid,
      projectId,
      enquiryId: guard.doc.id,
      enquiryTitle: guard.doc.title ?? null,
      ribaStage: guard.doc.ribaStage ?? null,
      subject: issuedRfi.subject,
      body: issuedRfi.body,
      priority: issuedRfi.priority,
      recipients: issuedRfi.recipients,
      status: "Issued",
      issuedAt: now,
      issuedBy: ctx.uid,
    });

    await summaryTabRef.set(
      {
        content: { ...summaryContent, rfi: issuedRfi },
        updatedAt: now,
      },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      rfiNumber,
      content: issuedRfi,
    });
  } catch (e: any) {
    console.error("[tacIssueRfi] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to issue RFI.",
      code: "RFI_ISSUE_FAILED",
    });
  }
}

// Endpoint 11: tacListRfis ----------------------------------
//
// Workspace-scoped list of issued RFIs. Used by RfiRegisterPage.

async function tacListRfis(req: any, res: any, ctx: ApiContext) {
  try {
    const { projectId } = req.body ?? {};
    let q: any = ctx.db
      .collection("rfis")
      .where("clientId", "==", ctx.primaryUid);
    if (projectId && typeof projectId === "string") {
      q = q.where("projectId", "==", projectId);
    }
    const snap = await q.get();
    const items = snap.docs
      .map((d: any) => d.data())
      .sort((a: any, b: any) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error("[tacListRfis] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load RFI register.",
      code: "RFI_LIST_FAILED",
    });
  }
}

// Endpoint 12: tacListCostRates -----------------------------
//
// Returns the merged cost-rates library (shared seed unioned with the
// council's own custom rates). Used by `CostProgrammeTab` for tooltip
// lookup against `costLine.rateId` so the user sees "rate sourced from
// MVHR install per dwelling — £4,500" without an extra round-trip per
// line.

async function tacListCostRates(_req: any, res: any, ctx: ApiContext) {
  try {
    await seedCostRatesIfMissing(ctx);
    const rates = await loadCostRates(ctx);
    return res.status(200).json({ success: true, items: rates });
  } catch (e: any) {
    console.error("[tacListCostRates] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load cost rates.",
      code: "COST_RATES_LIST_FAILED",
    });
  }
}

// Endpoint 13: tacExportCostCsv -----------------------------
//
// Renders the enquiry's cost+programme costLines as a CSV string for
// download via a `<a download>` Blob URL on the client. Header row +
// per-line rows. Programme bars not exported here (separate concept; PMs
// who need a Gantt PDF use the per-page print).

function csvField(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function tacExportCostCsv(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    // Reuse the canonical loader so we get composite-key resolution + tenant
    // guard for free. Bare doc(enquiryId) lookups always 404 because the
    // collection is keyed `{primaryUid}_{enquiryId}`.
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;
    const summaryTab = await guard.docRef
      .collection("tabs")
      .doc("summary")
      .get();
    const cp = summaryTab.exists
      ? (summaryTab.data() as any)?.content?.costProgramme
      : null;
    if (!cp || !Array.isArray(cp.costLines) || cp.costLines.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No cost data on this enquiry.",
        code: "NO_COST_DATA",
      });
    }
    const header = [
      "Description",
      "Unit",
      "Quantity",
      "Rate (£)",
      "Total (£)",
      "Rate ID",
    ];
    const rows = (cp.costLines as any[]).map((l) => [
      csvField(l.description),
      csvField(l.unit),
      csvField(l.quantity),
      csvField(l.rate),
      csvField(l.total),
      csvField(l.rateId ?? ""),
    ]);
    rows.push(["", "", "", "Total", csvField(cp.totalDelta ?? 0), ""]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n") + "\n";
    const filename = `enquiry-${String(enquiryId).slice(0, 24)}-cost.csv`;
    return res.status(200).json({ success: true, csv, filename });
  } catch (e: any) {
    console.error("[tacExportCostCsv] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to export cost CSV.",
      code: "COST_CSV_EXPORT_FAILED",
    });
  }
}

// Endpoint 14: tacDownloadCompliancePack --------------------
//
// Renders the enquiry's compliance deliverable (dimensional + system checks
// + citations + recommended option lede) as a structured PDF using the
//  jspdf renderer. Requires the enquiry to have a Summary
// deliverable already generated (insight pipeline must have run); returns
// 404 NO_INSIGHT otherwise.

async function tacDownloadCompliancePack(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    const summaryTab = await guard.docRef
      .collection("tabs")
      .doc("summary")
      .get();
    if (!summaryTab.exists) {
      return res.status(404).json({
        success: false,
        error:
          "No insight on this enquiry yet. Generate the insight first.",
        code: "NO_INSIGHT",
      });
    }
    const summary = (summaryTab.data() as any)?.content;
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: "Summary deliverable is empty.",
        code: "NO_INSIGHT",
      });
    }

    let projectName: string | undefined;
    let isHRB = false;
    try {
      if (guard.doc.projectId) {
        const proj = await ctx.db
          .collection("projects")
          .doc(String(guard.doc.projectId))
          .get();
        const data = proj.data() ?? {};
        projectName = (data.name as string | undefined) ?? undefined;
        isHRB = data.isHRB === true;
      }
    } catch {
      // Best-effort — project metadata is decorative on the cover.
    }

    const pdfBuffer = renderCompliancePackPdf({
      enquiry: {
        id: guard.doc.id,
        title: String(guard.doc.title ?? ""),
        ribaStage: String(guard.doc.ribaStage ?? "S0"),
        query: String(guard.doc.query ?? ""),
        projectName,
        isHRB,
      },
      summary,
      generatedAt: new Date().toISOString(),
    });
    return res.status(200).json({
      success: true,
      pdfBase64: pdfBuffer.toString("base64"),
      filename: compliancePackFilename(guard.doc.id),
    });
  } catch (e: any) {
    console.error("[tacDownloadCompliancePack] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to render compliance pack.",
      code: "COMPLIANCE_PACK_FAILED",
    });
  }
}

// Endpoint 15: tacSaveToGoldenThread ------------------------
//
// HRB-only — server-guarded by checking `Project.isHRB === true`. Writes
// an immutable WORM chain doc to `goldenThread` following the
// pattern (sourceKind = 'enquiry' to distinguish from report-sealed
// records). Idempotent across re-clicks: each click chains a new version
// with `previousId` linking to the prior enquiry-sourced GT doc; the
// payload captures the insight version so audit readers can see every
// save event.

async function tacSaveToGoldenThread(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    if (!guard.doc.projectId || typeof guard.doc.projectId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Enquiry has no linked project — cannot Save to Golden Thread.",
        code: "INVALID_INPUT",
      });
    }

    const projSnap = await ctx.db
      .collection("projects")
      .doc(guard.doc.projectId)
      .get();
    if (!projSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Linked project not found.",
        code: "NOT_FOUND",
      });
    }
    const proj = projSnap.data() ?? {};
    if (proj.isHRB !== true) {
      return res.status(403).json({
        success: false,
        error:
          "Save to Golden Thread is HRB-only. Mark the project as HRB to enable.",
        code: "NOT_HRB",
      });
    }

    const summaryTab = await guard.docRef
      .collection("tabs")
      .doc("summary")
      .get();
    if (!summaryTab.exists) {
      return res.status(404).json({
        success: false,
        error: "No insight to save — generate the insight first.",
        code: "NO_INSIGHT",
      });
    }
    const summary = (summaryTab.data() as any)?.content;
    const summaryVersion = (summaryTab.data() as any)?.versionNumber ?? 1;
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: "Summary deliverable is empty.",
        code: "NO_INSIGHT",
      });
    }

    const ts = new Date().toISOString();
    // Chain — find prior enquiry-sourced GT records for THIS enquiry to
    // capture re-saves as a versioned chain (matches pattern).
    const priorSnap = await ctx.db
      .collection("goldenThread")
      .where("clientId", "==", ctx.primaryUid)
      .where("enquiryId", "==", guard.doc.id)
      .get();
    const previousId =
      priorSnap.docs.length > 0
        ? priorSnap.docs[priorSnap.docs.length - 1].id
        : null;
    const version = priorSnap.docs.length + 1;

    const gtRef = ctx.db.collection("goldenThread").doc();
    await gtRef.set({
      clientId: ctx.primaryUid,
      sourceKind: "enquiry",
      enquiryId: guard.doc.id,
      reportId: null,
      projectId: guard.doc.projectId,
      version,
      previousId,
      decidedAt: ts,
      signerUid: ctx.uid,
      sealedPdfPath: null,
      payload: {
        title: guard.doc.title ?? "",
        ribaStage: guard.doc.ribaStage ?? null,
        isHRB: true,
        summaryVersion,
        lede: summary.lede ?? "",
        citationCount: Array.isArray(summary.citations)
          ? summary.citations.length
          : 0,
        complianceCount: Array.isArray(summary.complianceSnapshot)
          ? summary.complianceSnapshot.length
          : 0,
      },
      createdAt: ts,
    });

    // Stamp the enquiry doc so the UI can render "Saved to Golden Thread"
    // without an extra round-trip.
    await guard.docRef.set(
      {
        goldenThreadId: gtRef.id,
        goldenThreadVersion: version,
        goldenThreadSavedAt: ts,
      },
      { merge: true },
    );

    return res
      .status(200)
      .json({ success: true, version, previousId, goldenThreadId: gtRef.id });
  } catch (e: any) {
    console.error("[tacSaveToGoldenThread] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to save to Golden Thread.",
      code: "GOLDEN_THREAD_SAVE_FAILED",
    });
  }
}

// Feedback + Audit + Archive endpoints ----------------------
//
//  = E4 (prompt management) + US-2.4 (feedback) + Compliance Lead
// audit dashboard. Endpoints mutate fields already declared on the
// Enquiry shape (`feedback`, `flaggedForAudit`, status `Archived`).

/** Compliance Lead extra-role check on the server. Mirrors the client
 *  `isComplianceLead` helper — reads `userData.extraRoles` (or its
 *  TAC-specific alias). Compliance Lead is held alongside a primary role
 *  (typically client_admin); admins always pass.*/
function isComplianceLeadCtx(ctx: ApiContext): boolean {
  if (ctx.isAdmin || ctx.isClientAdmin) return true;
  const data = ctx.userData ?? {};
  const extras: string[] = Array.isArray(data.extraRoles) ? data.extraRoles : [];
  if (extras.includes("compliance_lead")) return true;
  const tacExtras: string[] = Array.isArray(data.tacExtraRoles)
    ? data.tacExtraRoles
    : [];
  return tacExtras.includes("compliance_lead");
}

// Endpoint 16: tacSubmitFeedback (/ US-2.4) -------------------
//
// Thumbs-up / thumbs-down feedback on the Summary tab. Thumbs-down
// optionally captures a categorised reason + free-text note. Re-submitting
// overwrites the prior feedback (same enquiry, same author) — keeps the
// model simple. Authors and admins can submit; cross-tenant guarded by
// `loadEnquiryForMutation`.

async function tacSubmitFeedback(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, thumbs, reason, note } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    if (thumbs !== "up" && thumbs !== "down") {
      return res.status(400).json({
        success: false,
        error: "thumbs must be 'up' or 'down'.",
        code: "INVALID_INPUT",
      });
    }
    const validReasons = new Set([
      "inaccurate",
      "missed_regulation",
      "wrong_stage",
      "other",
    ]);
    const safeReason =
      typeof reason === "string" && validReasons.has(reason)
        ? reason
        : undefined;
    const safeNote =
      typeof note === "string" && note.trim()
        ? String(note).trim().slice(0, 800)
        : undefined;

    const feedback: any = {
      thumbs,
      submittedBy: ctx.uid,
      submittedAt: new Date().toISOString(),
    };
    if (safeReason) feedback.reason = safeReason;
    if (safeNote) feedback.note = safeNote;

    await guard.docRef.set({ feedback }, { merge: true });
    return res.status(200).json({ success: true, feedback });
  } catch (e: any) {
    console.error("[tacSubmitFeedback] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to submit feedback.",
      code: "FEEDBACK_FAILED",
    });
  }
}

// Endpoint 17: tacFlagForAudit ------------------------------
//
// Compliance Lead / ClientAdmin / SuperAdmin flags an enquiry for audit
// review. Stamps `flaggedForAudit` with timestamp + flagger uid. Optional
// reviewer note explains why. Resubmitting on an already-flagged enquiry
// is rejected — must resolve first to re-flag.

async function tacFlagForAudit(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, reviewerNote } = req.body ?? {};
    if (!isComplianceLeadCtx(ctx)) {
      return res.status(403).json({
        success: false,
        error: "Only Compliance Lead or admin can flag enquiries for audit.",
        code: "FORBIDDEN",
      });
    }
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    const existing = guard.doc.flaggedForAudit;
    if (existing && !existing.resolvedAt) {
      return res.status(400).json({
        success: false,
        error:
          "Enquiry is already flagged for audit. Resolve the existing flag first.",
        code: "ALREADY_FLAGGED",
      });
    }

    const flaggedForAudit: any = {
      flaggedBy: ctx.uid,
      flaggedAt: new Date().toISOString(),
    };
    if (typeof reviewerNote === "string" && reviewerNote.trim()) {
      flaggedForAudit.reviewerNote = String(reviewerNote).trim().slice(0, 1000);
    }
    await guard.docRef.set({ flaggedForAudit }, { merge: true });
    return res.status(200).json({ success: true, flaggedForAudit });
  } catch (e: any) {
    console.error("[tacFlagForAudit] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to flag enquiry.",
      code: "FLAG_FAILED",
    });
  }
}

// Endpoint 18: tacResolveFlag -------------------------------
//
// Resolve an existing audit flag. Compliance Lead / admin only. Required
// resolution note (≥5 chars) explains the resolution. Stamps resolvedAt +
// resolvedBy on the existing flaggedForAudit object.

async function tacResolveFlag(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, reviewerNote } = req.body ?? {};
    if (!isComplianceLeadCtx(ctx)) {
      return res.status(403).json({
        success: false,
        error: "Only Compliance Lead or admin can resolve audit flags.",
        code: "FORBIDDEN",
      });
    }
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;
    if (
      typeof reviewerNote !== "string" ||
      reviewerNote.trim().length < 5
    ) {
      return res.status(400).json({
        success: false,
        error: "Resolution note (≥5 chars) is required.",
        code: "INVALID_INPUT",
      });
    }
    const existing = guard.doc.flaggedForAudit;
    if (!existing) {
      return res.status(400).json({
        success: false,
        error: "Enquiry is not flagged for audit.",
        code: "NOT_FLAGGED",
      });
    }
    if (existing.resolvedAt) {
      return res.status(400).json({
        success: false,
        error: "Audit flag is already resolved.",
        code: "ALREADY_RESOLVED",
      });
    }
    const flaggedForAudit = {
      ...existing,
      resolvedAt: new Date().toISOString(),
      resolvedBy: ctx.uid,
      // Append resolution note alongside the flagger's note so both are
      // preserved on the audit record.
      reviewerNote: existing.reviewerNote
        ? `${existing.reviewerNote}\n— Resolved: ${String(reviewerNote).trim().slice(0, 1000)}`
        : String(reviewerNote).trim().slice(0, 1000),
    };
    await guard.docRef.set({ flaggedForAudit }, { merge: true });
    return res.status(200).json({ success: true, flaggedForAudit });
  } catch (e: any) {
    console.error("[tacResolveFlag] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to resolve flag.",
      code: "RESOLVE_FAILED",
    });
  }
}

// Endpoint 19: tacArchiveEnquiry ----------------------------
//
// Move enquiry to `Archived` cold-state. Allowed from any state EXCEPT
// `Generating` (don't yank an in-flight insight). Owner or admin only.
// Reverse: tacUnarchiveEnquiry flips Archived → Open.

async function tacArchiveEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, restore } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    if (restore === true) {
      if (guard.doc.status !== "Archived") {
        return res.status(400).json({
          success: false,
          error: "Only Archived enquiries can be restored.",
          code: "INVALID_STATE",
        });
      }
      await guard.docRef.set(
        { status: "Open", updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return res.status(200).json({ success: true, status: "Open" });
    }

    if (guard.doc.status === "Generating") {
      return res.status(400).json({
        success: false,
        error: "Cannot archive while insight generation is in flight.",
        code: "INVALID_STATE",
      });
    }
    if (guard.doc.status === "Archived") {
      return res.status(400).json({
        success: false,
        error: "Enquiry is already archived.",
        code: "ALREADY_ARCHIVED",
      });
    }
    await guard.docRef.set(
      { status: "Archived", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return res.status(200).json({ success: true, status: "Archived" });
  } catch (e: any) {
    console.error("[tacArchiveEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to archive enquiry.",
      code: "ARCHIVE_FAILED",
    });
  }
}

// Endpoint 20: tacListAuditFlagged --------------------------
//
// Compliance Lead / admin-only list of every enquiry currently flagged for
// audit OR carrying thumbs-down feedback. Powers AuditDashboardPage.
// Returns enriched rows with the active flag/feedback summaries; sorting
// puts oldest-flagged first so reviewers tackle the longest-waiting items.

async function tacListAuditFlagged(_req: any, res: any, ctx: ApiContext) {
  try {
    if (!isComplianceLeadCtx(ctx)) {
      return res.status(403).json({
        success: false,
        error: "Audit dashboard requires Compliance Lead or admin role.",
        code: "FORBIDDEN",
      });
    }
    const snap = await ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid)
      .get();
    const items: any[] = [];
    for (const d of snap.docs) {
      const data: any = d.data();
      const isFlagged =
        data.flaggedForAudit && !data.flaggedForAudit.resolvedAt;
      const hasThumbsDown = data.feedback?.thumbs === "down";
      if (isFlagged || hasThumbsDown) {
        items.push({
          id: data.id ?? d.id.replace(`${ctx.primaryUid}_`, ""),
          title: data.title ?? "",
          ribaStage: data.ribaStage ?? "S0",
          status: data.status ?? "Draft",
          ownerUid: data.ownerUid ?? "",
          createdAt: data.createdAt ?? "",
          updatedAt: data.updatedAt ?? "",
          projectId: data.projectId ?? null,
          flaggedForAudit: data.flaggedForAudit ?? null,
          feedback: data.feedback ?? null,
        });
      }
    }
    // Sort: open flags first (oldest flaggedAt), then thumbs-down only.
    items.sort((a: any, b: any) => {
      const aFlagOpen = a.flaggedForAudit && !a.flaggedForAudit.resolvedAt;
      const bFlagOpen = b.flaggedForAudit && !b.flaggedForAudit.resolvedAt;
      if (aFlagOpen && !bFlagOpen) return -1;
      if (!aFlagOpen && bFlagOpen) return 1;
      const at = a.flaggedForAudit?.flaggedAt ?? a.feedback?.submittedAt ?? "";
      const bt = b.flaggedForAudit?.flaggedAt ?? b.feedback?.submittedAt ?? "";
      return at.localeCompare(bt);
    });
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error("[tacListAuditFlagged] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load audit dashboard.",
      code: "AUDIT_LIST_FAILED",
    });
  }
}

// Close + Unlock + Decision Log + Add to PM report ----------

// Endpoint 21: tacCloseEnquiry ------------------------------
//
// Owner-or-admin closes an Open or Approved enquiry. For HRB projects,
// also writes a Golden Thread chain doc (sourceKind 'enquiry') so the
// closure is preserved in the BSA Gateway 2/3 audit chain. Stamps
// closedAt + closedBy.

async function tacCloseEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      requireOwnerOrAdmin: true,
    });
    if (!guard) return;
    const allowed = ["Open", "AwaitingReview", "Approved"];
    if (!allowed.includes(guard.doc.status)) {
      return res.status(400).json({
        success: false,
        error: `Enquiry must be Open / AwaitingReview / Approved to close (current: ${guard.doc.status}).`,
        code: "INVALID_STATE",
      });
    }
    const ts = new Date().toISOString();
    let projectIsHRB = false;
    if (guard.doc.projectId) {
      try {
        const projSnap = await ctx.db
          .collection("projects")
          .doc(String(guard.doc.projectId))
          .get();
        projectIsHRB = projSnap.data()?.isHRB === true;
      } catch {
        // best-effort
      }
    }

    let goldenThreadId: string | null = null;
    let goldenThreadVersion: number | null = null;
    if (projectIsHRB) {
      try {
        const summaryTab = await guard.docRef
          .collection("tabs")
          .doc("summary")
          .get();
        const summary = summaryTab.exists
          ? (summaryTab.data() as any)?.content
          : null;
        if (summary) {
          const priorSnap = await ctx.db
            .collection("goldenThread")
            .where("clientId", "==", ctx.primaryUid)
            .where("enquiryId", "==", guard.doc.id)
            .get();
          const previousId =
            priorSnap.docs.length > 0
              ? priorSnap.docs[priorSnap.docs.length - 1].id
              : null;
          const version = priorSnap.docs.length + 1;
          const gtRef = ctx.db.collection("goldenThread").doc();
          await gtRef.set({
            clientId: ctx.primaryUid,
            sourceKind: "enquiry",
            enquiryId: guard.doc.id,
            reportId: null,
            projectId: guard.doc.projectId,
            version,
            previousId,
            decidedAt: ts,
            signerUid: ctx.uid,
            sealedPdfPath: null,
            payload: {
              event: "closed",
              title: guard.doc.title ?? "",
              ribaStage: guard.doc.ribaStage ?? null,
              isHRB: true,
              lede: summary.lede ?? "",
              citationCount: Array.isArray(summary.citations)
                ? summary.citations.length
                : 0,
            },
            createdAt: ts,
          });
          goldenThreadId = gtRef.id;
          goldenThreadVersion = version;
        }
      } catch (gtErr) {
        // non-fatal — closure proceeds even if GT write fails. Log loudly.
        console.error("[tacCloseEnquiry] golden thread write failed:", gtErr);
      }
    }

    const patch: any = {
      status: "Closed",
      closedAt: ts,
      closedBy: ctx.uid,
      updatedAt: ts,
    };
    if (goldenThreadId) {
      patch.goldenThreadId = goldenThreadId;
      patch.goldenThreadVersion = goldenThreadVersion;
      patch.goldenThreadSavedAt = ts;
    }
    await guard.docRef.set(patch, { merge: true });
    return res.status(200).json({
      success: true,
      status: "Closed",
      goldenThreadId,
      goldenThreadVersion,
      isHRB: projectIsHRB,
    });
  } catch (e: any) {
    console.error("[tacCloseEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to close enquiry.",
      code: "CLOSE_FAILED",
    });
  }
}

// Endpoint 22: tacUnlockEnquiry -----------------------------
//
// Compliance Lead / SuperAdmin re-opens a Closed enquiry. Required reason
// (≥10 chars) — appended to a `unlockHistory` array on the enquiry so
// the audit trail of every unlock is permanent. Returns to status `Open`.

async function tacUnlockEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, reason } = req.body ?? {};
    if (!isComplianceLeadCtx(ctx)) {
      return res.status(403).json({
        success: false,
        error: "Only Compliance Lead or admin can unlock closed enquiries.",
        code: "FORBIDDEN",
      });
    }
    if (typeof reason !== "string" || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: "Unlock reason (≥10 chars) is required.",
        code: "INVALID_INPUT",
      });
    }
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;
    if (guard.doc.status !== "Closed") {
      return res.status(400).json({
        success: false,
        error: `Only Closed enquiries can be unlocked (current: ${guard.doc.status}).`,
        code: "INVALID_STATE",
      });
    }
    const ts = new Date().toISOString();
    const priorHistory: any[] = Array.isArray(guard.doc.unlockHistory)
      ? guard.doc.unlockHistory
      : [];
    const unlockEntry = {
      at: ts,
      by: ctx.uid,
      reason: String(reason).trim().slice(0, 1000),
      priorClosedAt: guard.doc.closedAt ?? null,
      priorClosedBy: guard.doc.closedBy ?? null,
    };
    await guard.docRef.set(
      {
        status: "Open",
        closedAt: null,
        closedBy: null,
        unlockHistory: [...priorHistory, unlockEntry],
        updatedAt: ts,
      },
      { merge: true },
    );
    console.warn(
      `[tacUnlockEnquiry] ${enquiryId} unlocked by ${ctx.uid}: ${unlockEntry.reason}`,
    );
    return res.status(200).json({
      success: true,
      status: "Open",
      unlockHistoryCount: priorHistory.length + 1,
    });
  } catch (e: any) {
    console.error("[tacUnlockEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to unlock enquiry.",
      code: "UNLOCK_FAILED",
    });
  }
}

// Endpoint 23: tacExportDecisionLog -------------------------
//
// Per-project chronological PDF export of every closed enquiry on the
// project. Cover sheet (project meta + BSA Gateway references for HRB) +
// one section per enquiry (title + lede + recommended option + citation
// count). Suitable for Gateway 2 / 3 submission packs.

async function tacExportDecisionLog(req: any, res: any, ctx: ApiContext) {
  try {
    const { projectId } = req.body ?? {};
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({
        success: false,
        error: "projectId is required.",
        code: "INVALID_INPUT",
      });
    }
    if (!(await ctx.isAuthorizedForContext(projectId))) {
      return res
        .status(403)
        .json({ success: false, error: "Forbidden.", code: "CROSS_TENANT" });
    }
    const projSnap = await ctx.db.collection("projects").doc(projectId).get();
    if (!projSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Project not found.",
        code: "NOT_FOUND",
      });
    }
    const proj = projSnap.data() ?? {};

    // Pull every Closed enquiry for this project + tenant.
    const enquiriesSnap = await ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid)
      .where("projectId", "==", projectId)
      .where("status", "==", "Closed")
      .get();

    const enquiryEntries: Array<{
      id: string;
      title: string;
      ribaStage: string;
      closedAt: string;
      lede: string;
      recommendedOption: string;
      citationCount: number;
    }> = [];

    // Sequential reads of summary deliverables — small N (closed enquiries
    // per project rarely exceeds dozens).
    for (const d of enquiriesSnap.docs) {
      const data: any = d.data();
      let summary: any = null;
      try {
        const sTab = await d.ref.collection("tabs").doc("summary").get();
        summary = sTab.exists ? (sTab.data() as any)?.content : null;
      } catch {
        // skip
      }
      const recommended =
        Array.isArray(summary?.options)
          ? summary.options.find((o: any) => o?.recommended) ??
            summary.options[0]
          : null;
      enquiryEntries.push({
        id: data.id ?? d.id.replace(`${ctx.primaryUid}_`, ""),
        title: data.title ?? "",
        ribaStage: data.ribaStage ?? "S0",
        closedAt: data.closedAt ?? "",
        lede: summary?.lede ?? "",
        recommendedOption: recommended
          ? `${recommended.label ?? ""}${recommended.summary ? ` — ${recommended.summary}` : ""}`
          : "",
        citationCount: Array.isArray(summary?.citations)
          ? summary.citations.length
          : 0,
      });
    }
    enquiryEntries.sort((a, b) => a.closedAt.localeCompare(b.closedAt));

    const pdfBuffer = renderDecisionLogPdf({
      project: {
        id: projectId,
        name: String(proj.name ?? "Untitled project"),
        isHRB: proj.isHRB === true,
      },
      enquiries: enquiryEntries,
      generatedAt: new Date().toISOString(),
    });
    return res.status(200).json({
      success: true,
      pdfBase64: pdfBuffer.toString("base64"),
      filename: decisionLogFilename(projectId),
      enquiryCount: enquiryEntries.length,
    });
  } catch (e: any) {
    console.error("[tacExportDecisionLog] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to render decision log.",
      code: "DECISION_LOG_FAILED",
    });
  }
}

// Endpoint 24 + 25: tacAddToProjectReport / tacRemoveFromProjectReport
//
// Flags an enquiry for inclusion in the project's status report. The
// ProjectReport page reads enquiries where `addedToProjectReport === true`
// and renders a Technical Assurance section with cost+programme highlights.

async function tacAddToProjectReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      requireOwnerOrAdmin: true,
    });
    if (!guard) return;
    const ts = new Date().toISOString();
    await guard.docRef.set(
      {
        addedToProjectReport: true,
        addedToProjectReportAt: ts,
        addedToProjectReportBy: ctx.uid,
        updatedAt: ts,
      },
      { merge: true },
    );
    return res.status(200).json({ success: true, addedAt: ts });
  } catch (e: any) {
    console.error("[tacAddToProjectReport] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to add to project report.",
      code: "ADD_TO_REPORT_FAILED",
    });
  }
}

async function tacRemoveFromProjectReport(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      requireOwnerOrAdmin: true,
    });
    if (!guard) return;
    await guard.docRef.set(
      {
        addedToProjectReport: false,
        addedToProjectReportAt: null,
        addedToProjectReportBy: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error("[tacRemoveFromProjectReport] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to remove from project report.",
      code: "REMOVE_FROM_REPORT_FAILED",
    });
  }
}

// Endpoint 26: tacListProjectReportEnquiries ----------------
//
// ProjectReport reads this to render the Technical Assurance section.
// Returns enriched rows for each enquiry flagged `addedToProjectReport`
// on the given project.

async function tacListProjectReportEnquiries(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { projectId } = req.body ?? {};
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({
        success: false,
        error: "projectId is required.",
        code: "INVALID_INPUT",
      });
    }
    if (!(await ctx.isAuthorizedForContext(projectId))) {
      return res
        .status(403)
        .json({ success: false, error: "Forbidden.", code: "CROSS_TENANT" });
    }
    const snap = await ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid)
      .where("projectId", "==", projectId)
      .where("addedToProjectReport", "==", true)
      .get();
    const items: any[] = [];
    for (const d of snap.docs) {
      const data: any = d.data();
      let summary: any = null;
      try {
        const sTab = await d.ref.collection("tabs").doc("summary").get();
        summary = sTab.exists ? (sTab.data() as any)?.content : null;
      } catch {
        // skip
      }
      items.push({
        id: data.id ?? d.id.replace(`${ctx.primaryUid}_`, ""),
        title: data.title ?? "",
        ribaStage: data.ribaStage ?? "S0",
        status: data.status ?? "Draft",
        addedToProjectReportAt: data.addedToProjectReportAt ?? null,
        lede: summary?.lede ?? "",
        recommendedOption: Array.isArray(summary?.options)
          ? (() => {
              const r =
                summary.options.find((o: any) => o?.recommended) ??
                summary.options[0];
              return r
                ? {
                    label: r.label ?? "",
                    summary: r.summary ?? "",
                    costDelta: Number(r.costDelta ?? 0),
                    programmeDelta: Number(r.programmeDelta ?? 0),
                  }
                : null;
            })()
          : null,
        costProgramme: summary?.costProgramme
          ? {
              totalDelta: Number(summary.costProgramme.totalDelta ?? 0),
              floatRemaining: Number(summary.costProgramme.floatRemaining ?? 0),
              contingencyDrawPct:
                summary.costProgramme.contingencyDrawPct ?? null,
              costLineCount: Array.isArray(summary.costProgramme.costLines)
                ? summary.costProgramme.costLines.length
                : 0,
            }
          : null,
      });
    }
    items.sort((a, b) =>
      String(b.addedToProjectReportAt ?? "").localeCompare(
        String(a.addedToProjectReportAt ?? ""),
      ),
    );
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error("[tacListProjectReportEnquiries] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load TAC report enquiries.",
      code: "PROJECT_REPORT_LIST_FAILED",
    });
  }
}

// Share-for-review endpoints -------------------------------
//
// Owner shares an enquiry with another workspace member for read-only
// review. Recipient sees a "Shared with me" filter on EnquiriesListPage,
// opens the workspace, and approves or rejects with an optional note.
// Multiple recipients per enquiry supported (`shares` array).

function makeShareId(): string {
  return `shr-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

// Endpoint 27: tacShareEnquiry -----------------------------
//
// Owner-or-admin shares with a workspace member. Adds entry to `shares`.
// Server validates the recipient is in the same `clientId` workspace.

async function tacShareEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, sharedWithUid, note } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      requireOwnerOrAdmin: true,
    });
    if (!guard) return;
    if (
      !sharedWithUid ||
      typeof sharedWithUid !== "string" ||
      sharedWithUid.length > 128
    ) {
      return res.status(400).json({
        success: false,
        error: "sharedWithUid is required.",
        code: "INVALID_INPUT",
      });
    }
    if (sharedWithUid === ctx.uid) {
      return res.status(400).json({
        success: false,
        error: "Cannot share an enquiry with yourself.",
        code: "INVALID_INPUT",
      });
    }
    // Verify the recipient belongs to the same workspace (clientId === ctx.primaryUid).
    const recipientDoc = await ctx.db.collection("users").doc(sharedWithUid).get();
    if (!recipientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Recipient not found.",
        code: "NOT_FOUND",
      });
    }
    const recipient = recipientDoc.data() ?? {};
    const recipientClient = recipient.clientId ?? recipientDoc.id;
    if (recipientClient !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: "Recipient is not in this workspace.",
        code: "CROSS_TENANT",
      });
    }

    const existingShares: any[] = Array.isArray(guard.doc.shares)
      ? guard.doc.shares
      : [];
    // Avoid duplicate active shares to the same recipient. If a previous
    // share to this user exists and is undecided, reject; if it has a
    // decision already, allow re-share (treat as reopening review).
    const activeForRecipient = existingShares.find(
      (s: any) => s?.sharedWith === sharedWithUid && !s?.decision,
    );
    if (activeForRecipient) {
      return res.status(400).json({
        success: false,
        error: "This enquiry is already pending review by that user.",
        code: "ALREADY_SHARED",
      });
    }

    const ts = new Date().toISOString();
    const shareEntry: any = {
      shareId: makeShareId(),
      sharedWith: sharedWithUid,
      sharedBy: ctx.uid,
      sharedAt: ts,
    };
    if (typeof note === "string" && note.trim()) {
      shareEntry.note = String(note).trim().slice(0, 500);
    }
    await guard.docRef.set(
      {
        shares: [...existingShares, shareEntry],
        // Optional: flip status to AwaitingReview if currently Open. Keeps
        // the workspace pill obvious for both owner + recipient.
        ...(guard.doc.status === "Open"
          ? { status: "AwaitingReview" }
          : {}),
        updatedAt: ts,
      },
      { merge: true },
    );
    return res.status(200).json({ success: true, share: shareEntry });
  } catch (e: any) {
    console.error("[tacShareEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to share enquiry.",
      code: "SHARE_FAILED",
    });
  }
}

// Endpoint 28: tacDecideOnShare ----------------------------
//
// Recipient approves or rejects their share. Only the user listed as
// `shares.sharedWith` can decide on that share — owner / admin can NOT
// decide on someone else's behalf (would defeat the audit point).

async function tacDecideOnShare(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, shareId, decision, decisionNote } = req.body ?? {};
    if (!shareId || typeof shareId !== "string") {
      return res.status(400).json({
        success: false,
        error: "shareId is required.",
        code: "INVALID_INPUT",
      });
    }
    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({
        success: false,
        error: "decision must be 'approved' or 'rejected'.",
        code: "INVALID_INPUT",
      });
    }
    if (decision === "rejected" && (typeof decisionNote !== "string" || decisionNote.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        error: "Rejection requires a decision note (≥5 chars).",
        code: "INVALID_INPUT",
      });
    }
    // We do NOT use loadEnquiryForMutation's owner check here — recipients
    // need write access to update their own share entry. Fetch the doc
    // directly + verify recipient match instead.
    if (!enquiryId || typeof enquiryId !== "string") {
      return res.status(400).json({
        success: false,
        error: "enquiryId is required.",
        code: "INVALID_INPUT",
      });
    }
    const docId = compositeId(ctx.primaryUid, enquiryId);
    const docRef = ctx.db.collection("enquiries").doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Enquiry not found.", code: "NOT_FOUND" });
    }
    const doc = snap.data() ?? {};
    if (doc.clientId !== ctx.primaryUid) {
      return res
        .status(403)
        .json({ success: false, error: "Forbidden.", code: "CROSS_TENANT" });
    }
    const shares: any[] = Array.isArray(doc.shares) ? doc.shares : [];
    const targetIdx = shares.findIndex((s) => s?.shareId === shareId);
    if (targetIdx < 0) {
      return res.status(404).json({
        success: false,
        error: "Share not found on this enquiry.",
        code: "NOT_FOUND",
      });
    }
    const target = shares[targetIdx];
    if (target.sharedWith !== ctx.uid) {
      return res.status(403).json({
        success: false,
        error: "Only the share recipient can decide on this share.",
        code: "FORBIDDEN",
      });
    }
    if (target.decision) {
      return res.status(400).json({
        success: false,
        error: "This share has already been decided.",
        code: "ALREADY_DECIDED",
      });
    }
    const ts = new Date().toISOString();
    const updatedShare = {
      ...target,
      decision,
      decidedAt: ts,
      ...(decisionNote && typeof decisionNote === "string"
        ? { decisionNote: decisionNote.trim().slice(0, 1000) }
        : {}),
    };
    const newShares = [...shares];
    newShares[targetIdx] = updatedShare;

    // If this was the only outstanding share + decision is approved, flip
    // the enquiry status from AwaitingReview back to Approved (for HRB
    // workflows) or Open (for non-HRB). Rejection: stays AwaitingReview
    // with the reject note visible — owner can re-share or close.
    const otherUndecided = newShares.some(
      (s, i) => i !== targetIdx && !s?.decision,
    );
    let nextStatus = doc.status;
    if (
      doc.status === "AwaitingReview" &&
      decision === "approved" &&
      !otherUndecided
    ) {
      nextStatus = "Approved";
    }
    await docRef.set(
      {
        shares: newShares,
        ...(nextStatus !== doc.status ? { status: nextStatus } : {}),
        updatedAt: ts,
      },
      { merge: true },
    );
    return res
      .status(200)
      .json({ success: true, share: updatedShare, status: nextStatus });
  } catch (e: any) {
    console.error("[tacDecideOnShare] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to decide on share.",
      code: "DECIDE_FAILED",
    });
  }
}

// Endpoint 29: tacListSharedWithMe -------------------------
//
// Returns enquiries shared with the current user. Used by the "Shared with
// me" filter on EnquiriesListPage. Filtering by `array-contains` on a
// nested object isn't directly supported in Firestore; instead we
// list-then-filter on the server (workspace size is small).

async function tacListSharedWithMe(_req: any, res: any, ctx: ApiContext) {
  try {
    const snap = await ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid)
      .get();
    const items: any[] = [];
    for (const d of snap.docs) {
      const data: any = d.data();
      const shares: any[] = Array.isArray(data.shares) ? data.shares : [];
      const myShare = shares.find((s) => s?.sharedWith === ctx.uid);
      if (!myShare) continue;
      items.push({
        id: data.id ?? d.id.replace(`${ctx.primaryUid}_`, ""),
        title: data.title ?? "",
        ribaStage: data.ribaStage ?? "S0",
        status: data.status ?? "Draft",
        ownerUid: data.ownerUid ?? "",
        updatedAt: data.updatedAt ?? "",
        share: myShare,
      });
    }
    items.sort((a, b) => (b.share.sharedAt ?? "").localeCompare(a.share.sharedAt ?? ""));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error("[tacListSharedWithMe] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to load shared enquiries.",
      code: "SHARED_LIST_FAILED",
    });
  }
}

// Polish: corpus refresh cron + citation integrity scan ----
//
// Hardening jobs that run platform-wide (not workspace-scoped). Cron auth
// follows the same `CRON_SECRET` Bearer pattern as the + chase-engine
// crons in this codebase.

function isAuthorisedTacCronCall(req: any, ctx: ApiContext): boolean {
  if (ctx.isAdmin) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — local cron tests work without secret
  const auth = req?.headers?.authorization ?? req?.headers?.Authorization;
  if (typeof auth !== "string") return false;
  return auth === `Bearer ${secret}`;
}

// Endpoint 30: tacRefreshCorpus (, cron) ----------------------
//
// Quarterly cron that re-runs `seedRegulationsCorpusIfMissing` so any
// hand-curated entries added to the seed file land in production without
// a code deploy. Safe to call as often as needed — the seed helper probes
// before writing. Returns the count it touched.

async function tacRefreshCorpus(req: any, res: any, ctx: ApiContext) {
  try {
    if (!isAuthorisedTacCronCall(req, ctx)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorised — CRON_SECRET required.",
        code: "UNAUTHORISED",
      });
    }
    // Re-import dynamically so a future TAC corpus implementation that
    // pulls from a vendor (track) can swap this out without
    // touching the cron entry itself.
    const corpusMod = await import("../lib/regulationsCorpusSeed.js");
    await corpusMod.seedRegulationsCorpusIfMissing(ctx);
    const corpus = await corpusMod.loadRegulationsCorpus(ctx);
    return res.status(200).json({
      success: true,
      corpusSize: corpus.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[tacRefreshCorpus] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Corpus refresh failed.",
      code: "CORPUS_REFRESH_FAILED",
    });
  }
}

// Endpoint 31: tacScanCitationIntegrity (, admin) -------------
//
// Walks every enquiry's `tabs/summary` deliverable in the workspace and
// checks each citation's `regId` resolves in the current corpus. Reports
// any non-resolving citations grouped by enquiry. Used as a one-off
// post-deploy gate after corpus changes (vendor swap, etc.) and
// satisfies PRD §5 DoD ("≥95% of insights carry full citation trail").

async function tacScanCitationIntegrity(
  _req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!ctx.isAdmin && !ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: "Citation integrity scan requires admin role.",
        code: "FORBIDDEN",
      });
    }
    await seedRegulationsCorpusIfMissing(ctx);
    const corpus = await loadRegulationsCorpus(ctx);
    const corpusIds = new Set(corpus.map((c) => c.regId));

    const snap = await ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid)
      .get();

    let totalEnquiries = 0;
    let totalCitations = 0;
    let resolvedCitations = 0;
    const broken: Array<{
      enquiryId: string;
      title: string;
      brokenRegIds: string[];
    }> = [];

    for (const d of snap.docs) {
      totalEnquiries++;
      const data: any = d.data();
      try {
        const sTab = await d.ref.collection("tabs").doc("summary").get();
        if (!sTab.exists) continue;
        const summary: any = sTab.data()?.content ?? null;
        const cites: any[] = Array.isArray(summary?.citations)
          ? summary.citations
          : [];
        const brokenForEnquiry: string[] = [];
        for (const c of cites) {
          totalCitations++;
          if (typeof c?.regId === "string" && corpusIds.has(c.regId)) {
            resolvedCitations++;
          } else if (typeof c?.regId === "string") {
            brokenForEnquiry.push(c.regId);
          }
        }
        if (brokenForEnquiry.length > 0) {
          broken.push({
            enquiryId: data.id ?? d.id.replace(`${ctx.primaryUid}_`, ""),
            title: data.title ?? "",
            brokenRegIds: brokenForEnquiry,
          });
        }
      } catch (innerErr) {
        console.warn(
          "[tacScanCitationIntegrity] failed to scan enquiry",
          d.id,
          innerErr,
        );
      }
    }

    const integrityPct =
      totalCitations === 0
        ? 100
        : Math.round((resolvedCitations / totalCitations) * 100);
    return res.status(200).json({
      success: true,
      totalEnquiries,
      totalCitations,
      resolvedCitations,
      integrityPct,
      broken,
      corpusSize: corpus.length,
      scannedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[tacScanCitationIntegrity] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Citation integrity scan failed.",
      code: "INTEGRITY_SCAN_FAILED",
    });
  }
}

// Admin rates editor ---------------------------------------
//
// ClientAdmin / SuperAdmin add custom rates that shadow the seed library.
// Stored under `costRates/{primaryUid}_{rateId}` with `clientId` = the
// workspace's primary uid. `loadCostRates` already merges shared seed +
// own custom rates with custom shadowing seeds via the same rateId — so
// nothing else has to change to make the merge work.

const COST_RATE_WRITABLE_FIELDS = [
  "rateId",
  "category",
  "description",
  "unit",
  "rate",
  "currency",
] as const;
const COST_RATE_VALID_CATEGORIES = new Set([
  "preliminaries",
  "substructure",
  "frame",
  "me",
  "finishes",
  "external",
  "fees",
]);
const COST_RATE_VALID_UNITS = new Set(["m", "m2", "m3", "no", "hr", "item"]);

// Endpoint 32: tacUpsertCostRate (, admin) --------------------
//
// Create / update a custom cost rate for the caller's workspace. Custom
// rates shadow seed entries by `rateId` (the merge in `loadCostRates`
// keeps the own-tenant copy when both exist).

async function tacUpsertCostRate(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isAdmin && !ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: "Only ClientAdmin or SuperAdmin can manage cost rates.",
        code: "FORBIDDEN",
      });
    }
    const { rate: rateInput } = req.body ?? {};
    if (!rateInput || typeof rateInput !== "object") {
      return res.status(400).json({
        success: false,
        error: "rate object is required.",
        code: "INVALID_INPUT",
      });
    }
    // Whitelist write — drop any fields the caller may have added (e.g.
    // `clientId`, `lastUpdated`). (whitelist on every upsert).
    const patch: any = {};
    for (const key of COST_RATE_WRITABLE_FIELDS) {
      if (rateInput[key] !== undefined) patch[key] = rateInput[key];
    }
    if (typeof patch.rateId !== "string" || patch.rateId.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "rateId is required.",
        code: "INVALID_INPUT",
      });
    }
    if (!COST_RATE_VALID_CATEGORIES.has(patch.category)) {
      return res.status(400).json({
        success: false,
        error: `category must be one of: ${[...COST_RATE_VALID_CATEGORIES].join(", ")}.`,
        code: "INVALID_INPUT",
      });
    }
    if (!COST_RATE_VALID_UNITS.has(patch.unit)) {
      return res.status(400).json({
        success: false,
        error: `unit must be one of: ${[...COST_RATE_VALID_UNITS].join(", ")}.`,
        code: "INVALID_INPUT",
      });
    }
    if (
      typeof patch.description !== "string" ||
      patch.description.trim().length < 3
    ) {
      return res.status(400).json({
        success: false,
        error: "description (≥3 chars) is required.",
        code: "INVALID_INPUT",
      });
    }
    const rateNum = Number(patch.rate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      return res.status(400).json({
        success: false,
        error: "rate must be a non-negative number.",
        code: "INVALID_INPUT",
      });
    }
    patch.rate = rateNum;
    patch.currency = "GBP"; // single-currency v1
    patch.rateId = String(patch.rateId).trim();
    patch.description = String(patch.description).trim().slice(0, 200);

    const ts = new Date().toISOString();
    const docId = `${ctx.primaryUid}_${patch.rateId}`;
    const ref = ctx.db.collection("costRates").doc(docId);
    await ref.set(
      {
        ...patch,
        clientId: ctx.primaryUid,
        source: "custom",
        lastUpdated: ts,
        lastUpdatedBy: ctx.uid,
      },
      { merge: true },
    );
    const saved = await ref.get();
    return res.status(200).json({ success: true, rate: saved.data() });
  } catch (e: any) {
    console.error("[tacUpsertCostRate] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to save cost rate.",
      code: "COST_RATE_SAVE_FAILED",
    });
  }
}

// Endpoint 33: tacDeleteCostRate (, admin) --------------------
//
// Delete a custom cost rate. Refuses to delete shared-seed rates (those
// are platform-wide and should not be deleted by individual tenants —
// admin can override by adding a custom rate with the same rateId, which
// shadows the seed).

async function tacDeleteCostRate(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isAdmin && !ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: "Only ClientAdmin or SuperAdmin can manage cost rates.",
        code: "FORBIDDEN",
      });
    }
    const { rateId } = req.body ?? {};
    if (!rateId || typeof rateId !== "string") {
      return res.status(400).json({
        success: false,
        error: "rateId is required.",
        code: "INVALID_INPUT",
      });
    }
    // Two delete paths:
    //  • Workspace's own custom row for this rateId → hard-delete.
    //  • No own row but a shared seed exists → write a per-tenant
    //    `hidden: true` marker so the seed is filtered out of THIS
    //    workspace's merged list (other tenants still see it).
    const ownRef = ctx.db
      .collection("costRates")
      .doc(`${ctx.primaryUid}_${rateId}`);
    const ownSnap = await ownRef.get();
    if (ownSnap.exists && ownSnap.data()?.clientId === ctx.primaryUid) {
      await ownRef.delete();
      return res.status(200).json({ success: true, mode: "deleted-custom" });
    }

    // Verify a shared seed exists before writing the hidden marker —
    // otherwise we'd be creating an orphan marker for nothing.
    const sharedSnap = await ctx.db
      .collection("costRates")
      .doc(`__shared___${rateId}`)
      .get();
    if (!sharedSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Rate not found in seed library or this workspace.",
        code: "NOT_FOUND",
      });
    }
    const sharedData = sharedSnap.data() as any;
    const ts = new Date().toISOString();
    await ownRef.set(
      {
        rateId,
        clientId: ctx.primaryUid,
        // Mirror the seed metadata so the doc is self-contained for audit
        // (loadCostRates filters it out via the hidden flag, but a server
        // reader peeking at the row sees what was suppressed).
        category: sharedData.category,
        description: sharedData.description,
        unit: sharedData.unit,
        rate: sharedData.rate,
        currency: sharedData.currency ?? "GBP",
        source: "custom",
        hidden: true,
        lastUpdated: ts,
        lastUpdatedBy: ctx.uid,
      },
      { merge: false },
    );
    return res.status(200).json({ success: true, mode: "hidden-seed" });
  } catch (e: any) {
    console.error("[tacDeleteCostRate] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to delete cost rate.",
      code: "COST_RATE_DELETE_FAILED",
    });
  }
}

// Route map -----------------------------------------------------------

export const technicalAssuranceRoutes: Record<string, any> = {
  tacListEnquiries,
  tacGetEnquiry,
  tacUpsertEnquiry,
  tacAttachFile,
  tacRemoveAttachment,
  tacDeleteEnquiry,
  // AI insight generation (two-step: build prompt, then finalise
  // after client-side call to existing `aiRoutes.geminiPrompt`).
  tacBuildInsightPrompt,
  tacFinaliseInsight,
  tacGetEnquiryDeliverable,
  // RFI tab + register.
  tacUpsertRfiDraft,
  tacIssueRfi,
  tacListRfis,
  // Cost & programme tab.
  tacListCostRates,
  tacExportCostCsv,
  // Compliance & citations tab.
  tacDownloadCompliancePack,
  tacSaveToGoldenThread,
  // Feedback + Audit + Archive.
  tacSubmitFeedback,
  tacFlagForAudit,
  tacResolveFlag,
  tacArchiveEnquiry,
  tacListAuditFlagged,
  // Close + Unlock + Decision Log + Add to PM report.
  tacCloseEnquiry,
  tacUnlockEnquiry,
  tacExportDecisionLog,
  tacAddToProjectReport,
  tacRemoveFromProjectReport,
  tacListProjectReportEnquiries,
  // Share-for-review.
  tacShareEnquiry,
  tacDecideOnShare,
  tacListSharedWithMe,
  // Admin rates editor.
  tacUpsertCostRate,
  tacDeleteCostRate,
  // Polish: corpus refresh cron + integrity scan.
  tacRefreshCorpus,
  tacScanCitationIntegrity,
  // tacRenderAnnotatedPdf, tacSendDrawingToArchitect.
  // tacIssueRfi, tacListRfis, tacGetRfi, tacUpsertRfiDraft.
  //  (deferred): tacUpsertCostRate (admin rates editor).
  // tacCloseEnquiry, tacUnlockEnquiry, tacShareEnquiry,
  //          tacDecideOnShare, tacExportDecisionLog.
  // refreshRegulationsCorpus.
};

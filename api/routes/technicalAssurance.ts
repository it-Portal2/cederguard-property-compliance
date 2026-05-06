// Technical Assurance Companion (TAC) — backend route handler map.
//
// Phase 1 — Enquiry capture (E1). Six endpoints for the CRUD shell:
//   1. tacListEnquiries       — list scoped by clientId; optional `mine`
//   2. tacGetEnquiry          — single read, cross-tenant guard
//   3. tacUpsertEnquiry       — Draft only; field whitelist; auto-id on create
//   4. tacAttachFile          — base64 → storage → append to enquiry doc
//   5. tacRemoveAttachment    — delete from storage + remove from doc
//   6. tacSoftDeleteEnquiry   — soft-delete + restore via the same endpoint
//
// Phase 2 lands `tacGenerateInsight`. Phases 4-9 layer state-transition,
// share, close, unlock and audit endpoints on top.
//
// Standard return shape:
//   success → { success: true, ...payload }
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
import { generateInsightForEnquiry } from "../lib/tacInsightGenerator.js";

// --- Constants ------------------------------------------------------------

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
// Anything not on this list is silently dropped (lesson #12).
const ENQUIRY_WRITABLE_FIELDS = [
  "title",
  "query",
  "ribaStage",
  "projectId",
] as const;

const ENQUIRY_TITLE_MAX = 200;
const ENQUIRY_QUERY_MAX = 8000;

// --- Helpers --------------------------------------------------------------

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
 *
 * Mirrors the `loadEditableMeeting` / `loadFpItemForTransition` pattern from
 * Phase 8b / 5.5b governance — centralises ID validation + cross-tenant
 * scoping + owner-or-admin check + state-machine guard so each endpoint
 * stays focused on its own logic (lesson #80).
 *
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

// --- Endpoint 1: tacListEnquiries ----------------------------------------

async function tacListEnquiries(req: any, res: any, ctx: ApiContext) {
  try {
    const { mine } = req.body ?? {};
    // Seed-on-first-read — gives a fresh workspace 2 sample enquiries so the
    // table chrome + StatsCards are visually verifiable from first load.
    // Lesson #22: probe-then-batch pattern, idempotent — never duplicates.
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

// --- Endpoint 2: tacGetEnquiry -------------------------------------------

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

// --- Endpoint 3: tacUpsertEnquiry ----------------------------------------

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

// --- Endpoint 4: tacAttachFile -------------------------------------------

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

// --- Endpoint 5: tacRemoveAttachment -------------------------------------

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

// --- Endpoint 6: tacSoftDeleteEnquiry ------------------------------------

async function tacSoftDeleteEnquiry(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId, reason, restore } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res);
    if (!guard) return;

    if (restore === true) {
      await guard.docRef.set(
        {
          softDeleted: false,
          deletionReason: null,
          deletedAt: null,
          deletedBy: null,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
      return res.status(200).json({ success: true, restored: true });
    }

    if (typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "Soft-delete reason must be at least 5 characters.",
        code: "INVALID_INPUT",
      });
    }

    await guard.docRef.set(
      {
        softDeleted: true,
        deletionReason: reason.trim().slice(0, 500),
        deletedAt: nowIso(),
        deletedBy: ctx.uid,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    return res.status(200).json({ success: true, softDeleted: true });
  } catch (e: any) {
    console.error("[tacSoftDeleteEnquiry] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to soft-delete enquiry.",
      code: "DELETE_FAILED",
    });
  }
}

// --- Endpoint 7: tacGenerateInsight (Phase 2) ----------------------------

async function tacGenerateInsight(req: any, res: any, ctx: ApiContext) {
  try {
    const { enquiryId } = req.body ?? {};
    const guard = await loadEnquiryForMutation(ctx, enquiryId, res, {
      allowedStatuses: ["Draft"],
    });
    if (!guard) return;

    const result = await generateInsightForEnquiry({
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
    return res.status(200).json({
      success: true,
      enquiry: result.result.enquiry,
      summary: result.result.summary,
    });
  } catch (e: any) {
    console.error("[tacGenerateInsight] failed:", e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? "Failed to generate insight.",
      code: "GENERATE_FAILED",
    });
  }
}

// --- Endpoint 8: tacGetEnquiryDeliverable (Phase 2) ----------------------
// Reads a single tab's deliverable doc (Phase 3-7 will use this for the
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

// --- Route map -----------------------------------------------------------

export const technicalAssuranceRoutes: Record<string, any> = {
  tacListEnquiries,
  tacGetEnquiry,
  tacUpsertEnquiry,
  tacAttachFile,
  tacRemoveAttachment,
  tacSoftDeleteEnquiry,
  // Phase 2 — AI insight generation
  tacGenerateInsight,
  tacGetEnquiryDeliverable,
  // Phase 4: tacRenderAnnotatedPdf, tacSendDrawingToArchitect.
  // Phase 5: tacIssueRfi, tacListRfis, tacGetRfi, tacUpsertRfiDraft.
  // Phase 6: tacListCostRates, tacUpsertCostRate, tacExportCostCsv.
  // Phase 7: tacDownloadCompliancePack, tacSaveToGoldenThread.
  // Phase 8: tacFlagForAudit, tacResolveFlag, tacSubmitFeedback,
  //          tacArchiveEnquiry, tacRestoreEnquiry, tacDeleteEnquiry.
  // Phase 9: tacCloseEnquiry, tacUnlockEnquiry, tacShareEnquiry,
  //          tacDecideOnShare, tacExportDecisionLog.
  // Phase 10: refreshRegulationsCorpus.
};

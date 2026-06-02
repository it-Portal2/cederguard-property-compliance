//  server endpoints — month-end snapshot read + cron entry points.
//
// Three actions registered on the dispatcher:
//   • hrcRunMonthlySnapshot — cron-triggered (or super-admin manual)
//                                walks every workspace + builds the
//                                snapshot for the just-ended month.
//   • hrcRunRetentionPurge — cron-triggered yearly walk of the
//                                monthlySnapshots collection; deletes
//                                anything past retention.
//   • hrcReadSnapshot — client-facing read (signed-in users)
//                                returning frozen state for one month.
//   • hrcListAvailableMonths — populates the MonthPicker dropdown.
//
// Cron auth follows the exact same pattern as governanceCron.ts:
//   When CRON_SECRET env var is set, Vercel cron sends
//     `Authorization: Bearer <CRON_SECRET>`. We compare strict.
//   Local dev (no env var) is permissive so devs can trigger by hand.
//   Authenticated `super_admin` always allowed (ad-hoc rebuilds).

import type { ApiContext } from "../lib/context.js";
import { logSystemActivity } from "../lib/activityLog.js";
import {
  buildMonthlySnapshot,
  listAvailableSnapshotMonths,
  previousYearMonth,
  purgeExpiredSnapshots,
  readDeploymentMeta,
  readMonthlySnapshot,
  snapshotParentDocId,
} from "../lib/historicalSnapshots.js";
import {
  HRC_ALL_COLLECTIONS,
  type HrcCollection,
} from "../../src/types/historicalReporting.js";

// ── Cron auth (mirrors governanceCron.isAuthorisedCronCall) ──────────────
function isAuthorisedCronCall(req: any, ctx: ApiContext): boolean {
  if (ctx.isAdmin) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode
  const auth = req?.headers?.authorization ?? req?.headers?.Authorization;
  if (typeof auth !== "string") return false;
  return auth === `Bearer ${secret}`;
}

// ── Workspace discovery (mirrors governanceCron.runChaseEngine) ──────────
async function listWorkspaceIds(ctx: ApiContext): Promise<string[]> {
  const ids: string[] = [];
  try {
    const snap = await ctx.db.collection("users").limit(500).get();
    for (const d of snap.docs) {
      const data = d.data() ?? {};
      // Workspace owners (canonical client_admin) OR any user without a
      // linked owner (i.e. their uid IS the workspace primary id).
      if (data.role === "client_admin" || !data.linkedToOwnerUid) {
        ids.push(d.id);
      }
    }
  } catch (err) {
    console.error("[hrcCron] workspace discovery failed", err);
  }
  return ids;
}

// ── Endpoints ────────────────────────────────────────────────────────────

/**
 * Cron handler — fires at 00:05 UTC on day-1 of every month. Walks
 * every workspace and writes a snapshot for the month that JUST ended.
 *
 * Manual trigger by super_admin: pass `?yearMonth=2026-04` to rebuild
 * a specific month. Useful when the cron failed and we need to backfill.
 */
async function hrcRunMonthlySnapshot(req: any, res: any, ctx: ApiContext) {
  const startedAt = Date.now();
  try {
    if (!isAuthorisedCronCall(req, ctx)) {
      return res.status(403).json({
        success: false,
        error: "Cron auth failed.",
        code: "CRON_FORBIDDEN",
      });
    }
    const yearMonth: string =
      typeof req?.body?.yearMonth === "string" && req.body.yearMonth
        ? req.body.yearMonth
        : previousYearMonth();

    // `force=true` is only ever sent by a user who clicked "Generate
    // snapshot now" in the UI. We treat it as a manual trigger and
    // scope the work to JUST the caller's workspace so the response
    // returns in a few seconds — even when the caller is a platform
    // super_admin who would otherwise walk every workspace and time out.
    //
    // The unforced cron path (Vercel cron daily/monthly) preserves the
    // original behaviour — platform admin runs across all workspaces.
    const force = !!req?.body?.force;

    const isPlatformAdmin = !!ctx.isAdmin && !force;
    const workspaceIds = isPlatformAdmin
      ? await listWorkspaceIds(ctx)
      : [ctx.primaryUid];

    let totalLegacyDocsWritten = 0;
    let totalGovernanceDocsWritten = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    const results: Array<{
      clientId: string;
      legacyDocsWritten: number;
      governanceDocsWritten: number;
      durationMs?: number;
      skipped?: boolean;
      reason?: string;
      error?: string;
    }> = [];

    for (const clientId of workspaceIds) {
      try {
        const r = await buildMonthlySnapshot(ctx, clientId, yearMonth, {
          triggeredBy: ctx.uid ?? "cron",
          skipIfExists: !force,
          force,
        });
        results.push({
          clientId,
          legacyDocsWritten: r.legacyDocsWritten,
          governanceDocsWritten: r.governanceDocsWritten,
          durationMs: r.durationMs,
          ...(r.skipped ? { skipped: true, reason: r.reason } : {}),
        });
        totalLegacyDocsWritten += r.legacyDocsWritten;
        totalGovernanceDocsWritten += r.governanceDocsWritten;
        if (r.skipped) totalSkipped += 1;
      } catch (err: any) {
        console.error(
          `[hrcCron] snapshot failed for ${clientId} ${yearMonth}:`,
          err,
        );
        results.push({
          clientId,
          legacyDocsWritten: 0,
          governanceDocsWritten: 0,
          error: err?.message ?? "unknown",
        });
        totalErrors += 1;
      }
    }

    const summary = {
      yearMonth,
      workspaceCount: workspaceIds.length,
      durationMs: Date.now() - startedAt,
      totalLegacyDocsWritten,
      totalGovernanceDocsWritten,
      totalSkipped,
      totalErrors,
      force,
    };

    // Structured log for Vercel observability — one line per cron run,
    // grep-friendly for diagnosing missing-snapshot incidents.
    console.info(
      `[hrcCron] runMonthlySnapshot summary ${JSON.stringify(summary)}`,
    );

    await logSystemActivity(ctx, "monthly_snapshot_run", {
      entityType: "system",
      entityName: `Monthly snapshot ${summary.yearMonth}`,
      details: summary,
    });

    return res.status(200).json({ success: true, ...summary, results });
  } catch (err: any) {
    console.error("[hrcCron] runMonthlySnapshot fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Snapshot run failed.",
    });
  }
}

/**
 * Yearly retention-purge cron. Walks monthlySnapshots collection
 * deleting any parent doc whose `retentionUntil` is in the past.
 */
async function hrcRunRetentionPurge(req: any, res: any, ctx: ApiContext) {
  try {
    if (!isAuthorisedCronCall(req, ctx)) {
      return res.status(403).json({
        success: false,
        error: "Cron auth failed.",
        code: "CRON_FORBIDDEN",
      });
    }
    const result = await purgeExpiredSnapshots(ctx);
    await logSystemActivity(ctx, "retention_purge_run", {
      entityType: "system",
      entityName: "Retention purge run",
      details: { ...result },
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error("[hrcCron] runRetentionPurge fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Retention purge failed.",
    });
  }
}

/**
 * Client-facing read — returns the frozen state of one collection for
 * one month.
 */
async function hrcReadSnapshot(req: any, res: any, ctx: ApiContext) {
  try {
    const { yearMonth, collection } = req.body ?? {};
    if (typeof yearMonth !== "string" || !yearMonth.match(/^\d{4}-\d{2}$/)) {
      return res
        .status(400)
        .json({ success: false, error: "yearMonth must be YYYY-MM" });
    }
    if (
      typeof collection !== "string" ||
      !HRC_ALL_COLLECTIONS.includes(collection as HrcCollection)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid collection" });
    }
    const result = await readMonthlySnapshot(
      ctx,
      ctx.primaryUid,
      yearMonth,
      collection as HrcCollection,
    );
    if (!result) {
      return res.status(200).json({
        success: true,
        meta: null,
        entries: [],
        empty: true,
        reason: "NO_SNAPSHOT_FOR_MONTH",
      });
    }
    return res.status(200).json({
      success: true,
      meta: result.meta,
      entries: result.entries,
      empty: result.entries.length === 0,
    });
  } catch (err: any) {
    console.error("[hrc] hrcReadSnapshot fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Failed to read snapshot.",
    });
  }
}

/**
 * Client-facing helper for the MonthPicker dropdown. Returns the list
 * of YearMonth strings for which a snapshot exists in the caller's
 * workspace, plus the deployment marker so the UI can distinguish
 * "before launched" from "snapshot missing".
 */
async function hrcListAvailableMonths(_req: any, res: any, ctx: ApiContext) {
  try {
    const [months, deployment] = await Promise.all([
      listAvailableSnapshotMonths(ctx, ctx.primaryUid),
      readDeploymentMeta(ctx, ctx.primaryUid),
    ]);
    return res.status(200).json({
      success: true,
      months,
      activatedYearMonth: deployment?.activatedYearMonth ?? null,
      lastSnapshotYearMonth: deployment?.lastSnapshotYearMonth ?? null,
    });
  } catch (err: any) {
    console.error("[hrc] hrcListAvailableMonths fatal", err);
    return res
      .status(500)
      .json({ success: false, error: err?.message ?? "Failed to list months." });
  }
}

/**
 * Admin-only inspect endpoint — returns the parent meta + per-collection
 * row counts for one (clientId, yearMonth) without paying for the full
 * payload. Useful for diagnosing "did the cron run for this month?"
 * without scrolling through the snapshot UI.
 */
async function hrcInspectSnapshot(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isAdmin && !ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin only.",
        code: "FORBIDDEN",
      });
    }
    const { yearMonth } = req.body ?? {};
    if (typeof yearMonth !== "string" || !yearMonth.match(/^\d{4}-\d{2}$/)) {
      return res
        .status(400)
        .json({ success: false, error: "yearMonth must be YYYY-MM" });
    }
    const clientId = ctx.isAdmin && req.body?.clientId
      ? req.body.clientId
      : ctx.primaryUid;
    const parentId = snapshotParentDocId(clientId, yearMonth);
    const parentRef = ctx.db.collection("monthlySnapshots").doc(parentId);
    const parentDoc = await parentRef.get();
    if (!parentDoc.exists) {
      return res.status(200).json({
        success: true,
        exists: false,
        clientId,
        yearMonth,
      });
    }
    const meta = parentDoc.data();
    const collections = (meta?.collectionsCovered ?? []) as string[];
    const counts: Record<string, number> = {};
    for (const collection of collections) {
      try {
        const sub = await parentRef.collection(collection).count().get();
        counts[collection] = sub.data().count;
      } catch {
        counts[collection] = -1; // older Firestore SDK without count — skip
      }
    }
    return res.status(200).json({
      success: true,
      exists: true,
      clientId,
      yearMonth,
      meta,
      counts,
    });
  } catch (err: any) {
    console.error("[hrc] hrcInspectSnapshot fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Failed to inspect snapshot.",
    });
  }
}

/**
 * super_admin correction endpoint.
 * Lets a super_admin patch one row inside a snapshot when an honest
 * data entry error needs to be corrected after the cron has frozen
 * it. Every call:
 *   • requires `reason` ≥ 5 chars
 *   • appends an immutable row to the parent's `correctionHistory`
 *     sub-collection (before-state + after-state + reason + uid + ts)
 *   • flips the parent doc's `anyCorrected` flag to `true`
 *   • fires an `auditEvents` row of action `historical.snapshot.corrected`
 * Non-super_admin callers are rejected. The snapshot row itself is
 * patched (merge-set) so existing readers continue to work; the
 * historical view will surface a "Corrected" badge based on
 * `anyCorrected` and the correctionHistory entries.
 */
async function hrcCorrectSnapshotRow(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isAdmin) {
      return res
        .status(403)
        .json({ success: false, error: "Super admin only.", code: "FORBIDDEN" });
    }
    const { yearMonth, collection, docId, patch, reason, clientId } =
      req.body ?? {};

    if (typeof yearMonth !== "string" || !yearMonth.match(/^\d{4}-\d{2}$/)) {
      return res
        .status(400)
        .json({ success: false, error: "yearMonth must be YYYY-MM" });
    }
    if (
      typeof collection !== "string" ||
      !HRC_ALL_COLLECTIONS.includes(collection as HrcCollection)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid collection" });
    }
    if (typeof docId !== "string" || !docId) {
      return res.status(400).json({ success: false, error: "Missing docId" });
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return res
        .status(400)
        .json({ success: false, error: "patch must be an object" });
    }
    const trimmedReason =
      typeof reason === "string" ? reason.trim() : "";
    if (trimmedReason.length < 5) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Reason must be at least 5 characters.",
          code: "REASON_TOO_SHORT",
        });
    }

    // Super-admin can target any workspace; default to caller's primary.
    const targetClientId =
      typeof clientId === "string" && clientId ? clientId : ctx.primaryUid;
    const parentId = snapshotParentDocId(targetClientId, yearMonth);
    const parentRef = ctx.db.collection("monthlySnapshots").doc(parentId);
    const parentDoc = await parentRef.get();
    if (!parentDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Snapshot not found.", code: "NOT_FOUND" });
    }

    const rowRef = parentRef.collection(collection).doc(docId);
    const rowDoc = await rowRef.get();
    if (!rowDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Snapshot row not found.", code: "ROW_NOT_FOUND" });
    }
    const before = rowDoc.data() ?? null;
    const ts = new Date().toISOString();
    const correctionId = `${ctx.uid}_${Date.now().toString(36)}`;

    // Apply the patch (merge-set so untouched fields survive). Never
    // allow the patch to overwrite the snapshot's structural metadata
    // (kind / collection / capturedAt / docId / projectId).
    const blocked = ["kind", "collection", "capturedAt", "docId", "projectId"];
    const safePatch: Record<string, any> = {};
    for (const k of Object.keys(patch)) {
      if (!blocked.includes(k)) safePatch[k] = (patch as any)[k];
    }
    if (Object.keys(safePatch).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No allowed fields in patch.",
        code: "EMPTY_PATCH",
      });
    }

    await rowRef.set(safePatch, { merge: true });
    const after = (await rowRef.get()).data() ?? null;

    // Immutable correction-history row.
    await parentRef.collection("correctionHistory").doc(correctionId).set({
      id: correctionId,
      clientId: targetClientId,
      snapshotPath: `monthlySnapshots/${parentId}/${collection}/${docId}`,
      yearMonth,
      collection,
      docId,
      correctedAt: ts,
      correctedBy: ctx.uid ?? null,
      reason: trimmedReason,
      before,
      after,
    });

    // Flip parent flag (only if not already set — cheap idempotent merge).
    await parentRef.set({ anyCorrected: true }, { merge: true });

    // Loud audit event.
    try {
      await ctx.db.collection("auditEvents").add({
        clientId: targetClientId,
        action: "historical.snapshot.corrected",
        actorUid: ctx.uid,
        timestamp: ts,
        meta: {
          yearMonth,
          collection,
          docId,
          correctionId,
          reason: trimmedReason,
          patchedKeys: Object.keys(safePatch),
        },
      });
    } catch (auditErr) {
      console.error("[hrcCorrectSnapshotRow] audit write failed", auditErr);
    }

    return res.status(200).json({
      success: true,
      correctionId,
      correctedAt: ts,
      after,
    });
  } catch (err: any) {
    console.error("[hrc] hrcCorrectSnapshotRow fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Failed to correct snapshot row.",
    });
  }
}

/**
 * list correction-history entries for one snapshot (or one
 * specific row). Used by the CorrectionHistory side panel so the user
 * can see who corrected what, when, and why.
 * Readable by any signed-in caller in the same workspace — corrections
 * are part of the audit trail; FOI / Scrutiny readers must see them.
 */
async function hrcListCorrections(req: any, res: any, ctx: ApiContext) {
  try {
    const { yearMonth, collection, docId, clientId } = req.body ?? {};
    if (typeof yearMonth !== "string" || !yearMonth.match(/^\d{4}-\d{2}$/)) {
      return res
        .status(400)
        .json({ success: false, error: "yearMonth must be YYYY-MM" });
    }
    const targetClientId =
      typeof clientId === "string" && ctx.isAdmin && clientId
        ? clientId
        : ctx.primaryUid;
    const parentId = snapshotParentDocId(targetClientId, yearMonth);
    const parentRef = ctx.db.collection("monthlySnapshots").doc(parentId);

    let query: any = parentRef.collection("correctionHistory");
    if (typeof collection === "string" && collection) {
      query = query.where("collection", "==", collection);
    }
    if (typeof docId === "string" && docId) {
      query = query.where("docId", "==", docId);
    }

    const snap = await query.get();
    const entries = snap.docs
      .map((d: any) => d.data())
      .sort((a: any, b: any) =>
        String(b.correctedAt ?? "").localeCompare(String(a.correctedAt ?? "")),
      );
    return res.status(200).json({ success: true, entries });
  } catch (err: any) {
    console.error("[hrc] hrcListCorrections fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Failed to list corrections.",
    });
  }
}

/**
 * Returns the workspace's deployment meta — the "first available
 * month" + "last snapshot month" + total run count. Powers the UI
 * empty-state messaging.
 */
async function hrcGetDeploymentMeta(_req: any, res: any, ctx: ApiContext) {
  try {
    const meta = await readDeploymentMeta(ctx, ctx.primaryUid);
    return res.status(200).json({ success: true, meta });
  } catch (err: any) {
    console.error("[hrc] hrcGetDeploymentMeta fatal", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Failed to read deployment meta.",
    });
  }
}

export const historicalReportingRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  hrcRunMonthlySnapshot,
  hrcRunRetentionPurge,
  hrcReadSnapshot,
  hrcListAvailableMonths,
  hrcInspectSnapshot,
  hrcGetDeploymentMeta,
  hrcCorrectSnapshotRow,
  hrcListCorrections,
};

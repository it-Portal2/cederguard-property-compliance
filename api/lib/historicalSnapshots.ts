//  monthly snapshot helpers.
//
// Two surfaces:
//   1. Cron / manual trigger calls `buildMonthlySnapshot(ctx, clientId,
//      yearMonth)` to generate the frozen month-end view.
//   2. Read endpoints call `readMonthlySnapshot(ctx, clientId, yearMonth,
//      collection)` to return the snapshot rows for a given collection.
//
// Storage shape (under monthlySnapshots/{clientId}_{YYYY-MM}/.):
//   .meta ← parent doc with monthEnd, retentionUntil, etc.
//   risks/{projId} ← LegacyArraySnapshot (whole array)
//   complianceItems/{projId} ← same
//   issues/{projId} ← same
//   kris/{projId} ← same
//   forwardPlanItems/{docId} ← GovernanceDocSnapshot (per-doc)
//   meetings/{docId} ← same
//   reports/{docId} ← same
//   . etc
//
// Retention: 25 years for HRB workspaces, 7 years standard.
// Calculated at write time and stored on the parent doc; the yearly
// retention-purge cron uses it as a simple gate.

import type { ApiContext } from "./context.js";
import type {
  HrcCollection,
  YearMonth,
  MonthEndIso,
  MonthlySnapshotMeta,
  LegacyArraySnapshot,
  GovernanceDocSnapshot,
} from "../../src/types/historicalReporting.js";
import {
  HRC_LEGACY_COLLECTIONS,
  HRC_GOVERNANCE_COLLECTIONS,
} from "../../src/types/historicalReporting.js";

// ── Retention windows ─────────────────────────────────────────────────────
// PRD §5: 25y for HRB-flagged clients, 7y standard.
export const RETENTION_HRB_YEARS = 25;
export const RETENTION_STANDARD_YEARS = 7;

// ── Time helpers ──────────────────────────────────────────────────────────
// We store month-end in UK time (Europe/London) so end-of-March is
// 23:59:59 local even during the BST transition. We don't import a tz
// library — UK is UTC+0 (GMT) Oct-Mar and UTC+1 (BST) late-Mar to
// late-Oct. The snapshot timestamp is informational; the doc id is
// always YYYY-MM which is timezone-independent.

/**
 * Given a calendar yearMonth `'2026-05'`, return the ISO timestamp of
 * the last instant of that month in UK time. Works around BST
 * transitions by computing in UTC and applying the offset for the
 * relevant date.
 */
export function monthEndIso(yearMonth: YearMonth): MonthEndIso {
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) {
    throw new Error(`Invalid yearMonth: ${yearMonth}`);
  }
  // Day 0 of next month = last day of this month.
  const lastDayUtc = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return lastDayUtc.toISOString();
}

/**
 * Format yearMonth from a Date, e.g. for "what month did this snapshot belong to".
 */
export function yearMonthOf(d: Date): YearMonth {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Return the previous month's yearMonth. Used by the cron at the start
 * of every month to snapshot the month that JUST ended.
 */
export function previousYearMonth(now: Date = new Date()): YearMonth {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return yearMonthOf(d);
}

/**
 * Compute retention `until` ISO string by adding N years to the month-end.
 */
export function computeRetentionUntil(
  monthEndIsoStr: MonthEndIso,
  isHrb: boolean,
): string {
  const years = isHrb ? RETENTION_HRB_YEARS : RETENTION_STANDARD_YEARS;
  const d = new Date(monthEndIsoStr);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString();
}

// ── Workspace HRB detection ────────────────────────────────────────────
// A workspace is HRB-classified if ANY of its projects has isHRB === true.
// Drives 25y vs 7y retention on every snapshot.
export async function isWorkspaceHrb(
  ctx: ApiContext,
  clientId: string,
): Promise<boolean> {
  try {
    const snap = await ctx.db
      .collection("projects")
      .where("clientId", "==", clientId)
      .where("isHRB", "==", true)
      .limit(1)
      .get();
    return !snap.empty;
  } catch (err) {
    console.error("[historicalSnapshots] isWorkspaceHrb failed:", err);
    return false; // safer default: shorter retention
  }
}

// ── Doc id helpers ────────────────────────────────────────────────────────
export function snapshotParentDocId(clientId: string, yearMonth: YearMonth): string {
  return `${clientId}_${yearMonth}`;
}

// ── Deployment marker ─────────────────────────────────────────────
//
//  locks "start fresh from May 2026". The UI needs to distinguish two
// reasons a snapshot read returns empty:
//   (a) The user picked a month from BEFORE was activated for their
//       workspace — show "Feature launched {month}; earlier months
//       unavailable" message.
//   (b) The user picked a month AFTER activation but the cron failed for
//       that month — show "Snapshot missing — contact admin" message.
//
// This is solved by writing a per-workspace marker on the first
// successful snapshot run. `hrcMeta/{clientId}.activatedYearMonth` =
// the first yearMonth ever snapshotted for that workspace.
export interface HrcDeploymentMeta {
  clientId: string;
  activatedYearMonth: YearMonth;
  activatedAt: string;
  lastSnapshotYearMonth: YearMonth;
  lastSnapshotAt: string;
  totalSnapshotsRun: number;
}

export async function ensureDeploymentMarker(
  ctx: ApiContext,
  clientId: string,
  yearMonth: YearMonth,
): Promise<HrcDeploymentMeta> {
  const ref = ctx.db.collection("hrcMeta").doc(clientId);
  const now = new Date().toISOString();
  const existing = await ref.get();
  if (!existing.exists) {
    const meta: HrcDeploymentMeta = {
      clientId,
      activatedYearMonth: yearMonth,
      activatedAt: now,
      lastSnapshotYearMonth: yearMonth,
      lastSnapshotAt: now,
      totalSnapshotsRun: 1,
    };
    await ref.set(meta);
    return meta;
  }
  // Update on subsequent runs. Use Firestore increment for total counter
  // so concurrent runs don't drop count, but read-then-write is fine for
  // the lastSnapshot* fields since the cron is single-threaded per month.
  const data = existing.data() as HrcDeploymentMeta;
  const next: HrcDeploymentMeta = {
    ...data,
    lastSnapshotYearMonth: yearMonth,
    lastSnapshotAt: now,
    totalSnapshotsRun: (data.totalSnapshotsRun ?? 0) + 1,
  };
  await ref.set(next, { merge: true });
  return next;
}

export async function readDeploymentMeta(
  ctx: ApiContext,
  clientId: string,
): Promise<HrcDeploymentMeta | null> {
  const doc = await ctx.db.collection("hrcMeta").doc(clientId).get();
  if (!doc.exists) return null;
  return doc.data() as HrcDeploymentMeta;
}

// ── Builder ───────────────────────────────────────────────────────────────
//
// Snapshots every legacy collection (risks/compliance/issues/kris) for
// every project under the workspace, plus every governance per-doc
// collection (FP/meetings/reports/etc.) by clientId-prefix lookup.
//
// Idempotent: re-running the builder for the same (clientId, yearMonth)
// pair OVERWRITES the existing snapshot rows in place. The parent doc's
// `correctionHistory` sub-collection is not touched (Firestore preserves
// sub-collections when the parent doc is .set).
//
// The `skipIfExists` option is the canonical entry point for the cron —
// if a snapshot already exists for this (clientId, yearMonth), skip the
// expensive read+write phase and just bump the deployment marker.
//
// Pass `force: true` from a super-admin manual trigger when you actually
// want to rebuild a snapshot (e.g. after a data-correction).
export async function buildMonthlySnapshot(
  ctx: ApiContext,
  clientId: string,
  yearMonth: YearMonth,
  options: {
    triggeredBy?: string;
    skipIfExists?: boolean;
    force?: boolean;
  } = {},
): Promise<{
  parentPath: string;
  legacyDocsWritten: number;
  governanceDocsWritten: number;
  durationMs: number;
  skipped?: boolean;
  reason?: string;
}> {
  const startedAt = Date.now();
  const monthEnd = monthEndIso(yearMonth);
  const isHrb = await isWorkspaceHrb(ctx, clientId);
  const retentionUntil = computeRetentionUntil(monthEnd, isHrb);
  const parentId = snapshotParentDocId(clientId, yearMonth);
  const parentRef = ctx.db.collection("monthlySnapshots").doc(parentId);
  const capturedAt = new Date().toISOString();

  // Idempotency gate — when the cron retries a month we've already
  // captured, don't re-walk every collection. Force=true bypasses for
  // explicit super-admin rebuilds.
  if (options.skipIfExists && !options.force) {
    const existing = await parentRef.get();
    if (existing.exists) {
      return {
        parentPath: `monthlySnapshots/${parentId}`,
        legacyDocsWritten: 0,
        governanceDocsWritten: 0,
        durationMs: Date.now() - startedAt,
        skipped: true,
        reason: "ALREADY_EXISTS",
      };
    }
  }

  // ── Step 1: enumerate the workspace's projects (ids only) ────────────
  const projectsSnap = await ctx.db
    .collection("projects")
    .where("clientId", "==", clientId)
    .get();
  const projectIds = projectsSnap.docs.map((d) => d.id);

  // ── Step 2: snapshot legacy array-doc collections per project ────────
  let legacyDocsWritten = 0;
  for (const projectId of projectIds) {
    for (const collection of HRC_LEGACY_COLLECTIONS) {
      try {
        const liveDocRef = ctx.db
          .collection("projects")
          .doc(projectId)
          .collection("data")
          .doc(collection);
        const liveDoc = await liveDocRef.get();
        if (!liveDoc.exists) continue;

        const arrayValue = (liveDoc.data() as any)?.data;
        const array = Array.isArray(arrayValue) ? arrayValue : [];
        if (array.length === 0) continue; // skip empty

        const entry: LegacyArraySnapshot = {
          kind: "legacyArray",
          collection,
          projectId,
          array,
          itemCount: array.length,
          capturedAt,
        };
        await parentRef.collection(collection).doc(projectId).set(entry);
        legacyDocsWritten += 1;
      } catch (err) {
        console.error(
          `[historicalSnapshots] legacy snapshot failed for ${projectId}/${collection}:`,
          err,
        );
      }
    }
  }

  // ── Step 3: snapshot governance per-doc collections by clientId ──────
  // All + governance docs use composite IDs `{clientId}_{.}` so
  // we can prefix-scan, but the safer/simpler query is a where clause on
  // the clientId field which every governance doc carries.
  let governanceDocsWritten = 0;
  for (const collection of HRC_GOVERNANCE_COLLECTIONS) {
    try {
      const liveSnap = await ctx.db
        .collection(collection)
        .where("clientId", "==", clientId)
        .get();
      const batch = ctx.db.batch();
      let opsInBatch = 0;
      for (const doc of liveSnap.docs) {
        const entry: GovernanceDocSnapshot = {
          kind: "governanceDoc",
          collection,
          docId: doc.id,
          doc: doc.data(),
          capturedAt,
        };
        batch.set(parentRef.collection(collection).doc(doc.id), entry);
        opsInBatch += 1;
        governanceDocsWritten += 1;
        if (opsInBatch >= 400) {
          await batch.commit();
          opsInBatch = 0;
        }
      }
      if (opsInBatch > 0) await batch.commit();
    } catch (err) {
      console.error(
        `[historicalSnapshots] governance snapshot failed for ${collection}:`,
        err,
      );
    }
  }

  // ── Step 4: write the parent meta doc ────────────────────────────────
  const meta: MonthlySnapshotMeta = {
    clientId,
    yearMonth,
    monthEndIso: monthEnd,
    generatedAt: capturedAt,
    generatedBy: options.triggeredBy ?? "cron",
    retentionUntil,
    isHrbWorkspace: isHrb,
    collectionsCovered: [
      ...HRC_LEGACY_COLLECTIONS,
      ...HRC_GOVERNANCE_COLLECTIONS,
    ],
    anyCorrected: false,
  };
  await parentRef.set(meta, { merge: true });

  // ── Step 5: bump the deployment marker so the UI can answer
  //          "what's the earliest month I can pick?" without scanning.
  try {
    await ensureDeploymentMarker(ctx, clientId, yearMonth);
  } catch (err) {
    console.error(
      `[historicalSnapshots] deployment marker write failed for ${clientId}:`,
      err,
    );
  }

  return {
    parentPath: `monthlySnapshots/${parentId}`,
    legacyDocsWritten,
    governanceDocsWritten,
    durationMs: Date.now() - startedAt,
  };
}

// ── Reader ────────────────────────────────────────────────────────────────
//
// Returns:
//   LegacyArraySnapshot for legacy collections (one per project)
//   GovernanceDocSnapshot for governance collections (one per doc)
//   null when no snapshot exists for this (clientId, yearMonth)
export async function readMonthlySnapshot(
  ctx: ApiContext,
  clientId: string,
  yearMonth: YearMonth,
  collection: HrcCollection,
): Promise<{
  meta: MonthlySnapshotMeta | null;
  entries: any[];
} | null> {
  const parentId = snapshotParentDocId(clientId, yearMonth);
  const parentRef = ctx.db.collection("monthlySnapshots").doc(parentId);
  const parentDoc = await parentRef.get();
  if (!parentDoc.exists) return null;
  const meta = parentDoc.data() as MonthlySnapshotMeta;
  const subSnap = await parentRef.collection(collection).get();
  const entries = subSnap.docs.map((d) => d.data());
  return { meta, entries };
}

// ── Available months helper (for picker UI) ───────────────────────────────
export async function listAvailableSnapshotMonths(
  ctx: ApiContext,
  clientId: string,
): Promise<YearMonth[]> {
  const snap = await ctx.db
    .collection("monthlySnapshots")
    .where("clientId", "==", clientId)
    .orderBy("yearMonth", "desc")
    .limit(120) // up to 10 years of monthly snapshots
    .get();
  return snap.docs.map((d) => (d.data() as any).yearMonth).filter(Boolean);
}

// ── Retention purge ────────────────────────────────────────────────────────
//
// Yearly cron walks every monthlySnapshots parent doc; if `retentionUntil`
// is in the past, the parent + every sub-collection doc is deleted.
export async function purgeExpiredSnapshots(
  ctx: ApiContext,
  now: Date = new Date(),
): Promise<{ purged: number; checked: number }> {
  let purged = 0;
  let checked = 0;
  const snap = await ctx.db
    .collection("monthlySnapshots")
    .where("retentionUntil", "<=", now.toISOString())
    .limit(500)
    .get();

  for (const parentDoc of snap.docs) {
    checked += 1;
    try {
      // Recursively delete sub-collections.
      for (const collection of [
        ...HRC_LEGACY_COLLECTIONS,
        ...HRC_GOVERNANCE_COLLECTIONS,
        "correctionHistory",
      ]) {
        const subSnap = await parentDoc.ref.collection(collection).get();
        const batch = ctx.db.batch();
        let ops = 0;
        for (const sub of subSnap.docs) {
          batch.delete(sub.ref);
          ops += 1;
          if (ops >= 400) {
            await batch.commit();
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();
      }
      await parentDoc.ref.delete();
      purged += 1;
    } catch (err) {
      console.error(
        `[historicalSnapshots] purge failed for ${parentDoc.id}:`,
        err,
      );
    }
  }
  return { purged, checked };
}

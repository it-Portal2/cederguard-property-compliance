// Activity / audit logging helper.
//
// SINGLE SOURCE OF TRUTH for writing user-activity records. Every handler logs
// through `logActivity(ctx, type, details)` — a thin, consistent wrapper over the
// existing `activityLogs` collection. It is AWAITED inside the handler BEFORE the
// response is sent, so the write always completes within the live invocation
// (no serverless teardown race), and it swallows its own errors so a logging
// failure can never break the user's operation.
//
// Record shape (backward-compatible with legacy `{ type, uid, email, timestamp }`):
//   type        — specific event, e.g. "project_updated"
//   category    — coarse bucket for filtering: create|read|update|delete|approve|system|auth|export|other
//   uid         — actor user id (kept for traceability)
//   userName    — actor's display name (WHO — human readable)
//   email       — actor's email (WHO)
//   clientId    — tenant key (ctx.primaryUid)
//   entityType  — "project" | "programme" | "risk" | "enquiry" | …
//   entityId    — the affected record id (kept for traceability)
//   entityName  — the affected record's NAME / TITLE (WHAT — human readable)
//   details     — free-form extra context (what changed, counts, before/after)
//   timestamp   — ISO 8601 string

import type { ApiContext } from "./context.js";

export type ActivityCategory =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "system"
  | "auth"
  | "export"
  | "other";

export interface ActivityDetails {
  category?: ActivityCategory;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  details?: Record<string, any> | null;
}

/**
 * Write one activity record. Awaited by the caller (before the HTTP response is
 * sent) so the write reliably completes; never throws.
 */
export async function logActivity(
  ctx: ApiContext,
  type: string,
  info: ActivityDetails = {},
): Promise<void> {
  try {
    // WHO — capture the actor's human-readable name + email automatically from
    // the context, so every call site records who did it without repeating it.
    const userName =
      ctx.userData?.displayName ||
      ctx.userData?.name ||
      ctx.userData?.companyName ||
      (ctx.email ? ctx.email.split("@")[0] : null);

    await ctx.db.collection("activityLogs").add({
      type,
      category: info.category || "other",
      uid: ctx.uid ?? null,
      userName: userName ?? null,
      email: ctx.email ?? null,
      clientId: ctx.primaryUid ?? null,
      entityType: info.entityType ?? null,
      entityId: info.entityId ?? null,
      entityName: info.entityName ?? null,
      details: info.details ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[activityLog] write failed:", e?.message || e);
  }
}

/**
 * System / automatic activity (cron jobs, escalations) that aren't a direct user
 * action. Same collection + shape; actor falls back to "system" when no ctx user.
 */
export async function logSystemActivity(
  ctx: ApiContext,
  type: string,
  info: Omit<ActivityDetails, "category"> = {},
): Promise<void> {
  return logActivity(ctx, type, { ...info, category: "system" });
}

// --- Array-collection diff logging (risks / issues / complianceItems / kris) ---
//
// These collections are saved as a whole array through `saveData`, so to record
// WHICH item changed (by NAME) we diff the previous array against the new one by
// item id and log per-item create/update/delete. To avoid flooding the log on a
// large bulk save (e.g. first import), we log a single summary above a threshold.

const ITEM_LABELS: Record<string, string> = {
  risks: "Risk",
  issues: "Issue",
  complianceItems: "Compliance item",
  kris: "KRI",
};

const PER_ITEM_LIMIT = 12;

function itemTitle(item: any): string {
  return (
    item?.title ||
    item?.name ||
    item?.requirement ||
    item?.ref ||
    item?.code ||
    item?.description ||
    (item?.id ? `#${item.id}` : "item")
  );
}

/**
 * Diff `prev` vs `next` (arrays of `{ id, … }`) for a saveData collection and log
 * per-item create/update/delete with the item's NAME + the project NAME. Awaited.
 */
export async function logArrayChanges(
  ctx: ApiContext,
  collection: string,
  projectId: string,
  prev: unknown,
  next: unknown,
): Promise<void> {
  const label = ITEM_LABELS[collection] || collection;
  const prevArr: any[] = Array.isArray(prev) ? prev : [];
  const nextArr: any[] = Array.isArray(next) ? next : [];

  const prevMap = new Map(prevArr.map((i) => [String(i?.id), i]));
  const nextMap = new Map(nextArr.map((i) => [String(i?.id), i]));

  const added = nextArr.filter((i) => !prevMap.has(String(i?.id)));
  const removed = prevArr.filter((i) => !nextMap.has(String(i?.id)));
  const updated = nextArr.filter(
    (i) =>
      prevMap.has(String(i?.id)) &&
      JSON.stringify(prevMap.get(String(i?.id))) !== JSON.stringify(i),
  );

  const total = added.length + removed.length + updated.length;
  if (total === 0) return;

  // Resolve the project name once for context.
  let projectName: string | null = null;
  try {
    projectName =
      (await ctx.db.collection("projects").doc(projectId).get()).data()?.name ??
      null;
  } catch {
    /* best-effort */
  }

  // Above the threshold, summarize instead of per-item (avoids log flooding).
  if (total > PER_ITEM_LIMIT) {
    await logActivity(ctx, `${collection}_saved`, {
      category: "update",
      entityType: collection,
      entityId: projectId,
      entityName: projectName,
      details: {
        scope: "bulk",
        created: added.length,
        updated: updated.length,
        deleted: removed.length,
      },
    });
    return;
  }

  for (const it of added) {
    await logActivity(ctx, `${collection}_item_created`, {
      category: "create",
      entityType: collection,
      entityId: String(it?.id ?? ""),
      entityName: itemTitle(it),
      details: { label, project: projectName },
    });
  }
  for (const it of updated) {
    await logActivity(ctx, `${collection}_item_updated`, {
      category: "update",
      entityType: collection,
      entityId: String(it?.id ?? ""),
      entityName: itemTitle(it),
      details: { label, project: projectName },
    });
  }
  for (const it of removed) {
    await logActivity(ctx, `${collection}_item_deleted`, {
      category: "delete",
      entityType: collection,
      entityId: String(it?.id ?? ""),
      entityName: itemTitle(it),
      details: { label, project: projectName },
    });
  }
}

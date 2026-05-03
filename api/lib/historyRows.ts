// HRC field-level history helper.
//
// Called pre-mutation by every server endpoint that updates one of the
// in-place collections (risks, complianceItems, issues, kris, FP items,
// meetings). Captures the previous state so any future point-in-time
// query can replay state at any timestamp.
//
// Usage (legacy array-doc collections — risks/compliance/issues/kris):
//   await appendHistoryRow(ctx, {
//     kind: 'legacyArray',
//     collection: 'risks',
//     ownerScope: projectId,
//     prevState: prevArray,
//     newState: newArray,
//     changeKind: 'update',
//   });
//
// Usage (governance per-doc collections — fp items / meetings / etc.):
//   await appendHistoryRow(ctx, {
//     kind: 'governanceDoc',
//     collection: 'forwardPlanItems',
//     ownerScope: docId,
//     prevState: prevDoc,
//     newState: nextDoc,
//     changeKind: 'update',
//   });
//
// History writes happen in their own batch — they are fire-and-forget
// from the caller's perspective so a history failure never blocks the
// primary mutation. Errors are logged but swallowed.

import type { ApiContext } from "./context.js";
import type {
  ChangeKind,
  HrcCollection,
  LegacyCollection,
  GovernanceCollection,
} from "../../src/types/historicalReporting.js";

const LEGACY_HISTORY_COLLECTIONS: Record<LegacyCollection, string> = {
  risks: "risksHistory",
  complianceItems: "complianceItemsHistory",
  issues: "issuesHistory",
  kris: "krisHistory",
};

const GOVERNANCE_HISTORY_COLLECTIONS: Record<GovernanceCollection, string> = {
  forwardPlanItems: "forwardPlanItemsHistory",
  meetings: "meetingsHistory",
  reports: "reportsHistory",
  projectGovernanceDocs: "projectGovernanceDocsHistory",
  framework: "frameworkHistory",
  templates: "templatesHistory",
  tors: "torsHistory",
};

export interface AppendLegacyHistoryArgs {
  kind: "legacyArray";
  collection: LegacyCollection;
  ownerScope: string; // projectId
  prevState: unknown[] | null;
  newState: unknown[] | null;
  changeKind: ChangeKind;
}

export interface AppendGovernanceHistoryArgs {
  kind: "governanceDoc";
  collection: GovernanceCollection;
  ownerScope: string; // docId
  prevState: Record<string, any> | null;
  newState: Record<string, any> | null;
  changeKind: ChangeKind;
}

export type AppendHistoryArgs =
  | AppendLegacyHistoryArgs
  | AppendGovernanceHistoryArgs;

/**
 * Append a single history row capturing one mutation. Best-effort: errors
 * are logged but never thrown. Call AFTER you've validated the incoming
 * mutation but BEFORE you write the new state, so prevState is the actual
 * pre-mutation snapshot.
 */
export async function appendHistoryRow(
  ctx: ApiContext,
  args: AppendHistoryArgs,
): Promise<void> {
  try {
    const collectionName =
      args.kind === "legacyArray"
        ? LEGACY_HISTORY_COLLECTIONS[args.collection]
        : GOVERNANCE_HISTORY_COLLECTIONS[args.collection];

    const clientId = ctx.primaryUid;
    const ts = Date.now();
    const docId = `${clientId}_${args.ownerScope}_${ts}`;

    const row = {
      id: docId,
      clientId,
      ownerScope: args.ownerScope,
      collection: args.collection as HrcCollection,
      capturedAt: new Date(ts).toISOString(),
      capturedBy: ctx.uid ?? "system",
      changeKind: args.changeKind,
      prevState: args.prevState ?? null,
      newState: args.newState ?? null,
    };

    await ctx.db.collection(collectionName).doc(docId).set(row);
  } catch (err) {
    // Never block the parent mutation on a history-row failure. The
    // main write already succeeded by the time this fires; losing one
    // history row is much better than blocking the user's save.
    console.error(
      `[historyRows] appendHistoryRow failed for ${args.collection}:`,
      err,
    );
  }
}

/**
 * Reconstruct the state of an entity at a specific timestamp by walking
 * the history chain backwards. Returns the most recent newState whose
 * capturedAt is <= the requested timestamp, or the live state if no
 * history exists prior.
 *
 * For now this is a building block — Phase HR-2/3 wires it into the
 * `useHistoricalView` server endpoint when the user picks an arbitrary
 * date (not just month-end).
 */
export async function readStateAtTime(
  ctx: ApiContext,
  args: {
    kind: "legacyArray" | "governanceDoc";
    collection: HrcCollection;
    ownerScope: string;
    atIso: string;
  },
): Promise<{ state: any | null; source: "history" | "missing" }> {
  const collectionName =
    args.kind === "legacyArray"
      ? LEGACY_HISTORY_COLLECTIONS[args.collection as LegacyCollection]
      : GOVERNANCE_HISTORY_COLLECTIONS[args.collection as GovernanceCollection];

  if (!collectionName) return { state: null, source: "missing" };

  const clientId = ctx.primaryUid;
  // Most recent history row at or before `atIso`. Falls back to null
  // if no history exists yet (entity created after `atIso`).
  const snap = await ctx.db
    .collection(collectionName)
    .where("clientId", "==", clientId)
    .where("ownerScope", "==", args.ownerScope)
    .where("capturedAt", "<=", args.atIso)
    .orderBy("capturedAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return { state: null, source: "missing" };
  const row = snap.docs[0].data();
  return { state: row.newState ?? null, source: "history" };
}

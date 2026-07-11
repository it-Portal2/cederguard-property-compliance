import { Timestamp } from 'firebase-admin/firestore';
import { ApiContext } from './context.js';
import { appendHistoryRow } from './historyRows.js';
import {
  HRC_LEGACY_COLLECTIONS,
  type LegacyCollection,
} from '../../shared/types/historicalReporting.js';
import {
  detectSevereTransitions,
  writeSevereEscalations,
} from './riskSevereEscalation.js';
import { logActivity, logArrayChanges } from './activityLog.js';

const HRC_TRACKED_LEGACY_COLLECTIONS: ReadonlyArray<string> = HRC_LEGACY_COLLECTIONS;

export interface LegacyArrayWriteResult {
  severeNotified?: { count: number; recipientCount: number };
}

/**
 * The single writer for the legacy whole-array collections stored at
 * `projects/{contextId}/data/{collection}` (risks, issues, complianceItems, kris,
 * tasks, complianceAnalysis, …), together with every side effect a save must carry:
 * point-in-time history rows, per-item activity diffs, and severe-risk escalation.
 *
 * Extracted from `saveData` so the agentic layer's apply-adapters write through the
 * exact same sequence — the two paths cannot drift.
 *
 * PRECONDITION: the caller MUST have authorized `contextId` for this user
 * (`ctx.isAuthorizedForContext`). This function performs no access control; it is not
 * reachable from the dispatcher directly.
 */
export async function writeLegacyArray(
  ctx: ApiContext,
  params: { collection: string; data: unknown; projectId: string },
): Promise<LegacyArrayWriteResult> {
  const { db } = ctx;
  const { collection, data, projectId } = params;

  const pathRef = db.collection('projects').doc(projectId).collection('data').doc(collection);

  // Capture pre-mutation array state for tracked legacy collections (risks,
  // complianceItems, issues, kris) so a future point-in-time query can replay state
  // at any timestamp. Reads BEFORE writing so prevState reflects the actual
  // pre-mutation doc. Best-effort: appendHistoryRow swallows errors so a history
  // failure never blocks the user's save.
  const isHrcTracked =
    HRC_TRACKED_LEGACY_COLLECTIONS.includes(collection) && data !== undefined;
  let hrcPrevArray: unknown[] | null = null;
  if (isHrcTracked) {
    try {
      const existing = await pathRef.get();
      const existingArr = existing.exists ? (existing.data() as any)?.data : null;
      hrcPrevArray = Array.isArray(existingArr) ? existingArr : null;
    } catch (err) {
      console.error('[hrc] saveData prev-state read failed:', err);
    }
  }

  if (data === null) {
    await pathRef.delete();
  } else {
    await pathRef.set({ data, updatedAt: Timestamp.fromMillis(Date.now()) });
  }

  if (isHrcTracked) {
    const newArr = data === null ? null : (Array.isArray(data) ? data : []);
    const changeKind =
      data === null
        ? 'softDelete'
        : hrcPrevArray === null
          ? 'create'
          : 'update';
    // Fire-and-forget — caller doesn't await and we don't await either, since
    // errors are swallowed inside appendHistoryRow.
    void appendHistoryRow(ctx, {
      kind: 'legacyArray',
      collection: collection as LegacyCollection,
      ownerScope: projectId,
      prevState: hrcPrevArray,
      newState: newArr,
      changeKind,
    });
  }

  // Activity log: for the item-array collections, diff old vs new to record WHICH
  // item (by name) was created/updated/deleted + by whom. For the non-array
  // complianceAnalysis, log a single update event.
  if (['risks', 'issues', 'complianceItems', 'kris'].includes(collection) && data !== null) {
    await logArrayChanges(ctx, collection, projectId, hrcPrevArray, data);
  } else if (collection === 'complianceAnalysis') {
    await logActivity(ctx, 'compliance_analysis_saved', {
      category: 'update',
      entityType: 'compliance',
      entityId: projectId,
      details: { project: projectId },
    });
  }

  // Severe-risk escalation: when a saved risks array contains a risk that
  // transitioned INTO Severe state (Impact = 5 on gross or residual), write a
  // severeRiskAlerts row plus an activity log entry and resolve Strategic Director
  // recipients. Idempotent — re-saves of an already-Severe risk do not re-trigger.
  let severeNotified: { count: number; recipientCount: number } | undefined;
  if (collection === 'risks' && Array.isArray(data) && data.length > 0) {
    try {
      const transitions = detectSevereTransitions(hrcPrevArray, data);
      if (transitions.length > 0) {
        // Programme vs project context: detect by reading the project doc. If the
        // contextId resolves to a programme, it's programme-kind. Fall back to
        // project-kind when unclear (most common case).
        let contextKind: 'project' | 'programme' = 'project';
        try {
          const progDoc = await db.collection('programmes').doc(projectId).get();
          if (progDoc.exists) contextKind = 'programme';
        } catch (err) {
          console.error('[rsc-d] context-kind probe failed:', err);
        }
        const summary = await writeSevereEscalations(ctx, {
          transitions,
          contextId: projectId,
          contextKind,
        });
        if (summary.alertCount > 0) {
          severeNotified = {
            count: summary.alertCount,
            recipientCount: summary.recipientCount,
          };
        }
      }
    } catch (err) {
      // Never block save on Severe-detection failure.
      console.error('[rsc-d] severe-escalation pipeline failed:', err);
    }
  }

  return severeNotified ? { severeNotified } : {};
}

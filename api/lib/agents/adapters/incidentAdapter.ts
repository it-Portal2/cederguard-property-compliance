import { FieldValue } from 'firebase-admin/firestore';
import type { AgentSuggestionDoc } from '../../../../shared/types/agents.js';
import type { ApplyResult, OutputAdapter } from './base.js';
import { str, stripForbiddenFields } from './base.js';

const INCIDENTS = 'incidents';

/** Only these descriptive fields may be filled in by an approved suggestion. */
const MERGEABLE = ['rootCause', 'lessonsLearned', 'immediateImpact', 'residentImpact', 'regulatoryRelevance', 'actionsTaken'] as const;

/**
 * Applies an incidentUpdate suggestion by merging descriptive analysis (root cause,
 * lessons, impacts) into an EXISTING incident. It can never change status or close the
 * incident: `status`/`closedAt` are not mergeable and are stripped, so the brief's
 * "AI cannot close an incident" rule holds structurally.
 *
 * The target incident id lives in payload.incidentId and is validated against the
 * tenant at apply time.
 */
export const incidentAdapter: OutputAdapter = {
  targetCollection: INCIDENTS,
  sanitize(payload) {
    const p = stripForbiddenFields(payload);
    const out: Record<string, unknown> = { incidentId: str(p.incidentId, 100) };
    for (const f of MERGEABLE) {
      if (typeof p[f] === 'string' && p[f]) out[f] = str(p[f], 4000);
    }
    return out;
  },
  prohibited(payload) {
    if (!(payload as any).incidentId) {
      return 'This incident-update suggestion has no target incident.';
    }
    if ('status' in payload || 'closedAt' in payload) {
      return 'An AI suggestion cannot change an incident status or close it.';
    }
    return null;
  },
  async apply(ctx, s: AgentSuggestionDoc, payload): Promise<ApplyResult> {
    const { db, primaryUid } = ctx;
    const incidentId = String((payload as any).incidentId);
    const ref = db.collection(INCIDENTS).doc(incidentId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.clientId !== primaryUid) {
      throw new Error('Target incident not found for this tenant.');
    }

    const merge: Record<string, unknown> = {};
    for (const f of MERGEABLE) {
      if (typeof (payload as any)[f] === 'string' && (payload as any)[f]) merge[f] = (payload as any)[f];
    }
    // Idempotent: record which suggestion filled these fields.
    merge.updatedAt = FieldValue.serverTimestamp();
    merge.lastAiSuggestionId = s.id;

    await ref.set(merge, { merge: true });
    return { collection: INCIDENTS, recordId: incidentId };
  },
};

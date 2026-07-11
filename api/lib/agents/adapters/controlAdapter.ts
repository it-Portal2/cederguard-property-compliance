import { FieldValue } from 'firebase-admin/firestore';
import type { AgentSuggestionDoc } from '../../../../shared/types/agents.js';
import { CONTROLS, sanitizeControl } from '../../../routes/controls.js';
import type { ApplyResult, OutputAdapter } from './base.js';
import { str, stripForbiddenFields } from './base.js';

/**
 * Applies an approved control suggestion as a first-class Control, reusing the route's
 * own sanitizeControl whitelist so the two write paths cannot drift. The control is
 * always created Not Tested and tagged origin:'ai-suggestion' — the agent can never
 * assert a control is Effective or verified.
 */
export const controlAdapter: OutputAdapter = {
  targetCollection: CONTROLS,
  sanitize(payload, s) {
    const p = stripForbiddenFields(payload);
    const scoped = s.contextKind === 'programme'
      ? { programmeId: s.contextId }
      : { projectId: s.contextId };
    return sanitizeControl({
      ...p,
      title: str(p.title ?? s.title, 300),
      ...scoped,
      // Forced regardless of what the model proposed — a new AI-originated control is
      // never pre-marked Effective/verified.
      status: 'Not Tested',
      origin: 'ai-suggestion',
    });
  },
  prohibited(payload) {
    const status = String((payload as any).status || '');
    if (status && status !== 'Not Tested') {
      return 'An AI suggestion cannot set a control status — a new control starts Not Tested.';
    }
    return null;
  },
  async apply(ctx, s, payload): Promise<ApplyResult> {
    const { db, primaryUid } = ctx;

    // Idempotent: a prior apply may have written the control but failed to flip the
    // suggestion status. Re-find it by its unique suggestion id (single-field query =
    // auto-indexed, no composite index) and confirm the tenant in memory.
    const prior = await db
      .collection(CONTROLS)
      .where('aiSuggestionId', '==', s.id)
      .limit(1)
      .get();
    if (!prior.empty && prior.docs[0].data()?.clientId === primaryUid) {
      return { collection: CONTROLS, recordId: prior.docs[0].id };
    }

    const id = db.collection(CONTROLS).doc().id;
    await db.collection(CONTROLS).doc(id).set({
      ...payload,
      id,
      clientId: primaryUid,
      aiSuggestionId: s.id,
      sourceRunId: s.runId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { collection: CONTROLS, recordId: id };
  },
};

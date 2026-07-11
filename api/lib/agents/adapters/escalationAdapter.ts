import { FieldValue } from 'firebase-admin/firestore';
import type { AgentSuggestionDoc } from '../../../../shared/types/agents.js';
import type { ApplyResult, OutputAdapter } from './base.js';
import { str, stripForbiddenFields } from './base.js';

const ASSURANCE_ALERTS = 'assuranceAlerts';
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Applies an escalation suggestion as a new Assurance alert, always Open. The agent can
 * raise something into the assurance hub for a human to act on, but it cannot set the
 * alert to Resolved/Dismissed or generate+adopt actions itself — those stay human steps.
 */
export const escalationAdapter: OutputAdapter = {
  targetCollection: ASSURANCE_ALERTS,
  sanitize(payload, s) {
    const p = stripForbiddenFields(payload);
    return {
      title: str(p.title ?? s.title, 300),
      description: str(p.description ?? s.rationale, 8000),
      severity: SEVERITIES.includes(String(p.severity)) ? p.severity : 'Medium',
      failureReason: ['alert_not_acted', 'control_failed', 'incident_occurred', 'other'].includes(String(p.failureReason))
        ? p.failureReason
        : 'other',
    };
  },
  prohibited(payload) {
    const status = String((payload as any).status || '');
    if (status && status !== 'Open') {
      return 'An AI suggestion can raise an escalation but cannot resolve or dismiss one.';
    }
    return null;
  },
  async apply(ctx, s: AgentSuggestionDoc, payload): Promise<ApplyResult> {
    const { db, primaryUid } = ctx;

    const prior = await db.collection(ASSURANCE_ALERTS).where('aiSuggestionId', '==', s.id).limit(1).get();
    if (!prior.empty && prior.docs[0].data()?.clientId === primaryUid) {
      return { collection: ASSURANCE_ALERTS, recordId: prior.docs[0].id };
    }

    const id = db.collection(ASSURANCE_ALERTS).doc().id;
    const scoped = s.contextKind === 'programme'
      ? { programmeId: s.contextId, projectId: null }
      : { projectId: s.contextId, programmeId: null };
    await db.collection(ASSURANCE_ALERTS).doc(id).set({
      ...payload,
      id,
      clientId: primaryUid,
      ...scoped,
      source: 'direct',
      status: 'Open',
      generationStatus: 'pending',
      generatedActions: [],
      aiSuggestionId: s.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { collection: ASSURANCE_ALERTS, recordId: id };
  },
};

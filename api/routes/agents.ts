import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { getAgent } from '../lib/agents/registry.js';
import type { AgentScope } from '../lib/agents/registry.js';
import {
  AGENT_RUNS,
  AGENT_SUGGESTIONS,
  runAgentPipeline,
} from '../lib/agents/pipeline.js';
import { getAdapter } from '../lib/agents/adapters/index.js';
import {
  canReviewAgentSuggestions,
  canTransition,
  isApprovable,
  type AgentRunDoc,
  type AgentSuggestionDoc,
  type ContextKind,
  type ReviewStatus,
} from '../../shared/types/agents.js';
import { logActivity } from '../lib/activityLog.js';
import { isTacElevated } from './technicalAssurance.js';

/** Bounds an unindexed tenant read. Far above any realistic review-queue depth. */
const LIST_LIMIT = 500;

/**
 * Mirrors the chat path's user-side injection screen. The agent question is the only
 * user-authored free text an agent ever sees; fencing is the second layer, this is
 * the first.
 */
const INJECTION_RE =
  /<\|im_start\|>|<\|im_end\|>|<\/?(system|assistant|user)\s*>|^(system|assistant)\s*:\s*|ignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|messages|prompts)/im;

/**
 * A `technicalAnswer` is drafted from TAC enquiry content, whose visibility is
 * owner-scoped (canViewEnquiry). Suggestions inherit that, or the queue would leak
 * enquiry content to tenant users who cannot open the enquiry itself. Everything
 * else mirrors a register that is already tenant-visible.
 */
function canViewSuggestion(ctx: ApiContext, s: AgentSuggestionDoc): boolean {
  if (s.outputType !== 'technicalAnswer') return true;
  return s.requestedByUid === ctx.uid || isTacElevated(ctx);
}

async function resolveScope(
  ctx: ApiContext,
  body: any,
): Promise<{ scope: AgentScope } | { error: string; status: number }> {
  const kind = String(body?.contextKind || '') as ContextKind;
  const contextId = body?.contextId ? String(body.contextId) : null;

  if (kind === 'portfolio') {
    return { scope: { kind, contextId: null } };
  }
  if (kind !== 'project' && kind !== 'programme') {
    return { status: 400, error: 'contextKind must be project, programme or portfolio.' };
  }
  if (!contextId) {
    return { status: 400, error: `contextId is required for ${kind} scope.` };
  }
  // The agent inherits the caller's permissions — it can never read a context the
  // requesting user could not open themselves.
  if (!(await ctx.isAuthorizedForContext(contextId))) {
    return { status: 403, error: 'Forbidden: you do not have access to this context.' };
  }
  return { scope: { kind, contextId } };
}

export const agentRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  /**
   * Run one agent against a scope and persist its DRAFT suggestions. Never writes to a
   * live record — that is only reachable via agentApplySuggestion after a PM+ approval.
   */
  agentRun: async (req, res, ctx) => {
    const { agentKey, question } = req.body || {};
    const def = getAgent(String(agentKey || ''));
    if (!def) {
      return res.status(400).json({ error: 'Unknown agent.' });
    }

    const resolved = await resolveScope(ctx, req.body);
    if ('error' in resolved) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { scope } = resolved;

    if (!def.scopeKinds.includes(scope.kind)) {
      return res
        .status(400)
        .json({ error: `${def.label} cannot run at ${scope.kind} scope.` });
    }

    const q = question ? String(question).trim() : '';
    if (def.needsInput && !q) {
      return res.status(400).json({ error: `${def.label} needs a question.` });
    }
    if (q && INJECTION_RE.test(q)) {
      await ctx.db.collection('chatToolCallLog').add({
        uid: ctx.uid,
        primaryUid: ctx.primaryUid,
        tool: '_agent-injection-screen',
        kind: 'injection-attempt',
        sample: q.slice(0, 200),
        ts: FieldValue.serverTimestamp(),
      }).catch(() => undefined);
      return res
        .status(400)
        .json({ error: 'Your question contains unusual formatting. Please rephrase.' });
    }

    try {
      const { runId, suggestions } = await runAgentPipeline(ctx, def, scope, { question: q || undefined });
      return res.status(200).json({ success: true, runId, suggestions });
    } catch (e: any) {
      console.error(`agentRun(${def.key}) failed`, e?.message || e);
      return res
        .status(502)
        .json({ error: 'The agent could not complete this run. Please try again.' });
    }
  },

  /** The review queue. Equality-only tenant read + in-memory filter/sort — no composite index. */
  agentListSuggestions: async (req, res, ctx) => {
    const snap = await ctx.db
      .collection(AGENT_SUGGESTIONS)
      .where('clientId', '==', ctx.primaryUid)
      .limit(LIST_LIMIT)
      .get();

    const items = snap.docs
      .map((d) => d.data() as AgentSuggestionDoc)
      .filter((s) => canViewSuggestion(ctx, s))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return res.status(200).json({ success: true, items });
  },

  /** Run history — the prompt-context audit trail (who ran what, over which records). */
  agentListRuns: async (req, res, ctx) => {
    const snap = await ctx.db
      .collection(AGENT_RUNS)
      .where('clientId', '==', ctx.primaryUid)
      .limit(LIST_LIMIT)
      .get();

    const items = snap.docs
      .map((d) => d.data() as AgentRunDoc)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return res.status(200).json({ success: true, items });
  },

  /**
   * Accept / edit / reject a suggestion. PM+ only. Never writes to a live record — it
   * only moves the suggestion through its review lifecycle and records the reviewer.
   * Editing keeps the original payload untouched and stores the reviewer's version
   * plus a field-level diff, so the audit trail shows both.
   */
  agentReviewSuggestion: async (req, res, ctx) => {
    if (!canReviewAgentSuggestions(ctx.userData?.role)) {
      return res.status(403).json({ error: 'Forbidden: only a Project Manager or above can review AI suggestions.' });
    }
    const { suggestionId, decision, editedPayload, reason } = req.body || {};
    const target = String(decision || '') as ReviewStatus;
    if (!['accepted', 'edited', 'rejected'].includes(target)) {
      return res.status(400).json({ error: 'decision must be accepted, edited or rejected.' });
    }
    if (target === 'rejected' && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A rejection reason is required.' });
    }

    const ref = ctx.db.collection(AGENT_SUGGESTIONS).doc(String(suggestionId || ''));
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as AgentSuggestionDoc).clientId !== ctx.primaryUid) {
      return res.status(404).json({ error: 'Suggestion not found for this tenant.' });
    }
    const s = snap.data() as AgentSuggestionDoc;
    if (!canViewSuggestion(ctx, s)) {
      return res.status(403).json({ error: 'Forbidden: you cannot review this suggestion.' });
    }
    if (!canTransition(s.reviewStatus, target)) {
      return res.status(409).json({ error: `Cannot move a ${s.reviewStatus} suggestion to ${target}.` });
    }

    const now = new Date().toISOString();
    const reviewer: AgentSuggestionDoc['reviewer'] = {
      uid: ctx.uid,
      name: String(ctx.userData?.displayName || ctx.userData?.name || ctx.email || '').slice(0, 120),
      decidedAt: now,
    };
    const update: Record<string, unknown> = { reviewStatus: target, reviewer, updatedAt: now };

    if (target === 'rejected') {
      reviewer.reason = String(reason).slice(0, 2000);
    }
    if (target === 'edited') {
      const edited = editedPayload && typeof editedPayload === 'object' && !Array.isArray(editedPayload)
        ? (editedPayload as Record<string, unknown>)
        : {};
      reviewer.editDiff = diffPayload(s.payload, edited);
      update.editedPayload = edited;
    }
    update.reviewer = reviewer;

    await ref.update(update);
    await logActivity(ctx, `agent_suggestion_${target}`, {
      category: target === 'rejected' ? 'update' : 'approve',
      entityType: 'agentSuggestion',
      entityId: s.id,
      entityName: s.title,
      details: { agentKey: s.agentKey, outputType: s.outputType, ...(reviewer.reason ? { reason: reviewer.reason } : {}) },
    });
    return res.status(200).json({ success: true, suggestion: { ...s, ...update } });
  },

  /**
   * Apply an approved suggestion to a live record. PM+ only. This is the ONLY action
   * in the whole layer that writes to a module record, and it re-verifies everything
   * at apply time: tenant, review status, context authorization, output-type adapter,
   * field sanitize and the prohibited-action veto. The suggestion is flipped to
   * `applied` inside a transaction that re-reads its status, so a double-submit or a
   * retry can never apply twice.
   */
  agentApplySuggestion: async (req, res, ctx) => {
    if (!canReviewAgentSuggestions(ctx.userData?.role)) {
      return res.status(403).json({ error: 'Forbidden: only a Project Manager or above can apply AI suggestions.' });
    }
    const ref = ctx.db.collection(AGENT_SUGGESTIONS).doc(String(req.body?.suggestionId || ''));
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as AgentSuggestionDoc).clientId !== ctx.primaryUid) {
      return res.status(404).json({ error: 'Suggestion not found for this tenant.' });
    }
    const s = snap.data() as AgentSuggestionDoc;
    if (!canViewSuggestion(ctx, s)) {
      return res.status(403).json({ error: 'Forbidden: you cannot apply this suggestion.' });
    }
    if (!isApprovable(s.reviewStatus)) {
      return res.status(409).json({ error: `Only an accepted or edited suggestion can be applied (this one is ${s.reviewStatus}).` });
    }
    if (s.contextId && !(await ctx.isAuthorizedForContext(s.contextId))) {
      return res.status(403).json({ error: 'Forbidden: you no longer have access to this suggestion\'s context.' });
    }

    const adapter = getAdapter(s.outputType);
    if (!adapter) {
      return res.status(400).json({ error: `Suggestions of type ${s.outputType} cannot be applied to a record.` });
    }

    // Effective payload = the reviewer's edit if they made one, else the model's draft.
    const effective = s.editedPayload && Object.keys(s.editedPayload).length ? s.editedPayload : s.payload;
    const sanitized = adapter.sanitize(effective, s);
    const veto = adapter.prohibited(sanitized, s);
    if (veto) {
      return res.status(422).json({ error: veto });
    }

    let applied: { collection: string; recordId: string };
    try {
      applied = await adapter.apply(ctx, s, sanitized);
    } catch (e: any) {
      console.error(`agentApplySuggestion(${s.outputType}) failed`, e?.message || e);
      return res.status(500).json({ error: 'The record could not be created. Please try again.' });
    }

    // Flip to applied only if still approvable — guards against a concurrent second apply.
    const flipped = await ctx.db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      const cur = fresh.data() as AgentSuggestionDoc | undefined;
      if (!cur || !isApprovable(cur.reviewStatus)) return false;
      tx.update(ref, {
        reviewStatus: 'applied',
        applied: { collection: applied.collection, recordId: applied.recordId, at: new Date().toISOString(), byUid: ctx.uid },
        updatedAt: new Date().toISOString(),
      });
      return true;
    });

    await logActivity(ctx, 'agent_suggestion_applied', {
      category: 'create',
      entityType: 'agentSuggestion',
      entityId: s.id,
      entityName: s.title,
      details: { agentKey: s.agentKey, outputType: s.outputType, target: applied.collection, recordId: applied.recordId },
    });
    return res.status(200).json({ success: true, applied, alreadyApplied: !flipped });
  },
};

/** Shallow field-level diff between the model's payload and the reviewer's edit (for audit). */
function diffPayload(original: Record<string, unknown>, edited: Record<string, unknown>) {
  const keys = new Set([...Object.keys(original || {}), ...Object.keys(edited || {})]);
  const diff: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    const from = (original as any)?.[k];
    const to = (edited as any)?.[k];
    if (JSON.stringify(from) !== JSON.stringify(to)) diff.push({ field: k, from, to });
  }
  return diff.slice(0, 100);
}

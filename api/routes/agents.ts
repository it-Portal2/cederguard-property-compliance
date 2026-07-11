import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { getAgent } from '../lib/agents/registry.js';
import type { AgentScope } from '../lib/agents/registry.js';
import {
  AGENT_RUNS,
  AGENT_SUGGESTIONS,
  runAgentPipeline,
} from '../lib/agents/pipeline.js';
import type { AgentRunDoc, AgentSuggestionDoc, ContextKind } from '../../shared/types/agents.js';
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
};

import crypto from 'crypto';
import type { ApiContext } from '../../context.js';
import type { AgentSuggestionDoc } from '../../../../shared/types/agents.js';
import { writeLegacyArray } from '../../legacyArrayWrite.js';
import type { ApplyResult, OutputAdapter } from './base.js';
import { clampInt, requireContext, str, stripForbiddenFields, userError } from './base.js';

const newId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Read the current whole-array doc, append the server-built item, and write it back
 * through writeLegacyArray so history, activity diffs and severe-risk escalation all
 * fire exactly as they do for a human save.
 *
 * Idempotent: if an item already carries this suggestion's `aiSuggestionId`, the apply
 * previously succeeded (the status flip may have failed on a prior attempt) — return
 * the existing record instead of writing a duplicate.
 */
async function appendToLegacyArray(
  ctx: ApiContext,
  collection: string,
  contextId: string,
  item: Record<string, unknown>,
  suggestionId: string,
): Promise<ApplyResult> {
  const ref = ctx.db.collection('projects').doc(contextId).collection('data').doc(collection);
  const snap = await ref.get();
  const current: any[] = snap.exists && Array.isArray((snap.data() as any)?.data)
    ? (snap.data() as any).data
    : [];

  const existing = current.find((x) => x?.aiSuggestionId === suggestionId);
  if (existing) {
    return { collection, recordId: String(existing.id) };
  }

  const next = [item, ...current];
  await writeLegacyArray(ctx, { collection, data: next, projectId: contextId });
  return { collection, recordId: String(item.id) };
}

/** Provenance every agent-applied record carries, so an applied suggestion is traceable and dedupable. */
function provenance(s: AgentSuggestionDoc) {
  return { origin: 'ai-suggestion' as const, aiSuggestionId: s.id, dateAdded: today() };
}

function contextFields(s: AgentSuggestionDoc) {
  return s.contextKind === 'programme'
    ? { programmeId: s.contextId, isProgrammeLevel: true }
    : { projectId: s.contextId };
}

export const riskAdapter: OutputAdapter = {
  targetCollection: 'risks',
  sanitize(payload) {
    const p = stripForbiddenFields(payload);
    return {
      title: str(p.title, 300),
      desc: str(p.desc ?? p.description, 4000),
      cause: str(p.cause, 2000),
      category: str(p.category, 120),
      grossL: clampInt(p.grossL, 1, 5, 3),
      grossI: clampInt(p.grossI, 1, 5, 3),
      residualL: clampInt(p.residualL, 1, 5, 3),
      residualI: clampInt(p.residualI, 1, 5, 3),
      owner: str(p.owner, 200),
      response: str(p.response, 300),
    };
  },
  prohibited() {
    // Risks are CREATE-only for the agent — there is no path to downgrade an existing
    // risk's score, so no veto is needed beyond the create-only shape itself.
    return null;
  },
  async apply(ctx, s, payload) {
    if (requireContext(s)) throw userError(requireContext(s)!);
    const item = {
      id: newId('R'),
      ...payload,
      ...contextFields(s),
      // A newly-identified risk is always Open — never a resolved/closed state.
      status: 'Open',
      escalated: false,
      dueDate: '',
      ...provenance(s),
    };
    return appendToLegacyArray(ctx, 'risks', s.contextId!, item, s.id);
  },
};

export const complianceItemAdapter: OutputAdapter = {
  targetCollection: 'complianceItems',
  sanitize(payload) {
    const p = stripForbiddenFields(payload);
    return {
      name: str(p.name ?? p.title, 300),
      description: str(p.description ?? p.desc, 4000),
      category: str(p.category, 120),
      domain: str(p.domain, 120),
      owner: str(p.owner, 200),
      evidenceRequired: p.evidenceRequired === true,
    };
  },
  prohibited(payload) {
    // A compliance item can never be created already "done": Live/Archived means
    // completed, and the reviewed/approved sign-off is a separate human act.
    const stage = String((payload as any).stage || '');
    if (stage === 'Live' || stage === 'Archived') {
      return 'An AI suggestion cannot mark a compliance item complete.';
    }
    return null;
  },
  async apply(ctx, s, payload) {
    if (requireContext(s)) throw userError(requireContext(s)!);
    const item = {
      id: newId('C'),
      ...payload,
      ...contextFields(s),
      // Newly-identified obligation: not started. Never a completed/verified stage.
      stage: 'Information Gap',
      status: 'Open',
      ...provenance(s),
    };
    return appendToLegacyArray(ctx, 'complianceItems', s.contextId!, item, s.id);
  },
};

/** Shared builder for the two task-shaped outputs (CAPA action, evidence-gap action). */
function taskItem(
  s: AgentSuggestionDoc,
  payload: Record<string, unknown>,
  capaType: 'Corrective' | 'Preventive' | 'Improvement' | 'Detective',
  extra: Record<string, unknown> = {},
) {
  const p = stripForbiddenFields(payload);
  return {
    id: newId('T'),
    title: str(p.title, 300),
    description: str(p.description ?? p.desc ?? s.rationale, 4000),
    status: 'Pending' as const,
    priority: ['Low', 'Medium', 'High', 'Critical'].includes(String(p.priority)) ? p.priority : 'Medium',
    dueDate: str(p.dueDate, 30),
    owner: str(p.owner, 200),
    ...contextFields(s),
    ...(s.contextKind === 'programme' ? {} : { projectName: str(p.projectName, 300) }),
    // CAPA flag — the action enters the assurance register and gains PM+ sign-off,
    // which begins Pending. The agent can never pre-approve it.
    capaType,
    capaStatus: 'Pending' as const,
    ...extra,
    origin: 'ai-suggestion',
    aiSuggestionId: s.id,
  };
}

export const capaTaskAdapter: OutputAdapter = {
  targetCollection: 'tasks',
  sanitize(payload) {
    return stripForbiddenFields(payload);
  },
  prohibited() {
    return null;
  },
  async apply(ctx, s, payload) {
    if (requireContext(s)) throw userError(requireContext(s)!);
    const proposed = String((payload as any).capaType || '');
    const capaType = (['Corrective', 'Preventive', 'Improvement', 'Detective'].includes(proposed)
      ? proposed
      : 'Corrective') as 'Corrective' | 'Preventive' | 'Improvement' | 'Detective';
    const item = taskItem(s, payload, capaType);
    return appendToLegacyArray(ctx, 'tasks', s.contextId!, item, s.id);
  },
};

export const evidenceGapAdapter: OutputAdapter = {
  targetCollection: 'tasks',
  sanitize(payload) {
    return stripForbiddenFields(payload);
  },
  prohibited() {
    return null;
  },
  async apply(ctx, s, payload) {
    if (requireContext(s)) throw userError(requireContext(s)!);
    // An evidence gap is actioned as a corrective, evidence-required CAPA task —
    // "go and obtain the missing evidence" — rather than a new record type.
    const item = taskItem(s, payload, 'Corrective', { capaEvidenceRequired: true });
    return appendToLegacyArray(ctx, 'tasks', s.contextId!, item, s.id);
  },
};

export const lessonLearnedAdapter: OutputAdapter = {
  targetCollection: 'lessonsLearned',
  sanitize(payload) {
    const p = stripForbiddenFields(payload);
    return {
      title: str(p.title, 300),
      category: str(p.category, 120),
      problem: str(p.problem ?? p.desc ?? p.description, 4000),
      resolution: str(p.resolution, 4000),
      prevention: str(p.prevention, 4000),
    };
  },
  prohibited() {
    return null;
  },
  async apply(ctx, s, payload) {
    if (requireContext(s)) throw userError(requireContext(s)!);
    const item = {
      id: newId('L'),
      ...payload,
      ...contextFields(s),
      ...provenance(s),
    };
    return appendToLegacyArray(ctx, 'lessonsLearned', s.contextId!, item, s.id);
  },
};

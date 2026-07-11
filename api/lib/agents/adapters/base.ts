import type { ApiContext } from '../../context.js';
import type { AgentSuggestionDoc } from '../../../../shared/types/agents.js';

export interface ApplyResult {
  collection: string;
  recordId: string;
}

export interface OutputAdapter {
  /** Where the approved record lands — recorded on the suggestion's audit trail. */
  targetCollection: string;
  /** Whitelist the draft down to fields this record type accepts. Unknown fields are dropped. */
  sanitize(payload: Record<string, unknown>, s: AgentSuggestionDoc): Record<string, unknown>;
  /**
   * Hard veto. Returns a reason to refuse the apply, or null to allow. Re-run at apply
   * time, never trusted from review time.
   */
  prohibited(payload: Record<string, unknown>, s: AgentSuggestionDoc): string | null;
  apply(ctx: ApiContext, s: AgentSuggestionDoc, payload: Record<string, unknown>): Promise<ApplyResult>;
}

/**
 * Fields no agent-applied record may ever carry, whatever the model proposed or a
 * reviewer edited in. These are the states the brief reserves for a human acting
 * deliberately in the module itself — an AI-originated write can never assert that
 * something was reviewed, approved, verified or closed.
 */
const FORBIDDEN_FIELDS = [
  'reviewedBy',
  'reviewedAt',
  'approvedBy',
  'approvedAt',
  'capaApprovedBy',
  'capaApprovedAt',
  'closedAt',
  'completedAt',
  'signedOffBy',
  'verifiedBy',
];

export function stripForbiddenFields(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!FORBIDDEN_FIELDS.includes(k)) out[k] = v;
  }
  return out;
}

/** An array-backed record needs a project/programme to live in; portfolio scope has none. */
export function requireContext(s: AgentSuggestionDoc): string | null {
  if (!s.contextId) {
    return 'This suggestion has no project or programme to apply to. Re-run the agent with a project selected.';
  }
  return null;
}

export const str = (v: unknown, max: number): string => (v ? String(v).slice(0, max) : '');

export const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

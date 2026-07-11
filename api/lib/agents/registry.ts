import type { ApiContext } from '../context.js';
import type { OperationModelEntry } from '../aiModelConfig.js';
import type {
  AgentKey,
  ContextKind,
  OutputType,
  RecordCitation,
  RequestType,
} from '../../../shared/types/agents.js';

export interface AgentScope {
  kind: ContextKind;
  /** null only when kind === 'portfolio'. */
  contextId: string | null;
}

export interface AgentInput {
  /** Free-text question — Technical Companion only. Screened and fenced before use. */
  question?: string;
}

export interface RetrievalBundle {
  /** Fenced, injection-safe record blocks, already joined. */
  fenced: string;
  /** Every id the model may legally cite, keyed by nothing — a flat set across collections. */
  validIds: Set<string>;
  /** id → the real record it refers to, for resolving claimed sources into citations. */
  citations: Map<string, RecordCitation>;
  /** What grounded the prompt, per collection — persisted on the run doc for audit. */
  retrieved: { collection: string; ids: string[] }[];
  recordCounts: Record<string, number>;
  truncated: boolean;
}

export interface PromptSpec {
  prompt: string;
  responseSchema: Record<string, unknown>;
  /** Route through the web-grounded two-call path (Technical Companion). */
  webGather?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AgentDef {
  key: AgentKey;
  label: string;
  requestType: RequestType;
  scopeKinds: ContextKind[];
  /** An output type absent here is dropped by the pipeline even if the model emits it. */
  allowedOutputTypes: OutputType[];
  /** Technical Companion takes a user question; the rest run from context alone. */
  needsInput?: boolean;
  /**
   * Per-agent model pinning, passed straight to runAIOperation's
   * operationModelsOverride. Left undefined, the agent inherits the admin-curated
   * cascade (admin models → free auto-router → Gemini safety net), which is the
   * default for every agent — this exists so a demanding agent (Technical
   * Companion, Monitoring) can be pinned to a stronger model without code change
   * elsewhere.
   */
  modelOverride?: OperationModelEntry[];
  /**
   * Deterministic, code-directed retrieval. MUST use the same authorization the
   * human routes use (clientId equality, isAuthorizedForContext, canViewEnquiry),
   * so the agent can only ever see what the requesting user can see.
   */
  retrieve(ctx: ApiContext, scope: AgentScope, input: AgentInput): Promise<RetrievalBundle>;
  buildPrompt(bundle: RetrievalBundle, scope: AgentScope, input: AgentInput): PromptSpec;
}

/**
 * The agent registry. Agents are added here as they land (AG8–AG15); an agentKey
 * absent from this map is rejected with a 400 before any model call.
 */
export const AGENTS: Partial<Record<AgentKey, AgentDef>> = {};

export function getAgent(key: string): AgentDef | undefined {
  return AGENTS[key as AgentKey];
}

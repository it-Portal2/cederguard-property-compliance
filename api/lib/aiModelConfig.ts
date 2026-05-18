// Admin-controlled AI model configuration.
//
// Single Firestore doc at `adminConfig/aiModelConfig` holds two lists:
//   * chatModels      → drives the /chat dropdown + chatStream's allow-list
//   * operationModels → drives the cascading router used by legacy AI ops
//
// The schema is intentionally narrow: admin entries always go through
// OpenRouter (single SDK code-path). The hardcoded safety-net Gemini
// direct lives only in aiOperationRouter.ts and chatStream.ts and is
// never represented as a saved entry — the validator rejects anything
// but `backend: "openrouter"` on save.

import type { ApiContext } from "./context.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type ChatBackendId = "google-direct" | "openrouter";
export type ChatGroupId = "premium" | "default" | "free";

export interface AIModelEntryMeta {
  contextLength: number;
  promptCostUsdPer1M: number;
  completionCostUsdPer1M: number;
  isFree: boolean;
}

export interface ChatModelEntry {
  id: string;
  label: string;
  group: ChatGroupId;
  backend: ChatBackendId;
  modelString: string;
  enabled: boolean;
  isDefault: boolean;
  meta?: AIModelEntryMeta;
}

export interface OperationModelEntry {
  id: string;
  label: string;
  backend: ChatBackendId;
  modelString: string;
  enabled: boolean;
  meta?: AIModelEntryMeta;
}

export interface AIModelConfig {
  chatModels: ChatModelEntry[];
  operationModels: OperationModelEntry[];
  updatedAt?: unknown; // FirebaseFirestore.Timestamp at runtime
  updatedBy?: string;        // super-admin uid (immutable identifier)
  updatedByEmail?: string;   // super-admin email (human label for the UI)
}

// ── Limits + patterns ──────────────────────────────────────────────────────

export const MAX_ENTRIES_PER_LIST = 20;
export const MAX_LABEL_LENGTH = 80;
export const MAX_MODEL_STRING_LENGTH = 200;
// provider/model pattern — OpenRouter ids look like `openai/gpt-oss-20b:free`
// or `anthropic/claude-opus-4.7`. Matches a single slash separator.
export const MODEL_STRING_PATTERN = /^[a-z0-9-]+\/[a-z0-9.\-_:]+$/;

export const CONFIG_DOC_PATH = "adminConfig/aiModelConfig";

// ── Default seed ───────────────────────────────────────────────────────────
//
// Returned in-memory by loadAIModelConfig when the Firestore doc is missing.
// Never auto-written. Day-1 lineup gives a brand-new tenant a full chat
// picker and a sensible operation-router priority order — admin curates
// from this baseline via the AI Models tab.
//
// CHAT seed: 4 free + 2 paid placeholders (the paid rows are seeded but
// `enabled: false` until the operator loads paid OpenRouter credit and
// flips them on from the admin tab). Default = DeepSeek (most reliable
// free tier today).
//
// OPERATION seed: priority order = paid premium first, free in the middle,
// auto-router last. The hardcoded Step-3 safety-net (Gemini direct using
// the env GEMINI_API_KEY + userData.geminiBackupKey rotation) lives in
// aiOperationRouter.ts and runs unconditionally after this list — it is
// intentionally NOT a seed entry because the user shouldn't be able to
// disable the last line of defence.
//
// Once a config doc exists in Firestore, this seed is irrelevant — the
// admin's saved list is the source of truth.
export const SEED_CONFIG: AIModelConfig = {
  chatModels: [
    {
      id: "premium-openai-gpt-4o-mini",
      label: "GPT-4o-mini",
      group: "premium",
      backend: "openrouter",
      modelString: "openai/gpt-4o-mini",
      enabled: false, // paid — flip on after loading OpenRouter credit
      isDefault: false,
    },
    {
      id: "premium-gemini-2-5-flash",
      label: "Gemini 2.5 Flash",
      group: "premium",
      backend: "openrouter",
      modelString: "google/gemini-2.5-flash",
      enabled: false, // paid — flip on after loading OpenRouter credit
      isDefault: false,
    },
    {
      id: "free-deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      group: "free",
      backend: "openrouter",
      modelString: "deepseek/deepseek-v4-flash:free",
      enabled: true,
      isDefault: true, // single enabled+default row — satisfies validator
    },
    {
      id: "free-minimax-m2",
      label: "MiniMax M2",
      group: "free",
      backend: "openrouter",
      modelString: "minimax/minimax-m2:free",
      enabled: true,
      isDefault: false,
    },
    {
      id: "free-openai-gpt-oss-20b",
      label: "OpenAI GPT-OSS 20B",
      group: "free",
      backend: "openrouter",
      modelString: "openai/gpt-oss-20b:free",
      enabled: true,
      isDefault: false,
    },
    {
      id: "free-openai-gpt-oss-120b",
      label: "OpenAI GPT-OSS 120B",
      group: "free",
      backend: "openrouter",
      modelString: "openai/gpt-oss-120b:free",
      enabled: true,
      isDefault: false,
    },
  ],
  operationModels: [
    // Priority order — the router tries each enabled entry top-to-bottom.
    // After this list is exhausted, the hardcoded safety-net in
    // aiOperationRouter.ts runs: free auto-router → Gemini direct.
    {
      id: "op-openai-gpt-4o-mini",
      label: "GPT-4o-mini",
      backend: "openrouter",
      modelString: "openai/gpt-4o-mini",
      enabled: false, // paid — flip on after loading OpenRouter credit
    },
    {
      id: "op-gemini-2-5-flash",
      label: "Gemini 2.5 Flash",
      backend: "openrouter",
      modelString: "google/gemini-2.5-flash",
      enabled: false, // paid — flip on after loading OpenRouter credit
    },
    {
      id: "op-minimax-m2",
      label: "MiniMax M2",
      backend: "openrouter",
      modelString: "minimax/minimax-m2:free",
      enabled: true,
    },
    {
      id: "op-deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      backend: "openrouter",
      modelString: "deepseek/deepseek-v4-flash:free",
      enabled: true,
    },
    {
      id: "op-auto-router",
      label: "Auto-router (free)",
      backend: "openrouter",
      modelString: "openrouter/owl-alpha",
      enabled: true,
    },
  ],
};

// ── Validator ──────────────────────────────────────────────────────────────

// Flat result shape (errors always present, empty when valid) avoids
// discriminated-union narrowing requirements which need tsconfig strict
// mode — kept simple so callers can `if (!result.valid) result.errors`
// without type gymnastics.
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAIModelConfig(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["payload must be an object"] };
  }
  const cfg = payload as Record<string, unknown>;

  // chatModels
  if (!Array.isArray(cfg.chatModels)) {
    errors.push("chatModels must be an array");
  } else {
    if (cfg.chatModels.length > MAX_ENTRIES_PER_LIST) {
      errors.push(`chatModels must have at most ${MAX_ENTRIES_PER_LIST} entries`);
    }
    const seenIds = new Set<string>();
    let defaultCount = 0;
    for (let i = 0; i < cfg.chatModels.length; i++) {
      const entry = cfg.chatModels[i] as any;
      const prefix = `chatModels[${i}]`;
      errors.push(...validateChatEntry(entry, prefix));
      if (entry && typeof entry.id === "string" && entry.id) {
        if (seenIds.has(entry.id)) errors.push(`${prefix}.id duplicate (${entry.id})`);
        seenIds.add(entry.id);
      }
      if (entry && entry.isDefault === true && entry.enabled === true) defaultCount++;
    }
    if (defaultCount !== 1) {
      errors.push(
        `exactly one chatModels entry must be enabled + isDefault; found ${defaultCount}`,
      );
    }
  }

  // operationModels
  if (!Array.isArray(cfg.operationModels)) {
    errors.push("operationModels must be an array");
  } else {
    if (cfg.operationModels.length > MAX_ENTRIES_PER_LIST) {
      errors.push(
        `operationModels must have at most ${MAX_ENTRIES_PER_LIST} entries`,
      );
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < cfg.operationModels.length; i++) {
      const entry = cfg.operationModels[i] as any;
      const prefix = `operationModels[${i}]`;
      errors.push(...validateOperationEntry(entry, prefix));
      if (entry && typeof entry.id === "string" && entry.id) {
        if (seenIds.has(entry.id)) errors.push(`${prefix}.id duplicate (${entry.id})`);
        seenIds.add(entry.id);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateCommonEntry(entry: any, prefix: string): string[] {
  const errors: string[] = [];
  if (!entry || typeof entry !== "object") {
    errors.push(`${prefix} must be an object`);
    return errors;
  }
  if (typeof entry.id !== "string" || !entry.id.trim()) {
    errors.push(`${prefix}.id required`);
  }
  if (typeof entry.label !== "string" || !entry.label.trim()) {
    errors.push(`${prefix}.label required`);
  } else if (entry.label.length > MAX_LABEL_LENGTH) {
    errors.push(`${prefix}.label exceeds ${MAX_LABEL_LENGTH} chars`);
  }
  if (typeof entry.modelString !== "string" || !entry.modelString.trim()) {
    errors.push(`${prefix}.modelString required`);
  } else {
    if (entry.modelString.length > MAX_MODEL_STRING_LENGTH) {
      errors.push(`${prefix}.modelString exceeds ${MAX_MODEL_STRING_LENGTH} chars`);
    }
    // The provider/model pattern is enforced only for OpenRouter entries
    // — google-direct entries carry a free-text label here since the
    // backend dispatcher uses the backend field, not modelString, to
    // route. Lets the seed's "gemini-2.5-flash" pass without artificial
    // contortions like "google-direct/gemini-2.5-flash".
    if (entry.backend === "openrouter" && !MODEL_STRING_PATTERN.test(entry.modelString)) {
      errors.push(
        `${prefix}.modelString must match provider/model pattern for openrouter backend`,
      );
    }
  }
  if (entry.backend !== "openrouter" && entry.backend !== "google-direct") {
    errors.push(
      `${prefix}.backend must be "openrouter" or "google-direct"`,
    );
  }
  if (typeof entry.enabled !== "boolean") {
    errors.push(`${prefix}.enabled must be boolean`);
  }
  if (entry.meta !== undefined) {
    const m = entry.meta;
    if (!m || typeof m !== "object") {
      errors.push(`${prefix}.meta must be an object when present`);
    } else {
      for (const key of ["contextLength", "promptCostUsdPer1M", "completionCostUsdPer1M"]) {
        const v = (m as any)[key];
        if (typeof v !== "number" || v < 0 || !Number.isFinite(v)) {
          errors.push(`${prefix}.meta.${key} must be a non-negative finite number`);
        }
      }
      if (typeof (m as any).isFree !== "boolean") {
        errors.push(`${prefix}.meta.isFree must be boolean`);
      }
    }
  }
  return errors;
}

function validateChatEntry(entry: any, prefix: string): string[] {
  const errors = validateCommonEntry(entry, prefix);
  if (entry && typeof entry === "object") {
    if (!["premium", "default", "free"].includes(entry.group)) {
      errors.push(`${prefix}.group must be premium|default|free`);
    }
    if (typeof entry.isDefault !== "boolean") {
      errors.push(`${prefix}.isDefault must be boolean`);
    }
  }
  return errors;
}

function validateOperationEntry(entry: any, prefix: string): string[] {
  return validateCommonEntry(entry, prefix);
}

// ── Loader + cache-buster ──────────────────────────────────────────────────

// Module-level cache-buster bumped by adminUpdateAIModelConfig so any
// in-process getActiveChatModels cache notices a fresh write on its next
// read. Exposed as a value (not a setter+getter pair) for test simplicity.
let _cacheBuster = 0;
export function bumpAIModelConfigCacheBuster(): void {
  _cacheBuster = Date.now();
}
export function getAIModelConfigCacheBuster(): number {
  return _cacheBuster;
}

export async function loadAIModelConfig(ctx: ApiContext): Promise<AIModelConfig> {
  const snap = await ctx.db.doc(CONFIG_DOC_PATH).get();
  if (!snap.exists) return SEED_CONFIG;
  const data = snap.data() as AIModelConfig | undefined;
  // Belt-and-braces: a doc that exists but has the wrong shape should not
  // crash the app. Treat as missing and return the seed.
  if (
    !data ||
    !Array.isArray(data.chatModels) ||
    !Array.isArray(data.operationModels)
  ) {
    return SEED_CONFIG;
  }
  return data;
}

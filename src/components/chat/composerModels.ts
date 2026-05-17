// Single source of truth for the chat model picker.
// Imported by both the client (composer dropdown) and the server (chatStream
// dispatcher) so we never accept raw model strings from a request body.

export type ChatModelId =
  // Premium — paid via OpenRouter, disabled until credit is loaded
  | "openai-gpt-4o-mini"
  | "gemini-2.5-flash-openrouter"
  // Default — direct Gemini SDK against existing GEMINI_API_KEY
  | "gemini-existing"
  // Free OpenRouter models — work today
  | "free-deepseek-v4-flash"
  | "free-openai-gpt-oss-20b"
  | "free-openai-gpt-oss-120b"
  | "free-minimax-m2"
  | "free-nemotron-3-super-120b"
  | "free-auto";

export type ChatModelBackend = "google-direct" | "openrouter" | "disabled";
export type ChatModelGroup = "premium" | "default" | "free";

export interface ChatModelOption {
  id: ChatModelId;
  group: ChatModelGroup;
  label: string;
  tagline: string;
  backend: ChatModelBackend;
  /** Set only when backend === "openrouter". */
  openRouterId?: string;
  /** Coming-soon rows render greyed and can't be selected. */
  disabled?: boolean;
  disabledReason?: string;
}

export const DEFAULT_MODEL_ID: ChatModelId = "gemini-existing";
export const SAFETY_NET_MODEL_ID: ChatModelId = "gemini-existing";
export const FREE_AUTOROUTER_OPENROUTER_ID = "openrouter/owl-alpha";

export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: "openai-gpt-4o-mini",
    group: "premium",
    label: "GPT-4o-mini (OpenRouter)",
    tagline: "OpenAI proprietary — needs paid OpenRouter credit (~$0.001/msg)",
    backend: "disabled",
    disabled: true,
    disabledReason:
      "Load paid OpenRouter credit (openrouter.ai/settings/credits), then flip this row's disabled flag.",
  },
  {
    id: "gemini-2.5-flash-openrouter",
    group: "premium",
    label: "Gemini 2.5 Flash (OpenRouter)",
    tagline: "Google flagship via OpenRouter — requires paid OpenRouter credit",
    backend: "disabled",
    disabled: true,
    disabledReason: "Activate paid OpenRouter credit in workspace settings to enable.",
  },
  {
    id: "gemini-existing",
    group: "default",
    label: "Gemini",
    tagline: "Default · uses existing Gemini config",
    backend: "google-direct",
  },
  {
    id: "free-deepseek-v4-flash",
    group: "free",
    label: "DeepSeek V4 Flash",
    tagline: "Free · 1M context",
    backend: "openrouter",
    openRouterId: "deepseek/deepseek-v4-flash:free",
  },
  {
    id: "free-openai-gpt-oss-20b",
    group: "free",
    label: "OpenAI GPT-OSS 20B",
    tagline: "Free · OpenAI open-weight · fast & cheap",
    backend: "openrouter",
    openRouterId: "openai/gpt-oss-20b:free",
  },
  {
    id: "free-openai-gpt-oss-120b",
    group: "free",
    label: "OpenAI GPT-OSS 120B",
    tagline: "Free · OpenAI open-weight · higher quality",
    backend: "openrouter",
    openRouterId: "openai/gpt-oss-120b:free",
  },
  {
    id: "free-minimax-m2",
    group: "free",
    label: "MiniMax M2",
    tagline: "Free · MiniMax latest free tier",
    backend: "openrouter",
    openRouterId: "minimax/minimax-m2:free",
  },
  {
    id: "free-nemotron-3-super-120b",
    group: "free",
    label: "NVIDIA Nemotron 3 Super 120B",
    tagline: "Free · 1M context",
    backend: "openrouter",
    openRouterId: "nvidia/nemotron-3-super-120b-a12b:free",
  },
  {
    id: "free-auto",
    group: "free",
    label: "Auto-router (smartest free)",
    tagline: "Free · routes to best free model per query",
    backend: "openrouter",
    openRouterId: FREE_AUTOROUTER_OPENROUTER_ID,
  },
];

export function findChatModel(id: string | undefined | null): ChatModelOption | undefined {
  if (!id) return undefined;
  return CHAT_MODELS.find((m) => m.id === id);
}

export function resolveRequestedModel(requestedId: string | undefined | null): ChatModelOption {
  const requested = findChatModel(requestedId);
  if (requested && !requested.disabled) return requested;
  return findChatModel(SAFETY_NET_MODEL_ID)!;
}

export const GROUP_LABELS: Record<ChatModelGroup, string> = {
  premium: "Premium",
  default: "Default",
  free: "Free (no cost)",
};

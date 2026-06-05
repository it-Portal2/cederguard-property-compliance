// CLIENT-SIDE FALLBACK for the chat model picker.
//
// The production source of truth is the admin-curated Firestore doc
// `adminConfig/aiModelConfig`, fetched via api.getActiveChatModels and
// adapted in src/pages/ChatPage.tsx. This file is the offline fallback
// the page falls back to when that fetch fails (network error, 5xx, or
// the admin endpoint not yet reachable on first deploy). Day-1 behaviour
// matches the lineup today's super-admins see when they open the Models
// tab — DeepSeek V4 Flash default, plus the other free OpenRouter rows.
//
// Server-side use is now limited to types — `ChatModelOption` is the
// shape `pickBackend` in api/routes/chatStream.ts expects, and is also
// re-used by the per-page adapter on the client. The static array below
// is NOT consulted server-side; chatStream reads admin config directly.

export type ChatModelId =
  // Premium paid via OpenRouter — disabled until paid credit is loaded
  | "premium-openai-gpt-4o-mini"
  | "premium-gemini-2-5-flash"
  // Free OpenRouter rows
  | "free-deepseek-v4-flash"
  | "free-minimax-m2"
  | "free-openai-gpt-oss-20b"
  | "free-openai-gpt-oss-120b"
  // Legacy id kept for backwards-compat with stored localStorage values
  | "gemini-existing"
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

// Offline fallback default — must match the seed's isDefault entry id.
// The real default at runtime comes from getActiveChatModels' defaultModelId
// (admin-curated). These constants only apply when the server fetch fails.
export const DEFAULT_MODEL_ID: ChatModelId = "free-deepseek-v4-flash";
export const SAFETY_NET_MODEL_ID: ChatModelId = "free-deepseek-v4-flash";
// Kept exported because chatStream.ts uses it as the cascading-fallback
// step 2 target (selected model fails → retry against the free auto-router
// before falling through to safety-net Gemini). It is intentionally NOT
// listed in CHAT_MODELS so the user can't pick it directly from the
// dropdown — it only ever runs as an automatic backend rescue.
export const FREE_AUTOROUTER_OPENROUTER_ID = "openrouter/owl-alpha";

// Mirror of api/lib/aiModelConfig.ts SEED_CONFIG.chatModels — kept in sync
// so the offline fallback shows the same lineup the server-side seed would.
// Disabled (Coming Soon) rows are flagged via `disabled: true` so the
// dropdown renders them dim and uncluckable; flip them on by curating the
// admin tab once paid OpenRouter credit is loaded.
export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: "premium-openai-gpt-4o-mini",
    group: "premium",
    label: "GPT-4o-mini",
    tagline: "",
    backend: "openrouter",
    openRouterId: "openai/gpt-4o-mini",
    disabled: true,
    disabledReason: "Paid — load OpenRouter credit and enable in /admin → AI Models.",
  },
  {
    id: "premium-gemini-2-5-flash",
    group: "premium",
    label: "Gemini 2.5 Flash",
    tagline: "",
    backend: "openrouter",
    openRouterId: "google/gemini-2.5-flash",
    disabled: true,
    disabledReason: "Paid — load OpenRouter credit and enable in /admin → AI Models.",
  },
  {
    id: "free-deepseek-v4-flash",
    group: "free",
    label: "DeepSeek V4 Flash",
    tagline: "",
    backend: "openrouter",
    openRouterId: "deepseek/deepseek-v4-flash:free",
  },
  {
    id: "free-minimax-m2",
    group: "free",
    label: "MiniMax M2",
    tagline: "",
    backend: "openrouter",
    openRouterId: "minimax/minimax-m2:free",
  },
  {
    id: "free-openai-gpt-oss-20b",
    group: "free",
    label: "OpenAI GPT-OSS 20B",
    tagline: "",
    backend: "openrouter",
    openRouterId: "openai/gpt-oss-20b:free",
  },
  {
    id: "free-openai-gpt-oss-120b",
    group: "free",
    label: "OpenAI GPT-OSS 120B",
    tagline: "",
    backend: "openrouter",
    openRouterId: "openai/gpt-oss-120b:free",
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

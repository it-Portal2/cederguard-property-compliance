import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquareDashed,
  FolderKanban,
  Layers,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Activity,
  ChevronDown,
  Globe,
} from "lucide-react";
import { clsx } from "clsx";
import { useStore } from "../store/useStore";
import { useChatStream } from "../hooks/useChatStream";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatComposer } from "../components/chat/ChatComposer";
import {
  CHAT_MODELS,
  DEFAULT_MODEL_ID,
  type ChatModelOption,
} from "../components/chat/composerModels";
import type { ScopeContext } from "../lib/chatTransport";
import { api } from "../lib/api";

const MODEL_STORAGE_KEY = "cedar.chat.model";

interface ServerActiveChatEntry {
  id: string;
  label: string;
  group: "premium" | "default" | "free";
  backend: "openrouter" | "google-direct";
  modelString: string;
  enabled: boolean;
  isDefault: boolean;
  meta?: {
    contextLength: number;
    promptCostUsdPer1M: number;
    completionCostUsdPer1M: number;
    isFree: boolean;
  };
}

/**
 * Adapt a server-side ChatModelEntry into the ChatModelOption shape the
 * ModelSelector renders. Preserves the entry's backend (google-direct
 * entries skip the openRouterId mapping — they route through Gemini
 * direct using the server's env + user backup key). Synthesises a
 * tagline from the meta block so admins curating cost/context see it
 * surface in the dropdown.
 */
function serverEntryToOption(e: ServerActiveChatEntry): ChatModelOption {
  const tagline = e.meta
    ? `${e.meta.isFree ? "Free" : "Paid"} · ${
        e.meta.contextLength >= 1_000_000
          ? `${(e.meta.contextLength / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
          : `${Math.round(e.meta.contextLength / 1_000)}k`
      } context`
    : e.backend === "google-direct"
      ? "Uses existing Gemini config"
      : "";
  return {
    id: e.id as ChatModelOption["id"],
    group: e.group,
    label: e.label,
    tagline,
    backend: e.backend,
    // openRouterId is only meaningful when backend === "openrouter".
    // Setting it for google-direct entries is harmless (the dispatcher
    // ignores it) but we leave it undefined for cleanliness.
    ...(e.backend === "openrouter" ? { openRouterId: e.modelString } : {}),
  };
}

const EXAMPLE_PROMPTS = [
  {
    icon: AlertTriangle,
    colour: "text-orange-500",
    bg: "bg-orange-50 border-orange-100 hover:border-orange-300",
    text: "What are the highest-scoring open risks across all my projects?",
  },
  {
    icon: CheckSquare,
    colour: "text-emerald-500",
    bg: "bg-emerald-50 border-emerald-100 hover:border-emerald-300",
    text: "Which compliance items are currently non-compliant or overdue?",
  },
  {
    icon: Activity,
    colour: "text-amber-500",
    bg: "bg-amber-50 border-amber-100 hover:border-amber-300",
    text: "Show me any KRIs that have breached their thresholds.",
  },
  {
    icon: FolderKanban,
    colour: "text-indigo-500",
    bg: "bg-indigo-50 border-indigo-100 hover:border-indigo-300",
    text: "Give me a summary of the current status of all my active projects.",
  },
];

/**
 * First-render seed: the locally-bundled CHAT_MODELS list, with the stored
 * id from localStorage if it matches anything in that fallback. The useEffect
 * below replaces both with the server-fetched lineup as soon as it lands.
 */
function loadStoredModelAgainstFallback(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_ID;
    const match = CHAT_MODELS.find((m) => m.id === raw);
    if (!match || match.disabled) return DEFAULT_MODEL_ID;
    return match.id;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

export function ChatPage() {
  const { activeProject, activeProgramme } = useStore();
  const [inputValue, setInputValue] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // ── Model registry — server-curated, falls back to local registry ──
  // First render uses the local composerModels.ts list so the dropdown
  // is never empty. As soon as getActiveChatModels resolves we replace
  // both `models` and `selectedModel` to honour the admin curation and
  // reconcile any stale localStorage id against the live lineup.
  const [models, setModels] = useState<ChatModelOption[]>(CHAT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(loadStoredModelAgainstFallback);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getActiveChatModels();
        if (cancelled) return;
        const serverEntries: ServerActiveChatEntry[] = Array.isArray(res?.chatModels) ? res.chatModels : [];
        if (serverEntries.length === 0) return; // keep the local fallback
        const adminOptions = serverEntries.map(serverEntryToOption);
        setModels(adminOptions);
        // Reconcile the stored selection against the admin lineup.
        const storedRaw = (() => {
          try { return window.localStorage.getItem(MODEL_STORAGE_KEY); } catch { return null; }
        })();
        const storedMatch = storedRaw && adminOptions.find((m) => m.id === storedRaw);
        const adminDefaultId: string | null = res?.defaultModelId ?? adminOptions[0]?.id ?? null;
        setSelectedModel((curr) => {
          if (storedMatch) return storedRaw!;
          if (adminOptions.find((m) => m.id === curr)) return curr;
          return adminDefaultId ?? curr;
        });
      } catch (e: any) {
        // Network / 5xx — stay on the local CHAT_MODELS fallback. The
        // hardcoded list is exactly what was shipped before this feature,
        // so users see a working dropdown even when the admin endpoint
        // is unreachable.
        console.warn("[ChatPage] getActiveChatModels failed, using local fallback:", e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist model pick across sessions.
  useEffect(() => {
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch { /* ignore quota errors */ }
  }, [selectedModel]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scopeContext: ScopeContext | null =
    activeProject || activeProgramme
      ? {
          projectId: (activeProject as any)?.id ?? null,
          projectName:
            (activeProject as any)?.name ??
            (activeProject as any)?.projectName ??
            null,
          programmeId: (activeProgramme as any)?.id ?? null,
          programmeName: (activeProgramme as any)?.name ?? null,
        }
      : null;

  const {
    messages,
    isStreaming,
    rateLimit,
    sendMessage,
    stopStream,
    clearMessages,
  } = useChatStream(scopeContext);

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage(text, { model: selectedModel });
    },
    [sendMessage, selectedModel],
  );

  // Track scroll position to show/hide "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  // Auto-scroll only when near the bottom (don't hijack user scroll)
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  // Scroll to bottom when streaming starts
  useEffect(() => {
    if (isStreaming) scrollToBottom(true);
  }, [isStreaming, scrollToBottom]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    send(inputValue);
    setInputValue("");
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-5.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
            Cedar AI Chat
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">
            Ask questions about your projects, risks, compliance items, and more.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {/* Scope indicator */}
          <div
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold truncate max-w-[160px]",
              scopeContext
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-slate-50 border-slate-200 text-slate-500",
            )}
            title={
              scopeContext?.projectName ??
              scopeContext?.programmeName ??
              "Portfolio-wide"
            }
          >
            {scopeContext?.projectId ? (
              <>
                <FolderKanban className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {scopeContext.projectName ?? "Active Project"}
                </span>
              </>
            ) : scopeContext?.programmeId ? (
              <>
                <Layers className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {scopeContext.programmeName ?? "Active Programme"}
                </span>
              </>
            ) : (
              <>
                <Globe className="w-3 h-3 flex-shrink-0" />
                <span>Portfolio</span>
              </>
            )}
          </div>

          {/* Clear button */}
          {!isEmpty && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-5 space-y-4 relative"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-2 pb-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <MessageSquareDashed className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-base font-black text-slate-900">
                How can I help today?
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                I have access to your projects, risks, compliance items, and
                governance data.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    send(p.text);
                  }}
                  disabled={rateLimit.isLimited}
                  className={clsx(
                    "flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all hover:scale-[1.01] hover:shadow-sm active:scale-[0.99]",
                    p.bg,
                    rateLimit.isLimited && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <p.icon
                    className={clsx("w-4 h-4 flex-shrink-0 mt-0.5", p.colour)}
                  />
                  <span className="text-[13px] text-slate-700 font-medium leading-snug">
                    {p.text}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 text-center max-w-xs">
              Cedar AI is read-only and can only query data you have permission to
              access. It cannot create or modify records.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </>
        )}
        <div ref={messagesEndRef} aria-hidden />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && !isEmpty && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-[7.5rem] md:bottom-24 right-6 z-10 p-2 bg-white border border-slate-300 rounded-full shadow-md text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all hover:scale-105"
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* Composer */}
      <div className="pt-3 border-t border-slate-200 flex-shrink-0">
        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onStop={stopStream}
          isStreaming={isStreaming}
          rateLimit={rateLimit}
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>
    </div>
  );
}

export default ChatPage;

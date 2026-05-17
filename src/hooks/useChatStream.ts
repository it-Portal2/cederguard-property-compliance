// React hook that manages the AI Chat stream state.
// Each assistant message carries its own ordered `steps[]` keyed by the
// server-supplied callId, so re-invocations of the same tool show as
// separate rows in the activity timeline. Conversation history is
// ephemeral — no Firestore writes; refresh = new conversation.

import { useState, useCallback, useRef } from "react";
import {
  openChatStream,
  type ChatMessage,
  type Citation,
  type ScopeContext,
  type ChatSendOptions,
} from "../lib/chatTransport";
import { labelForTool } from "../components/chat/toolLabels";

export type AiActivityStepStatus = "pending" | "running" | "done" | "failed";

export interface AiActivityStep {
  id: string;                  // server-supplied callId (or synthetic for _fallback)
  toolName: string;
  displayLabel: string;
  argsPreview?: string;
  status: AiActivityStepStatus;
  resultCount?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
  citations?: Citation[];
  steps?: AiActivityStep[];
  error?: string;
}

export interface RateLimitState {
  remaining: number | null;
  resetAt: number | null;
  isLimited: boolean;
  retryAfterSeconds: number | null;
}

export function useChatStream(scopeContext: ScopeContext | null) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimitState>({
    remaining: null,
    resetAt: null,
    isLimited: false,
    retryAfterSeconds: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    if (streamingIdRef.current) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== streamingIdRef.current) return m;
          // Empty bubble after stop looks like a hang — fill it with a
          // polite cancellation note so the user sees an immediate, clear
          // acknowledgement instead of a spinner-less blank card.
          const hadOutput = !!m.text && m.text.length > 0;
          const stopNote = hadOutput
            ? `${m.text}\n\n*— Response stopped by you. Ask another question anytime.*`
            : "*Response stopped. Ask another question anytime.*";
          return { ...m, isStreaming: false, text: stopNote };
        }),
      );
      streamingIdRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (userText: string, options: ChatSendOptions = {}) => {
      if (isStreaming || !userText.trim()) return;

      const userMsgId = `u-${Date.now()}`;
      const assistantMsgId = `a-${Date.now()}`;
      streamingIdRef.current = assistantMsgId;

      const userMsg: DisplayMessage = {
        id: userMsgId,
        role: "user",
        text: userText.trim(),
      };
      const assistantMsg: DisplayMessage = {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        isStreaming: true,
        citations: [],
        steps: [],
      };

      // Build history BEFORE adding the new messages to state.
      const history: ChatMessage[] = messages.slice(-20).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        text: m.text,
      }));
      history.push({ role: "user", text: userText.trim() });

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await openChatStream(
          history,
          scopeContext,
          options,
          (evt) => {
            if (evt.event === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, text: m.text + evt.data.delta }
                    : m,
                ),
              );
              return;
            }

            if (evt.event === "tool") {
              const { name, callId, status, argsPreview, resultCount, error } =
                evt.data;
              // Internal fallback chips ("_fallback") are for server logs only;
              // never surface the AI-provider switch to the user.
              if (name === "_fallback" || name.startsWith("_")) return;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const steps = [...(m.steps ?? [])];
                  const existingIdx = steps.findIndex((s) => s.id === callId);
                  const now = Date.now();
                  const nextStatus: AiActivityStepStatus =
                    status === "done"
                      ? error
                        ? "failed"
                        : "done"
                      : "running";
                  if (existingIdx === -1) {
                    steps.push({
                      id: callId,
                      toolName: name,
                      displayLabel: labelForTool(name),
                      argsPreview,
                      status: nextStatus,
                      resultCount,
                      error,
                      startedAt: now,
                      finishedAt: status === "done" ? now : undefined,
                    });
                  } else {
                    const prevStep = steps[existingIdx];
                    steps[existingIdx] = {
                      ...prevStep,
                      argsPreview: argsPreview ?? prevStep.argsPreview,
                      status: nextStatus,
                      resultCount: resultCount ?? prevStep.resultCount,
                      error: error ?? prevStep.error,
                      finishedAt:
                        status === "done" ? now : prevStep.finishedAt,
                    };
                  }
                  return { ...m, steps };
                }),
              );
              return;
            }

            if (evt.event === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, citations: evt.data.citations }
                    : m,
                ),
              );
              return;
            }

            if (evt.event === "error") {
              const errData = evt.data;
              if (errData.code === "RATE_LIMITED") {
                setRateLimit({
                  remaining: 0,
                  resetAt: errData.resetAt ?? null,
                  isLimited: true,
                  retryAfterSeconds: errData.retryAfterSeconds ?? null,
                });
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        text: m.text || "",
                        error: errData.message,
                        isStreaming: false,
                      }
                    : m,
                ),
              );
              return;
            }

            if (evt.event === "done") {
              if (evt.data.remaining != null) {
                setRateLimit((prev) => ({
                  ...prev,
                  remaining: evt.data.remaining!,
                  isLimited: false,
                  retryAfterSeconds: null,
                }));
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, isStreaming: false }
                    : m,
                ),
              );
              setIsStreaming(false);
              streamingIdRef.current = null;
              return;
            }
          },
          controller.signal,
        );
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    error: err.message || "Connection failed",
                    isStreaming: false,
                  }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        streamingIdRef.current = null;
        abortRef.current = null;
      }
    },
    [isStreaming, scopeContext, messages],
  );

  const clearMessages = useCallback(() => {
    stopStream();
    setMessages([]);
    setRateLimit({
      remaining: null,
      resetAt: null,
      isLimited: false,
      retryAfterSeconds: null,
    });
  }, [stopStream]);

  return {
    messages,
    isStreaming,
    rateLimit,
    sendMessage,
    stopStream,
    clearMessages,
  };
}

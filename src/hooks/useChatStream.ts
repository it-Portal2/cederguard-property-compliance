// React hook that manages the AI Chat stream state.
// Handles text delta accumulation, tool status indicators, citations, and stop.

import { useState, useCallback, useRef } from "react";
import {
  openChatStream,
  type ChatMessage,
  type Citation,
  type ScopeContext,
} from "../lib/chatTransport";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
  citations?: Citation[];
  toolActivity?: { name: string; status: "running" | "done"; resultCount?: number }[];
  error?: string;
}

export interface ToolIndicator {
  name: string;
  status: "running" | "done";
  resultCount?: number;
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
  const [toolIndicators, setToolIndicators] = useState<ToolIndicator[]>([]);
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
    setToolIndicators([]);
    // Mark streaming message as complete
    if (streamingIdRef.current) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m,
        ),
      );
      streamingIdRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (userText: string) => {
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
        toolActivity: [],
      };

      // Build conversation history BEFORE adding new messages to state
      const history: ChatMessage[] = messages
        .slice(-20)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          text: m.text,
        }));
      history.push({ role: "user", text: userText.trim() });

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setToolIndicators([]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await openChatStream(
          history,
          scopeContext,
          (evt) => {
            if (evt.event === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, text: m.text + evt.data.delta }
                    : m,
                ),
              );
            } else if (evt.event === "tool") {
              setToolIndicators((prev) => {
                const existing = prev.find((t) => t.name === evt.data.name);
                if (existing) {
                  return prev.map((t) =>
                    t.name === evt.data.name
                      ? {
                          ...t,
                          status: evt.data.status,
                          resultCount: evt.data.resultCount ?? t.resultCount,
                        }
                      : t,
                  );
                }
                return [
                  ...prev,
                  {
                    name: evt.data.name,
                    status: evt.data.status,
                    resultCount: evt.data.resultCount,
                  },
                ];
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        toolActivity: [
                          ...(m.toolActivity ?? []).filter(
                            (t) => t.name !== evt.data.name,
                          ),
                          {
                            name: evt.data.name,
                            status: evt.data.status,
                            resultCount: evt.data.resultCount,
                          },
                        ],
                      }
                    : m,
                ),
              );
            } else if (evt.event === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, citations: evt.data.citations }
                    : m,
                ),
              );
            } else if (evt.event === "error") {
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
            } else if (evt.event === "done") {
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
              setToolIndicators([]);
              streamingIdRef.current = null;
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
        setToolIndicators([]);
        streamingIdRef.current = null;
        abortRef.current = null;
      }
    },
    [isStreaming, scopeContext, messages],
  );

  const clearMessages = useCallback(() => {
    stopStream();
    setMessages([]);
    setRateLimit({ remaining: null, resetAt: null, isLimited: false, retryAfterSeconds: null });
  }, [stopStream]);

  return {
    messages,
    isStreaming,
    toolIndicators,
    rateLimit,
    sendMessage,
    stopStream,
    clearMessages,
  };
}

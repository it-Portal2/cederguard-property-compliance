// Browser-side transport for the AI Chat streaming endpoint.
// Opens a fetch + ReadableStream connection to POST /api?action=chatStream
// with the Firebase auth token in the Authorization header.
//
// Auth + URL resolution mirror src/lib/api.ts so this transport works
// identically on web and desktop:
//   - Token via authBridge.getIdToken() — on desktop the Firebase ID
//     token lives in safeStorage in the main process, NOT in
//     auth.currentUser (which is always null on desktop because we
//     never sign in through the Firebase Web SDK).
//   - URL via window.cedar.apiBaseUrl on desktop, /api on web.

import { authBridge } from "./auth/authBridge";
import { isDesktop } from "./desktop/isDesktop";

const env = (import.meta as any).env || {};
const cedar = typeof window !== "undefined" ? (window as any).cedar : null;
const API_URL = isDesktop
  ? (cedar?.apiBaseUrl ||
     env.VITE_DESKTOP_API_URL ||
     env.VITE_API_URL ||
     "https://cedarguard.co.uk/api")
  : (env.VITE_API_URL || "/api");

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ScopeContext {
  projectId?: string | null;
  projectName?: string | null;
  programmeId?: string | null;
  programmeName?: string | null;
}

export type ChatStreamEvent =
  | { event: "text"; data: { delta: string } }
  | {
      event: "tool";
      data: {
        name: string;
        callId: string;
        status: "running" | "done";
        argsPreview?: string;
        resultCount?: number;
        error?: string;
      };
    }
  | { event: "sources"; data: { citations: Citation[] } }
  | { event: "error"; data: { message: string; code?: string; retryAfterSeconds?: number; resetAt?: number } }
  | {
      event: "done";
      data: { messageId: string | null; remaining?: number; factCheckable?: boolean };
    };

export interface Citation {
  /** Record-type ("risk" | "compliance" | …) for in-app sources, or "web" for an external web source. */
  kind: string;
  id: string;
  label: string;
  /** In-app deep-link route. For web sources this is the external URL too (or use `url`). */
  route: string;
  /** External source URL — present on web citations (kind: "web"). */
  url?: string;
  /** Optional page/source title for web citations. */
  title?: string;
  /** Optional extractive snippet from the web source. */
  snippet?: string;
}

export interface ChatSendOptions {
  /** ChatModelId from src/components/chat/composerModels.ts (left as string here to keep the transport layer dep-free). */
  model?: string;
  extendedThinking?: boolean;
}

export async function openChatStream(
  messages: ChatMessage[],
  scopeContext: ScopeContext | null,
  options: ChatSendOptions,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await authBridge.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}?action=chatStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      scopeContext,
      model: options.model,
      extendedThinking: options.extendedThinking,
    }),
    signal,
  });

  if (!res.ok && !res.body) {
    const text = await res.text();
    let msg = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) msg = parsed.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as ChatStreamEvent;
          onEvent(parsed);
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as ChatStreamEvent;
        onEvent(parsed);
      } catch {
        // ignore
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") return;
    throw err;
  } finally {
    reader.releaseLock();
  }
}

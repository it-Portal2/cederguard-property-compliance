import React, { useRef, useEffect, useCallback } from "react";
import { Send, Square, Clock } from "lucide-react";
import { clsx } from "clsx";
import type { RateLimitState } from "../../hooks/useChatStream";

interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  rateLimit: RateLimitState;
  disabled?: boolean;
}

function formatCountdown(resetAt: number | null): string {
  if (!resetAt) return "";
  const diffMs = resetAt - Date.now();
  if (diffMs <= 0) return "shortly";
  const mins = Math.ceil(diffMs / 60000);
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  rateLimit,
  disabled = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming && !rateLimit.isLimited && value.trim()) {
          onSend();
        }
      }
      if (e.key === "Escape" && isStreaming) {
        onStop();
      }
    },
    [isStreaming, rateLimit.isLimited, value, onSend, onStop],
  );

  const isInputDisabled = disabled || rateLimit.isLimited;
  const canSend = !isStreaming && !isInputDisabled && value.trim().length > 0;

  return (
    <div className="space-y-2">
      {/* Rate limit banner */}
      {rateLimit.isLimited && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            You&apos;ve used 20 of 20 messages this hour. The next message will
            be available in {formatCountdown(rateLimit.resetAt)}.
          </span>
        </div>
      )}

      {/* Remaining message count (subtle hint) */}
      {!rateLimit.isLimited && rateLimit.remaining !== null && rateLimit.remaining <= 5 && (
        <div className="text-[11px] text-amber-500 font-medium text-right pr-1">
          {rateLimit.remaining} message{rateLimit.remaining !== 1 ? "s" : ""} remaining this hour
        </div>
      )}

      {/* Input row */}
      <div
        className={clsx(
          "flex items-end gap-2 bg-white border rounded-2xl px-3 py-2 transition-all",
          isInputDisabled
            ? "border-slate-200 opacity-60"
            : "border-slate-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={
            rateLimit.isLimited
              ? "Rate limit reached — please wait…"
              : "Ask Cedar AI about your projects, risks, compliance items…"
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none min-h-[24px] max-h-[200px] py-0.5 leading-relaxed disabled:cursor-not-allowed"
          aria-label="Chat message input"
        />

        <div className="flex-shrink-0 pb-0.5">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              title="Stop generation (Esc)"
              aria-label="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={clsx(
                "p-2 rounded-xl transition-all",
                canSend
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-sm"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              )}
              title="Send message (Enter)"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Cedar AI can make mistakes. Always verify important compliance and risk information.
      </p>
    </div>
  );
}

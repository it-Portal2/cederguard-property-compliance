import React, { useRef, useEffect, useCallback, useId } from "react";
import { Send, Square, Clock, AlertCircle } from "lucide-react";
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
  if (!resetAt) return "shortly";
  const diffMs = resetAt - Date.now();
  if (diffMs <= 0) return "now";
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
  const inputId = useId();

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  // Focus composer on mount for desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      textareaRef.current?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (!isStreaming && !rateLimit.isLimited && value.trim()) {
          onSend();
        }
      }
      if (e.key === "Escape" && isStreaming) {
        e.preventDefault();
        onStop();
      }
    },
    [isStreaming, rateLimit.isLimited, value, onSend, onStop],
  );

  const isInputDisabled = disabled || rateLimit.isLimited;
  const canSend = !isStreaming && !isInputDisabled && value.trim().length > 0;
  const charCount = value.length;
  const charLimit = 8000;
  const nearLimit = charCount > charLimit * 0.85;

  return (
    <div className="space-y-2" role="form" aria-label="Send a message">
      {/* Rate limit banner */}
      {rateLimit.isLimited && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800"
          role="alert"
          aria-live="assertive"
        >
          <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Hourly message limit reached</p>
            <p className="text-amber-700 mt-0.5">
              You&apos;ve used all 20 messages this hour. Your limit resets
              in {formatCountdown(rateLimit.resetAt)}.
            </p>
          </div>
        </div>
      )}

      {/* Remaining hint — only show when 5 or fewer left */}
      {!rateLimit.isLimited &&
        rateLimit.remaining !== null &&
        rateLimit.remaining <= 5 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium justify-end pr-1">
            <AlertCircle className="w-3 h-3" />
            {rateLimit.remaining}{" "}
            {rateLimit.remaining === 1 ? "message" : "messages"} remaining this
            hour
          </div>
        )}

      {/* Input row */}
      <div
        className={clsx(
          "flex items-end gap-2 bg-white border rounded-2xl px-3 py-2.5 transition-all duration-150",
          isInputDisabled
            ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
            : "border-slate-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100",
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          Chat message
        </label>
        <textarea
          id={inputId}
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= charLimit) onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={
            rateLimit.isLimited
              ? "Rate limit reached — please wait…"
              : isStreaming
              ? "Cedar AI is responding… (Esc to stop)"
              : "Ask about your projects, risks, compliance items… (Enter to send)"
          }
          rows={1}
          maxLength={charLimit}
          className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none min-h-[24px] max-h-[200px] py-0.5 leading-relaxed disabled:cursor-not-allowed"
          aria-label="Type your message"
          aria-describedby={nearLimit ? "char-count" : undefined}
          autoComplete="off"
          spellCheck
        />

        {/* Character count — only near limit */}
        {nearLimit && (
          <span
            id="char-count"
            className={clsx(
              "text-[10px] font-mono flex-shrink-0 self-end pb-0.5",
              charCount >= charLimit ? "text-red-500" : "text-slate-400",
            )}
            aria-live="polite"
          >
            {charLimit - charCount}
          </span>
        )}

        {/* Send / Stop button */}
        <div className="flex-shrink-0 pb-0.5">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all focus:outline-none focus:ring-2 focus:ring-red-300"
              title="Stop generation (Esc)"
              aria-label="Stop generating response"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={clsx(
                "p-2 rounded-xl transition-all focus:outline-none focus:ring-2",
                canSend
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-sm focus:ring-indigo-300"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed focus:ring-slate-200",
              )}
              title="Send message (Enter)"
              aria-label="Send message"
              aria-disabled={!canSend}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        Cedar AI may make mistakes. Always verify important compliance and risk
        information independently.
        {!isStreaming && (
          <span className="hidden md:inline">
            {" "}
            <kbd className="px-1 py-0.5 rounded border border-slate-200 text-[9px] font-mono">
              Shift+Enter
            </kbd>{" "}
            for new line.
          </span>
        )}
      </p>
    </div>
  );
}

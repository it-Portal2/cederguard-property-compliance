// Premium chat composer.
// Auto-grow textarea, left-side Extended Thinking toggle, right-side
// model selector + send button. No file uploads, no drag-drop, no
// paste-as-card. CedarGuard indigo palette.

import React, { useCallback, useEffect, useId, useRef } from "react";
import { ArrowUp, Square, Clock, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import type { RateLimitState } from "../../hooks/useChatStream";
import { ModelSelector } from "./ModelSelector";
import type { ChatModelOption } from "./composerModels";

interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  rateLimit: RateLimitState;
  /**
   * Resolved list of chat models to render in the dropdown. Owned by the
   * parent so the source of truth (admin-curated server config, with the
   * static composerModels.ts list as offline fallback) lives in one place.
   */
  models: ChatModelOption[];
  selectedModel: string;
  onModelChange: (id: string) => void;
  disabled?: boolean;
}

const MAX_CHARS = 4000;

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
  models,
  selectedModel,
  onModelChange,
  disabled = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();

  // Auto-grow up to 384px (matches reference's max-h-96)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 384) + "px";
  }, [value]);

  // Focus the textarea on mount for desktop only
  useEffect(() => {
    if (typeof window === "undefined") return;
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
  const hasContent = value.trim().length > 0;
  const canSend = !isStreaming && !isInputDisabled && hasContent;
  const charCount = value.length;
  const nearLimit = charCount > MAX_CHARS * 0.85;

  return (
    <div
      className="w-full max-w-2xl mx-auto space-y-2"
      role="form"
      aria-label="Send a message"
    >
      {/* Rate limit banner */}
      {rateLimit.isLimited && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300"
          role="alert"
          aria-live="assertive"
        >
          <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-semibold">Hourly message limit reached</p>
            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
              You&apos;ve used all 20 messages this hour. Your limit resets in{" "}
              {formatCountdown(rateLimit.resetAt)}.
            </p>
          </div>
        </div>
      )}

      {/* Remaining hint when low */}
      {!rateLimit.isLimited &&
        rateLimit.remaining !== null &&
        rateLimit.remaining <= 5 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium justify-end pr-1">
            <AlertCircle className="w-3 h-3" aria-hidden />
            {rateLimit.remaining}{" "}
            {rateLimit.remaining === 1 ? "message" : "messages"} remaining this
            hour
          </div>
        )}

      {/* Composer shell */}
      <div
        className={clsx(
          "flex flex-col mx-2 md:mx-0 rounded-lg border cursor-text",
          "bg-white dark:bg-slate-900",
          "border-slate-200 dark:border-slate-700",
          "shadow-[0_0_15px_rgba(0,0,0,0.06)] hover:shadow-[0_0_20px_rgba(0,0,0,0.1)]",
          "focus-within:shadow-[0_0_25px_rgba(0,0,0,0.12)] focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50",
          "transition-shadow duration-200",
        )}
        onClick={() => textareaRef.current?.focus()}
      >
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">
          {/* Textarea */}
          <div className="relative mb-1">
            <label htmlFor={inputId} className="sr-only">
              Chat message
            </label>
            <div className="max-h-96 w-full overflow-y-auto font-sans wrap-break-word min-h-10 pl-1">
              <textarea
                id={inputId}
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    onChange(e.target.value);
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={isInputDisabled}
                placeholder={
                  rateLimit.isLimited
                    ? "Rate limit reached — please wait…"
                    : isStreaming
                      ? "Cedar AI is responding… (Esc to stop)"
                      : "How can I help you today?"
                }
                rows={1}
                maxLength={MAX_CHARS}
                className={clsx(
                  "w-full bg-transparent border-0 outline-none resize-none overflow-hidden",
                  "text-[16px] leading-relaxed py-0.5",
                  "text-slate-900 dark:text-slate-100",
                  "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                  "disabled:cursor-not-allowed",
                )}
                style={{ minHeight: "1.5em" }}
                autoComplete="off"
                spellCheck
                aria-label="Type your message"
                aria-describedby={nearLimit ? `${inputId}-counter` : undefined}
              />
            </div>
            {nearLimit && (
              <span
                id={`${inputId}-counter`}
                aria-live="polite"
                className={clsx(
                  "absolute right-1 -bottom-4 text-[10px] font-mono tabular-nums",
                  charCount >= MAX_CHARS
                    ? "text-rose-500"
                    : "text-slate-400 dark:text-slate-500",
                )}
              >
                {MAX_CHARS - charCount}
              </span>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 w-full">
            {/* Spacer pushes model + send to the right */}
            <div className="flex-1" />

            {/* Right cluster — Model + Send/Stop */}
            <div className="flex items-center gap-1.5 min-w-0">
              <ModelSelector
                models={models}
                selectedId={selectedModel}
                onSelect={onModelChange}
                disabled={isInputDisabled}
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className={clsx(
                    "h-8 w-8 inline-flex items-center justify-center rounded-lg",
                    "bg-rose-50 text-rose-500 hover:bg-rose-100 active:scale-95",
                    "dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20",
                    "focus:outline-none focus:ring-2 focus:ring-rose-300",
                    "transition-all duration-150",
                  )}
                  title="Stop generating (Esc)"
                  aria-label="Stop generating response"
                >
                  <Square className="w-4 h-4 fill-current" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!canSend}
                  className={clsx(
                    "h-8 w-8 inline-flex items-center justify-center rounded-lg",
                    "transition-all duration-150 active:scale-95",
                    "focus:outline-none focus:ring-2",
                    canSend
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm focus:ring-indigo-300"
                      : "bg-indigo-200 dark:bg-indigo-500/30 text-white/60 cursor-not-allowed focus:ring-slate-200",
                  )}
                  title="Send message (Enter)"
                  aria-label="Send message"
                  aria-disabled={!canSend}
                >
                  <ArrowUp className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
        Cedar AI may make mistakes. Always verify important compliance and risk
        information independently.
        {!isStreaming && (
          <span className="hidden md:inline">
            {" "}
            <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[9px] font-mono">
              Shift+Enter
            </kbd>{" "}
            for new line.
          </span>
        )}
      </p>
    </div>
  );
}

export default ChatComposer;

import React, { useState, useRef, useEffect } from "react";
import {
  ScanSearch,
  Loader2,
  Check,
  X,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { api } from "../lib/api";
import { handleAIError } from "../services/aiService";
import { stripMarkdown } from "../lib/utils";

type AIWriterState = "IDLE" | "COMPOSING" | "GENERATING" | "REVIEWING";

/** Strip common AI meta-commentary prefixes from responses */
function stripAIPrefixes(text: string): string {
  const prefixes = [
    /^here[\'"']?s an?\s+(improved|enhanced|better|rewritten|updated)\s+(version|text|description|control|action)\s*:?\s*/i,
    /^here[\'"']?s the\s+(improved|enhanced|better|rewritten|updated)\s+(version|text|description|control|action)\s*:?\s*/i,
    /^(rewritten|improved|updated|enhanced)\s+(version|text)\s*:?\s*/i,
    /^(here[\'"']?s|this is)\s+(what\s+i\s+have|my\s+(suggestion|improvement))\s*:?\s*/i,
    /^["']+\s*(here[\'"']?s|this\s+is)\s*/i,
    /\s*["']+\s*$/,
  ];

  let cleaned = text.trim();
  prefixes.forEach((prefix) => {
    cleaned = cleaned.replace(prefix, "");
  });

  cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();
  return cleaned;
}

interface AIWriterProps {
  onSuggest: (content: string) => void;
  context: string;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const AIWriter: React.FC<AIWriterProps> = ({
  onSuggest,
  context,
  label = "AI Assist",
  placeholder = "Optional: add context or focus areas to guide the AI (e.g. listed building, fire safety, planning delays)",
  className = "",
}) => {
  const [state, setState] = useState<AIWriterState>("IDLE");
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the panel when the user clicks outside, unless a generation is in flight
  useEffect(() => {
    if (state === "IDLE") return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        state !== "GENERATING" &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        resetToIdle();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetToIdle = () => {
    setState("IDLE");
    setUserInput("");
    setResult(null);
  };

  const openComposing = () => {
    setState("COMPOSING");
    // Defer focus so the textarea has mounted
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleTriggerClick = () => {
    if (state !== "IDLE") {
      // Button acts as a close toggle when the panel is open
      if (state !== "GENERATING") resetToIdle();
      return;
    }
    openComposing();
  };

  const handleGenerate = async () => {
    setState("GENERATING");
    try {
      const finalPrompt = userInput.trim()
        ? `${context}\n\nUser guidance: "${userInput.trim()}"`
        : context;

      const res = await api.testGemini(finalPrompt);
      if (!res?.success || !res?.result) throw new Error("Empty AI response");

      const clean = stripAIPrefixes(stripMarkdown(res.result)).trim();
      if (!clean) throw new Error("Empty AI response after processing");

      setResult(clean);
      setState("REVIEWING");
    } catch (err: any) {
      handleAIError(err, "AI draft");
      // Return to composing so the user can try again
      setState("COMPOSING");
    }
  };

  const handleAccept = () => {
    if (result) {
      onSuggest(result);
      resetToIdle();
    }
  };

  const handleRegenerate = () => {
    setResult(null);
    // Keep userInput so the user can refine it
    setState("COMPOSING");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const isActive = state !== "IDLE";
  const isGenerating = state === "GENERATING";

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger button — always visible to preserve flex-row layout ── */}
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={isGenerating}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          isActive
            ? "text-indigo-700 bg-indigo-100 border border-indigo-300"
            : "text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"
        } disabled:opacity-60 ${className}`}
        title={isActive ? "Close AI panel" : undefined}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Generating…</span>
          </>
        ) : (
          <>
            <ScanSearch className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* ── COMPOSING / GENERATING panel ── */}
      {(state === "COMPOSING" || state === "GENERATING") && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-white border border-indigo-200 rounded-lg shadow-xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-indigo-700">
              <ScanSearch className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-wide">
                Guide the AI
              </span>
            </div>
            <button
              type="button"
              onClick={resetToIdle}
              disabled={isGenerating}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors disabled:opacity-40"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={placeholder}
            rows={3}
            disabled={isGenerating}
            className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 disabled:opacity-50 placeholder:text-slate-400 leading-relaxed"
            onKeyDown={(e) => {
              // Enter (without Shift) triggers generation — Shift+Enter inserts newline
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (state === "COMPOSING") handleGenerate();
              }
              if (e.key === "Escape") resetToIdle();
            }}
          />

          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={resetToIdle}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <ScanSearch className="w-3.5 h-3.5" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── REVIEWING panel ── */}
      {state === "REVIEWING" && result !== null && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-linear-to-br from-indigo-50 to-white border border-indigo-200 rounded-lg shadow-xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-indigo-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-wide">
                AI Suggestion
              </span>
            </div>
            <button
              type="button"
              onClick={resetToIdle}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
              title="Discard"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto rounded-lg">
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap px-1">
              &ldquo;{result}&rdquo;
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-white hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

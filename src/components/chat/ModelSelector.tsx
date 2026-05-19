// Composer model picker.
// Flat dropdown — just model names, no group headers, no taglines, no
// pricing badges. Same shape as Perplexity / ChatGPT / Claude's picker.
// Model list is sourced from the parent (which fetches getActiveChatModels
// and falls back to the static composerModels registry on failure) — the
// component itself is stateless about the registry, so a super-admin
// curating the lineup in /admin → AI Models is reflected on the next
// chat page-load.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import type { ChatModelOption } from "./composerModels";

interface ModelSelectorProps {
  /** Pre-resolved list to render. Parent owns the source-of-truth. */
  models: ChatModelOption[];
  /** Currently-selected model id (string — parent enforces validity). */
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  models,
  selectedId,
  onSelect,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => models.find((m) => m.id === selectedId) ?? models[0],
    [models, selectedId],
  );

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ESC closes the menu when open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = (option: ChatModelOption) => {
    if (option.disabled) return;
    onSelect(option.id);
    setOpen(false);
  };

  // Defensive — if the parent passes an empty list (admin disabled every
  // entry AND the local fallback also somehow ended up empty), render
  // nothing rather than crashing on `selected.label`.
  if (!selected) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${selected.label}`}
        className={clsx(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors",
          "min-w-0 max-w-[180px]",
          open
            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 flex-shrink-0 opacity-70 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="listbox"
            aria-label="Choose AI model"
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
            className={clsx(
              "absolute bottom-full right-0 mb-2 z-50",
              "w-[320px] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto",
              "rounded-lg border border-slate-200 dark:border-slate-700",
              "bg-white dark:bg-slate-900 shadow-lg p-1.5 origin-bottom-right",
            )}
          >
            {models.map((option) => {
              const isSelected = option.id === selectedId;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  disabled={option.disabled}
                  title={option.disabled ? option.disabledReason : undefined}
                  className={clsx(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                    option.disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer",
                  )}
                >
                  <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100 truncate">
                    {option.label}
                  </span>
                  {isSelected && (
                    <Check
                      className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModelSelector;

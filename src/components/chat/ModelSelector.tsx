// Composer model picker.
// Grouped dropdown: Premium (Coming Soon, disabled) · Default · Free.
// Mounts inside the chat composer's right cluster, anchored
// bottom-right of the trigger.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import {
  CHAT_MODELS,
  GROUP_LABELS,
  type ChatModelGroup,
  type ChatModelId,
  type ChatModelOption,
} from "./composerModels";

interface ModelSelectorProps {
  selectedId: ChatModelId;
  onSelect: (id: ChatModelId) => void;
  disabled?: boolean;
}

const GROUP_ORDER: ChatModelGroup[] = ["premium", "default", "free"];

export function ModelSelector({
  selectedId,
  onSelect,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => CHAT_MODELS.find((m) => m.id === selectedId) ?? CHAT_MODELS[0],
    [selectedId],
  );

  const grouped = useMemo(() => {
    const out: Record<ChatModelGroup, ChatModelOption[]> = {
      premium: [],
      default: [],
      free: [],
    };
    for (const m of CHAT_MODELS) out[m.group].push(m);
    return out;
  }, []);

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
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium transition-colors",
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
              "rounded-2xl border border-slate-200 dark:border-slate-700",
              "bg-white dark:bg-slate-900 shadow-lg p-1.5 origin-bottom-right",
            )}
          >
            {GROUP_ORDER.map((group, gi) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  {gi > 0 && (
                    <div
                      className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2"
                      aria-hidden
                    />
                  )}
                  <div
                    className={clsx(
                      "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider",
                      "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    {GROUP_LABELS[group]}
                  </div>
                  {group === "free" && (
                    <div
                      className="px-3 pb-1.5 -mt-1 text-[10px] leading-snug text-amber-700 dark:text-amber-400"
                      role="note"
                    >
                      Free models route your question through third-party providers — don't use for confidential or FOI material.
                    </div>
                  )}
                  {items.map((option) => {
                    const isSelected = option.id === selectedId;
                    const isFree = option.group === "free";
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
                          "w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-colors min-h-[44px]",
                          option.disabled
                            ? "cursor-not-allowed opacity-55"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer",
                        )}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {option.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {option.tagline}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          {option.disabled && (
                            <span className="px-2 py-[1px] rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Coming Soon
                            </span>
                          )}
                          {isFree && !option.disabled && (
                            <span className="px-2 py-[1px] rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                              FREE
                            </span>
                          )}
                          {isSelected && (
                            <Check
                              className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5"
                              aria-hidden
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModelSelector;

import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConfirmVariant } from '../table/types';

interface TextInputDialogProps {
  open: boolean;
  title: string;
  message?: string;
  /** Label above the input.*/
  inputLabel?: string;
  /** Placeholder shown in the input.*/
  placeholder?: string;
  /** Initial value for the input.*/
  defaultValue?: string;
  /** Validator returns null if valid, error string otherwise.*/
  validate?: (value: string) => string | null;
  /** Confirm button label. Defaults to "Confirm".*/
  confirmLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<
  ConfirmVariant,
  { bubbleBg: string; iconColor: string; button: string }
> = {
  danger: {
    bubbleBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    button: 'bg-rose-600 hover:bg-rose-700',
  },
  warning: {
    bubbleBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
  info: {
    bubbleBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    button: 'bg-sky-600 hover:bg-sky-700',
  },
  success: {
    bubbleBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-600 hover:bg-emerald-700',
  },
  default: {
    bubbleBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    button: 'bg-indigo-600 hover:bg-indigo-700',
  },
};

/**
 * Single-line text input dialog — replaces `window.prompt` calls
 * . Use for "what should I name this duplicate?" / "what
 * is the new ID?" style flows. For multi-line free text + reason
 * capture, use ReasonDialog instead.
 */
export function TextInputDialog({
  open,
  title,
  message,
  inputLabel = 'Value',
  placeholder = '',
  defaultValue = '',
  validate,
  confirmLabel = 'Confirm',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: TextInputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus-trap (WCAG 2.2 AA) — wraps Tab inside the dialog.
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const style = VARIANT_STYLES[variant];

  // Reset on open + autofocus.
  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, defaultValue]);

  // ESC to cancel, Enter to confirm.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  const trimmed = value.trim();
  const validationError = validate ? validate(trimmed) : null;
  const canConfirm = trimmed.length > 0 && !validationError;

  const handleConfirm = () => {
    if (!canConfirm) {
      setError(validationError ?? 'Required');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
        >
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-[min(440px,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start gap-3 px-5 py-4">
              <span
                className={clsx(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  style.bubbleBg,
                )}
              >
                <HelpCircle className={clsx('h-5 w-5', style.iconColor)} />
              </span>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  {title}
                </h2>
                {message && (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {message}
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 pb-2">
              <label className="font-mono block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {inputLabel}
              </label>
              <input
                ref={inputRef}
                type="text"
                className={clsx(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2',
                  error || validationError
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100',
                )}
                value={value}
                disabled={loading}
                placeholder={placeholder}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
              {(error || validationError) && (
                <p className="mt-1 text-[10px] font-semibold text-rose-600">
                  {error ?? validationError}
                </p>
              )}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-700 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || !canConfirm}
                className={clsx(
                  'inline-flex h-9 min-w-24 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  style.button,
                )}
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {confirmLabel}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

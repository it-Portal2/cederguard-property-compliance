import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConfirmVariant } from '../table/types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Label above the textarea. */
  reasonLabel?: string;
  /** Placeholder shown in the textarea. */
  reasonPlaceholder?: string;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
  variant?: ConfirmVariant;
  /** When true, an empty reason is accepted. Default: false (reason required). */
  reasonOptional?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<
  ConfirmVariant,
  { bubbleBg: string; iconColor: string; button: string; defaultIcon: any }
> = {
  danger: {
    bubbleBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    button: 'bg-rose-600 hover:bg-rose-700',
    defaultIcon: AlertTriangle,
  },
  warning: {
    bubbleBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700',
    defaultIcon: AlertTriangle,
  },
  info: {
    bubbleBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    button: 'bg-sky-600 hover:bg-sky-700',
    defaultIcon: HelpCircle,
  },
  success: {
    bubbleBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    defaultIcon: HelpCircle,
  },
  default: {
    bubbleBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    defaultIcon: HelpCircle,
  },
};

// Small composable confirm dialog with a required (or optional) textarea.
// Same visual language as `ConfirmDialog` — used where audit rules require
// a reason for the action (FP soft-delete, FP mark-as-decided outcome, etc.).
export function ReasonDialog({
  open,
  title,
  message,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Provide a short reason for the audit log…',
  confirmLabel = 'Confirm',
  variant = 'danger',
  reasonOptional = false,
  loading = false,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  // Focus-trap (WCAG 2.2 AA Success Criterion 2.4.3) — wraps Tab inside
  // the dialog, restores focus on close.
  const containerRef = useFocusTrap<HTMLDivElement>(open);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      return;
    }
    // Override useFocusTrap's default first-focusable target to land on
    // the textarea instead of the cancel button — the textarea is the
    // primary input the user will interact with.
    setTimeout(() => textareaRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!loading) onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, loading, onCancel]);

  const v = VARIANT_STYLES[variant];
  const Icon = v.defaultIcon;
  const trimmed = reason.trim();
  const canConfirm = reasonOptional || trimmed.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) onCancel();
          }}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reason-title"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-start gap-3 px-6 pt-6 pb-3">
              <div
                aria-hidden="true"
                className={clsx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  v.bubbleBg,
                )}
              >
                <Icon size={18} className={v.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="reason-title"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {message}
                </p>
              </div>
            </div>

            <div className="px-6 pb-2">
              <label className="font-mono block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {reasonLabel}
                {!reasonOptional && <span className="ml-1 text-rose-500">*</span>}
              </label>
              <textarea
                ref={textareaRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                disabled={loading}
                className="mt-1 block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-200 active:scale-95 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm(trimmed)}
                disabled={loading || !canConfirm}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
                  v.button,
                )}
              >
                {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

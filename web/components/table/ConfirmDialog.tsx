import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, HelpCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { ConfirmVariant } from './types';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: ConfirmVariant;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, {
  bubbleBg: string;
  iconColor: string;
  button: string;
  defaultIcon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
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
    defaultIcon: Info,
  },
  success: {
    bubbleBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    defaultIcon: CheckCircle2,
  },
  default: {
    bubbleBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    defaultIcon: HelpCircle,
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement;

    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) focusable[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (!loading) onCancel(); return; }

      if (e.key === 'Enter' && !loading) {
        const target = e.target as HTMLElement;
        const tag = target?.tagName;
        const isEditableField = tag === 'INPUT' || tag === 'TEXTAREA';
        if (!isEditableField) {
          e.preventDefault();
          onConfirm();
          return;
        }
      }

      if (e.key !== 'Tab' || !focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      (previousFocus.current as HTMLElement | null)?.focus();
    };
  }, [open, onCancel, onConfirm, loading]);

  const v = VARIANT_STYLES[variant];
  const Icon = icon ?? v.defaultIcon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4 flex items-start gap-3">
              <div
                aria-hidden="true"
                className={clsx(
                  'shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                  v.bubbleBg
                )}
              >
                <Icon size={18} className={v.iconColor} />
              </div>
              <div>
                <h3
                  id="confirm-title"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  {title}
                </h3>
                <p
                  id="confirm-message"
                  className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed"
                >
                  {message}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={clsx(
                  'px-4 py-2 text-xs font-medium rounded-lg text-white flex items-center gap-1.5 transition-all duration-150 active:scale-95 disabled:opacity-60',
                  v.button
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

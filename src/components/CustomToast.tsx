import { type Toast, toast } from 'react-hot-toast';
import { Check, X, Info } from 'lucide-react';
import { clsx } from 'clsx';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

const variantStyles: Record<ToastVariant, {
  bg: string;
  iconColor: string;
  progressBg: string;
  title: string;
  Icon: typeof Check;
}> = {
  success: {
    bg: 'bg-emerald-500',
    iconColor: 'text-emerald-500',
    progressBg: 'bg-emerald-200',
    title: 'Success!',
    Icon: Check,
  },
  error: {
    bg: 'bg-rose-500',
    iconColor: 'text-rose-500',
    progressBg: 'bg-rose-200',
    title: 'Error!',
    Icon: X,
  },
  info: {
    bg: 'bg-sky-500',
    iconColor: 'text-sky-500',
    progressBg: 'bg-sky-200',
    title: 'Info!',
    Icon: Info,
  },
  warning: {
    bg: 'bg-amber-500',
    iconColor: 'text-amber-500',
    progressBg: 'bg-amber-200',
    title: 'Warning!',
    Icon: Info,
  },
};

interface CustomToastProps {
  t: Toast;
  variant?: ToastVariant;
  /** Override message — used by `showInfo` / `showWarning` since `toast.custom`
   *  doesn't surface the message via `t.message`. For `toast.success` /
   *  `toast.error` (the render-prop path), `t.message` is used directly. */
  messageOverride?: React.ReactNode;
}

// Variant inference for the global render-prop path. `toast.success(...)` and
// `toast.error(...)` are the two react-hot-toast natives we'll see most often
// (382 call sites). `toast.custom(...)` ones pass their own variant explicitly
// via `showInfo` / `showWarning` below.
function inferVariant(t: Toast): ToastVariant {
  if (t.type === 'success') return 'success';
  if (t.type === 'error') return 'error';
  return 'info';
}

export function CustomToast({ t, variant, messageOverride }: CustomToastProps) {
  const v = variant ?? inferVariant(t);
  const style = variantStyles[v];
  const { Icon } = style;
  // react-hot-toast's `t.message` carries the string passed to toast.X(...).
  // `messageOverride` wins when the call came in through `showInfo` /
  // `showWarning` (those use `toast.custom` which doesn't populate t.message).
  const message =
    messageOverride ??
    (typeof t.message === 'string' ? t.message : (t.message as React.ReactNode));
  const durationMs = t.duration || 4000;

  return (
    <div
      className={clsx(
        'relative flex items-start gap-3 rounded-lg p-4 pr-3 pb-5 min-w-[320px] max-w-[420px] shadow-lg overflow-hidden',
        style.bg,
        t.visible ? 'animate-in fade-in slide-in-from-right-4 duration-200' : 'animate-out fade-out duration-150',
      )}
      role="status"
      aria-live="polite"
    >
      {/* Icon circle */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center">
        <Icon className={clsx('w-5 h-5', style.iconColor)} strokeWidth={3} />
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0 text-white">
        <p className="text-base font-bold leading-tight">{style.title}</p>
        {message && (
          <p className="text-sm text-white/90 leading-snug mt-0.5 break-words">{message}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => toast.dismiss(t.id)}
        className="shrink-0 text-white/80 hover:text-white p-1 -m-1 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" strokeWidth={3} />
      </button>

      {/* Progress bar — CSS animation tied to t.duration */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div
          className={clsx('h-full origin-left', style.progressBg)}
          style={{
            animation: `toast-progress ${durationMs}ms linear forwards`,
            animationPlayState: t.visible ? 'running' : 'paused',
          }}
        />
      </div>
    </div>
  );
}

// Convenience helpers for Info and Warning — react-hot-toast doesn't ship
// these. Existing toast.success / toast.error calls go through the global
// <Toaster> render-prop in App.tsx, so no migration needed for those.
export const showInfo = (message: string, duration = 4000) =>
  toast.custom((t) => <CustomToast t={t} variant="info" messageOverride={message} />, {
    duration,
    position: 'top-right',
  });

export const showWarning = (message: string, duration = 5000) =>
  toast.custom((t) => <CustomToast t={t} variant="warning" messageOverride={message} />, {
    duration,
    position: 'top-right',
  });

// Re-export so callers can pull everything from one place.
export { toast };

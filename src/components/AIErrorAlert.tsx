import React from 'react';
import { ShieldAlert, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { ApiError } from '../lib/api';

interface AIErrorAlertProps {
  error: string | ApiError | null;
  onRetry?: () => void;
  className?: string;
}

export const AIErrorAlert: React.FC<AIErrorAlertProps> = ({ error, onRetry, className }) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : (error?.message || 'Unknown error');
  const safeMessage = String(errorMessage).toLowerCase();
  const isRateLimit = typeof error !== 'string' && (error?.status === 429 || safeMessage.includes('quota') || safeMessage.includes('rate limit'));
  const retryAfter = typeof error !== 'string' ? error?.retryAfter : null;

  return (
    <div className={clsx(
      "bg-white border rounded-lg overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-4 duration-500",
      isRateLimit ? "border-amber-200" : "border-red-200",
      className
    )}>
      <div className={clsx(
        "px-6 py-4 flex items-center justify-between",
        isRateLimit ? "bg-amber-50" : "bg-red-50"
      )}>
        <div className="flex items-center gap-3">
          <div className={clsx(
            "p-2 rounded-lg",
            isRateLimit ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
          )}>
            {isRateLimit ? <Clock className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <h3 className={clsx(
              "font-black text-sm uppercase tracking-wider",
              isRateLimit ? "text-amber-900" : "text-red-900"
            )}>
              {isRateLimit ? "AI Engine Rate Limit" : "AI Analysis Error"}
            </h3>
            <p className={clsx(
              "text-[10px] font-bold uppercase tracking-tight opacity-70",
              isRateLimit ? "text-amber-700" : "text-red-700"
            )}>
              {isRateLimit ? "Quota Exceeded" : "Generation Failed"}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all",
              isRateLimit 
                ? "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200" 
                : "bg-red-600 text-white hover:bg-red-700 shadow-red-200",
              "shadow-lg active:scale-95"
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed font-medium">
          {errorMessage}
        </p>

        <div className={clsx(
          "p-4 rounded-lg border flex gap-4",
          isRateLimit ? "bg-amber-50/50 border-amber-100" : "bg-slate-50 border-slate-100"
        )}>
          <div className={clsx(
            "w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-sm",
            isRateLimit ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
          )}>
            !
          </div>
          <div className="space-y-1">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
              cedar Advisory
            </h4>
            <p className="text-xs text-slate-500 leading-tight">
              {isRateLimit 
                ? `High demand on the shared AI pool. Please wait ${retryAfter || '60'} seconds before your next request. For priority access, configure your own key.`
                : "The AI engine encountered an unexpected error. This usually resolves by retrying or refreshing the page."}
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-4">
          <a 
            href="/settings/profile" 
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-xs font-black uppercase tracking-widest transition-colors"
          >
            Go to Profile Settings
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

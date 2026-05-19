import React from 'react';
import { ScanSearch, Briefcase, Loader2, LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PremiumAIBannerProps {
  title: string;
  description: string;
  buttonText: string;
  onAction: () => void;
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
  badgeText?: string;
  className?: string;
  variant?: 'indigo' | 'slate' | 'emerald';
}

export function PremiumAIBanner({
  title,
  description,
  buttonText,
  onAction,
  isLoading = false,
  loadingText = "Processing Signals...",
  icon: Icon = Briefcase,
  badgeText = "Premium AI",
  className,
  variant = 'indigo'
}: PremiumAIBannerProps) {
  const variants = {
    indigo: "from-indigo-900 via-indigo-800 to-slate-900 shadow-indigo-200/20",
    slate: "from-slate-800 via-slate-900 to-black shadow-slate-900/20",
    emerald: "from-emerald-900 via-emerald-800 to-slate-900 shadow-emerald-200/20",
  };

  const accentColors = {
    indigo: "bg-indigo-500/10 group-hover:bg-indigo-500/20",
    slate: "bg-slate-500/10 group-hover:bg-slate-500/20",
    emerald: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg p-8 mb-8 border border-white/10 shadow-2xl transition-all duration-500 group",
      "bg-gradient-to-br",
      variants[variant],
      className
    )}>
      {/* Decorative Elements */}
      <div className={cn(
        "absolute top-0 right-0 w-80 h-80 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl transition-all duration-1000",
        accentColors[variant]
      )} />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
      
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            <ScanSearch className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
              {badgeText}
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight italic leading-tight">
              {title}
            </h2>
            <p className="text-white/70 text-sm md:text-base font-medium leading-relaxed max-w-xl">
              {description}
            </p>
          </div>
        </div>

        <button 
          onClick={onAction}
          disabled={isLoading}
          className={cn(
            "shrink-0 relative group/btn overflow-hidden px-10 py-5 rounded-lg font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl",
            isLoading 
              ? "bg-white/10 text-white/40 cursor-not-allowed" 
              : "bg-white text-indigo-950 hover:bg-slate-900 hover:text-white"
          )}
        >
          <div className="relative z-10 flex items-center gap-3">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{loadingText}</span>
              </>
            ) : (
              <>
                <Icon className={cn("w-4 h-4 transition-transform group-hover/btn:scale-110", !isLoading && "group-hover/btn:rotate-12")} />
                <span>{buttonText}</span>
              </>
            )}
          </div>
          {!isLoading && (
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
          )}
        </button>
      </div>
    </div>
  );
}

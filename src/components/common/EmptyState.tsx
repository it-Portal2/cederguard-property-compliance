import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: any;
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  className = '', 
  action,
  compact = false
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-4 px-2" : "py-12 px-4",
        className
      )}
    >
      <div className={clsx(
        "bg-slate-50 rounded-full flex items-center justify-center mb-4 relative",
        compact ? "w-10 h-10" : "w-16 h-16"
      )}>
        {Icon && <Icon className={clsx("text-slate-300", compact ? "w-5 h-5" : "w-8 h-8")} />}
        <div className="absolute inset-0 bg-slate-100 rounded-full animate-pulse -z-10 opacity-50" />
      </div>
      <h3 className={clsx(
        "font-mono font-semibold text-slate-900 uppercase tracking-wider ",
        compact ? "text-[10px] mb-0.5" : "text-sm mb-1"
      )}>
        {title}
      </h3>
      {description && (
        <p className={clsx(
          "text-slate-500 max-w-xs mx-auto leading-relaxed font-medium",
          compact ? "text-[8px]" : "text-xs"
        )}>
          {description}
        </p>
      )}
      {action && <div className={compact ? "mt-3" : "mt-6"}>{action}</div>}
    </motion.div>
  );
}

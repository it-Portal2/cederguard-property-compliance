import { motion } from 'motion/react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { BulkAction } from './types';

interface TableBulkBarProps<T> {
  selectedCount: number;
  actions: BulkAction<T>[];
  onAction: (action: BulkAction<T>) => void;
  onClear: () => void;
}

export default function TableBulkBar<T>({
  selectedCount,
  actions,
  onAction,
  onClear,
}: TableBulkBarProps<T>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-slate-900 dark:bg-slate-800 text-white px-8 py-4 rounded-lg shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl">
        <span className="text-[11px] font-semibold text-slate-300">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-white/20" />

        <div className="flex items-center gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => onAction(action)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-150 active:scale-95',
                  action.isDanger
                    ? 'bg-rose-600/80 hover:bg-rose-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                )}
              >
                {Icon && <Icon size={13} />}
                {action.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClear}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all duration-150"
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
}

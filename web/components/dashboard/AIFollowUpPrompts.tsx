import { MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';

const DEFAULT_PROMPTS = [
  'Which projects drive 80% of the risk?',
  'Draft a board update from this',
  'What changed since last week?',
  'Compare against Q1 baseline',
  'Show me regulatory exposure only',
  'Plan a 14-day verification sprint',
];

type Props = {
  prompts?: string[];
  onAsk: (prompt: string) => void;
  className?: string;
};

export function AIFollowUpPrompts({ prompts = DEFAULT_PROMPTS, onAsk, className }: Props) {
  return (
    <div className={clsx('pt-3 mt-3 border-t border-dashed border-slate-200', className)}>
      <div className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 mb-2">
        Continue the thread
      </div>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onAsk(p)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs text-slate-700 bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-slate-900 transition-colors"
          >
            <MessageSquare className="w-3 h-3 text-indigo-600" />
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

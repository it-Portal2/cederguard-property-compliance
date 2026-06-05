import React, { ReactNode } from 'react';
import { Info } from 'lucide-react';

export function InfoTooltip({ content }: { content: ReactNode }) {
  return (
    <div className="group relative inline-flex items-center justify-center ml-1.5 align-middle cursor-help">
      <Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none font-normal normal-case tracking-normal leading-relaxed text-left">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

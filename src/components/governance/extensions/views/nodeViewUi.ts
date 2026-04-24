// Shared Tailwind classes so every NodeView looks consistent inside the
// editor. Keep palette rules from plan §21: indigo / slate / emerald / amber /
// rose only; rounded-lg / rounded-xl only; no violet.

export const textInputCls =
  'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

export const inlineInputCls =
  'rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-slate-900 ' +
  'hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none ' +
  'focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed';

export const labelCellCls =
  'border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase ' +
  'tracking-wide text-slate-600 w-48';

export const valueCellCls =
  'border border-slate-200 px-2 py-1 text-sm text-slate-900 align-middle';

export const rowCardCls =
  'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2';

export const ghostBtnCls =
  'inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-slate-500 ' +
  'transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

export const dangerBtnCls =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 ' +
  'transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50';

export const addRowBtnCls =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 ' +
  'px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const sectionCaptionCls =
  'text-left text-xs font-semibold uppercase tracking-widest text-slate-400';

export const inputBase =
  'block w-full rounded-md border border-slate-300 bg-white px-3 h-10 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ' +
  'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ' +
  'transition-colors ' +
  'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:border-rose-500 aria-[invalid=true]:focus:ring-rose-500/30';

export const textareaBase =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 leading-relaxed ' +
  'placeholder:text-slate-400 min-h-[96px] resize-y ' +
  'focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ' +
  'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ' +
  'transition-colors ' +
  'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:border-rose-500 aria-[invalid=true]:focus:ring-rose-500/30';

export const selectBase =
  inputBase +
  ' appearance-none bg-no-repeat bg-[length:16px] bg-[right_0.75rem_center] pr-10' +
  " bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")]";

import { useState } from 'react'
import { ChevronDown, AlertCircle, Info } from 'lucide-react'
import { clsx } from 'clsx'

export interface ActionItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  category: 'Context Actions' | 'Data Tools'
  onClick: () => void | Promise<void>
}

interface PageActionsProps {
  items: ActionItem[]
  canManage: boolean
}

export default function PageActions({ items, canManage }: PageActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, ActionItem[]>)

  const handleItemClick = async (item: ActionItem) => {
    setIsOpen(false)
    const result = item.onClick()
    if (result && typeof (result as Promise<void>).then === 'function') {
      setIsLoading(true)
      try { await result } finally { setIsLoading(false) }
    }
  }

  if (!canManage) {
    return (
      <div className="flex h-9 items-center justify-center gap-2 px-4 bg-slate-50 border border-slate-200 rounded-lg w-full md:w-auto">
        <AlertCircle className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-500">Read-only</span>
      </div>
    )
  }

  return (
    <div className="relative w-full md:w-auto">
      <button
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        className={clsx(
          'flex h-9 items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold transition-colors w-full md:w-auto',
          isOpen ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700',
          isLoading && 'opacity-70 cursor-wait'
        )}
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        <span>{isLoading ? 'Exporting...' : 'Actions & options'}</span>
        {!isLoading && (
          <ChevronDown className={clsx('w-4 h-4 transition-transform duration-200 shrink-0', isOpen && 'rotate-180')} />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 md:left-auto md:right-0 mt-2 md:w-72 bg-white rounded-lg shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
              {Object.entries(grouped).map(([category, catItems], catIdx) => (
                <div key={category} className={clsx(catIdx !== 0 && 'mt-3 pt-3 border-t border-slate-100')}>
                  <div className="px-3 mb-1.5">
                    <p className="font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wide">{category}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-1 px-1">
                    {catItems.map((item, idx) => (
                      <button
                        key={idx}
                        disabled={isLoading}
                        onClick={() => handleItemClick(item)}
                        className="group flex items-start gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100 shrink-0">
                          <item.icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.label}</p>
                          <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">{item.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 px-3 pb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <Info className="w-3 h-3 shrink-0" />
                Requires PM/SRO permissions
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

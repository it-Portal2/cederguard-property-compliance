import { useState } from 'react';
import { ChevronDown, Database, FolderKanban, Layers, Trash2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { isSuperAdmin } from '../lib/roles';
import { isDemoId } from '../lib/demoMode';

// Admin-only "Load / Clear demo data" controls for the Dashboard header.
// Client-side only (localStorage, never the DB). "Demo loaded?" is derived from
// the active-context id so it re-renders via the normal store subscription.

interface DemoDataControlsProps {
  className?: string;
}

export default function DemoDataControls({ className }: DemoDataControlsProps) {
  const user = useStore((s) => s.user);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeProgrammeId = useStore((s) => s.activeProgrammeId);
  const loadDemoProgramme = useStore((s) => s.loadDemoProgramme);
  const loadDemoProject = useStore((s) => s.loadDemoProject);
  const clearDemo = useStore((s) => s.clearDemo);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const userRole = (user?.role || user?.profile?.role) as string | undefined;
  const canSeeControls = isSuperAdmin(user?.email, userRole);

  const demoActive = isDemoId(activeProjectId) || isDemoId(activeProgrammeId);

  if (!canSeeControls) return null;

  const handleLoad = (kind: 'programme' | 'project') => {
    setMenuOpen(false);
    if (kind === 'programme') loadDemoProgramme();
    else loadDemoProject();
  };

  const handleClear = async () => {
    setConfirmOpen(false);
    setClearing(true);
    try {
      await clearDemo();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {/* Load demo data — dropdown with two options */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className={clsx(
            'flex h-9 items-center justify-center gap-2 px-3 rounded-lg text-sm font-semibold transition-colors',
            menuOpen
              ? 'bg-slate-900 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-700',
          )}
          title="Load demonstration data (local only)"
        >
          <Database className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Load demo data</span>
          <ChevronDown
            className={clsx(
              'w-4 h-4 transition-transform duration-200 shrink-0',
              menuOpen && 'rotate-180',
            )}
          />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <div className="px-3 mb-1.5">
                <p className="font-mono text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                  Demo data · local only
                </p>
              </div>
              <div className="grid grid-cols-1 gap-1 px-1">
                <button
                  onClick={() => handleLoad('programme')}
                  className="group flex items-start gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left w-full"
                >
                  <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100 shrink-0">
                    <Layers className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Programme demo
                    </p>
                    <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">
                      A demo programme with child projects, risks &amp; compliance.
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleLoad('project')}
                  className="group flex items-start gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left w-full"
                >
                  <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100 shrink-0">
                    <FolderKanban className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Project demo
                    </p>
                    <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">
                      A standalone demo project with its own data.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Clear demo data — only while a demo is loaded */}
      {demoActive && (
        <div className="relative">
          <button
            onClick={() => setConfirmOpen((o) => !o)}
            disabled={clearing}
            className={clsx(
              'flex h-9 items-center justify-center gap-2 px-3 rounded-lg text-sm font-semibold transition-colors',
              'bg-white text-red-600 border border-red-200 hover:bg-red-50',
              clearing && 'opacity-70 cursor-wait',
            )}
            title="Clear demo data and restore your real data"
          >
            {clearing ? (
              <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Trash2 className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden sm:inline">{clearing ? 'Clearing…' : 'Clear demo data'}</span>
          </button>

          {confirmOpen && !clearing && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setConfirmOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-2xl border border-slate-100 p-3 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 p-1.5 bg-red-50 rounded-lg shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Clear demo data?</p>
                    <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">
                      Removes the demo overlay and restores your real data. Nothing is deleted from the database.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="px-3 h-8 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-3 h-8 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

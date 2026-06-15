import { useState } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { isSuperAdmin } from '../lib/roles';
import { isDemoId } from '../lib/demoMode';

// App-wide "viewing demo data" banner. Admin-only, shown only while a demo is
// loaded. "Exit demo" restores real data (clearDemo); the close (X) just hides
// the banner for the session (demo stays loaded).

export default function DemoModeBanner() {
  const user = useStore((s) => s.user);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeProgrammeId = useStore((s) => s.activeProgrammeId);
  const clearDemo = useStore((s) => s.clearDemo);
  const [exiting, setExiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const userRole = (user?.role || user?.profile?.role) as string | undefined;
  const canSee = isSuperAdmin(user?.email, userRole);
  const demoActive = isDemoId(activeProjectId) || isDemoId(activeProgrammeId);

  if (!canSee || !demoActive || dismissed) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      await clearDemo();
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="print:hidden relative flex items-center justify-center gap-3 px-4 py-2 pr-12 bg-amber-100 border-b border-amber-200 text-amber-900">
      <FlaskConical className="w-4 h-4 shrink-0" />
      <p className="text-sm font-medium text-center">
        <span className="font-mono uppercase tracking-wide text-[11px] font-semibold mr-2">
          Demo mode
        </span>
        <span className="hidden sm:inline">
          You're viewing demonstration data — nothing here is saved to the database.
        </span>
        <span className="sm:hidden">Viewing demo data.</span>
      </p>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-amber-900 text-amber-50 text-xs font-semibold hover:bg-amber-800 transition-colors disabled:opacity-70 disabled:cursor-wait shrink-0"
      >
        {exiting && (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {exiting ? 'Exiting…' : 'Exit demo'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Hide demo banner"
        title="Hide banner"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-amber-700 hover:bg-amber-200/70 hover:text-amber-900 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

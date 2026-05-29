import React, { useEffect, useState, useCallback } from 'react';
import { isDesktop } from '../../lib/desktop/isDesktop';

// PT-HealthBanner — non-blocking offline indicator.
//
// Fires a single POST to {apiBaseUrl}?action=ping on mount. If the server is
// reachable, this component renders nothing. If unreachable (network error,
// CORS rejection, 5xx), it shows a thin non-blocking banner at the top of
// the shell with a Retry button.
//
// We never block first paint waiting for this. The renderer always renders
// the wizard/auth/dashboard immediately; this banner is purely informational.
//
// Design source: research-confirmed pattern matching Slack's "you're offline"
// toast + the "render immediately, fail loud at action time" principle. None
// of VS Code / GitHub Desktop / Slack gate first paint on a backend ping.

type Status = 'idle' | 'ok' | 'down';

async function pingBackend(): Promise<boolean> {
  const cedar = (window as any).cedar;
  const apiBaseUrl =
    cedar?.apiBaseUrl ||
    (import.meta as any).env?.VITE_DESKTOP_API_URL ||
    'https://cedarguard.co.uk/api';
  try {
    const res = await fetch(`${apiBaseUrl}?action=ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' }),
    });
    // Treat anything <500 as "server reachable". 401/403 mean the server is
    // up, just doesn't have auth or the ping action isn't whitelisted —
    // either way, NOT an outage. Only 5xx / network errors mean we should
    // surface the offline banner. Older deployments without the pre-auth
    // ping bypass will return 401; that's fine — the rest of the app works.
    return res.status < 500;
  } catch {
    return false;
  }
}

export const HealthBanner: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const ok = await pingBackend();
    setStatus(ok ? 'ok' : 'down');
    setChecking(false);
  }, []);

  useEffect(() => {
    // Only run on desktop — web users have native browser offline indicators
    // and the relative /api path doesn't need a separate health check.
    if (!isDesktop) return;
    check();
    // Re-check when the browser reports connectivity changes back.
    const handler = () => check();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [check]);

  if (!isDesktop) return null;
  if (status !== 'down') return null;

  return (
    <div
      role="alert"
      className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-sm"
      style={{
        // `fixed` (not `sticky`) so the banner floats above the sidebar +
        // header chrome instead of getting trapped inside an inner scroll
        // container. z-index 9999 to beat any app-level z-indexed surface.
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <div className="flex items-center gap-2 text-red-800">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v3.5M8 11h.01" />
        </svg>
        <span>
          Can't reach the CedarGuard server. Some features may not work until
          the connection is restored.
        </span>
      </div>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="text-red-700 hover:text-red-900 font-medium underline-offset-2 hover:underline disabled:opacity-50"
      >
        {checking ? 'Checking…' : 'Retry'}
      </button>
    </div>
  );
};

export default HealthBanner;

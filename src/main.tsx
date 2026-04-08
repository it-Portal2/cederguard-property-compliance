import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
registerSW({ immediate: true });

// Crash recovery: catch any synchronous error during bootstrap
try {
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element not found');

  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e: any) {
  // Show a visible error instead of a blank white page
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="font-family:sans-serif;padding:40px;color:#1e293b;background:#f8fafc;min-height:100vh">
        <h1 style="color:#dc2626;font-size:24px;margin-bottom:16px"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:text-bottom;margin-right:8px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Application Error</h1>
        <p style="color:#475569;margin-bottom:12px">The app failed to start. Please contact support.</p>
        <pre style="background:#1e293b;color:#e2e8f0;padding:20px;border-radius:8px;font-size:12px;overflow:auto">${e?.message || String(e)}</pre>
      </div>`;
  }
  console.error('Bootstrap error:', e);
}

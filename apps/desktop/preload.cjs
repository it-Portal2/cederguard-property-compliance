// CedarGuard desktop preload.
//
// Exposes a narrow, typed IPC surface to the renderer via contextBridge.
// The renderer reads window.cedar.* to:
//   - detect desktop mode (isDesktop flag)
//   - detect dev vs prod (isDev flag) — set in main via app.isPackaged
//   - get the resolved API URL (apiBaseUrl) — set in main, no env juggling
//   - sign in / out (auth.*)
//   - read + write the encrypted setup config (config.*, setup.*)
//
// isDev + apiBaseUrl are passed from main via webPreferences.additionalArguments
// (parsed off process.argv below) — sandboxed preload can't import 'electron'
// freely to read `app.isPackaged` directly, so main is the source of truth.

const { contextBridge, ipcRenderer } = require('electron');

// ---------------------------------------------------------------------------
// Parse the cedar flags main wired into additionalArguments.
// ---------------------------------------------------------------------------
function findArg(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

const isDev = findArg('--cedar-is-dev=') === '1';
const apiBaseUrl = findArg('--cedar-api-base-url=') || '';

contextBridge.exposeInMainWorld('cedar', {
  isDesktop: true,
  isDev,
  apiBaseUrl,

  auth: {
    signInGoogle: () => ipcRenderer.invoke('auth:signInGoogle'),
    cancelSignIn: () => ipcRenderer.invoke('auth:cancelSignIn'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getIdToken: () => ipcRenderer.invoke('auth:getIdToken'),
    getAccount: () => ipcRenderer.invoke('auth:getAccount'),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (cfg) => ipcRenderer.invoke('config:set', cfg),
  },

  setup: {
    complete: (payload) => ipcRenderer.invoke('setup:complete', payload),
    // PT-Reset — also callable from a future renderer-side settings UI.
    // The menu item triggers the same handler directly in main.
    reset: () => ipcRenderer.invoke('setup:reset'),
  },

  // PT-Menu — let the renderer subscribe to menu-driven actions.
  // Currently used by the macOS app menu's "Sign Out" item — main pushes a
  // `menu:signOut` event and the renderer handler calls authBridge.signOut().
  menu: {
    onSignOut: (handler) => {
      const wrapped = () => handler();
      ipcRenderer.on('menu:signOut', wrapped);
      // Return an unsubscribe so React components can clean up on unmount.
      return () => ipcRenderer.removeListener('menu:signOut', wrapped);
    },
  },

  // PT-Logger — renderer-side hook into the main process electron-log file
  // sink. Use dot-notation event names + structured payload objects:
  //   window.cedar.log('info', 'auth.signin.start', { method: 'google' })
  log: (level, event, payload) =>
    ipcRenderer.invoke('log:write', level, event, payload),

  // PT-ErrorBoundary — diagnostics bundle (app version, runtime, OS,
  // last ~200 log lines) for the "Copy Diagnostics" button on the crash
  // fallback screen.
  diagnostics: {
    get: () => ipcRenderer.invoke('diagnostics:get'),
  },

  // PT-Updater — manual check + install hooks for a future Settings UI.
  // The menu's "Check for Updates" item triggers the main-side handler
  // directly (no renderer round-trip). These IPC handles are here for when
  // we add an in-app updates panel.
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
  },
});

// Boot-time flag so src/lib/desktop/isDesktop.ts can detect desktop mode
// synchronously, before window.cedar is accessed. (Kept for backward compat
// with the existing isDesktop helper — eventually consolidate into just
// reading `window.cedar`.)
contextBridge.exposeInMainWorld('__CEDAR_IS_DESKTOP__', true);

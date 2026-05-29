// CedarGuard desktop preload.
//
// Exposes a narrow, typed IPC surface to the renderer via contextBridge.
// The renderer reads window.cedar.* to:
//   - detect desktop mode (isDesktop flag — consumed by src/lib/desktop/isDesktop.ts)
//   - sign in / out (auth.*)
//   - read + write the encrypted setup config (config.*, setup.*)
//
// All channels currently route to stub handlers in main.cjs. Real behaviour
// lands in Tasks 8 (config) and 11 (auth).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cedar', {
  isDesktop: true,

  auth: {
    signInGoogle: () => ipcRenderer.invoke('auth:signInGoogle'),
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
  },
});

// Also expose a tiny boot-time flag on the global so src/lib/desktop/isDesktop.ts
// can detect desktop mode synchronously, before any IPC round-trip.
contextBridge.exposeInMainWorld('__CEDAR_IS_DESKTOP__', true);

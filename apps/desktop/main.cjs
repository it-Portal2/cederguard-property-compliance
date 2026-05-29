// Load env vars FIRST, before any module that reads process.env.
// Required because Vite only injects VITE_* vars into the renderer
// (import.meta.env), not into process.env for the Node main process.
//
// Two paths:
//   1. Packaged DMG → built-env.cjs (generated at build time by
//      scripts/buildDesktopEnv.cjs, baked into the asar).
//   2. Dev mode (electron:dev) → .env.local at the repo root (via dotenv).
//
// built-env.cjs is preferred when present so dev never accidentally diverges
// from the packaged build.
const path = require('path');
try {
  const builtEnv = require('./built-env.cjs');
  Object.assign(process.env, builtEnv);
} catch {
  const envPath = path.resolve(__dirname, '..', '..', '.env.local');
  require('dotenv').config({ path: envPath });
}

const { app, BrowserWindow, ipcMain } = require('electron');
const secureStore = require('./secureStore.cjs');
const googleOAuth = require('./googleOAuth.cjs');

// ---------------------------------------------------------------------------
// Single-instance lock — only one CedarGuard window allowed per user session.
// Prevents the OAuth flow (Task 11) from being confused by a second launch.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

app.on('second-instance', () => {
  // A duplicate launch arrived. Focus the existing window instead of
  // creating a new one.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.CEDAR_DEV === '1') {
    // Dev mode: point at the Vite dev server. HMR works inside Electron.
    // Triggered by `npm run electron:dev`.
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load the packaged renderer from dist/.
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    if (process.env.CEDAR_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------------------------------------------------------------------------
// IPC handler stubs.
//
// Each handler currently returns placeholder data. Real implementations land
// in later tasks:
//   - config:* + setup:complete → Task 8 (safeStorage wiring)
//   - auth:signInGoogle + auth:getIdToken + auth:* → Task 11 (real OAuth)
//
// The renderer-side typed wrappers live in:
//   - src/lib/auth/desktopIpcBridge.ts (Task 5)
//   - the preload below exposes them on window.cedar.*
// ---------------------------------------------------------------------------

ipcMain.handle('config:get', async () => {
  return secureStore.readConfig();
});

ipcMain.handle('config:set', async (_e, cfg) => {
  try {
    secureStore.writeConfig(cfg);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('setup:complete', async (_e, payload) => {
  // payload shape (Task 8): { backend: 'firebase' }
  // Future steps (M-Azure) will extend this with tenant/client IDs, etc.
  const existing = secureStore.readConfig() || {};
  const next = {
    ...existing,
    backend: payload && payload.backend ? payload.backend : 'firebase',
    setupCompletedAt: new Date().toISOString(),
  };
  try {
    secureStore.writeConfig(next);
    return { ok: true, config: next };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('auth:getAccount', async () => {
  return googleOAuth.getAccount();
});

ipcMain.handle('auth:getIdToken', async () => {
  return googleOAuth.getIdToken();
});

ipcMain.handle('auth:signInGoogle', async () => {
  try {
    const account = await googleOAuth.signInGoogle();
    return account;
  } catch (err) {
    // Surface a friendly error string back to the renderer rather than
    // throwing across the IPC boundary (which Electron stringifies awkwardly).
    return { error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('auth:signOut', async () => {
  await googleOAuth.signOut();
  return { ok: true };
});

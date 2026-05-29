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

const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');

// Silence Electron's noisy "Insecure CSP" warning in dev. The warning
// itself notes that it's dev-only and "will not show up once the app is
// packaged" — so there's nothing to fix, just dev console noise. We rely on
// contextIsolation:true + sandbox:true + nodeIntegration:false for real
// safety, not CSP-in-dev. Packaged builds get a stricter posture anyway.
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

const secureStore = require('./secureStore.cjs');
const googleOAuth = require('./googleOAuth.cjs');
const windowState = require('./windowState.cjs');
const logger = require('./logger.cjs');
logger.configure(); // wire renderer→main IPC bridge before any BrowserWindow exists
const updater = require('./updater.cjs');

// ---------------------------------------------------------------------------
// Compute isDev + apiBaseUrl ONCE in main, then pass to preload via
// additionalArguments. Renderer reads them off `window.cedar.{isDev,
// apiBaseUrl}` — no env-var juggling, no manual .env.local toggling.
//
// `app.isPackaged` is Electron's blessed signal for "running from `electron .`
// vs from a packaged .app bundle". `CEDAR_DEV=1` stays as a QA override so a
// packaged build can be pointed at localhost when debugging.
// ---------------------------------------------------------------------------
const isDev = !app.isPackaged || process.env.CEDAR_DEV === '1';
// API URL resolution in priority order:
//   1. CEDAR_DEV_API_URL — explicit override (set when running `vercel dev`
//      locally so the API call lands on http://localhost:3000/api).
//   2. VITE_DESKTOP_API_URL — baked-in production URL (built-env.cjs in
//      packaged builds; .env.local in dev).
//   3. Hardcoded fallback.
// Important: dev mode does NOT auto-point at localhost — Vite alone doesn't
// serve /api. Either run `vercel dev` + set CEDAR_DEV_API_URL, or rely on
// the production API (default).
const apiBaseUrl =
  process.env.CEDAR_DEV_API_URL ||
  process.env.VITE_DESKTOP_API_URL ||
  'https://cedarguard.co.uk/api';

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
  // PT-WindowState: restore saved size + position (multi-monitor safe).
  // First-launch returns defaults; subsequent launches restore last close.
  const bounds = windowState.getRestoredBounds();

  mainWindow = new BrowserWindow({
    ...bounds,
    // PT-FlashFix: hide the window until the renderer has painted at least
    // once, and paint the chrome with a dark backgroundColor so users never
    // see the default white flash. Direct from Electron BrowserWindow docs:
    // "showing the window after [ready-to-show] event will have no visual
    //  flash". Modern Electron apps don't ship splash windows.
    show: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Surface the resolved dev/prod facts to the sandboxed preload.
      // Preload parses these off process.argv and re-exposes via cedar.{}.
      additionalArguments: [
        `--cedar-is-dev=${isDev ? '1' : '0'}`,
        `--cedar-api-base-url=${apiBaseUrl}`,
      ],
    },
  });

  // Show the window only once the first frame is ready to render — kills
  // the white flash on cold start.
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // PT-WindowState: persist size/position on resize/move/close.
  windowState.track(mainWindow);

  // ─── Dev-against-production CORS enabling ────────────────────────────
  // INTENTIONAL ARCHITECTURE — not a workaround to clean up.
  //
  // CedarGuard desktop has three legitimate dev flows. This rewriter is the
  // enabling technology for the fastest of them:
  //
  //   electron:dev      → Vite (HMR) + production API.  Rewrite ACTIVE (this code).
  //                       Fastest inner loop with real Firestore data — no
  //                       vercel dev startup cost, no DMG rebuild cycle.
  //   electron:dev:full → vercel dev + local API.       Same-origin, NO rewrite needed.
  //                       Use when iterating on api/* routes alongside the UI.
  //   dev:install       → packaged binary + prod API via file://. NO rewrite needed
  //                       (file:// → Origin: null → already in prod allowlist).
  //
  // Why a header rewrite is the right tool for the first flow:
  // In `electron:dev` the renderer is served by Vite at http://localhost:3000,
  // so its Origin header is "http://localhost:3000". Production's CORS allow-
  // list includes cedarguard.co.uk + "null" but NOT localhost:3000 (and never
  // should — weakening prod CORS for dev convenience is a security smell).
  //
  // We can't simply rewrite the outgoing Origin — even if the server returns
  // a matching Access-Control-Allow-Origin, the browser does its OWN CORS
  // check against the renderer's actual page origin (http://localhost:3000),
  // which still wouldn't match. So we rewrite the RESPONSE's Access-Control-
  // Allow-Origin to mirror the renderer's origin, so the browser's preflight
  // passes. Auth (Firebase ID token in Bearer header) is the actual security
  // boundary — CORS is browser-side enforcement only and is irrelevant to
  // server-side authorization. Scoped to API requests + dev mode only.
  if (isDev) {
    try {
      const apiHost = new URL(apiBaseUrl).origin; // e.g. https://cedarguard.co.uk
      mainWindow.webContents.session.webRequest.onHeadersReceived(
        { urls: [`${apiHost}/*`] },
        (details, callback) => {
          const headers = { ...details.responseHeaders };
          // Strip server-sent ACAO/credentials (case-insensitive) before
          // setting our own — duplicate headers also fail the preflight.
          for (const key of Object.keys(headers)) {
            const lc = key.toLowerCase();
            if (
              lc === 'access-control-allow-origin' ||
              lc === 'access-control-allow-credentials'
            ) {
              delete headers[key];
            }
          }
          headers['Access-Control-Allow-Origin'] = ['http://localhost:3000'];
          headers['Access-Control-Allow-Credentials'] = ['true'];
          callback({ responseHeaders: headers });
        }
      );
    } catch (err) {
      console.warn('[dev-cors] Failed to install header rewriter:', err);
    }
  }

  if (isDev) {
    // Dev mode: point at the Vite dev server. HMR works inside Electron.
    // Triggered by `npm run electron:dev` (CEDAR_DEV=1) OR by running an
    // unpackaged build with `electron .`.
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

// ---------------------------------------------------------------------------
// PT-About — About panel options.
// app.showAboutPanel() is called from the menu (CedarGuard → About).
// On macOS this displays a native About window.
// ---------------------------------------------------------------------------
function configureAboutPanel() {
  app.setAboutPanelOptions({
    applicationName: 'CedarGuard',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: '© 2026 CedarGuard',
    website: 'https://cedarguard.co.uk',
    credits: 'Compliance + Risk for the Built Environment',
  });
}

// ---------------------------------------------------------------------------
// PT-Menu — Native macOS app menu.
//
// Replaces Electron's default menu with the standard macOS structure plus
// CedarGuard-specific items (Sign Out, Reset Desktop Setup, Check for Updates).
//
// Role-based items (undo/redo/cut/copy/paste, minimize/zoom/close, etc.) use
// Electron's built-in `role:` strings so OS keybindings + localization work
// automatically.
// ---------------------------------------------------------------------------
function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const appName = app.getName(); // matches package.json "name" / productName

  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    // ── App menu (macOS only — CedarGuard) ─────────────────────────────
    ...(isMac
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about', label: `About ${appName}` },
              { type: 'separator' },
              {
                label: 'Check for Updates…',
                click: async () => {
                  try {
                    await updater.checkNow();
                  } catch (err) {
                    logger.log('warn', 'update.check.error', {
                      stage: 'menu_manual',
                      message: err && err.message ? err.message : String(err),
                    });
                    dialog.showMessageBox(mainWindow || undefined, {
                      type: 'info',
                      title: 'Check for Updates',
                      message: 'No update available right now.',
                      detail:
                        'Either you\'re on the latest version, or the update ' +
                        'server is unreachable. Check ~/Library/Logs/CedarGuard/' +
                        'main.log for details.',
                    });
                  }
                },
              },
              { type: 'separator' },
              {
                label: 'Reset Desktop Setup…',
                click: async () => {
                  await handleResetDesktopSetup();
                },
              },
              {
                label: 'Sign Out',
                accelerator: 'Shift+Cmd+Q',
                click: () => {
                  // Tell the renderer to drive the sign-out flow (calls
                  // authBridge.signOut(), updates store, navigates).
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('menu:signOut');
                  }
                },
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide', label: `Hide ${appName}` },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: `Quit ${appName}` },
            ],
          },
        ]
      : []),

    // ── File ──────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },

    // ── Edit ──────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },

    // ── View ──────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        // Only expose DevTools in dev builds. Production users have no
        // reason to see this and accidentally opening it confuses people.
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // ── Window ────────────────────────────────────────────────────────
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : [{ role: 'close' }]),
      ],
    },

    // ── Help ──────────────────────────────────────────────────────────
    {
      role: 'help',
      submenu: [
        {
          label: 'CedarGuard Help',
          click: async () => {
            await shell.openExternal('https://cedarguard.co.uk/support');
          },
        },
        {
          label: 'Report an Issue',
          click: async () => {
            await shell.openExternal('https://cedarguard.co.uk/support');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ---------------------------------------------------------------------------
// PT-Reset — Reset Desktop Setup handler.
//
// Wipes the encrypted config + Firebase tokens, then relaunches the app so
// the user lands back on the first-run wizard with zero prior state.
// Triggered from the menu (CedarGuard → Reset Desktop Setup) AND available
// via the `setup:reset` IPC channel if the renderer ever wants to expose
// the same action in a settings UI.
// ---------------------------------------------------------------------------
async function handleResetDesktopSetup() {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const choice = await dialog.showMessageBox(win || undefined, {
    type: 'warning',
    buttons: ['Cancel', 'Reset and Relaunch'],
    defaultId: 0,
    cancelId: 0,
    title: 'Reset Desktop Setup',
    message: 'Reset CedarGuard Desktop?',
    detail:
      'This will sign you out, clear your stored backend choice, and ' +
      'relaunch the app into the first-run wizard. Your data on the ' +
      'CedarGuard server is not affected.',
  });
  if (choice.response !== 1) return;

  try {
    secureStore.clearConfig();
  } catch (err) {
    console.error('[reset] Failed to clear config:', err);
  }
  try {
    await googleOAuth.signOut(); // also revokes refresh token at Google
  } catch (err) {
    console.error('[reset] Failed to sign out:', err);
  }

  app.relaunch();
  app.exit(0);
}

app.whenReady().then(() => {
  logger.log('info', 'lifecycle.boot', {
    isDev,
    isPackaged: app.isPackaged,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  });
  configureAboutPanel();
  buildAppMenu();
  createWindow();

  // PT-Updater — dormant until the publish feed exists. Won't show user-
  // visible errors when the feed 404s; just logs warnings to the file sink.
  updater.configure({ logger, isDev, isPackaged: app.isPackaged });
  if (!isDev && app.isPackaged) {
    updater.startChecking();
  }
});

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

// PT-Cancel — let the renderer abort an in-flight Google OAuth flow.
// User clicks "Cancel" while the spinner is up on the auth screen.
ipcMain.handle('auth:cancelSignIn', async () => {
  googleOAuth.cancelSignIn();
  return { ok: true };
});

// PT-Updater — manual check + install IPC handlers. The dormant feed
// (https://cedarguard.co.uk/desktop-updates/) means these no-op silently
// today; once M-UpdateRelease publishes artifacts they activate.
ipcMain.handle('update:check', async () => {
  try {
    const result = await updater.checkNow();
    return { ok: true, updateAvailable: !!result?.updateInfo };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('update:install', async () => {
  updater.installNow();
  return { ok: true };
});

// PT-Reset — also expose Reset Desktop Setup via IPC. Triggered from the
// menu directly (see buildAppMenu) OR by the renderer if/when we add a
// "Reset" button to a future settings UI.
ipcMain.handle('setup:reset', async () => {
  await handleResetDesktopSetup();
  return { ok: true };
});

// PT-Logger — renderer logs flow through here into the same electron-log
// file sink (JSON-formatted). The preload bridge exposes this as
// `window.cedar.log(level, event, payload)`.
ipcMain.handle('log:write', async (_e, level, event, payload) => {
  logger.log(level, event, payload);
  return { ok: true };
});

// PT-ErrorBoundary — diagnostic bundle for the "Copy Diagnostics" button.
// Captures the bits a support engineer needs to triage a user-reported crash
// without asking for a screenshot.
ipcMain.handle('diagnostics:get', async () => {
  const os = require('os');
  let lastLogLines = '(log file unreadable)';
  try {
    const fs = require('fs');
    const logFile = require('path').join(app.getPath('logs'), 'main.log');
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      // Last ~200 lines is plenty of context for a support triage.
      const lines = content.split('\n');
      lastLogLines = lines.slice(Math.max(0, lines.length - 200)).join('\n');
    }
  } catch (err) {
    lastLogLines = `(log read failed: ${err && err.message ? err.message : String(err)})`;
  }
  return {
    app: {
      name: app.getName(),
      version: app.getVersion(),
      isDev,
      isPackaged: app.isPackaged,
    },
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    },
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      type: os.type(),
    },
    locale: app.getLocale(),
    timestamp: new Date().toISOString(),
    recentLogs: lastLogLines,
  };
});

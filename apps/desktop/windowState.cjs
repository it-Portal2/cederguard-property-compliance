// Inline window-state persistence for the CedarGuard desktop app.
//
// Reads + writes `{ x, y, width, height, isMaximized }` to
// `<userData>/window-state.json` so the window opens in the same place + size
// it was closed. Multi-monitor safe — falls back to defaults if the saved
// display is no longer attached.
//
// We deliberately don't depend on `electron-window-state` (last published
// 2017, ~40 LOC of behaviour we can own). Pattern direct from Electron
// BrowserWindow docs.

const { app, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const FILENAME = 'window-state.json';
const DEFAULTS = { width: 1400, height: 900 };

function statePath() {
  return path.join(app.getPath('userData'), FILENAME);
}

function readState() {
  const p = statePath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8').trim();
    if (!raw) return null; // empty file (interrupted write) → use defaults
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    console.warn('[windowState] state file unreadable, using defaults:', err && err.message ? err.message : err);
    // Best-effort: remove the corrupt file so the next session writes a fresh
    // one instead of failing again.
    try { fs.unlinkSync(p); } catch {}
    return null;
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state), { mode: 0o600 });
  } catch (err) {
    console.error('[windowState] Failed to write:', err);
  }
}

// Returns BrowserWindow constructor options that include restored position
// + size, falling back to defaults if no state or the saved display is gone.
function getRestoredBounds() {
  const saved = readState();
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULTS };
  }

  // Multi-monitor safety: drop saved x/y if they're outside any current
  // display's work area (monitor was unplugged). Keep size as a hint.
  const displays = screen.getAllDisplays();
  const inDisplay = displays.some((d) => {
    const { x, y, width, height } = d.workArea;
    return (
      typeof saved.x === 'number' &&
      typeof saved.y === 'number' &&
      saved.x >= x &&
      saved.y >= y &&
      saved.x + (saved.width || DEFAULTS.width) <= x + width &&
      saved.y + (saved.height || DEFAULTS.height) <= y + height
    );
  });

  return {
    width: Number.isFinite(saved.width) ? saved.width : DEFAULTS.width,
    height: Number.isFinite(saved.height) ? saved.height : DEFAULTS.height,
    ...(inDisplay
      ? { x: saved.x, y: saved.y }
      : {}), // let Electron centre the window on the current primary display
  };
}

// Attach save-on-change handlers to a BrowserWindow. Persists on close,
// resize, and move (debounced via the OS — close is the canonical save).
function track(win) {
  const persist = () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized() || win.isFullScreen()) return; // don't save odd states
    const [x, y] = win.getPosition();
    const [width, height] = win.getSize();
    writeState({ x, y, width, height, isMaximized: win.isMaximized() });
  };

  win.on('close', persist);
  win.on('resize', persist);
  win.on('move', persist);
}

module.exports = { getRestoredBounds, track };

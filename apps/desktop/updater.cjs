// electron-updater wrapper for CedarGuard desktop.
//
// Pinned to electron-updater >=6.3.x in package.json to escape CVE-2024-39698
// (Windows signature-bypass) and earlier signature-validation issues
// documented by Doyensec.
//
// Status today: DORMANT. The `publish` config in electron-builder.yml points
// at https://cedarguard.co.uk/desktop-updates/ which doesn't host the
// `latest-mac.yml` + DMG artifacts yet. autoUpdater will hit a 404 on every
// check and log a warning — silent, no user-visible error. A separate
// `M-UpdateRelease` milestone wires the feed (CI pushes artifacts after each
// signed release).
//
// Cadence: 10s after whenReady (so first-launch UX isn't blocked) + every 4
// hours (GitHub Desktop pattern, catches updates without requiring a relaunch
// for long-running sessions).
//
// Requires SIGNED BUILDS to actually deliver updates — electron-updater
// verifies the new artifact's signature against the running app's. Without
// PT-Sign activated, this stays dormant even if a feed is published.

const { autoUpdater } = require('electron-updater');

// Will be set by configure() so subsequent calls can route logs through the
// same electron-log file as everything else.
let _log = null;

const TEN_SECONDS = 10 * 1000;
const FOUR_HOURS = 4 * 60 * 60 * 1000;

function configure({ logger, isDev, isPackaged }) {
  _log = logger;

  // Hook electron-log into the updater. electron-updater accepts any logger
  // exposing .info/.warn/.error.
  if (logger && logger._electronLog) {
    autoUpdater.logger = logger._electronLog;
    // Default updater log level is 'info' — bump to 'debug' in dev only.
    if (isDev && autoUpdater.logger.transports?.file?.level) {
      autoUpdater.logger.transports.file.level = 'debug';
    }
  }

  // Don't auto-download in dev or unpackaged runs — there's no signed
  // artifact to apply, and the feed is dormant anyway.
  autoUpdater.autoDownload = !isDev && isPackaged;
  autoUpdater.autoInstallOnAppQuit = true;

  // Wire structured events so support sees update-cycle activity in the
  // log file alongside auth/api events.
  autoUpdater.on('checking-for-update', () => {
    if (_log) _log.log('debug', 'update.check.start', {});
  });
  autoUpdater.on('update-available', (info) => {
    if (_log) _log.log('info', 'update.check.available', { version: info?.version });
  });
  autoUpdater.on('update-not-available', () => {
    if (_log) _log.log('debug', 'update.check.none', {});
  });
  autoUpdater.on('error', (err) => {
    if (_log) _log.log('warn', 'update.check.error', { message: err && err.message ? err.message : String(err) });
  });
  autoUpdater.on('download-progress', (p) => {
    if (_log) _log.log('debug', 'update.download.progress', { percent: Math.round(p.percent), bytes: p.transferred });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (_log) _log.log('info', 'update.download.ready', { version: info?.version });
  });
}

function startChecking() {
  // 10s delay so first-launch UX never waits for a network round-trip.
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      if (_log) _log.log('warn', 'update.check.error', { stage: 'first', message: err?.message });
    });
  }, TEN_SECONDS);

  // Every 4h thereafter so long-running sessions catch updates.
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      if (_log) _log.log('warn', 'update.check.error', { stage: 'recurring', message: err?.message });
    });
  }, FOUR_HOURS);
}

function checkNow() {
  // Triggered from the menu's "Check for Updates" item. Always responsive
  // (no notification spam — uses the raw check, not checkForUpdatesAndNotify).
  return autoUpdater.checkForUpdates();
}

function installNow() {
  // Called from the renderer when the user clicks "Restart and install"
  // on the update-ready prompt. Quits + relaunches into the new version.
  autoUpdater.quitAndInstall();
}

module.exports = {
  configure,
  startChecking,
  checkNow,
  installNow,
};

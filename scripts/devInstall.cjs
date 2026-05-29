#!/usr/bin/env node
// Fast local install for the CedarGuard desktop app.
//
// Replaces the painful `npm run dist:mac → uninstall → drag DMG → reinstall →
// right-click → Open → re-sign-in` loop with a single command that takes
// ~30-40 seconds and preserves all user state (auth tokens, config).
//
// Why ~/Applications and not /Applications:
//   Apple TN2206 — rsyncing into /Applications.app trips Gatekeeper, can
//   reset TCC permissions on bundle-hash change, and LaunchServices caches
//   the original inode on macOS Sonoma+. ~/Applications is user-writable,
//   Finder treats it as first-class, no sudo, no LaunchServices fights.
//
// Why ad-hoc codesign:
//   After rsync, macOS sees a "new" bundle that needs at least an ad-hoc
//   signature to satisfy Gatekeeper. `codesign --sign -` is the special
//   "no identity" signer for local builds. Without it, the app may refuse
//   to launch on macOS 14+ with "code object is not signed at all".
//
// Two modes:
//   - default (`npm run dev:install`): full electron-builder --dir build.
//     Use after main-process changes, package.json changes, or first install.
//   - fast (`npm run dev:install:fast`): repacks only the asar.
//     Use after renderer-only changes (src/* edits). ~5-10s.

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

const FAST = process.argv.includes('--fast');
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_NAME = 'CedarGuard.app';
const DEST_DIR = path.join(os.homedir(), 'Applications');
const DEST_APP = path.join(DEST_DIR, APP_NAME);
const BUILD_OUTPUT_DIR = path.join(REPO_ROOT, 'dist-electron', 'mac-arm64');
const BUILT_APP = path.join(BUILD_OUTPUT_DIR, APP_NAME);

function log(msg) {
  process.stdout.write(`[dev:install${FAST ? ':fast' : ''}] ${msg}\n`);
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT, ...opts });
}

function ensureUserApplicationsDir() {
  if (!fs.existsSync(DEST_DIR)) {
    log(`Creating ${DEST_DIR}/`);
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }
}

function fullInstall() {
  log('1/5  Building renderer (vite)…');
  run('npm run build:desktop-web');

  log('2/5  Baking desktop env vars…');
  run('node scripts/buildDesktopEnv.cjs');

  log('3/5  Packaging .app via electron-builder --dir (no DMG)…');
  // --dir builds the unpacked .app bundle only — much faster than full DMG
  // packaging (~30s vs ~2min). Per electron-builder CLI docs: "useful to test."
  run('npx electron-builder --dir --mac --arm64');

  if (!fs.existsSync(BUILT_APP)) {
    throw new Error(`Expected built app at ${BUILT_APP} but it does not exist.`);
  }

  log(`4/5  Syncing to ${DEST_APP}…`);
  ensureUserApplicationsDir();
  // -a archive, --delete remove files no longer in source.
  // Trailing slash on source: copy contents into destination.
  run(`rsync -a --delete "${BUILT_APP}/" "${DEST_APP}/"`);

  log('5/5  Ad-hoc signing the installed bundle…');
  // `--sign -` is the special "no identity" signer for local builds.
  // Required so Gatekeeper accepts the rsync'd bundle on launch.
  run(`codesign --force --deep --sign - "${DEST_APP}"`);

  log('');
  log(`✓ Installed → ${DEST_APP}`);
  log('  Open with:  open "' + DEST_APP + '"');
}

function fastInstall() {
  if (!fs.existsSync(DEST_APP)) {
    log(`No existing install at ${DEST_APP}. Run "npm run dev:install" (full) first.`);
    process.exit(1);
  }

  log('1/4  Building renderer (vite)…');
  run('npm run build:desktop-web');

  log('2/4  Baking desktop env vars…');
  run('node scripts/buildDesktopEnv.cjs');

  log('3/4  Repacking asar in place…');
  // Pack only what would normally land in the asar (files: from electron-builder.yml):
  // dist/**, apps/desktop/**, package.json. We mimic that here.
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cedar-asar-'));
  try {
    fs.mkdirSync(path.join(stagingDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(stagingDir, 'apps', 'desktop'), { recursive: true });
    run(`rsync -a dist/ "${stagingDir}/dist/"`);
    run(`rsync -a apps/desktop/ "${stagingDir}/apps/desktop/"`);
    run(`cp package.json "${stagingDir}/package.json"`);

    const asarPath = path.join(DEST_APP, 'Contents', 'Resources', 'app.asar');
    run(`npx asar pack "${stagingDir}" "${asarPath}"`);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  log('4/4  Re-signing the bundle (ad-hoc)…');
  run(`codesign --force --deep --sign - "${DEST_APP}"`);

  log('');
  log(`✓ Updated → ${DEST_APP}`);
  log('  Quit + relaunch CedarGuard to see changes.');
}

function preflight() {
  if (process.platform !== 'darwin') {
    log('This script targets macOS. For other platforms use `npm run dist:mac` (or future Windows equivalent).');
    process.exit(1);
  }
  // Verify codesign is available (it ships with Xcode CLT, but check anyway).
  const check = spawnSync('which', ['codesign']);
  if (check.status !== 0) {
    log('`codesign` not found. Install Xcode Command Line Tools: xcode-select --install');
    process.exit(1);
  }
}

(function main() {
  preflight();
  const t0 = Date.now();
  if (FAST) fastInstall();
  else fullInstall();
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  log(`Done in ${seconds}s.`);
})();

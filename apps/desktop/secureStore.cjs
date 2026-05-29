// Encrypted local store for the CedarGuard desktop config.
//
// Uses Electron's safeStorage (Keychain on macOS, DPAPI on Windows,
// libsecret on Linux) to encrypt a small JSON blob to disk at
// `<userData>/config.bin`.
//
// Contents are intentionally tiny: { backend, setupCompletedAt, ... }.
// Auth tokens live in a separate file (`auth.bin`) written by Task 11's
// googleOAuth.cjs.

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = 'config.bin';

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function isEncryptionReady() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function readConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  try {
    const encrypted = fs.readFileSync(p);
    if (!isEncryptionReady()) {
      console.warn('safeStorage not available; cannot decrypt config.bin');
      return null;
    }
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json);
  } catch (err) {
    console.error('Failed to read encrypted config:', err);
    return null;
  }
}

function writeConfig(config) {
  if (!isEncryptionReady()) {
    throw new Error(
      'safeStorage not available on this platform — cannot persist config.'
    );
  }
  const json = JSON.stringify(config ?? {});
  const encrypted = safeStorage.encryptString(json);
  fs.writeFileSync(configPath(), encrypted, { mode: 0o600 });
}

function clearConfig() {
  const p = configPath();
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
    } catch (err) {
      console.error('Failed to clear config:', err);
    }
  }
}

module.exports = {
  readConfig,
  writeConfig,
  clearConfig,
  configPath,
  isEncryptionReady,
};

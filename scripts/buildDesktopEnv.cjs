#!/usr/bin/env node
// Build-time env baking for the Electron desktop binary.
//
// Reads .env.local at the repo root, extracts ONLY the env vars the desktop
// main process needs at runtime, and writes them to apps/desktop/built-env.cjs.
// That generated file is then included in the electron-builder asar, so the
// packaged binary has the env vars available without needing .env.local on
// the user's disk.
//
// Public-by-design values only — Firebase Web API key, Google Desktop Client
// ID/Secret, API URL. Per Google + Firebase docs, these are safe to embed in
// a desktop binary. Server-side secrets (FIREBASE_SERVICE_ACCOUNT,
// GEMINI_API_KEY, etc.) stay out of the binary.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(
    `[buildDesktopEnv] .env.local not found at ${envPath}.\n` +
      `Copy .env.example to .env.local and fill in the desktop vars before building the DMG.`
  );
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(envPath));

const desktopVars = {
  VITE_GOOGLE_DESKTOP_CLIENT_ID: env.VITE_GOOGLE_DESKTOP_CLIENT_ID || '',
  VITE_GOOGLE_DESKTOP_CLIENT_SECRET: env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || '',
  VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY || '',
  VITE_DESKTOP_API_URL: env.VITE_DESKTOP_API_URL || '',
};

// Sanity check — fail the build early if anything required is missing.
const missing = Object.entries(desktopVars)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  console.error(
    `[buildDesktopEnv] Missing required env vars in .env.local:\n` +
      missing.map((k) => `  - ${k}`).join('\n')
  );
  process.exit(1);
}

const outPath = path.resolve(__dirname, '..', 'apps', 'desktop', 'built-env.cjs');
const header = `// Auto-generated at build time by scripts/buildDesktopEnv.cjs.
// DO NOT EDIT — regenerated on every \`npm run dist:mac\`.
// Contains only public-by-design values per Google + Firebase docs.
`;
const body = `module.exports = ${JSON.stringify(desktopVars, null, 2)};\n`;
fs.writeFileSync(outPath, header + body);

console.log(`[buildDesktopEnv] Wrote ${Object.keys(desktopVars).length} env vars to ${outPath}`);

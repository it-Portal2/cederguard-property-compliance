// Google OAuth for the CedarGuard desktop app.
//
// Architecture (industry-standard, validated 2026-05-28 against
// RFC 8252, Google's native-app docs, and the AppAuth-JS Electron sample):
//
//   1. PKCE (S256) — desktop apps are public clients (no secret).
//   2. System browser via shell.openExternal — embedded webviews are unsafe
//      and prohibited by RFC 8252.
//   3. Loopback HTTP redirect (http://127.0.0.1:<ephemeral>/callback) —
//      Google explicitly recommends this for desktop. Avoids macOS open-url
//      cold-start race + cross-platform protocol-registration quirks.
//   4. Two-step token exchange: Google code → Google ID token, then
//      Google ID token → Firebase ID token via identitytoolkit signInWithIdp.
//
// REQUIRED before this flow can succeed:
//   - GCP Console: create a "Desktop app" OAuth client; copy Client ID into
//     VITE_GOOGLE_DESKTOP_CLIENT_ID env var.
//   - Firebase Console → Authentication → Sign-in method → Google →
//     "Whitelist client IDs from external projects" → paste the same
//     Desktop Client ID. Otherwise Firebase returns INVALID_IDP_RESPONSE.
//
// Token storage: Firebase idToken + refreshToken + account info encrypted
// to <userData>/auth.bin via Electron safeStorage (OS keychain).

const { shell, safeStorage, app } = require('electron');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config — read from env vars baked into the Electron build at package time
// or passed through electron:dev.
// ---------------------------------------------------------------------------

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_DESKTOP_CLIENT_ID || '';
// Google's modern Desktop OAuth clients DO require client_secret in the
// token-exchange request — even though Desktop clients are "public" and
// Google explicitly states the secret is embedded in the binary and is not
// treated as a real secret. Reference: Google's "OAuth 2.0 for Mobile &
// Desktop Apps" docs. The variable is named "secret" by convention but
// shipping it inside the binary is supported by Google for Desktop clients.
const GOOGLE_CLIENT_SECRET = process.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || '';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || '';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_SIGNIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`;
const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;

const SCOPES = ['openid', 'email', 'profile'];

const AUTH_FILENAME = 'auth.bin';

// ---------------------------------------------------------------------------
// Token storage (encrypted with safeStorage).
// ---------------------------------------------------------------------------

function tokensPath() {
  return path.join(app.getPath('userData'), AUTH_FILENAME);
}

function readTokens() {
  const p = tokensPath();
  if (!fs.existsSync(p)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = fs.readFileSync(p);
    return JSON.parse(safeStorage.decryptString(encrypted));
  } catch (err) {
    console.error('Failed to read auth tokens:', err);
    return null;
  }
}

function writeTokens(tokens) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage not available — cannot persist auth tokens.');
  }
  fs.writeFileSync(tokensPath(), safeStorage.encryptString(JSON.stringify(tokens)), {
    mode: 0o600,
  });
}

function clearTokens() {
  const p = tokensPath();
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
    } catch (err) {
      console.error('Failed to clear tokens:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// PKCE helpers.
// ---------------------------------------------------------------------------

function base64UrlEncode(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkce() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );
  return { verifier, challenge };
}

function randomState() {
  return base64UrlEncode(crypto.randomBytes(16));
}

// ---------------------------------------------------------------------------
// Tiny "you can close this tab" HTML response served by the loopback server.
// ---------------------------------------------------------------------------

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>CedarGuard — Sign-in complete</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background:#f8fafc; color:#1e293b;
         display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; }
  .card { background:white; border-radius:16px; padding:48px 56px; box-shadow:0 20px 60px rgba(0,0,0,.08);
          text-align:center; max-width:420px; }
  h1 { margin:0 0 12px; font-size:20px; font-weight:600; letter-spacing:-0.01em; }
  p  { margin:0; font-size:14px; color:#64748b; line-height:1.55; }
  .check { width:48px; height:48px; border-radius:50%; background:#10b981; color:white;
           display:inline-flex; align-items:center; justify-content:center; margin-bottom:20px;
           font-size:24px; font-weight:700; }
</style></head>
<body><div class="card">
  <div class="check">✓</div>
  <h1>You're signed in</h1>
  <p>You can close this tab and return to the CedarGuard app.</p>
</div></body></html>`;

const ERROR_HTML = (msg) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>CedarGuard — Sign-in error</title></head>
<body style="font-family:system-ui;padding:40px;background:#fff5f5;color:#7f1d1d">
  <h1 style="margin:0 0 12px;font-size:20px">Sign-in failed</h1>
  <p style="margin:0;font-size:14px">${msg}</p>
  <p style="margin-top:16px;font-size:13px;color:#64748b">Return to CedarGuard and try again.</p>
</body></html>`;

// ---------------------------------------------------------------------------
// Loopback server — listens on 127.0.0.1:0 (ephemeral port), captures the
// authorization code, and shuts down immediately. Single-shot, 5-minute
// timeout in case the user abandons the flow.
// ---------------------------------------------------------------------------

function startLoopback(expectedState) {
  return new Promise((outerResolve, outerReject) => {
    let codeResolve;
    let codeReject;
    const codePromise = new Promise((r, j) => {
      codeResolve = r;
      codeReject = j;
    });

    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        if (reqUrl.pathname !== '/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        const errorParam = reqUrl.searchParams.get('error');
        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');

        if (errorParam) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML(`Google reported: ${errorParam}`));
          codeReject(new Error(`Google OAuth error: ${errorParam}`));
          setImmediate(() => server.close());
          return;
        }
        if (!code || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML('State or code mismatch — possible CSRF.'));
          codeReject(new Error('OAuth state/code validation failed'));
          setImmediate(() => server.close());
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(SUCCESS_HTML);
        codeResolve(code);
        setImmediate(() => server.close());
      } catch (err) {
        try {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal error');
        } catch {}
        codeReject(err);
        setImmediate(() => server.close());
      }
    });

    server.on('error', (err) => outerReject(err));

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      outerResolve({ port, codePromise });
    });

    setTimeout(() => {
      codeReject(new Error('Sign-in timed out (5 minutes). Please try again.'));
      try {
        server.close();
      } catch {}
    }, 5 * 60 * 1000);
  });
}

// ---------------------------------------------------------------------------
// Main sign-in flow.
// ---------------------------------------------------------------------------

async function signInGoogle() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'VITE_GOOGLE_DESKTOP_CLIENT_ID is not configured. ' +
        'Create a Desktop OAuth client in Google Cloud Console and set the env var.'
    );
  }
  if (!FIREBASE_API_KEY) {
    throw new Error(
      'VITE_FIREBASE_API_KEY is not configured. Set the same key the web build uses.'
    );
  }
  if (!GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'VITE_GOOGLE_DESKTOP_CLIENT_SECRET is not configured. ' +
        'Copy the client secret shown when the Desktop OAuth client was ' +
        'created in Google Cloud Console (or click "Reset secret" on that ' +
        'client to view it again), and set the env var in .env.local.'
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = randomState();
  const { port, codePromise } = await startLoopback(state);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // 1. Open system browser to Google's OAuth consent screen.
  const authParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_account',
    access_type: 'offline',
  });
  await shell.openExternal(`${GOOGLE_AUTH_URL}?${authParams.toString()}`);

  // 2. Wait for the loopback server to capture the authorization code.
  const code = await codePromise;

  // 3. Exchange the code for Google tokens.
  const tokenBody = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${text}`);
  }
  const googleTokens = await tokenRes.json();
  if (!googleTokens.id_token) {
    throw new Error('Google token response missing id_token.');
  }

  // 4. Exchange Google ID token for Firebase ID token via signInWithIdp.
  const firebaseBody = {
    postBody: `id_token=${encodeURIComponent(googleTokens.id_token)}&providerId=google.com`,
    requestUri: 'http://127.0.0.1',
    returnSecureToken: true,
    returnIdpCredential: true,
  };
  const fbRes = await fetch(FIREBASE_SIGNIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firebaseBody),
  });
  if (!fbRes.ok) {
    const text = await fbRes.text();
    throw new Error(
      `Firebase signInWithIdp failed (${fbRes.status}): ${text}. ` +
        'Likely cause: the Google Desktop Client ID is not whitelisted in ' +
        'Firebase Console → Authentication → Sign-in method → Google → ' +
        '"Whitelist client IDs from external projects".'
    );
  }
  const fb = await fbRes.json();

  // 5. Persist tokens + account info.
  const account = {
    uid: fb.localId,
    email: fb.email ?? null,
    displayName: fb.displayName ?? null,
    photoURL: fb.photoUrl ?? null,
  };
  const tokens = {
    idToken: fb.idToken,
    refreshToken: fb.refreshToken,
    expiresAt: Date.now() + Number(fb.expiresIn || 3600) * 1000,
    account,
  };
  writeTokens(tokens);
  return account;
}

// ---------------------------------------------------------------------------
// getIdToken — returns a fresh Firebase ID token, refreshing if needed.
// ---------------------------------------------------------------------------

async function getIdToken() {
  const tokens = readTokens();
  if (!tokens) return null;

  // 5-minute safety buffer before actual expiry.
  if (tokens.expiresAt && tokens.expiresAt - Date.now() > 5 * 60 * 1000) {
    return tokens.idToken;
  }

  // Expired or near-expiry → refresh.
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    });
    const res = await fetch(FIREBASE_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      console.error('Token refresh failed:', res.status, await res.text());
      clearTokens();
      return null;
    }
    const refreshed = await res.json();
    const updated = {
      ...tokens,
      idToken: refreshed.id_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    };
    writeTokens(updated);
    return updated.idToken;
  } catch (err) {
    console.error('Token refresh threw:', err);
    return null;
  }
}

async function getAccount() {
  const tokens = readTokens();
  return tokens ? tokens.account : null;
}

async function signOut() {
  clearTokens();
}

module.exports = {
  signInGoogle,
  getIdToken,
  getAccount,
  signOut,
  // exposed for testing / future cleanup paths
  clearTokens,
};

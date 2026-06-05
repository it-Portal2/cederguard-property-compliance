// Desktop implementation of the auth bridge.
//
// Bridges to the Electron main process via the IPC surface exposed by
// apps/desktop/preload.cjs as window.cedar.auth.*. Main-process handlers
// currently return stubs (Task 1) — real OAuth lands in Task 11.
//
// Auth state is cached locally in the renderer so consumers can read it
// synchronously (getCurrentAccount). The cache is updated:
//   - on bootstrap (initial read from main process)
//   - whenever signInGoogle / signOut completes
//
// Listeners registered via onAuthChange are notified on cache mutations.

import type { Account, IAuthBridge } from './authBridge';

interface CedarBridge {
  auth: {
    signInGoogle: () => Promise<Account | { skipped: true } | null>;
    signOut: () => Promise<{ ok: true } | null>;
    getIdToken: () => Promise<string | null>;
    getAccount: () => Promise<Account | null>;
  };
}

function getCedar(): CedarBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as any).cedar ?? null;
}

let cachedAccount: Account | null = null;
const listeners = new Set<(a: Account | null) => void>();

// Defensive normaliser — accounts persisted by older builds (before the
// creationTime field existed) come back without it. Force the contract.
function normalize(raw: any): Account | null {
  if (!raw) return null;
  return {
    uid: raw.uid,
    email: raw.email ?? null,
    displayName: raw.displayName ?? null,
    photoURL: raw.photoURL ?? null,
    creationTime: raw.creationTime ?? null,
  };
}

function setAccount(next: Account | null) {
  cachedAccount = next;
  listeners.forEach((cb) => {
    try {
      cb(next);
    } catch (err) {
      // Listener exceptions must not break the bridge.
      console.error('authBridge listener threw:', err);
    }
  });
}

// Bootstrap — read initial state from the main process. This is async, but
// callers of getCurrentAccount() that fire before bootstrap completes will
// receive null and then learn about a real account through onAuthChange.
(async () => {
  const cedar = getCedar();
  if (!cedar) return;
  try {
    const account = normalize(await cedar.auth.getAccount());
    if (account) setAccount(account);
  } catch (err) {
    console.error('authBridge bootstrap failed:', err);
  }
})();

export const desktopIpcBridge: IAuthBridge = {
  getCurrentAccount() {
    return cachedAccount;
  },

  onAuthChange(callback) {
    listeners.add(callback);
    // Fire once with current state so subscribers always see the initial value.
    callback(cachedAccount);
    return () => {
      listeners.delete(callback);
    };
  },

  async getIdToken() {
    const cedar = getCedar();
    if (!cedar) return null;
    return cedar.auth.getIdToken();
  },

  async signInGoogle() {
    const cedar = getCedar();
    if (!cedar) throw new Error('Desktop IPC bridge not available');
    const result = (await cedar.auth.signInGoogle()) as any;

    // Main-process handler returns either an Account or { error: string }.
    if (!result) {
      throw new Error('Sign-in returned no result. Please try again.');
    }
    if (result.error) {
      throw new Error(result.error);
    }
    if (result.skipped) {
      throw new Error('Google sign-in is not yet implemented in this build');
    }
    const account = normalize(result);
    if (!account) throw new Error('Sign-in returned a malformed account');
    setAccount(account);
    return account;
  },

  async signOut() {
    const cedar = getCedar();
    if (!cedar) return;
    await cedar.auth.signOut();
    setAccount(null);
  },
};

// Platform-agnostic auth interface.
//
// The store (src/store/useStore.ts) and API client (src/lib/api.ts) consume
// this bridge instead of importing Firebase directly. Two implementations
// exist:
//   - firebaseWebBridge.ts — Firebase Web SDK (current web behaviour)
//   - desktopIpcBridge.ts  — IPC to Electron main process (OAuth via system browser)
//
// The bridge selected at module-load time is determined by isDesktop.

import { isDesktop } from '../desktop/isDesktop';
import { firebaseWebBridge } from './firebaseWebBridge';
import { desktopIpcBridge } from './desktopIpcBridge';

export interface Account {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface IAuthBridge {
  /** Synchronous read of the currently signed-in account, or null. */
  getCurrentAccount(): Account | null;

  /** Subscribe to auth-state changes. Returns an unsubscribe function. */
  onAuthChange(callback: (account: Account | null) => void): () => void;

  /** Returns a fresh Firebase ID token, or null if not signed in. */
  getIdToken(): Promise<string | null>;

  /** Sign in with Google. Web: popup. Desktop: system browser via main process. */
  signInGoogle(): Promise<Account>;

  /** Sign out and clear any cached tokens. */
  signOut(): Promise<void>;
}

export const authBridge: IAuthBridge = isDesktop
  ? desktopIpcBridge
  : firebaseWebBridge;

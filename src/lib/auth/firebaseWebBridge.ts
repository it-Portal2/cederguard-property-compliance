// Web implementation of the auth bridge — thin wrapper around Firebase Web SDK.
// Behaviour identical to what the codebase did before the bridge layer.

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import type { Account, IAuthBridge } from './authBridge';

function userToAccount(user: User | null): Account | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export const firebaseWebBridge: IAuthBridge = {
  getCurrentAccount() {
    return userToAccount(auth.currentUser);
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => callback(userToAccount(user)));
  },

  async getIdToken() {
    const u = auth.currentUser;
    if (!u) return null;
    return u.getIdToken();
  },

  async signInGoogle() {
    const result = await signInWithPopup(auth, googleProvider ?? new GoogleAuthProvider());
    const account = userToAccount(result.user);
    if (!account) throw new Error('Sign-in returned no user');
    return account;
  },

  async signOut() {
    await fbSignOut(auth);
  },
};

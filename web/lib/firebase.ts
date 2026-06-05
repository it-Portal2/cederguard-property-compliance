import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// Firebase config — values are public (client-side) and safe to commit.
// They can also be overridden via VITE_FIREBASE_* env vars during build.
const env = (import.meta as any).env || {};
const firebaseConfig = {
    apiKey: (env.VITE_FIREBASE_API_KEY ?? "").trim(),
    authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: (env.VITE_FIREBASE_PROJECT_ID ?? "").trim(),
    storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: (env.VITE_FIREBASE_APP_ID ?? "").trim()
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};

export const sendMagicLink = async (email: string) => {
    // Force the redirect URL to the authorized production domain to avoid whitelist errors
    // While allowing localhost for development
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const continueUrl = isLocal 
        ? window.location.origin + '/login'
        : 'https://cedarguard.co.uk/login';

    const actionCodeSettings = {
        url: continueUrl,
        handleCodeInApp: true,
    };
    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        // Note: localStorage is readable by any JS on the page (XSS risk). Acceptable here
        // because the value is only a non-secret email address used to pre-fill the sign-in form.
        window.localStorage.setItem('emailForSignIn', email);
    } catch (error) {
        console.error("Error sending magic link", error);
        throw error;
    }
};

export const confirmMagicLink = async (email: string, link: string) => {
    if (isSignInWithEmailLink(auth, link)) {
        try {
            const result = await signInWithEmailLink(auth, email, link);
            window.localStorage.removeItem('emailForSignIn');
            return result.user;
        } catch (error) {
             console.error("Error confirming magic link", error);
             throw error;
        }
    }
    throw new Error("Invalid magic link");
};

export const isMagicLink = (link: string) => isSignInWithEmailLink(auth, link);

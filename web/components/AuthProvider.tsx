import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { authBridge } from '../lib/auth/authBridge';
import { Loader2 } from 'lucide-react';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const setUser = useStore(state => state.setUser);
    const initStore = useStore(state => state.initStore);
    const isInitialized = useStore(state => state.isInitialized);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = authBridge.onAuthChange(async (account) => {
            if (account) {
                setUser(account);
                try {
                    await initStore();
                } catch (err) {
                    console.error('AuthProvider init error:', err);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [setUser, initStore]);

    // PT-Menu — wire the native macOS app menu's "Sign Out" item to our auth
    // bridge. The menu emits a 'menu:signOut' IPC event; the renderer calls
    // authBridge.signOut() which triggers the same onAuthChange path as the
    // user-clicked Sign Out button.
    useEffect(() => {
        const cedar = (window as any).cedar;
        if (!cedar?.menu?.onSignOut) return; // web build — nothing to wire
        const off = cedar.menu.onSignOut(async () => {
            try {
                await authBridge.signOut();
            } catch (err) {
                console.error('Menu Sign Out failed:', err);
            }
        });
        return () => { if (typeof off === 'function') off(); };
    }, []);

    // Show loading if we are still checking auth OR if we have a user but the store isn't ready yet
    if (loading || (useStore.getState().user && !isInitialized)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-sm text-slate-500 font-medium">Loading your workspace...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

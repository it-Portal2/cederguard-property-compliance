import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/auth/authBridge', () => ({
  authBridge: {
    getCurrentAccount: vi.fn(() => ({
      uid: 'user-1',
      email: 'new.user@example.com',
      displayName: null,
      photoURL: null,
      creationTime: '2026-07-02T00:00:00.000Z',
    })),
    onAuthChange: vi.fn(() => () => {}),
  },
}));

vi.mock('../lib/api', () => ({
  api: new Proxy(
    {
      getProfile: vi.fn(async () => ({
        success: true,
        profile: {
          email: 'new.user@example.com',
          role: 'viewer',
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      })),
    },
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        // Every other action call resolves to an empty success payload —
        // fetchProjects/fetchProgrammes/getPreferences etc. all tolerate this.
        return vi.fn(async () => ({}));
      },
    },
  ),
}));

import { useStore } from '../store/useStore';

describe('initStore — user.creationTime', () => {
  beforeEach(() => {
    useStore.setState({ isInitialized: false, user: null } as any);
  });

  it('carries creationTime from the auth account onto the store user, not just uid/email/photoURL/displayName', async () => {
    await useStore.getState().initStore();
    const { user } = useStore.getState();
    expect(user).toBeTruthy();
    // The Firestore profile never has this field (it stores `createdAt`,
    // a different key) — it must come from the Firebase Auth account.
    expect(user.creationTime).toBe('2026-07-02T00:00:00.000Z');
  });
});

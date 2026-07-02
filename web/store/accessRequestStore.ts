import { create } from "zustand";

const DISMISS_SUPPRESS_MS = 3000;

interface AccessRequestModalState {
  isOpen: boolean;
  attemptedAction: string | null;
  dismissedAt: number | null;
  open: (attemptedAction?: string) => void;
  close: () => void;
}

export const useAccessRequestStore = create<AccessRequestModalState>((set, get) => ({
  isOpen: false,
  attemptedAction: null,
  dismissedAt: null,
  open: (attemptedAction) => {
    // If the user just dismissed the modal, don't bounce it back open for a
    // slow overlapping request's 403 landing a moment later.
    const { dismissedAt } = get();
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_SUPPRESS_MS) return;
    set({ isOpen: true, attemptedAction: attemptedAction || null });
  },
  close: () => set({ isOpen: false, attemptedAction: null, dismissedAt: Date.now() }),
}));

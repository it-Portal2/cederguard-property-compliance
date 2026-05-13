import { create } from 'zustand';

// Programme Governance store — isolated Zustand slice.
// Kept separate from `src/store/useStore.ts` so governance surfaces never
// touch the existing mega-store and existing surfaces never see governance
// state. Populated phase by phase as each surface lands.

export interface GovernanceState {
  // Populated in later phases. Intentionally empty in (Foundation).
  _initialised: boolean;
  setInitialised: (v: boolean) => void;
}

export const useGovernanceStore = create<GovernanceState>((set) => ({
  _initialised: false,
  setInitialised: (v: boolean) => set({ _initialised: v }),
}));

import { create } from "zustand";
import type { Enquiry } from "../types/technicalAssurance";

// Technical Assurance Companion (TAC) store — isolated Zustand slice.
//
// Kept separate from `src/store/useStore.ts` and `src/store/governanceStore.ts`
// so TAC surfaces never touch existing state and the existing mega-store stays
// untouched (lesson §25 ADD-never-MODIFY).
//
// populated:
//   enquiriesCache: list cache for the EnquiriesListPage; used to give an
//   instant render after first load so subsequent refetches feel snappy.
//   `null` means "never loaded"; an empty array means "loaded, none exist".

export interface TechnicalAssuranceState {
  _initialised: boolean;
  setInitialised: (v: boolean) => void;

  enquiriesCache: Enquiry[] | null;
  enquiriesCacheTs: number | null;
  setEnquiries: (items: Enquiry[]) => void;
  clearEnquiries: () => void;

  // id of the enquiry currently being run through the AI insight
  // generator. Used by the list page to disable other row actions on the same
  // row + show the pulse/loading state on the "Generate insight" button.
  generatingId: string | null;
  setGeneratingId: (id: string | null) => void;
}

export const useTechnicalAssuranceStore = create<TechnicalAssuranceState>(
  (set) => ({
    _initialised: false,
    setInitialised: (v: boolean) => set({ _initialised: v }),

    enquiriesCache: null,
    enquiriesCacheTs: null,
    setEnquiries: (items: Enquiry[]) =>
      set({ enquiriesCache: items, enquiriesCacheTs: Date.now() }),
    clearEnquiries: () =>
      set({ enquiriesCache: null, enquiriesCacheTs: null }),

    generatingId: null,
    setGeneratingId: (id: string | null) => set({ generatingId: id }),
  }),
);

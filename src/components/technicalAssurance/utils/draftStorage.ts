// 24-hour localStorage draft buffer for the TAC New Enquiry modal.
//
// Per PRD US-1.1 acceptance criterion A1, an in-progress enquiry draft must
// survive a page reload for 24 hours. We persist the form state to
// `localStorage` keyed per-user so two PMs sharing a browser don't see each
// other's drafts.
//
// Stored shape is intentionally small (title + query + ribaStage). Files are
// NOT cached — they live on the server once uploaded, and the user re-attaches
// any pending uploads after refresh.

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface TacEnquiryDraft {
  enquiryId?: string | null; // populated once the draft is saved server-side
  title: string;
  query: string;
  ribaStage: string;
  projectId: string;
  savedAt: number;
}

function key(uid: string): string {
  return `tac.draft.enquiry.${uid}`;
}

export function loadDraft(uid: string): TacEnquiryDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TacEnquiryDraft;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(key(uid));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(uid: string, draft: Omit<TacEnquiryDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const next: TacEnquiryDraft = { ...draft, savedAt: Date.now() };
    window.localStorage.setItem(key(uid), JSON.stringify(next));
  } catch {
    // Disk-full / quota errors are non-fatal — the draft simply isn't
    // restored next reload. The user keeps editing in-memory.
  }
}

export function clearDraft(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(uid));
  } catch {
    // ignore
  }
}

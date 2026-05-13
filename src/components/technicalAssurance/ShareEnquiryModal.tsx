// Share-for-review modal.
//
// Owner picks a workspace member from the existing
// `governanceListWorkspaceMembers` endpoint (re-used cross-feature; same
// shape used for governance attendees / reviewers). Optional 500-char
// note explains what to review. On submit, posts to `tacShareEnquiry`.
//
// motion-driven custom modal, no native dialogs.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  Search,
  Send,
  X,
  Loader2,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

import { api } from "../../lib/api";

interface WorkspaceMember {
  uid: string;
  email: string;
  name?: string;
  role?: string;
  pmLevel?: string;
}

interface ShareEnquiryModalProps {
  open: boolean;
  enquiryId: string;
  enquiryTitle: string;
  /** uids that already have an active (undecided) share — disabled in the
   *  member list so the owner doesn't double-share.*/
  alreadySharedUids?: string[];
  /** Owner's own uid — hidden from the picker so they can't share with themselves.*/
  ownerUid: string;
  onClose: () => void;
  onShared: () => void;
}

function memberLabel(m: WorkspaceMember): string {
  if (m.name && m.name.trim()) return m.name.trim();
  if (m.email && m.email.includes("@")) {
    const local = m.email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return m.email || m.uid;
}

function memberInitials(m: WorkspaceMember): string {
  const label = memberLabel(m);
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  client_admin: "Programme Manager",
  project_manager: "Project Manager",
  super_admin: "Super Admin",
  admin: "Admin",
  strategic_director: "Strategic Director",
  viewer: "Viewer",
};

export function ShareEnquiryModal({
  open,
  enquiryId,
  enquiryTitle,
  alreadySharedUids = [],
  ownerUid,
  onClose,
  onShared,
}: ShareEnquiryModalProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [search, setSearch] = useState("");
  const [pickedUid, setPickedUid] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Focus-trap (WCAG 2.2 AA) — replaces the prior plain ref.
  const cardRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setPickedUid(null);
    setNote("");
    setError(null);
    let cancelled = false;
    setLoadingMembers(true);
    void (async () => {
      try {
        const r = await api.governanceListWorkspaceMembers();
        if (cancelled) return;
        const items: WorkspaceMember[] = Array.isArray(r?.items)
          ? r.items
          : [];
        setMembers(items.filter((m) => m.uid !== ownerUid));
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load workspace members");
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ownerUid]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const label = memberLabel(m).toLowerCase();
      const email = (m.email ?? "").toLowerCase();
      const role = (m.role ?? "").toLowerCase();
      return (
        label.includes(q) || email.includes(q) || role.includes(q)
      );
    });
  }, [members, search]);

  const submit = async () => {
    if (submitting) return;
    if (!pickedUid) {
      setError("Pick a workspace member to share with.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.tacShareEnquiry({
        enquiryId,
        sharedWithUid: pickedUid,
        note: note.trim() || undefined,
      });
      if (!r?.success) throw new Error(r?.error ?? "Share failed");
      toast.success("Enquiry shared for review");
      onShared();
    } catch (e: any) {
      setError(e?.message ?? "Failed to share enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
        >
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <h3
                    id="share-dialog-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    Share for review
                  </h3>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Pick a workspace member to review "{enquiryTitle}". They'll
                    see the full insight and can approve or reject with a note.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close share dialog"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label
                  htmlFor="share-search"
                  className="text-[11px] font-semibold uppercase tracking-widest text-slate-500"
                >
                  Workspace member
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    id="share-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, or role"
                    className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-[13px] focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {loadingMembers ? (
                    <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading workspace members…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[12px] text-slate-500">
                      No matching members in this workspace.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {filtered.map((m) => {
                        const isAlreadyShared = alreadySharedUids.includes(
                          m.uid,
                        );
                        const isPicked = pickedUid === m.uid;
                        return (
                          <li key={m.uid}>
                            <button
                              type="button"
                              onClick={() =>
                                isAlreadyShared
                                  ? null
                                  : setPickedUid(m.uid)
                              }
                              disabled={isAlreadyShared}
                              className={clsx(
                                "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                                isPicked
                                  ? "bg-indigo-50"
                                  : isAlreadyShared
                                    ? "cursor-not-allowed opacity-60"
                                    : "hover:bg-slate-50",
                              )}
                            >
                              <div
                                className={clsx(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                                  isPicked
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-100 text-slate-700",
                                )}
                              >
                                {memberInitials(m)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-semibold text-slate-900">
                                  {memberLabel(m)}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">
                                  {m.email}
                                  {m.role
                                    ? ` · ${ROLE_LABEL[m.role] ?? m.role}`
                                    : ""}
                                </div>
                              </div>
                              {isPicked ? (
                                <UserCheck className="h-4 w-4 shrink-0 text-indigo-600" />
                              ) : isAlreadyShared ? (
                                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Pending
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="share-note"
                  className="text-[11px] font-semibold uppercase tracking-widest text-slate-500"
                >
                  Note for the reviewer (optional)
                </label>
                <textarea
                  id="share-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="What would you like them to focus on?"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="mt-1 text-right text-[10px] text-slate-400">
                  {note.length}/500
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 text-[12px] text-rose-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !pickedUid || loadingMembers}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Share for review
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

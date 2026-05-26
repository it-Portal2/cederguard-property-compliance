// Thumbs-up / thumbs-down feedback control. PRD US-2.4.
//
// Inline thumbs pair on the Summary tab. Thumbs-up submits immediately
// (one click, no dialog). Thumbs-down opens a dialog with a categorised
// reason picker (inaccurate / missed_regulation / wrong_stage / other) +
// optional free-text note. Re-submitting overwrites prior feedback.
//
// Uses motion-driven custom modal (no native window.confirm — ).

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

import { api } from "../../lib/api";
import type {
  EnquiryFeedback,
} from "../../types/technicalAssurance";

interface FeedbackControlProps {
  enquiryId: string;
  feedback?: EnquiryFeedback;
  onSubmitted?: (feedback: EnquiryFeedback) => void;
}

const REASONS: Array<{
  key: NonNullable<EnquiryFeedback["reason"]>;
  label: string;
}> = [
  { key: "inaccurate", label: "Inaccurate or hallucinated content" },
  { key: "missed_regulation", label: "Missed an applicable regulation" },
  { key: "wrong_stage", label: "Wrong RIBA stage framing" },
  { key: "other", label: "Other (please describe below)" },
];

export function FeedbackControl({
  enquiryId,
  feedback,
  onSubmitted,
}: FeedbackControlProps) {
  const [submitting, setSubmitting] = useState<"up" | "down" | null>(null);
  const [downOpen, setDownOpen] = useState(false);

  const currentThumbs = feedback?.thumbs;

  const submitUp = async () => {
    if (submitting) return;
    setSubmitting("up");
    try {
      const r = await api.tacSubmitFeedback({ enquiryId, thumbs: "up" });
      if (!r?.success) throw new Error(r?.error ?? "Feedback failed");
      toast.success("Thanks for the feedback");
      onSubmitted?.(r.feedback as EnquiryFeedback);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit feedback");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-xs">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Helpful?
        </span>
        <button
          type="button"
          onClick={submitUp}
          disabled={!!submitting}
          aria-label="Mark insight as helpful"
          aria-pressed={currentThumbs === "up"}
          className={clsx(
            "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            currentThumbs === "up"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:bg-slate-100 hover:text-emerald-700",
            submitting && "cursor-not-allowed opacity-60",
          )}
        >
          {submitting === "up" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : currentThumbs === "up" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setDownOpen(true)}
          disabled={!!submitting}
          aria-label="Mark insight as not helpful"
          aria-pressed={currentThumbs === "down"}
          className={clsx(
            "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            currentThumbs === "down"
              ? "bg-rose-50 text-rose-700"
              : "text-slate-500 hover:bg-slate-100 hover:text-rose-700",
            submitting && "cursor-not-allowed opacity-60",
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <FeedbackDownDialog
        open={downOpen}
        enquiryId={enquiryId}
        onClose={() => setDownOpen(false)}
        onSubmitted={(fb) => {
          setDownOpen(false);
          onSubmitted?.(fb);
        }}
      />
    </>
  );
}

interface FeedbackDownDialogProps {
  open: boolean;
  enquiryId: string;
  onClose: () => void;
  onSubmitted: (fb: EnquiryFeedback) => void;
}

function FeedbackDownDialog({
  open,
  enquiryId,
  onClose,
  onSubmitted,
}: FeedbackDownDialogProps) {
  const [reason, setReason] = useState<EnquiryFeedback["reason"] | undefined>(
    undefined,
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Focus-trap (WCAG 2.2 AA) — replaces the prior plain ref.
  const cardRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (open) {
      setReason(undefined);
      setNote("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await api.tacSubmitFeedback({
        enquiryId,
        thumbs: "down",
        reason,
        note: note.trim() || undefined,
      });
      if (!r?.success) throw new Error(r?.error ?? "Feedback failed");
      toast.success("Thanks — feedback captured");
      onSubmitted(r.feedback as EnquiryFeedback);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit feedback");
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
          aria-labelledby="feedback-dialog-title"
        >
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-slate-200">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <ThumbsDown className="h-4 w-4" />
                </div>
                <div>
                  <h3
                    id="feedback-dialog-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    What went wrong?
                  </h3>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Your feedback helps the Compliance Lead audit AI quality.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close feedback dialog"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <fieldset>
                <legend className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Reason (optional)
                </legend>
                <ul className="mt-2 space-y-1.5">
                  {REASONS.map((r) => (
                    <li key={r.key}>
                      <label className="flex items-start gap-2 cursor-pointer rounded-md p-2 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="feedback-reason"
                          value={r.key}
                          checked={reason === r.key}
                          onChange={() => setReason(r.key)}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <span className="text-[13px] text-slate-700">
                          {r.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <div>
                <label
                  htmlFor="feedback-note"
                  className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Note (optional)
                </label>
                <textarea
                  id="feedback-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="What was inaccurate or missing?"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="mt-1 text-right text-[10px] text-slate-400">
                  {note.length}/800
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 rounded-b-lg">
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
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Submit feedback
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Copy, Check, Mail, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { clsx } from "clsx";

import type {
  Enquiry,
  DrawingTabContent,
} from "../../types/technicalAssurance";

// Phase 4 — "Send to architect" modal. Q16 = D locks no SMTP infra in v1,
// so the user gets a pre-filled email body they can copy + a `mailto:` link
// that opens their default mail client. The marked-up PDF (Phase 4b) will
// be attached client-side; for now the email references the source drawing
// and the AI-derived annotation list verbatim.

interface SendToArchitectModalProps {
  isOpen: boolean;
  enquiry: Enquiry;
  drawing: DrawingTabContent;
  onClose: () => void;
}

function buildEmailBody(args: {
  enquiry: Enquiry;
  drawing: DrawingTabContent;
}): { subject: string; body: string } {
  const { enquiry, drawing } = args;
  const subject = `RFI follow-up — ${enquiry.title}`;
  const callouts = drawing.annotations
    .map(
      (a) =>
        `${a.number}. ${a.label}${
          a.dimension ? ` (${a.dimension})` : ""
        } — page ${a.page}${a.note ? `: ${a.note}` : ""}`,
    )
    .join("\n");
  const body = `Hi,

I'd like your input on a technical query against ${enquiry.title}.

Source drawing: ${drawing.basePdfFileName ?? "(see attached PDF)"}
RIBA stage: ${enquiry.ribaStage}

${drawing.summaryNote ?? "Annotations identified by our technical assurance review:"}

${callouts}

Please review the marked-up drawing and confirm the appropriate course. The original PDF is attached for reference.

Thanks,
${enquiry.ownerUid ? "(your name)" : "(your name)"}`;
  return { subject, body };
}

export function SendToArchitectModal({
  isOpen,
  enquiry,
  drawing,
  onClose,
}: SendToArchitectModalProps) {
  const initial = useMemo(
    () => buildEmailBody({ enquiry, drawing }),
    [enquiry, drawing],
  );
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  // Re-seed the form whenever the modal opens with a fresh enquiry.
  useEffect(() => {
    if (!isOpen) return;
    setSubject(initial.subject);
    setBody(initial.body);
    setCopied(null);
  }, [isOpen, initial.subject, initial.body]);

  // ESC key dismisses.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = async (kind: "subject" | "body") => {
    try {
      await navigator.clipboard.writeText(kind === "subject" ? subject : body);
      setCopied(kind);
      toast.success(`${kind === "subject" ? "Subject" : "Body"} copied`);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Couldn't copy — try selecting the text manually.");
    }
  };

  const openMailClient = () => {
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", body);
    const href = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
    // The replace removes the encoded "+" → " " URLSearchParams quirk so the
    // mail client gets a normal-looking subject. Body keeps line breaks via
    // the encoded %0A.
    window.location.href = href.replace(/\+/g, "%20");
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tac-architect-title"
      >
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 220, damping: 25 }}
          className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Mail className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Technical Assurance
                </p>
                <h2
                  id="tac-architect-title"
                  className="text-lg font-bold tracking-tight text-slate-900"
                >
                  Send to architect
                </h2>
              </div>
            </div>
            <button
              type="button"
              className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              <strong>No mail server configured in v1.</strong> Copy the
              subject + body, attach the source PDF, and send from your
              default mail client.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                To
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="architect@example.com"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span>Subject</span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard("subject")}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    copied === "subject"
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                  )}
                >
                  {copied === "subject" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied === "subject" ? "Copied" : "Copy"}
                </button>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span>Body</span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard("body")}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    copied === "body"
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                  )}
                >
                  {copied === "body" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied === "body" ? "Copied" : "Copy"}
                </button>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {drawing.basePdfFileName && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-600">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                Attach manually:{" "}
                <strong className="text-slate-800">
                  {drawing.basePdfFileName}
                </strong>
                {drawing.basePdfUrl && (
                  <a
                    href={drawing.basePdfUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    download={drawing.basePdfFileName}
                    className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50"
                  >
                    Download
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Footer — stacks on small widths so the action buttons never
              squeeze the helper text or wrap mid-label. */}
          <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden text-[11px] leading-snug text-slate-400 sm:block sm:max-w-[55%]">
              Edits stay on this device — the message is not stored on
              CedarGuard.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={openMailClient}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Mail className="h-4 w-4 shrink-0" />
                Open in mail client
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

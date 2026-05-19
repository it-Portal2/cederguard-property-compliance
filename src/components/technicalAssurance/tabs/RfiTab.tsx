import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ClipboardList,
  Save,
  Send,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  PlayCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { clsx } from "clsx";

import { api } from "../../../lib/api";
import type {
  Enquiry,
  RfiTabContent,
  RfiPriority,
  RfiRecipient,
} from "../../../types/technicalAssurance";

// RFI / instruction tab. AI auto-populates subject + body +
// priority + walkthrough chapters; user adds recipients and tweaks copy
// before clicking Issue. Issued RFIs are immutable here and live in the
// workspace-wide RFI register (see RfiRegisterPage).
//
// walkthroughChapters is a TEXT-ONLY install/inspection
// stepper. No video player. Site teams read the captions on a phone.

const PRIORITY_OPTIONS: Array<{ value: RfiPriority; label: string; pill: string }> = [
  {
    value: "high",
    label: "High",
    pill: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  {
    value: "medium",
    label: "Medium",
    pill: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  {
    value: "low",
    label: "Low",
    pill: "bg-slate-100 text-slate-700 border border-slate-200",
  },
];

interface RfiTabProps {
  enquiry: Enquiry;
  rfi: RfiTabContent;
  onIssued: (rfi: RfiTabContent) => void;
}

export function RfiTab({ enquiry, rfi, onIssued }: RfiTabProps) {
  const isIssued = rfi.status !== "Draft";

  const [subject, setSubject] = useState(rfi.subject);
  const [body, setBody] = useState(rfi.body);
  const [priority, setPriority] = useState<RfiPriority>(rfi.priority);
  const [recipients, setRecipients] = useState<RfiRecipient[]>(
    rfi.recipients ?? [],
  );
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientNameInput, setRecipientNameInput] = useState("");
  const [recipientRoleInput, setRecipientRoleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const initialRef = useRef({ subject: rfi.subject, body: rfi.body, priority: rfi.priority, recipients: rfi.recipients ?? [] });

  // Re-seed on prop change.
  useEffect(() => {
    setSubject(rfi.subject);
    setBody(rfi.body);
    setPriority(rfi.priority);
    setRecipients(rfi.recipients ?? []);
    initialRef.current = {
      subject: rfi.subject,
      body: rfi.body,
      priority: rfi.priority,
      recipients: rfi.recipients ?? [],
    };
  }, [rfi]);

  const isDirty = useMemo(
    () =>
      subject !== initialRef.current.subject ||
      body !== initialRef.current.body ||
      priority !== initialRef.current.priority ||
      JSON.stringify(recipients) !==
        JSON.stringify(initialRef.current.recipients),
    [subject, body, priority, recipients],
  );

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!/^.+@.+\..+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (recipients.some((r) => r.email === email)) {
      toast.error("That recipient is already on the list.");
      return;
    }
    const nextRecipient: RfiRecipient = {
      email,
      name: recipientNameInput.trim() || undefined,
      role: recipientRoleInput.trim() || undefined,
    };
    setRecipients((prev) => [...prev, nextRecipient]);
    setRecipientInput("");
    setRecipientNameInput("");
    setRecipientRoleInput("");
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  const handleSave = async () => {
    if (isIssued) return;
    if (!subject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!body.trim() || body.trim().length < 60) {
      toast.error("Body must be at least 60 characters.");
      return;
    }
    try {
      setSaving(true);
      await api.tacUpsertRfiDraft(enquiry.id, {
        subject: subject.trim(),
        body: body.trim(),
        priority,
        recipients,
      });
      initialRef.current = { subject, body, priority, recipients };
      toast.success("Draft saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleIssue = async () => {
    if (isIssued || issuing) return;
    if (!subject.trim() || !body.trim() || recipients.length === 0) {
      toast.error("Subject, body, and at least one recipient are required.");
      return;
    }
    // Spinner flips on immediately so the button stops looking idle while
    // the conditional save-draft round-trip runs. Was previously firing
    // only after save-draft completed → noticeable click-then-nothing lag.
    setIssuing(true);
    try {
      if (isDirty) {
        await api.tacUpsertRfiDraft(enquiry.id, {
          subject: subject.trim(),
          body: body.trim(),
          priority,
          recipients,
        });
        initialRef.current = { subject, body, priority, recipients };
      }
      const res = await api.tacIssueRfi(enquiry.id);
      if (!res?.success) {
        throw new Error(res?.error ?? "Issue failed.");
      }
      toast.success(`RFI issued · ${res.rfiNumber}`);
      onIssued(res.content as RfiTabContent);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to issue RFI.");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header*/}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ClipboardList className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Request for information
            </p>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {isIssued
                ? `Issued · ${rfi.rfiNumber}`
                : "Draft RFI auto-populated by AI"}
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {isIssued
                ? `Issued ${rfi.issuedAt ? new Date(rfi.issuedAt).toLocaleString("en-GB") : "—"}. Edits are now locked — see the RFI register.`
                : "Edit the draft below, add recipients, then click Issue to commit a numbered RFI to the workspace register."}
            </p>
          </div>
        </div>
        {isIssued && (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            {rfi.status}
          </span>
        )}
      </div>

      {/* Form / read-only display*/}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {/* Subject*/}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isIssued}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>

          {/* Body*/}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Body
              </label>
              <p className="text-[11px] text-slate-400">
                {body.length} chars · min 60
              </p>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isIssued}
              rows={10}
              maxLength={8000}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-700"
            />
          </div>

          {/* Walkthrough chapters (text-only — )*/}
          {rfi.walkthroughChapters && rfi.walkthroughChapters.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-indigo-600" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Install walkthrough
                </p>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Numbered install / inspection steps for the site team to
                follow. Read on a phone — no video player.
              </p>
              <ol className="mt-3 space-y-3">
                {rfi.walkthroughChapters.map((ch) => (
                  <li
                    key={ch.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                        {ch.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {ch.caption}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                          {ch.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Right column — priority + recipients*/}
        <div className="space-y-4 lg:col-span-4">
          {/* Priority*/}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Priority
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  disabled={isIssued}
                  className={clsx(
                    "rounded-lg border px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    priority === p.value
                      ? p.pill
                      : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients*/}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {isIssued ? "Sent to" : "Recipients"}
              </p>
              {isIssued && recipients.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-500">
                  {recipients.length} recipient
                  {recipients.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {isIssued && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] leading-relaxed text-emerald-800">
                <strong>This RFI is locked.</strong> The recipient list below
                shows who it was sent to
                {rfi.issuedAt
                  ? ` on ${new Date(rfi.issuedAt).toLocaleString("en-GB")}`
                  : ""}
                . Read-only — edits aren't possible after issue.
              </div>
            )}
            {recipients.length === 0 ? (
              <p className="mt-2 text-[12px] text-slate-400">
                Add at least one recipient before issuing.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {recipients.map((r) => (
                  <li
                    key={r.email}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {r.name ?? r.email.split("@")[0]}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {r.email}
                        {r.role ? ` · ${r.role}` : ""}
                      </p>
                    </div>
                    {!isIssued && (
                      <button
                        type="button"
                        onClick={() => removeRecipient(r.email)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remove ${r.email}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!isIssued && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="email@example.com *"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={recipientNameInput}
                    onChange={(e) => setRecipientNameInput(e.target.value)}
                    placeholder="Name (optional)"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <input
                    type="text"
                    value={recipientRoleInput}
                    onChange={(e) => setRecipientRoleInput(e.target.value)}
                    placeholder="Role (optional)"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={addRecipient}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add recipient
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isIssued && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || issuing || !isDirty}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={
                  issuing ||
                  saving ||
                  !subject.trim() ||
                  body.trim().length < 60 ||
                  recipients.length === 0
                }
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {issuing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Issue RFI
              </button>
              {recipients.length === 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  Add at least one recipient before issuing.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

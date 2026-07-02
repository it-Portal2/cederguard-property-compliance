import React, { useEffect, useRef, useState } from 'react';
import { X, Lock, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptedAction?: string | null;
}

export function RequestAccessModal({ isOpen, onClose, attemptedAction }: RequestAccessModalProps) {
  const hasPendingCached = useStore((s) => s.hasPendingAccessRequest);
  const setHasPending = useStore((s) => s.setHasPendingAccessRequest);

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyPending, setAlreadyPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const handleClose = () => {
    onClose();
    // Reset for the next open, after the close would run.
    setTimeout(() => {
      setReason('');
      setSubmitted(false);
      setAlreadyPending(false);
      setError(null);
    }, 200);
  };

  // On open, render instantly from the cached flag (no spinner), then silently
  // revalidate in the background so a rejected/cleared request self-corrects
  // without the user waiting on a network round-trip.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setSubmitted(false);
    setError(null);
    setAlreadyPending(hasPendingCached);
    (async () => {
      try {
        const res = await api.getMyAccessRequest();
        if (cancelled) return;
        setAlreadyPending(!!res?.pending);
        setHasPending(!!res?.pending);
      } catch {
        // Non-fatal — keep the cached value.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, submitting]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    // Ref guard: never let a rapid double-click fire two create calls (the
    // second would race back as "already pending" and mask the real success).
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createAccessRequest(reason || undefined, attemptedAction || undefined);
      setHasPending(true);
      if (res?.alreadyPending) setAlreadyPending(true);
      else setSubmitted(true);
    } catch (e: any) {
      setError(e.message || 'Failed to submit request');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-access-modal-title"
        tabIndex={-1}
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            <h3 id="request-access-modal-title" className="text-lg font-semibold text-slate-800">Request Access</h3>
          </div>
          <button onClick={handleClose} aria-label="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-4 text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-slate-800 font-medium">Request sent successfully</p>
            <p className="text-sm text-slate-500 mt-1">
              Thank you. Your access request has been submitted and your workspace admin has been notified. Our team will review it and grant you access shortly.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : alreadyPending ? (
          <div className="mt-4 text-center py-4">
            <Clock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <p className="text-slate-800 font-medium">Request already submitted</p>
            <p className="text-sm text-slate-500 mt-1">
              You already have an access request awaiting review. Please wait for your workspace admin to approve it — you'll be able to use this feature once access is granted.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 mt-2">
              Your account currently has read-only (Viewer) access. This action requires Project Manager permissions.
              Send a request to your workspace admin to be upgraded.
            </p>
            <textarea
              className="w-full mt-3 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Add a note for your admin (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Request
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

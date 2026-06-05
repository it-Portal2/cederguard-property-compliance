// Cost rate editor modal.
//
// Single-form create/edit. Validates rateId regex (lowercase + hyphens
// only — matches the seed convention so the AI prompt's rate library
// listing stays consistent), category enum, unit enum, rate ≥ 0,
// description ≥ 3 chars. Server re-validates everything.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, AlertCircle, PoundSterling } from "lucide-react";
import { clsx } from "clsx";

import { useFocusTrap } from "../../../hooks/useFocusTrap";
import type { CostRate, CostRateCategory } from "../../../../shared/types/technicalAssurance";

interface CostRateEditorProps {
  open: boolean;
  rate: CostRate | null;
  onSave: (rate: {
    rateId: string;
    category: CostRateCategory;
    description: string;
    unit: CostRate["unit"];
    rate: number;
  }) => void | Promise<void>;
  onCancel: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: CostRateCategory; label: string }> = [
  { value: "preliminaries", label: "Preliminaries" },
  { value: "substructure", label: "Substructure" },
  { value: "frame", label: "Frame" },
  { value: "me", label: "Mechanical & Electrical" },
  { value: "finishes", label: "Finishes" },
  { value: "external", label: "External works" },
  { value: "fees", label: "Fees & soft costs" },
];

const UNIT_OPTIONS: Array<{ value: CostRate["unit"]; label: string }> = [
  { value: "m", label: "m (linear metre)" },
  { value: "m2", label: "m² (square metre)" },
  { value: "m3", label: "m³ (cubic metre)" },
  { value: "no", label: "no (each)" },
  { value: "hr", label: "hr (hour)" },
  { value: "item", label: "item (lump sum)" },
];

const RATE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;

export function CostRateEditor({
  open,
  rate,
  onSave,
  onCancel,
}: CostRateEditorProps) {
  const [rateId, setRateId] = useState("");
  const [category, setCategory] =
    useState<CostRateCategory>("preliminaries");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<CostRate["unit"]>("item");
  const [rateValue, setRateValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    setRateId(rate?.rateId ?? "");
    setCategory((rate?.category as CostRateCategory) ?? "preliminaries");
    setDescription(rate?.description ?? "");
    setUnit((rate?.unit as CostRate["unit"]) ?? "item");
    setRateValue(rate?.rate != null ? String(rate.rate) : "");
    setError(null);
  }, [open, rate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  const isEdit = rate !== null && rate.clientId !== "__shared__";
  const isOverridingSeed = rate !== null && rate.clientId === "__shared__";

  const submit = async () => {
    if (submitting) return;
    setError(null);
    const trimmedId = rateId.trim();
    const trimmedDesc = description.trim();
    if (!RATE_ID_PATTERN.test(trimmedId)) {
      setError("Rate ID must be 2-80 chars, lowercase letters / digits / hyphens only.");
      return;
    }
    if (trimmedDesc.length < 3) {
      setError("Description must be at least 3 characters.");
      return;
    }
    const num = Number(rateValue);
    if (!Number.isFinite(num) || num < 0) {
      setError("Rate must be a non-negative number (in £).");
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        rateId: trimmedId,
        category,
        description: trimmedDesc,
        unit,
        rate: num,
      });
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
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
            if (e.target === e.currentTarget && !submitting) onCancel();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cost-rate-editor-title"
        >
          <motion.div
            ref={trapRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <PoundSterling className="h-4 w-4" />
                </div>
                <div>
                  <h3
                    id="cost-rate-editor-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    {isEdit
                      ? "Edit custom cost rate"
                      : isOverridingSeed
                        ? "Override seed rate (creates custom)"
                        : "New custom cost rate"}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {isOverridingSeed
                      ? `This will create a council-specific override that shadows the seed "${rate?.rateId}".`
                      : "Used by the Technical Assurance AI as a benchmark."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                aria-label="Close cost rate editor"
                className="text-slate-400 hover:text-slate-700 disabled:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label
                  htmlFor="rate-id"
                  className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Rate ID
                </label>
                <input
                  id="rate-id"
                  type="text"
                  value={rateId}
                  onChange={(e) => setRateId(e.target.value.toLowerCase())}
                  disabled={isEdit || isOverridingSeed}
                  placeholder="e.g. me-mvhr-install"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-mono focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Lowercase letters, digits, hyphens only. Cannot change after
                  creation.
                </p>
              </div>

              <div>
                <label
                  htmlFor="rate-category"
                  className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Category
                </label>
                <select
                  id="rate-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as CostRateCategory)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="rate-description"
                  className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Description
                </label>
                <input
                  id="rate-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. MVHR system — install per dwelling"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rate-unit"
                    className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Unit
                  </label>
                  <select
                    id="rate-unit"
                    value={unit}
                    onChange={(e) =>
                      setUnit(e.target.value as CostRate["unit"])
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="rate-value"
                    className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Rate (£)
                  </label>
                  <input
                    id="rate-value"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-mono focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
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
                onClick={onCancel}
                disabled={submitting}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60",
                  "bg-indigo-600 hover:bg-indigo-700",
                )}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {isEdit ? "Save changes" : "Add rate"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

import { useState } from "react";
import toast from "react-hot-toast";
import { X, UploadCloud, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { api } from "../../../lib/api";

interface Flag {
  severity: "error" | "warning";
  field: string;
  message: string;
}
interface PreviewRow {
  sheetRow: number;
  item: { name?: string; complexityRaw?: string; sosDate?: string | null };
  flags: Flag[];
}
interface Summary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  headerRowIndex: number;
  unmappedColumns: string[];
}

const MAX_BYTES = 5 * 1024 * 1024;

export default function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [base64, setBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 5 MB).");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setRows([]);
    setSummary(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setBase64(dataUrl);
      const res = await api.resourceImportSchemesDryRun(dataUrl);
      setRows(res?.rows || []);
      setSummary(res?.summary || null);
      if (!res?.summary || res.summary.totalRows === 0) {
        toast.error("No scheme rows found — check the file has a 'Scheme Name' header.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not read the spreadsheet");
    } finally {
      setParsing(false);
    }
  };

  const commit = async () => {
    if (!base64) return;
    setCommitting(true);
    try {
      const res = await api.resourceImportSchemesCommit(base64);
      toast.success(`Imported ${res?.written ?? 0} scheme(s)`);
      onImported();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Import schemes</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30">
            <UploadCloud className="h-7 w-7 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {fileName || "Choose an Excel / CSV file"}
            </span>
            <span className="text-[12px] text-slate-400">
              Maps the PROGRAMME PROFILE columns automatically · max 5 MB
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          {parsing && <p className="text-sm text-slate-500">Reading spreadsheet…</p>}

          {summary && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-[13px]">
                <Stat label="Rows" value={summary.totalRows} />
                <Stat label="Importable" value={summary.validRows} tone="emerald" />
                <Stat label="Errors" value={summary.errorRows} tone="red" />
                <Stat label="Warnings" value={summary.warningRows} tone="amber" />
              </div>
              {summary.unmappedColumns.length > 0 && (
                <p className="flex items-start gap-1.5 text-[12px] text-slate-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  <span>
                    Ignored columns: {summary.unmappedColumns.slice(0, 8).join(", ")}
                    {summary.unmappedColumns.length > 8 ? "…" : ""}
                  </span>
                </p>
              )}

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                        Scheme
                      </th>
                      <th className="px-3 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                        Complexity
                      </th>
                      <th className="px-3 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                        SoS
                      </th>
                      <th className="px-3 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r) => {
                      const hasErr = r.flags.some((f) => f.severity === "error");
                      return (
                        <tr key={r.sheetRow} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-700">
                            {r.item.name || (
                              <span className="text-red-500">(no name)</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">
                            {r.item.complexityRaw || "—"}
                          </td>
                          <td className="px-3 py-1.5 font-mono tabular-nums text-slate-500">
                            {r.item.sosDate ? String(r.item.sosDate).slice(0, 10) : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            {hasErr ? (
                              <span className="font-mono text-[11px] text-red-600">skip</span>
                            ) : r.flags.length ? (
                              <span className="font-mono text-[11px] text-amber-600">warn</span>
                            ) : (
                              <span className="font-mono text-[11px] text-emerald-600">ok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 100 && (
                  <div className="border-t border-slate-100 px-3 py-1.5 text-[12px] text-slate-400">
                    Showing first 100 of {rows.length} rows.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={!summary || summary.validRows === 0 || committing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {committing
              ? "Importing…"
              : summary
                ? `Import ${summary.validRows} scheme(s)`
                : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${tones[tone]}`}>
      <span className="font-mono tabular-nums font-semibold">{value}</span>
      <span className="font-mono uppercase tracking-wide text-[11px]">{label}</span>
    </span>
  );
}

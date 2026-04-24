import { useEffect, useState } from 'react';
import { Stamp as StampIcon, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import { fileToDataUri, validateImageFile } from './fileToBase64';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const STAMP_ID_RE = /^[a-z0-9_-]{1,40}$/i;

interface StampRecord {
  id: string;
  label: string;
  url: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export function StampManager() {
  const [stamps, setStamps] = useState<Record<string, StampRecord>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftId, setDraftId] = useState('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.governanceGetCouncilAssets();
        if (cancelled) return;
        setStamps(res.stamps ?? {});
      } catch (e: any) {
        console.error('[StampManager] load failed', e);
        toast.error(e?.message ?? 'Could not load stamps.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetDraft = () => {
    setDraftLabel('');
    setDraftId('');
    setPickedFile(null);
    setAdding(false);
  };

  const handleAdd = async () => {
    if (!pickedFile) {
      toast.error('Pick an image first.');
      return;
    }
    const issue = validateImageFile(pickedFile, ALLOWED_TYPES);
    if (issue) {
      toast.error(issue);
      return;
    }
    if (!STAMP_ID_RE.test(draftId)) {
      toast.error('Stamp ID: 1–40 chars, letters / digits / underscore / hyphen.');
      return;
    }
    if (stamps[draftId]) {
      toast.error('A stamp with that ID already exists.');
      return;
    }
    setBusyId(draftId);
    try {
      const dataUri = await fileToDataUri(pickedFile);
      const res = await api.governanceUploadCouncilStamp(
        draftId,
        draftLabel || draftId,
        dataUri,
      );
      setStamps((prev) => ({ ...prev, [res.stamp.id]: res.stamp }));
      resetDraft();
      toast.success('Stamp uploaded');
    } catch (e: any) {
      console.error('[StampManager] add failed', e);
      toast.error(e?.message ?? 'Stamp upload failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await api.governanceDeleteCouncilStamp(id);
      setStamps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success('Stamp removed');
    } catch (e: any) {
      console.error('[StampManager] delete failed', e);
      toast.error(e?.message ?? 'Failed to remove stamp.');
    } finally {
      setBusyId(null);
    }
  };

  const stampList = Object.values(stamps);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <StampIcon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Stamps
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Optional watermarks (DRAFT, RECEIVED, etc.) inserted into reports based on status. PNG / JPG / SVG · max 2 MB each.
            </p>
          </div>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add stamp
          </button>
        )}
      </header>

      <div className="p-5">
        {adding && (
          <div className="mb-4 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-500/5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                New stamp
              </h4>
              <button
                type="button"
                onClick={resetDraft}
                aria-label="Cancel"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Stamp ID
                <input
                  type="text"
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  placeholder="draft / received / cabinet-seal"
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Display label
                <input
                  type="text"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  placeholder="DRAFT — Not for circulation"
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!pickedFile || !draftId || !!busyId}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyId === draftId ? 'Uploading…' : 'Upload stamp'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
            <div className="h-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
            <div className="h-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
          </div>
        ) : stampList.length === 0 && !adding ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
            No stamps yet. Add one to start watermarking reports.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stampList.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <img
                    src={s.url}
                    alt={`${s.label} preview`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {s.label}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    id · {s.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  disabled={busyId === s.id}
                  aria-label={`Remove ${s.label}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

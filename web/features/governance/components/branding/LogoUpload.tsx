import { useEffect, useState } from 'react';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../lib/api';
import { AssetDropZone } from './AssetDropZone';
import { fileToDataUri, validateImageFile } from './fileToBase64';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

export function LogoUpload() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.governanceGetCouncilAssets();
        if (cancelled) return;
        setCurrentUrl(res.logoUrl ?? null);
        setUpdatedAt(res.logoUpdatedAt ?? null);
      } catch (e: any) {
        console.error('[LogoUpload] load failed', e);
        toast.error(e?.message ?? 'Could not load existing logo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async (file: File) => {
    const issue = validateImageFile(file, ALLOWED_TYPES);
    if (issue) {
      toast.error(issue);
      return;
    }
    setBusy(true);
    try {
      const dataUri = await fileToDataUri(file);
      const res = await api.governanceUploadCouncilLogo(dataUri);
      setCurrentUrl(res.url);
      setUpdatedAt(new Date().toISOString());
      toast.success('Council logo updated');
    } catch (e: any) {
      console.error('[LogoUpload] upload failed', e);
      toast.error(e?.message ?? 'Logo upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.governanceDeleteCouncilLogo();
      setCurrentUrl(null);
      setUpdatedAt(new Date().toISOString());
      toast.success('Logo removed');
    } catch (e: any) {
      console.error('[LogoUpload] delete failed', e);
      toast.error(e?.message ?? 'Failed to remove logo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <ImageIcon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Council logo
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Embedded at the top of every published report. PNG, JPG or SVG · max 2 MB.
            </p>
          </div>
        </div>
      </header>
      <div className="space-y-4 p-5">
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
        ) : (
          <AssetDropZone
            accept={ALLOWED_TYPES}
            onFile={handleUpload}
            busy={busy}
            title={currentUrl ? 'Replace logo' : 'Drop logo here or click to browse'}
            helper={
              updatedAt
                ? `Last updated ${new Date(updatedAt).toLocaleString('en-GB')}`
                : 'Compresses to ~500 KB on save.'
            }
          >
            {currentUrl && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <img
                      src={currentUrl}
                      alt="Council logo preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Current logo
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Will appear on every new report.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            )}
          </AssetDropZone>
        )}
      </div>
    </section>
  );
}

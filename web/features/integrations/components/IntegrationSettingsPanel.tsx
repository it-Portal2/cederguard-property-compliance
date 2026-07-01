import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  X,
  UploadCloud,
  FileJson,
  Copy,
  Check,
  Trash2,
  Loader2,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../../lib/api';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import ConfirmDialog from '../../../components/table/ConfirmDialog';
import type { ProviderMeta } from '../providers';
import type { ProviderStatus } from './IntegrationCard';

interface Props {
  meta: ProviderMeta;
  status?: ProviderStatus;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function IntegrationSettingsPanel({ meta, status, canManage, onClose, onChanged }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const secretFields = meta.fields.filter((f) => f.secret);
  const cfg = status?.config || {};
  const fieldId = (k: string) => `intg-${meta.id}-${k}`;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of meta.fields) {
      if (!f.secret && cfg[f.key] !== undefined && cfg[f.key] !== null) v[f.key] = String(cfg[f.key]);
    }
    v.label = cfg.label ? String(cfg.label) : '';
    if (meta.id === 'powerbi' && !v.dataScope) v.dataScope = 'all';
    return v;
  });
  const [sync, setSync] = useState<string[]>(() =>
    Array.isArray(cfg.syncCategories) ? cfg.syncCategories : meta.syncCategories.map((c) => c.key),
  );
  const [enabled, setEnabled] = useState<boolean>(!!status?.enabled);
  const [setupOpen, setSetupOpen] = useState<boolean>(!status?.connected);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'disconnect' | 'revoke'>(null);
  const [feed, setFeed] = useState<{ key: string; url: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirm) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, confirm]);

  const setValue = (k: string, val: string) => setValues((prev) => ({ ...prev, [k]: val }));

  const hasSavedSecret = (key: string) => {
    // Mirrors the server's mask: an encrypted `<field>Enc` becomes a `has<Field>` boolean.
    const flag = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    return !!(status as any)?.[flag];
  };

  const readJsonFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text); // fail fast on a non-JSON file
      setValue('serviceAccountJson', text);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error('That file is not valid JSON.');
    }
  };

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Both the file-upload and paste paths feed the same value — validate either.
  const validateJsonFields = (): boolean => {
    for (const f of secretFields) {
      if (f.type !== 'json') continue;
      const raw = values[f.key];
      if (raw && raw.trim()) {
        try {
          JSON.parse(raw);
        } catch {
          toast.error(`${f.label} must be valid JSON.`);
          return false;
        }
      }
    }
    return true;
  };

  const buildPayload = () => {
    const config: Record<string, any> = { label: values.label || '', enabled, syncCategories: sync };
    for (const f of meta.fields) {
      if (f.secret) continue;
      const raw = values[f.key];
      if (raw === undefined) continue;
      if (f.type === 'number') {
        const n = Number(raw);
        if (raw !== '' && !Number.isNaN(n)) config[f.key] = n;
      } else {
        config[f.key] = raw;
      }
    }
    const secrets: Record<string, any> = {};
    for (const f of secretFields) {
      const raw = values[f.key];
      if (typeof raw === 'string' && raw.trim()) secrets[f.key] = raw.trim();
    }
    return { config, secrets };
  };

  const handleSave = async () => {
    if (!canManage || !validateJsonFields()) return;
    setSaving(true);
    try {
      const { config, secrets } = buildPayload();
      const res = await api.integrationSaveProvider(meta.id, config, secrets);
      if (res.success) {
        toast.success(`${meta.name} saved`);
        onChanged();
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateJsonFields()) return;
    setTesting(true);
    try {
      // Persist first so the server tests the latest values (button says "Save & test").
      if (canManage) {
        const { config, secrets } = buildPayload();
        await api.integrationSaveProvider(meta.id, config, secrets);
        onChanged();
      }
      const res = await api.integrationTest(meta.id);
      if (res.success) toast.success(res.message || 'Test succeeded.');
      else toast.error(res.message || 'Test failed.');
    } catch (e: any) {
      toast.error(e?.message || 'Test failed.');
    } finally {
      setTesting(false);
    }
  };

  const doDisconnect = async () => {
    setBusy(true);
    try {
      await api.integrationDisconnect(meta.id);
      toast.success(`${meta.name} disconnected`);
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateFeed = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      await api.integrationSaveProvider(meta.id, { dataScope: values.dataScope || 'all', enabled: true });
      const res = await api.integrationGenerateFeedKey();
      if (res.success) {
        setFeed({ key: res.key, url: res.url });
        toast.success('Feed key generated');
        onChanged();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not generate a feed key.');
    } finally {
      setSaving(false);
    }
  };

  const doRevokeFeed = async () => {
    setBusy(true);
    try {
      await api.integrationRevokeFeedKey();
      setFeed(null);
      toast.success('Feed key revoked');
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not revoke the key.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const labelId = `intg-${meta.id}-title`;
  const feedActive = !!(status as any)?.hasFeed || !!feed;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200 sm:w-[460px]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
            <img src={meta.logo} alt="" className="h-5 w-5 object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={labelId} className="text-sm font-semibold text-slate-900">
              {meta.name}
            </h2>
            <p className="truncate text-xs text-slate-500">Integration settings</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {!canManage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              You have read-only access. A workspace admin can change these settings.
            </div>
          )}

          {/* Setup guide */}
          <div className="overflow-hidden rounded-lg border border-indigo-100 bg-indigo-50/60">
            <button
              type="button"
              aria-expanded={setupOpen}
              onClick={() => setSetupOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-indigo-700">
                {meta.setupTitle}
              </span>
              <ChevronDown className={clsx('h-4 w-4 text-indigo-500 transition-transform', setupOpen ? 'rotate-0' : '-rotate-90')} />
            </button>
            {setupOpen && (
              <ol className="list-decimal space-y-1.5 px-6 pb-3 pt-1 text-[13px] leading-snug text-slate-600 marker:text-indigo-400">
                {meta.setupSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
          </div>

          {/* Label */}
          <Field label="Label (optional)" htmlFor={fieldId('label')}>
            <input
              id={fieldId('label')}
              type="text"
              value={values.label || ''}
              disabled={!canManage}
              onChange={(e) => setValue('label', e.target.value)}
              placeholder="e.g. Governance channel"
              className={inputCls}
            />
          </Field>

          {/* Provider fields */}
          {meta.fields.map((f) => {
            if (meta.id === 'powerbi' && f.type === 'select') {
              return (
                <Field key={f.key} label={f.label} help={f.help} htmlFor={fieldId(f.key)}>
                  <select
                    id={fieldId(f.key)}
                    value={values[f.key] || 'all'}
                    disabled={!canManage}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    className={inputCls}
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            }

            if (f.type === 'json') {
              const saved = hasSavedSecret(f.key);
              const loaded = !!values[f.key];
              return (
                <Field key={f.key} label={f.label} help={f.help} helpLink={f.helpLink} htmlFor={fieldId(f.key)}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    disabled={!canManage}
                    aria-label={`Upload ${f.label}`}
                    onChange={(e) => readJsonFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-50"
                  >
                    {loaded ? (
                      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-emerald-700">
                        <FileJson className="h-4 w-4" /> Key loaded — click to replace
                      </span>
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 text-slate-400" />
                        <span className="text-[13px] text-slate-600">
                          <span className="font-medium text-indigo-600 underline">Click to upload</span> the JSON key
                        </span>
                        {saved && <span className="text-[11px] text-slate-400">A key is already saved — upload to replace</span>}
                      </>
                    )}
                  </button>
                  <div className="my-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">or</div>
                  <textarea
                    id={fieldId(f.key)}
                    rows={3}
                    disabled={!canManage}
                    value={values[f.key] || ''}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    placeholder="Paste the service-account JSON here…"
                    className={clsx(inputCls, 'font-mono text-xs')}
                  />
                </Field>
              );
            }

            const saved = f.secret && hasSavedSecret(f.key);
            return (
              <Field key={f.key} label={f.label} help={f.help} helpLink={f.helpLink} required={f.required} htmlFor={fieldId(f.key)}>
                <input
                  id={fieldId(f.key)}
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key] || ''}
                  disabled={!canManage}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  placeholder={saved ? '•••••••• saved — leave blank to keep' : f.placeholder}
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
            );
          })}

          {/* Power BI feed key */}
          {meta.id === 'powerbi' && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-700">Feed key</span>
                {feedActive ? (
                  <button
                    type="button"
                    onClick={() => setConfirm('revoke')}
                    disabled={!canManage || busy}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </button>
                ) : null}
              </div>
              {feed ? (
                <>
                  <p className="text-[11px] text-slate-500">Copy the feed URL now — the key is shown only once.</p>
                  <CopyRow label="feed URL" value={feed.url} copied={copied === 'url'} onCopy={() => copy('url', feed.url)} />
                </>
              ) : feedActive ? (
                <p className="text-[12px] text-emerald-700">A feed key is active. Regenerate to rotate it.</p>
              ) : (
                <p className="text-[12px] text-slate-500">Generate a key to get your Power BI feed URL.</p>
              )}
              <button
                type="button"
                onClick={handleGenerateFeed}
                disabled={!canManage || saving}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {feedActive ? 'Regenerate feed key' : 'Generate feed key'}
              </button>
            </div>
          )}

          {/* Sync categories */}
          {meta.syncCategories.length > 0 && (
            <div role="group" aria-label="Sync these events">
              <div className="mb-1 block text-[13px] font-medium text-slate-700">Sync these events</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {meta.syncCategories.map((c) => {
                  const on = sync.includes(c.key);
                  return (
                    <label key={c.key} className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!canManage}
                        onChange={() =>
                          setSync((prev) => (on ? prev.filter((k) => k !== c.key) : [...prev, c.key]))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enabled */}
          <label className="flex items-center gap-2 border-t border-slate-100 pt-4 text-[13px] font-medium text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canManage}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
            />
            Enabled — events will be delivered
          </label>
        </div>

        {/* Footer — stacks on mobile, buttons wrap so nothing overflows a narrow panel */}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {status?.connected && canManage && (
              <button
                type="button"
                onClick={() => setConfirm('disconnect')}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Disconnect
              </button>
            )}
            <a
              href={meta.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {meta.name}
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {meta.id !== 'powerbi' && (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !canManage}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save &amp; test
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            {meta.id !== 'powerbi' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !canManage}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save changes
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        variant="danger"
        loading={busy}
        title={confirm === 'disconnect' ? `Disconnect ${meta.name}?` : 'Revoke feed key?'}
        message={
          confirm === 'disconnect'
            ? 'This removes the stored credentials for this integration.'
            : 'Any Power BI report using this key will stop refreshing until you generate a new one.'
        }
        confirmLabel={confirm === 'disconnect' ? 'Disconnect' : 'Revoke'}
        onConfirm={() => (confirm === 'disconnect' ? doDisconnect() : doRevokeFeed())}
        onCancel={() => setConfirm(null)}
      />
    </div>,
    document.body,
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50';

function Field({
  label,
  htmlFor,
  help,
  helpLink,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  helpLink?: { label: string; url: string };
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {help && (
        <p className="mb-1.5 text-[12px] leading-snug text-slate-500">
          {help}{' '}
          {helpLink && (
            <a href={helpLink.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline">
              {helpLink.label}
            </a>
          )}
        </p>
      )}
      {children}
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label={label}
        className="min-w-0 flex-1 select-all rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] text-slate-700"
      />
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
        title="Copy"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

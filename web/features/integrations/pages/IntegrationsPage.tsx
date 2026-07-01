import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { api } from '../../../lib/api';
import { PROVIDERS } from '../providers';
import IntegrationCard, { type ProviderStatus } from '../components/IntegrationCard';
import IntegrationSettingsPanel from '../components/IntegrationSettingsPanel';

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [canManage, setCanManage] = useState(false);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.integrationsGetStatus();
      if (res.success) {
        setStatuses(res.integrations || {});
        setCanManage(!!res.canManage);
        setEncryptionReady(res.encryptionReady !== false);
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load integrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (providerId: string, next: boolean) => {
    setTogglingId(providerId);
    // Optimistic update.
    setStatuses((prev) => ({ ...prev, [providerId]: { ...prev[providerId], enabled: next } }));
    try {
      await api.integrationSaveProvider(providerId, { enabled: next });
      toast.success(next ? 'Integration enabled' : 'Integration disabled');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update.');
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const openMeta = openId ? PROVIDERS.find((p) => p.id === openId) : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Integrations & workflows"
        subtitle="Connect the tools you and your team use every day — governance, risk and compliance updates flow straight to them."
        breadcrumbs={[{ label: 'Account' }, { label: 'Integrations' }]}
      />

      {!encryptionReady && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Integrations are not fully configured on the server yet (missing <code className="font-mono text-xs">INTEGRATIONS_ENC_KEY</code>).
            Credentials cannot be stored securely until an administrator sets it.
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-24 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200/70" />
                  <div className="h-3 w-2/3 rounded bg-slate-200/70" />
                </div>
              </div>
              <div className="mt-3 h-3 w-16 rounded bg-slate-200/70" />
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="h-7 w-20 rounded-lg bg-slate-200" />
                <div className="h-5 w-9 rounded-full bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((meta) => (
            <IntegrationCard
              key={meta.id}
              meta={meta}
              status={statuses[meta.id]}
              canManage={canManage}
              busy={togglingId === meta.id}
              onOpen={() => setOpenId(meta.id)}
              onToggle={(next) => handleToggle(meta.id, next)}
            />
          ))}
        </div>
      )}

      {openMeta && (
        <IntegrationSettingsPanel
          meta={openMeta}
          status={statuses[openMeta.id]}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

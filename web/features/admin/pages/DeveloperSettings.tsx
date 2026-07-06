import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { KeyRound, Plus, Trash2, Copy, Check, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import DynamicTable from '../../../components/table/DynamicTable';
import type { ColumnDef, RowAction } from '../../../components/table/types';

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string | null;
}

export function DeveloperSettings() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await api.getApiKeys();
      if (res.success) {
        setKeys(res.keys || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      showError('Please provide a name for the API Key');
      return;
    }
    try {
      setGenerating(true);
      const res = await api.generateApiKey(newKeyName.trim());
      if (res.success) {
        setGeneratedKey(res.key);
        setNewKeyName('');
        showSuccess('API Key generated successfully');
        fetchKeys();
      }
    } catch (err: any) {
      showError(err.message || 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      const res = await api.revokeApiKey(keyId);
      if (res.success) {
        showSuccess('API Key revoked');
        fetchKeys();
      }
    } catch (err: any) {
      showError(err.message || 'Failed to revoke key');
    }
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      showSuccess('API Key copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : null);

  const columns: ColumnDef<ApiKeyRow>[] = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'prefix',
      label: 'Prefix',
      render: (v) => <span className="font-mono text-[12.5px] text-slate-500">{v}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (v) => <span className="font-mono text-[11px] text-slate-500 tabular-nums">{fmtDate(v)}</span>,
    },
    {
      key: 'lastUsed',
      label: 'Last used',
      sortable: true,
      render: (v) =>
        v ? (
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">{fmtDate(v)}</span>
        ) : (
          <span className="font-mono text-[11px] text-slate-400">Never</span>
        ),
    },
  ];

  const rowActions: RowAction<ApiKeyRow>[] = [
    {
      key: 'revoke',
      label: 'Revoke',
      icon: Trash2,
      isDanger: true,
      onClick: (row) => handleRevoke(row.id),
      requireConfirm: {
        title: 'Revoke API key',
        message: (row) =>
          `Permanently revoke "${row.name}"? Any client or script using this key will immediately stop working. This cannot be undone.`,
        confirmLabel: 'Revoke key',
        variant: 'danger',
        isDanger: true,
      },
    },
  ];

  const generateForm = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        value={newKeyName}
        onChange={(e) => setNewKeyName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        placeholder="Key name (e.g. CI pipeline)"
        className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-64"
        maxLength={50}
      />
      <button
        onClick={handleCreate}
        disabled={generating || !newKeyName.trim()}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {generating ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Generate key
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Settings"
        subtitle="Manage API keys to securely access the platform's API."
        breadcrumbs={[{ label: 'Developer / API' }, { label: 'API Keys' }]}
      />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {generatedKey && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="mb-1 text-sm font-semibold text-emerald-900">Save your new API Key</h3>
              <p className="mb-3 text-sm text-emerald-700">
                This key will only be shown once. Please save it in a secure location.
              </p>
              <div className="flex items-center gap-2">
                <code className="select-all rounded-md border border-emerald-200 bg-white px-3 py-2 font-mono text-sm text-emerald-900">
                  {generatedKey}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="rounded-md p-2 text-emerald-700 transition-colors hover:bg-emerald-100"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <button
                onClick={() => setGeneratedKey(null)}
                className="mt-4 text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                I have saved this key safely
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="mb-4 max-w-2xl text-sm text-slate-600">
          API keys allow programmatic access to your platform data. Keep them secure and never share them in
          public repositories. Keys are stored hashed and cannot be recovered — revoke and regenerate if lost.
        </p>
        <DynamicTable<ApiKeyRow>
          data={keys}
          columns={columns}
          rowActions={rowActions}
          searchable
          searchPlaceholder="Search keys…"
          searchFields={['name', 'prefix']}
          getRowId={(r) => r.id}
          loading={loading}
          headerVariant="light"
          pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
          toolbarActions={generateForm}
          emptyState={{
            title: 'No API keys generated yet',
            description: 'Generate a key above to start calling the API.',
            icon: KeyRound,
          }}
        />
      </div>
    </div>
  );
}

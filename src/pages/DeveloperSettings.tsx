import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { KeyRound, Plus, Trash2, Copy, Check, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export function DeveloperSettings() {
  const [keys, setKeys] = useState<any[]>([]);
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
    if (!window.confirm('Are you sure you want to permanently revoke this API Key?')) return;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Settings"
        subtitle="Manage API keys to securely access the platform's API."
        breadcrumbs={[{label:"Developer / API"},{label:"API Keys"}]}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">API Keys</h2>
        <p className="text-sm text-slate-600 mb-6 max-w-2xl">
          API Keys allow programmatic access to your platform data. Keep them secure. Never share them in public repositories.
        </p>

        {generatedKey && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-900 mb-1">Save your new API Key</h3>
                <p className="text-sm text-emerald-700 mb-3">
                  This key will only be shown once. Please save it in a secure location.
                </p>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-2 bg-white border border-emerald-200 text-emerald-900 font-mono text-sm rounded-md select-all">
                    {generatedKey}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
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

        {/* Generate New Key Form */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g., Development Script, Jenkins Pipeline"
            className="flex-1 px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 focus:outline-none"
            maxLength={50}
          />
          <button
            onClick={handleCreate}
            disabled={generating || !newKeyName.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Generate Key
          </button>
        </div>

        {/* Existing Keys Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Prefix</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading keys...</td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 flex flex-col items-center">
                    <KeyRound className="w-10 h-10 text-slate-300 mb-2" />
                    No API keys generated yet.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{key.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{key.prefix}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors inline-flex items-center gap-2"
                        title="Revoke Key"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

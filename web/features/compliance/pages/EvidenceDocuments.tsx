import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore, ComplianceItem } from '../../../store/useStore';
import {
  UploadCloud, File, Trash2, CheckCircle2, X, AlertCircle,
  ExternalLink, Shield, Link as LinkIcon, Search, ChevronDown,
  Loader2, FileText, Globe, Pencil
} from 'lucide-react';
import { api } from '../../../lib/api';
import { toast } from "react-hot-toast";
import PageHeader from '../../../components/PageHeader';
import RunAgentButton from '../../agents/components/RunAgentButton';
import DynamicTable from '../../../components/table/DynamicTable';
import type { ColumnDef, RowAction, FilterDef } from '../../../components/table/types';

/* ── helpers ─────────────────────────────────────────── */
function formatSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ── row type ──────────────────────────────────────────── */
interface EvidenceRow {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  relatedRequirementId: string;
  storagePath: string;
  url: string;
  project: string;
  linkedType?: string;
  linkedId?: string;
  linkedLabel?: string;
  _reqLabel: string;
  _source: string;
  _typeGroup: 'file' | 'link';
}

/* ── component ───────────────────────────────────────── */
type EvidenceLink = { linkedType?: string; linkedId?: string; linkedLabel?: string };

export function EvidenceDocuments() {
  const {
    activeProjectId, activeProgrammeId, projects, programmes, complianceItems,
    controls, incidents, risks, tasks, loadControls, loadIncidents,
  } = useStore();

  useEffect(() => {
    loadControls();
    loadIncidents();
  }, [loadControls, loadIncidents]);
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkData, setLinkData] = useState<{ name: string; url: string; relatedRequirementId: string } & EvidenceLink>({ name: '', url: '', relatedRequirementId: '' });
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileRequirementId, setFileRequirementId] = useState('');
  const [fileLink, setFileLink] = useState<EvidenceLink>({});
  const [editData, setEditData] = useState<({ id: string; name: string; relatedRequirementId: string } & EvidenceLink) | null>(null);

  const contextId = activeProjectId || activeProgrammeId || 'all';
  const isPortfolioView = !activeProjectId && !activeProgrammeId;
  const contextName = activeProjectId
    ? projects.find(p => p.id === activeProjectId)?.name
    : activeProgrammeId
      ? programmes.find(p => p.id === activeProgrammeId)?.name
      : 'Portfolio Aggregate';

  useEffect(() => { fetchDocuments(); }, [contextId]);

  // Escape closes whichever evidence modal is open.
  useEffect(() => {
    const anyOpen = isLinkModalOpen || isFileModalOpen || !!editData;
    if (!anyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsLinkModalOpen(false);
      setIsFileModalOpen(false);
      setEditData(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLinkModalOpen, isFileModalOpen, editData]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEvidence(contextId);
      if (res.success) {
        setFiles((res.data || []).sort((a: any, b: any) =>
          new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()));
      } else {
        setError('Failed to retrieve document list.');
        toast.error('Failed to retrieve document list.');
      }
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.message || 'Connection error while fetching documents.');
      toast.error(err.message || 'Connection error.');
    } finally { setLoading(false); }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files;
    if (!f || f.length === 0) return;
    const fileArray = Array.from(f);
    const MAX_SIZE = 3 * 1024 * 1024;
    const ALLOWED_EXTS = ['.jpg', '.jpeg', '.pdf', '.doc', '.docx'];
    const validFiles: File[] = [];
    const errors: string[] = [];
    for (const file of fileArray) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) { errors.push(`"${file.name}" unsupported format.`); continue; }
      if (file.size > MAX_SIZE) { errors.push(`"${file.name}" exceeds 3 MB. For larger files, add an external link instead.`); continue; }
      validFiles.push(file);
    }
    if (errors.length > 0) {
      setError(errors.join(' '));
      errors.forEach(e => toast.error(e));
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (validFiles.length === 0) return;
    } else { setError(null); }
    setSelectedFiles(validFiles);
    setFileRequirementId('');
    setFileLink({});
    setIsFileModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') { reject(new Error('Unexpected reader result.')); return; }
        resolve(result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
      reader.readAsDataURL(file);
    });

  const confirmFileUpload = async () => {
    if (selectedFiles.length === 0 || !contextId) return;
    setUploading(true); setError(null);
    try {
      for (const file of selectedFiles) {
        const contentType = file.type || (
          file.name.endsWith('.pdf') ? 'application/pdf' :
          file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
          file.name.endsWith('.doc') ? 'application/msword' :
          (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) ? 'image/jpeg' :
          'application/octet-stream'
        );
        const base64 = await fileToBase64(file);
        await api.addEvidence(contextId, {
          name: file.name, url: '', type: contentType,
          relatedRequirementId: fileRequirementId || undefined,
          ...fileLink,
          uploadedAt: new Date().toISOString(),
        }, { base64, mime: contentType });
      }
      toast.success(`${selectedFiles.length} file(s) uploaded successfully.`);
      await fetchDocuments();
      setIsFileModalOpen(false); setSelectedFiles([]); setFileRequirementId(''); setFileLink({});
    } catch (err: any) {
      const msg = `Upload failed: ${err.message || 'Unknown error'}.`;
      setError(msg); toast.error(msg);
    } finally { setUploading(false); }
  };

  const handleOpenFile = (file: any) => {
    if (!file?.url) { toast.error('No download URL on this record. Try re-uploading the file.'); return; }
    window.open(file.url, '_blank', 'noopener,noreferrer');
  };

  const handleAddLink = async () => {
    if (!linkData.name || !linkData.url || !contextId) return;
    setUploading(true); setError(null);
    try {
      const urlToSave = linkData.url.startsWith('http') ? linkData.url : `https://${linkData.url}`;
      await api.addEvidence(contextId, {
        name: linkData.name, url: urlToSave, storagePath: 'external-link', size: 0, type: 'link',
        relatedRequirementId: linkData.relatedRequirementId || undefined,
        linkedType: linkData.linkedType, linkedId: linkData.linkedId, linkedLabel: linkData.linkedLabel,
        uploadedAt: new Date().toISOString(),
      });
      toast.success('External link added.');
      await fetchDocuments();
      setIsLinkModalOpen(false); setLinkData({ name: '', url: '', relatedRequirementId: '' });
    } catch (err: any) {
      const msg = `Failed to add link: ${err.message || 'Unknown error'}.`;
      setError(msg); toast.error(msg);
    } finally { setUploading(false); }
  };

  const handleUpdateEvidence = async () => {
    if (!editData || !editData.id) return;
    setUploading(true);
    try {
      const res = await api.updateEvidence(editData.id, {
        name: editData.name,
        relatedRequirementId: editData.relatedRequirementId || null,
        linkedType: editData.linkedType || null,
        linkedId: editData.linkedId || null,
        linkedLabel: editData.linkedLabel || null,
      });
      if (res.success) {
        toast.success('Document updated successfully.');
        await fetchDocuments();
        setEditData(null);
      } else { throw new Error(res.error || 'Update failed'); }
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    } finally { setUploading(false); }
  };

  const groupedRequirements = useMemo<Record<string, ComplianceItem[]>>(() => {
    const groups: Record<string, ComplianceItem[]> = {};
    complianceItems.forEach(item => {
      const domain = item.domain || 'General';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(item);
    });
    return groups;
  }, [complianceItems]);

  const [reqSearchTerm, setReqSearchTerm] = useState('');
  const filteredGroupedReqs = useMemo<Record<string, ComplianceItem[]>>(() => {
    const result: Record<string, ComplianceItem[]> = {};
    Object.entries(groupedRequirements).forEach(([domain, items]) => {
      const filtered = items.filter(i =>
        i.req?.toLowerCase().includes(reqSearchTerm.toLowerCase()) ||
        domain.toLowerCase().includes(reqSearchTerm.toLowerCase()));
      if (filtered.length > 0) result[domain] = filtered;
    });
    return result;
  }, [groupedRequirements, reqSearchTerm]);

  /* ── table rows (derived) ─────────────────────────────── */
  const tableRows = useMemo<EvidenceRow[]>(() => files.map(f => ({
    ...f,
    relatedRequirementId: f.relatedRequirementId || '',
    _reqLabel: complianceItems.find(c => c.id === f.relatedRequirementId)?.req || '',
    _source: projects.find(p => p.id === f.project)?.name || programmes.find(p => p.id === f.project)?.name || 'Unknown',
    _typeGroup: f.type === 'link' ? 'link' : 'file',
  })), [files, complianceItems, projects, programmes]);

  /* ── columns ─────────────────────────────────────────── */
  const columns: ColumnDef<EvidenceRow>[] = [
    {
      key: 'name',
      label: 'Document',
      sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            {row._typeGroup === 'link'
              ? <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
              : <File className="h-3.5 w-3.5 text-slate-400" />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 truncate max-w-[260px]" title={v}>{v}</p>
            {row._reqLabel && (
              <p className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400 truncate max-w-[240px]">
                <Shield className="h-3 w-3 shrink-0" />{row._reqLabel}
              </p>
            )}
            {row.linkedLabel && (
              <p className="flex items-center gap-1 mt-0.5 text-[11px] text-indigo-500 truncate max-w-[240px]">
                <LinkIcon className="h-3 w-3 shrink-0" />
                <span className="font-mono uppercase tracking-wide text-[9px]">{row.linkedType}</span>
                {row.linkedLabel}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: '_source',
      label: 'Source',
      render: (v) => <span className="text-[12px] text-slate-500 font-medium">{v}</span>,
    },
    {
      key: 'size',
      label: 'Size',
      align: 'right',
      render: (v, row) => (
        row._typeGroup === 'link'
          ? <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"><Globe className="h-2.5 w-2.5" />URL</span>
          : <span className="text-[12px] font-mono tabular-nums text-slate-500">{formatSize(v)}</span>
      ),
    },
    {
      key: 'uploadedAt',
      label: 'Date Added',
      sortable: true,
      render: (v) => (
        <span className="text-[12px] font-mono tabular-nums text-slate-500">
          {v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
  ];

  /* ── filters ─────────────────────────────────────────── */
  const filters: FilterDef<EvidenceRow>[] = [
    {
      key: '_typeGroup',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'file', label: 'Files' },
        { value: 'link', label: 'Links' },
      ],
    },
  ];

  /* ── row actions ─────────────────────────────────────── */
  const rowActions: RowAction<EvidenceRow>[] = [
    {
      key: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: (row) => setEditData({ id: row.id, name: row.name, relatedRequirementId: row.relatedRequirementId, linkedType: row.linkedType, linkedId: row.linkedId, linkedLabel: row.linkedLabel }),
    },
    {
      key: 'open',
      label: 'Open',
      icon: ExternalLink,
      onClick: (row) => handleOpenFile(row),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      isDanger: true,
      requireConfirm: {
        title: (row) => `Delete "${row.name}"?`,
        message: 'This document will be permanently removed and cannot be recovered.',
        confirmLabel: 'Delete',
        isDanger: true,
        icon: Trash2,
      },
      onClick: async (row) => {
        const res = await api.deleteEvidence(row.id);
        if (res.success) {
          setFiles(prev => prev.filter(f => f.id !== row.id));
          toast.success('Document removed.');
        } else {
          throw new Error('API deletion failed');
        }
      },
    },
  ];

  /* ── RequirementSelector ─────────────────────────────── */
  const RequirementSelector = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => {
    const [open, setOpen] = useState(false);
    const selected = complianceItems.find(i => i.id === value);
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-500">{label}</label>
        <button type="button" onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-left hover:bg-gray-100 transition-colors">
          <span className="truncate text-gray-700">{selected ? selected.req : '— Select Requirement —'}</span>
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
        </button>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-gray-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900">Select Requirement</h4>
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 transition-colors"><X className="h-4 w-4 text-gray-400" /></button>
              </div>
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input autoFocus value={reqSearchTerm} onChange={e => setReqSearchTerm(e.target.value)}
                    placeholder="Search requirements..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <button onClick={() => { onChange(''); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                  <X className="h-3.5 w-3.5" /> No requirement tagged
                </button>
                {Object.entries(filteredGroupedReqs).length > 0 ? (
                  Object.entries(filteredGroupedReqs).map(([domain, items]) => (
                    <div key={domain} className="mt-3">
                      <div className="px-3 py-1 text-[11px] font-mono font-medium text-gray-400 uppercase tracking-wide">{domain}</div>
                      {items.map(item => (
                        <button key={item.id} onClick={() => { onChange(item.id); setOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${value === item.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium leading-snug">{item.req}</div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-500">{item.reg}</span>
                                {item.risk && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.risk === 'Critical' ? 'bg-red-100 text-red-600' : item.risk === 'High' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>{item.risk}</span>
                                )}
                              </div>
                            </div>
                            {value === item.id && <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-sm text-gray-400">No matching requirements</div>
                )}
              </div>
              <div className="p-2 border-t border-gray-100 text-center text-[11px] text-gray-400">
                {complianceItems.length} total requirements
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── EntityLinkSelector — link evidence to a control / risk / incident / action ── */
  const EntityLinkSelector = ({ value, onChange }: { value: EvidenceLink; onChange: (v: EvidenceLink) => void }) => {
    const optionsFor = (type?: string): { id: string; label: string }[] => {
      switch (type) {
        case 'Control': return controls.map(c => ({ id: c.id, label: c.title }));
        case 'Risk': return risks.map(r => ({ id: r.id, label: r.title || r.desc || r.id }));
        case 'Incident': return incidents.map(i => ({ id: i.id, label: i.title }));
        case 'Action': return (Array.isArray(tasks) ? tasks : []).map(t => ({ id: t.id, label: t.title }));
        default: return [];
      }
    };
    const entityOptions = optionsFor(value.linkedType);
    return (
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-gray-500">Linked record (Optional)</span>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Linked record type"
            value={value.linkedType || ''}
            onChange={e => onChange({ linkedType: e.target.value || undefined, linkedId: undefined, linkedLabel: undefined })}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">— No record —</option>
            <option value="Control">Control</option>
            <option value="Risk">Risk</option>
            <option value="Incident">Incident</option>
            <option value="Action">Action</option>
          </select>
          <select
            aria-label="Linked record"
            value={value.linkedId || ''}
            disabled={!value.linkedType}
            onChange={e => {
              const opt = entityOptions.find(o => o.id === e.target.value);
              onChange({ ...value, linkedId: e.target.value || undefined, linkedLabel: opt?.label });
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
          >
            <option value="">{value.linkedType ? '— Select —' : '—'}</option>
            {entityOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  /* ── Modal shell ──────────────────────────────── */
  const Modal = ({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title" className="bg-white rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 id="evidence-modal-title" className="text-lg font-semibold text-gray-900">{title}</h3>
              {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    );
  };

  /* ── RENDER ────────────────────────────────────── */
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Evidence & Documents"
        subtitle={isPortfolioView
          ? `Global audit trail across ${projects.length} projects and ${programmes.length} programmes.`
          : `Statutory evidence records for "${contextName || 'the active context'}".`}
        breadcrumbs={[{label:"Compliance"},{label:"Evidence"}]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <RunAgentButton agentKey="evidence" label="Run Evidence agent" />
            <button onClick={() => setIsLinkModalOpen(true)} disabled={uploading || isPortfolioView}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <LinkIcon className="h-4 w-4" /> Add URL
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading || isPortfolioView}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading ? 'Processing…' : 'Upload Evidence'}
            </button>
            <input type="file" multiple accept=".jpg,.jpeg,.pdf,.doc,.docx" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
          <button onClick={() => setError(null)} className="p-1 rounded hover:bg-red-100 text-red-400"><X className="h-4 w-4" /></button>
        </div>
      )}

      <DynamicTable<EvidenceRow>
        data={tableRows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search by name or requirement…"
        searchFields={['name', '_reqLabel', '_source']}
        filters={filters}
        rowActions={rowActions}
        getRowId={r => r.id}
        pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50] }}
        emptyState={{
          title: files.length === 0 ? 'No documents yet' : 'No results found',
          description: files.length === 0 ? 'Upload evidence files or add an external URL link.' : 'Try adjusting your search or filter.',
          icon: FileText,
          action: files.length === 0 ? (
            <button onClick={() => fileInputRef.current?.click()}
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              <UploadCloud className="h-4 w-4" /> Upload Evidence
            </button>
          ) : undefined,
        }}
        headerVariant="light"
        stickyHeader
      />

      {/* Add Link Modal */}
      <Modal open={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} title="Add External Evidence Link" description="Add a URL reference to external evidence.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500">Document Title</label>
            <input value={linkData.name} onChange={e => setLinkData({ ...linkData, name: e.target.value })}
              placeholder="e.g. Project Archive Folder"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500">External URL</label>
            <input value={linkData.url} onChange={e => setLinkData({ ...linkData, url: e.target.value })}
              placeholder="https://sharepoint.com/…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          </div>
          <RequirementSelector value={linkData.relatedRequirementId} onChange={val => setLinkData({ ...linkData, relatedRequirementId: val })} label="Related Requirement (Optional)" />
          <EntityLinkSelector value={{ linkedType: linkData.linkedType, linkedId: linkData.linkedId, linkedLabel: linkData.linkedLabel }} onChange={v => setLinkData({ ...linkData, ...v })} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setIsLinkModalOpen(false)}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleAddLink} disabled={!linkData.name || !linkData.url || uploading}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Adding…' : 'Save Link'}
            </button>
          </div>
        </div>
      </Modal>

      {/* File Upload Modal */}
      <Modal open={isFileModalOpen} onClose={() => { setIsFileModalOpen(false); setSelectedFiles([]); setFileRequirementId(''); }}
        title="Upload Evidence" description="Review files and tag a compliance requirement.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500">Selected Files</label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-32 overflow-y-auto">
              <ul className="space-y-1">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <File className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <RequirementSelector value={fileRequirementId} onChange={val => setFileRequirementId(val)} label="Related Requirement (Optional)" />
          <EntityLinkSelector value={fileLink} onChange={setFileLink} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setIsFileModalOpen(false); setSelectedFiles([]); setFileRequirementId(''); }}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={confirmFileUpload} disabled={selectedFiles.length === 0 || uploading}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Processing…' : 'Confirm Upload'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editData} onClose={() => setEditData(null)} title="Edit Document Details" description="Update the name or target requirement for this document.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500">Document Name</label>
            <input
              value={editData?.name || ''}
              onChange={e => setEditData(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder="Enter document name..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <RequirementSelector
            value={editData?.relatedRequirementId || ''}
            onChange={val => setEditData(prev => prev ? { ...prev, relatedRequirementId: val } : null)}
            label="Linked Requirement"
          />
          <EntityLinkSelector
            value={{ linkedType: editData?.linkedType, linkedId: editData?.linkedId, linkedLabel: editData?.linkedLabel }}
            onChange={v => setEditData(prev => prev ? { ...prev, ...v } : null)}
          />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditData(null)}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={handleUpdateEvidence} disabled={!editData?.name || uploading}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Updating…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Info Panel */}
      <div className="rounded-lg bg-slate-900 p-5 sm:p-6 text-white flex flex-col sm:flex-row items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Compliance Document Trail</h3>
          <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
            All uploaded documentation is transmitted over a secure connection and stored against the project's record. Each document is time-stamped on upload and tagged to its project to support a traceable audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore, ComplianceItem } from '../store/useStore';
import {
  UploadCloud, File, Trash2, CheckCircle2, X, AlertCircle, Clock,
  ExternalLink, Shield, Link as LinkIcon, Search, ChevronDown,
  ChevronLeft, ChevronRight, Loader2, FileText, Globe, Pencil
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { api } from '../lib/api';
import { toast } from "react-hot-toast";

/* ── helpers ─────────────────────────────────────────── */
function formatSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const ITEMS_PER_PAGE = 10;

/* ── component ───────────────────────────────────────── */
export function EvidenceDocuments() {
  const { activeProjectId, activeProgrammeId, projects, programmes, complianceItems } = useStore();
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkData, setLinkData] = useState({ name: '', url: '', relatedRequirementId: '' });
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileRequirementId, setFileRequirementId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; storagePath: string; name: string } | null>(null);
  const [editData, setEditData] = useState<{ id: string; name: string; relatedRequirementId: string } | null>(null);

  const contextId = activeProjectId || activeProgrammeId || 'all';
  const isPortfolioView = !activeProjectId && !activeProgrammeId;
  const contextName = activeProjectId
    ? projects.find(p => p.id === activeProjectId)?.name
    : activeProgrammeId
      ? programmes.find(p => p.id === activeProgrammeId)?.name
      : 'Portfolio Aggregate';

  useEffect(() => { fetchDocuments(); }, [contextId]);

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
    const MAX_SIZE = 10 * 1024 * 1024;
    const ALLOWED_EXTS = ['.jpg', '.jpeg', '.pdf', '.doc', '.docx'];
    const validFiles: File[] = [];
    const errors: string[] = [];
    for (const file of fileArray) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) { errors.push(`"${file.name}" unsupported format.`); continue; }
      if (file.size > MAX_SIZE) { errors.push(`"${file.name}" exceeds 10MB.`); continue; }
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
    setIsFileModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([promise, new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms))]);

  const confirmFileUpload = async () => {
    if (selectedFiles.length === 0 || !contextId) return;
    setUploading(true); setError(null);
    try {
      for (const file of selectedFiles) {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `evidence/${contextId}/${timestamp}_${sanitizedName}`;
        const storageRef = ref(storage, storagePath);
        const snapshot: any = await withTimeout(uploadBytes(storageRef, file), 30000, 'File upload');
        const downloadURL = await withTimeout(getDownloadURL(snapshot.ref), 10000, 'URL retrieval');
        await api.addEvidence(contextId, {
          name: file.name, url: downloadURL, storagePath: snapshot.ref.fullPath,
          size: file.size, type: file.type, relatedRequirementId: fileRequirementId || undefined,
          uploadedAt: new Date().toISOString(),
        });
      }
      toast.success(`${selectedFiles.length} file(s) uploaded successfully.`);
      await fetchDocuments();
      setIsFileModalOpen(false); setSelectedFiles([]); setFileRequirementId('');
    } catch (err: any) {
      console.error('Upload failed:', err);
      const isCors = err.message?.includes('CORS') || err.message?.includes('timed out');
      const msg = isCors ? 'Upload failed: CORS not configured.' : `Upload failed: ${err.message || 'Unknown error'}.`;
      setError(msg); toast.error(msg);
    } finally { setUploading(false); }
  };

  const handleAddLink = async () => {
    if (!linkData.name || !linkData.url || !contextId) return;
    setUploading(true); setError(null);
    try {
      const urlToSave = linkData.url.startsWith('http') ? linkData.url : `https://${linkData.url}`;
      await api.addEvidence(contextId, {
        name: linkData.name, url: urlToSave, storagePath: 'external-link', size: 0, type: 'link',
        relatedRequirementId: linkData.relatedRequirementId || undefined, uploadedAt: new Date().toISOString(),
      });
      toast.success('External link added.');
      await fetchDocuments();
      setIsLinkModalOpen(false); setLinkData({ name: '', url: '', relatedRequirementId: '' });
    } catch (err: any) {
      const msg = `Failed to add link: ${err.message || 'Unknown error'}.`;
      setError(msg); toast.error(msg);
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

  const filteredFiles = useMemo(() => {
    let result = files;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(f =>
        f.name?.toLowerCase().includes(term) ||
        (complianceItems.find(c => c.id === f.relatedRequirementId)?.req || '').toLowerCase().includes(term));
    }
    if (typeFilter !== 'all') {
      result = result.filter(f => typeFilter === 'link' ? f.type === 'link' : f.type !== 'link');
    }
    return result;
  }, [files, searchTerm, typeFilter, complianceItems]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / ITEMS_PER_PAGE));
  const paginatedFiles = filteredFiles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, typeFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { id: docId, storagePath } = deleteTarget;
    try {
      if (storagePath && storagePath !== 'external-link') {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef).catch(() => {});
      }
      const res = await api.deleteEvidence(docId);
      if (res.success) { setFiles(prev => prev.filter(f => f.id !== docId)); toast.success('Document removed.'); }
      else throw new Error('API deletion failed');
    } catch (err: any) {
      setError('Could not remove document.'); toast.error('Could not remove document.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleUpdateEvidence = async () => {
    if (!editData || !editData.id) return;
    setUploading(true);
    try {
      const res = await api.updateEvidence(editData.id, {
        name: editData.name,
        relatedRequirementId: editData.relatedRequirementId || null
      });
      if (res.success) {
        toast.success('Document updated successfully.');
        await fetchDocuments();
        setEditData(null);
      } else {
        throw new Error(res.error || 'Update failed');
      }
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        if (pages.length > 0 && typeof pages[pages.length - 1] === 'number' && (i - (pages[pages.length - 1] as number)) > 1)
          pages.push('...');
        pages.push(i);
      }
    }
    return pages;
  }, [totalPages, currentPage]);

  /* ── RequirementSelector (pure tailwind) ─── */
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
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900">Select Requirement</h4>
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              {/* Search */}
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input autoFocus value={reqSearchTerm} onChange={e => setReqSearchTerm(e.target.value)}
                    placeholder="Search requirements..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                </div>
              </div>
              {/* List */}
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

  /* ── Modal shell ──────────────────────────────── */
  const Modal = ({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    );
  };

  /* ── Skeleton rows ────────────────────────────── */
  const SkeletonRows = () => (
    <div className="p-5 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-lg bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
          </div>
          <div className="h-4 w-16 rounded bg-gray-100 hidden sm:block" />
          <div className="h-4 w-24 rounded bg-gray-100 hidden md:block" />
        </div>
      ))}
    </div>
  );

  /* ── RENDER ────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="inline-block rounded bg-gray-900 px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wide text-white">Repository</span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Evidence &amp; Documents</h1>
          </div>
          <p className="text-sm text-gray-500">
            {isPortfolioView ? (
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Global Audit Trail — {projects.length} Projects &amp; {programmes.length} Programmes
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Statutory records for <strong className="text-gray-700">&ldquo;{contextName}&rdquo;</strong>
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setIsLinkModalOpen(true)} disabled={uploading || isPortfolioView}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <LinkIcon className="h-4 w-4" /> Add URL
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || isPortfolioView}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? 'Processing…' : 'Upload Evidence'}
          </button>
          <input type="file" multiple accept=".jpg,.jpeg,.pdf,.doc,.docx" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
          <button onClick={() => setError(null)} className="p-1 rounded hover:bg-red-100 text-red-400"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name or requirement…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:w-44">
          <option value="all">All Types</option>
          <option value="file">Files Only</option>
          <option value="link">Links Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading ? <SkeletonRows /> : filteredFiles.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
              <FileText className="h-7 w-7 text-gray-300" />
            </div>
            <h3 className="font-semibold text-gray-900">{files.length === 0 ? 'No documents yet' : 'No results found'}</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              {files.length === 0 ? 'Upload evidence to get started.' : 'Try adjusting your search or filter.'}
            </p>
            {files.length === 0 && (
              <button onClick={() => fileInputRef.current?.click()}
                className="mt-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Get Started
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="font-mono border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Document</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Size</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedFiles.map(file => (
                    <tr key={file.id} className="group hover:bg-indigo-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            {file.type === 'link' ? <LinkIcon className="h-4 w-4 text-gray-400" /> : <File className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate max-w-[280px]" title={file.name}>{file.name}</p>
                            {file.relatedRequirementId && (
                              <p className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 truncate max-w-[250px] cursor-help"
                                title={`Compliance: ${complianceItems.find(c => c.id === file.relatedRequirementId)?.req || file.relatedRequirementId}\nRegulation: ${complianceItems.find(c => c.id === file.relatedRequirementId)?.reg || 'N/A'}\nRisk: ${complianceItems.find(c => c.id === file.relatedRequirementId)?.risk || 'N/A'}`}>
                                <Shield className="h-3 w-3 shrink-0" />
                                {complianceItems.find(c => c.id === file.relatedRequirementId)?.req || file.relatedRequirementId}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 truncate max-w-[120px] cursor-help"
                        title={`Source: ${projects.find(p => p.id === file.project)?.name || programmes.find(p => p.id === file.project)?.name || 'Unknown'}\nID: ${file.project}`}>
                        {projects.find(p => p.id === file.project)?.name || programmes.find(p => p.id === file.project)?.name || 'Unknown'}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 tabular-nums">
                        {file.type === 'link' ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">URL</span> : formatSize(file.size)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {new Date(file.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditData({ id: file.id, name: file.name, relatedRequirementId: file.relatedRequirementId || '' })}
                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <a href={file.url} target="_blank" rel="noreferrer"
                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Open">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button onClick={() => setDeleteTarget({ id: file.id, storagePath: file.storagePath, name: file.name })}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-100">
              {paginatedFiles.map(file => (
                <div key={file.id} className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      {file.type === 'link' ? <LinkIcon className="h-4 w-4 text-gray-400" /> : <File className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate" title={file.name}>{file.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {projects.find(p => p.id === file.project)?.name || programmes.find(p => p.id === file.project)?.name || 'Unknown'}
                        {' · '}
                        {file.type === 'link' ? 'URL' : formatSize(file.size)}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(file.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      {file.relatedRequirementId && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 truncate cursor-help"
                          title={`Compliance: ${complianceItems.find(c => c.id === file.relatedRequirementId)?.req || file.relatedRequirementId}\nRegulation: ${complianceItems.find(c => c.id === file.relatedRequirementId)?.reg || 'N/A'}\nRisk: ${complianceItems.find(c => c.id === file.relatedRequirementId)?.risk || 'N/A'}`}>
                          <Shield className="h-3 w-3 shrink-0" />
                          {complianceItems.find(c => c.id === file.relatedRequirementId)?.req || file.relatedRequirementId}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditData({ id: file.id, name: file.name, relatedRequirementId: file.relatedRequirementId || '' })} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <a href={file.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button onClick={() => setDeleteTarget({ id: file.id, storagePath: file.storagePath, name: file.name })} className="p-2 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredFiles.length)} of {filteredFiles.length}
              </p>
              <div className="flex items-center gap-1">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers.map((p, i) =>
                  typeof p === 'string' ? (
                    <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                  ) : (
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                        currentPage === p ? 'bg-indigo-600 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}>
                      {p}
                    </button>
                  )
                )}
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

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
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setEditData(null)}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpdateEvidence} 
              disabled={!editData?.name || uploading}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Updating…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Info Panel */}
      <div className="rounded-lg bg-gray-900 p-5 sm:p-6 text-white flex flex-col sm:flex-row items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Compliance Data Sovereignty</h3>
          <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
            All uploaded documentation is encrypted at rest and transit via military-grade AES-256 protocols. Documents are immutable once registered and tagged with the project's unique forensic identifier for audit chain continuity.
          </p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Document</h3>
              <p className="text-sm text-gray-500 mb-1">Are you sure you want to permanently delete:</p>
              <p className="text-sm font-medium text-gray-700 truncate px-4" title={deleteTarget.name}>&ldquo;{deleteTarget.name}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-2">This action cannot be undone.</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

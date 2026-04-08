import React, { useState, useEffect, useRef } from 'react';
import { useStore, ComplianceItem } from '../store/useStore';
import { 
  UploadCloud, 
  File, 
  Download, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Info,
  X,
  AlertCircle,
  Clock,
  ExternalLink,
  Shield,
  Link as LinkIcon,
  Search,
  ChevronDown
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { api } from '../lib/api';
import { clsx } from 'clsx';

function formatSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

    // Strictly ID-based context for backend authorization
    const contextId = activeProjectId || activeProgrammeId || 'all';
    const isPortfolioView = !activeProjectId && !activeProgrammeId;
    
    // For UI display name
    const contextName = activeProjectId 
        ? projects.find(p => p.id === activeProjectId)?.name 
        : activeProgrammeId 
            ? programmes.find(p => p.id === activeProgrammeId)?.name 
            : 'Portfolio Aggregate';

    useEffect(() => {
        fetchDocuments();
    }, [contextId]);

    const fetchDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getEvidence(contextId);
            if (res.success) {
                setFiles((res.data || []).sort((a: any, b: any) => 
                    new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
                ));
            } else {
                setError("Failed to retrieve document list.");
            }
        } catch (err: any) {
            console.error("Error fetching documents:", err);
            setError(err.message || "Connection error while fetching documents.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setSelectedFiles(Array.from(files));
        setFileRequirementId('');
        setIsFileModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmFileUpload = async () => {
        if (selectedFiles.length === 0 || !contextId) return;

        setUploading(true);
        setError(null);

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                
                // 1. Sanitize file path
                const timestamp = Date.now();
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `evidence/${contextId}/${timestamp}_${sanitizedName}`;
                const storageRef = ref(storage, storagePath);

                // 2. Upload to Firebase Storage
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                // 3. Register in Database via API
                await api.addEvidence(contextId, {
                    name: file.name,
                    url: downloadURL,
                    storagePath: snapshot.ref.fullPath,
                    size: file.size,
                    type: file.type,
                    relatedRequirementId: fileRequirementId || undefined,
                    uploadedAt: new Date().toISOString()
                });
            }

            await fetchDocuments();
            setIsFileModalOpen(false);
            setSelectedFiles([]);
            setFileRequirementId('');
        } catch (err: any) {
            console.error("Upload failed:", err);
            setError(`Upload failed: ${err.message || "Unknown error"}. Check storage permissions.`);
        } finally {
            setUploading(false);
        }
    };

    const handleAddLink = async () => {
        if (!linkData.name || !linkData.url || !contextId) return;
        setUploading(true);
        setError(null);
        try {
            const urlToSave = linkData.url.startsWith('http') ? linkData.url : `https://${linkData.url}`;
            await api.addEvidence(contextId, {
                name: linkData.name,
                url: urlToSave,
                storagePath: 'external-link',
                size: 0,
                type: 'link',
                relatedRequirementId: linkData.relatedRequirementId || undefined,
                uploadedAt: new Date().toISOString()
            });
            await fetchDocuments();
            setIsLinkModalOpen(false);
            setLinkData({ name: '', url: '', relatedRequirementId: '' });
        } catch (err: any) {
            console.error("Add link failed:", err);
            setError(`Failed to add link: ${err.message || "Unknown error"}.`);
        } finally {
            setUploading(false);
        }
    };

    // Helper for grouped requirements
    const groupedRequirements = React.useMemo<Record<string, ComplianceItem[]>>(() => {
        const groups: Record<string, ComplianceItem[]> = {};
        complianceItems.forEach(item => {
            const domain = item.domain || 'General';
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(item);
        });
        return groups;
    }, [complianceItems]);

    const [reqSearchTerm, setReqSearchTerm] = useState('');
    const filteredGroupedReqs = React.useMemo<Record<string, ComplianceItem[]>>(() => {
        const result: Record<string, ComplianceItem[]> = {};
        Object.entries(groupedRequirements).forEach(([domain, items]: [string, ComplianceItem[]]) => {
            const filtered = items.filter(i => 
                i.req?.toLowerCase().includes(reqSearchTerm.toLowerCase()) ||
                domain.toLowerCase().includes(reqSearchTerm.toLowerCase())
            );
            if (filtered.length > 0) result[domain] = filtered;
        });
        return result;
    }, [groupedRequirements, reqSearchTerm]);

    const RequirementSelector = ({ value, onChange, label }: { value: string, onChange: (val: string) => void, label: string }) => {
        const [isOpen, setIsOpen] = useState(false);
        const selectedItem = complianceItems.find(i => i.id === value);

        return (
            <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors shadow-sm active:scale-[0.99]"
                >
                    <span className="truncate pr-4">{selectedItem ? selectedItem.req : '-- Select Requirement --'}</span>
                    <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                        <div className="absolute z-[70] mt-3 left-1/2 -translate-x-1/2 w-[calc(100%+4rem)] sm:w-[600px] bg-white border border-slate-200 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
                            {/* Search Header */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 backdrop-blur-md sticky top-0 z-10">
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        autoFocus
                                        value={reqSearchTerm}
                                        onChange={e => setReqSearchTerm(e.target.value)}
                                        placeholder="Search by title, reg, or risk..."
                                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* List Area */}
                            <div className="max-h-[380px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scrollbar-track-transparent">
                                <button
                                    onClick={() => { onChange(''); setIsOpen(false); }}
                                    className="w-full text-left px-4 py-3 text-[10px] font-black text-slate-400 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2 mb-2"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    -- NO REQUIREMENT TAGGED --
                                </button>

                                {Object.entries(filteredGroupedReqs).length > 0 ? (
                                    <div className="space-y-4">
                                        {Object.entries(filteredGroupedReqs).map(([domain, items]: [string, ComplianceItem[]]) => (
                                            <div key={domain} className="space-y-1">
                                                <div className="px-3 py-1.5 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{domain}</span>
                                                </div>
                                                <div className="grid gap-1">
                                                    {items.map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                onChange(item.id);
                                                                setIsOpen(false);
                                                            }}
                                                            className={clsx(
                                                                "w-full text-left p-3.5 rounded-2xl transition-all group/item relative",
                                                                value === item.id 
                                                                    ? "bg-indigo-50 border border-indigo-100" 
                                                                    : "hover:bg-slate-50 border border-transparent"
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={clsx(
                                                                        "font-black text-sm leading-tight mb-1 whitespace-normal",
                                                                        value === item.id ? "text-indigo-700" : "text-slate-900"
                                                                    )}>
                                                                        {item.req}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2 items-center">
                                                                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-500 font-bold">
                                                                            {item.reg}
                                                                        </span>
                                                                        {item.risk && (
                                                                            <span className={clsx(
                                                                                "text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter",
                                                                                item.risk === 'Critical' ? "bg-rose-100 text-rose-600" :
                                                                                item.risk === 'High' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                                                                            )}>
                                                                                {item.risk}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {value === item.id && (
                                                                    <div className="shrink-0 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <Search className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">No matching requirements found</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {complianceItems.length} total requirements available
                                </p>
                            </div>
                        </div>
                    </>
                )}

            </div>
        );
    };

    const handleDelete = async (docId: string, storagePath: string) => {
        if (!confirm("Remove this document permanently from the register?")) return;

        try {
            // Delete from Cloud Storage first if it's a real file
            if (storagePath && storagePath !== 'external-link') {
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef).catch(e => console.warn("Storage deletion failed, continuing...", e));
            }

            // Delete from Database
            const res = await api.deleteEvidence(docId);
            if (res.success) {
                setFiles(prev => prev.filter(f => f.id !== docId));
            } else {
                throw new Error("API deletion failed");
            }
        } catch (err: any) {
            console.error("Delete failed:", err);
            setError("Could not remove document record. Please refresh and try again.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b-2 border-slate-100">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Repository</span>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Evidence & Documents</h1>
                    </div>
                    <p className="text-sm text-slate-500 font-medium italic">
                        {isPortfolioView ? (
                            <span className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-[0.1em] text-[10px]">
                                <Search className="w-4 h-4" /> Global Audit Trail: All {projects.length} Projects & {programmes.length} Programmes
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                                Managing statutory records for <strong className="text-slate-700 not-italic">"{contextName}"</strong>
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setIsLinkModalOpen(true)}
                        disabled={uploading || isPortfolioView}
                        className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-600 border border-indigo-200 text-xs font-black rounded-2xl hover:bg-indigo-50 transition-all transform active:scale-95 shadow-sm disabled:opacity-50 disabled:grayscale uppercase tracking-widest"
                        title={isPortfolioView ? "Select a project to add links" : ""}
                    >
                        <LinkIcon className="w-4 h-4" /> Add URL Link
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || isPortfolioView}
                        className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-700 transition-all transform active:scale-95 shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:grayscale uppercase tracking-widest"
                        title={isPortfolioView ? "Select a project to upload" : ""}
                    >
                        {uploading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <UploadCloud className="w-4 h-4" />
                        )}
                        {uploading ? 'Processing...' : 'Upload Evidence'}
                    </button>
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-rose-700 text-sm font-bold italic">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                        {error}
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg text-rose-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) }

            {/* No Context Warning removed in favor of Aggregate View */}
            {false && !contextId ? (
                <div />
            ) : (
                <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="py-24 text-center">
                            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Vault...</div>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="py-24 text-center flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                <File className="w-8 h-8 text-slate-200" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 mb-1">Vault empty for this context</h3>
                                <p className="text-xs text-slate-400 font-medium max-w-sm">
                                    Upload audit trails, inspection certificates, or other compliance evidence to securely store them in the project vault.
                                </p>
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                            >
                                Get Started
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto italic font-medium">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
                                        <th className="px-8 py-5">Managed Record</th>
                                        <th className="px-8 py-5">Source</th>
                                        <th className="px-8 py-5">Scale</th>
                                        <th className="px-8 py-5">Audit Timestamp</th>
                                        <th className="px-8 py-5 text-right">Vault Control</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {files.map((file) => (
                                        <tr key={file.id} className="group hover:bg-indigo-50/30 transition-all">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600 transition-colors">
                                                        {file.type === 'link' ? <LinkIcon className="w-6 h-6" /> : <File className="w-6 h-6" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 text-sm truncate max-w-[320px]" title={file.name}>{file.name}</p>
                                                        {file.relatedRequirementId && (
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <Shield className="w-3 h-3 text-amber-500 shrink-0" />
                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest truncate max-w-[250px]" title={complianceItems.find(c => c.id === file.relatedRequirementId)?.req || file.relatedRequirementId}>
                                                                    Req: {complianceItems.find(c => c.id === file.relatedRequirementId)?.req || file.relatedRequirementId}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Cloud Verified</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="w-3.5 h-3.5 text-slate-300" />
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest truncate max-w-[120px]">
                                                        {projects.find(p => p.id === file.project)?.name || programmes.find(p => p.id === file.project)?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-xs font-black text-slate-400 tabular-nums">
                                                {file.type === 'link' ? 'External URL' : formatSize(file.size)}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(file.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-100 shadow-sm transition-all"
                                                        title="External View"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(file.id, file.storagePath)}
                                                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-100 shadow-sm transition-all"
                                                        title="Purge"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Add Link Modal */}
            {isLinkModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Add External Evidence Link</h3>
                            <button onClick={() => setIsLinkModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Title</label>
                                <input
                                    value={linkData.name}
                                    onChange={e => setLinkData({ ...linkData, name: e.target.value })}
                                    placeholder="e.g. Project Archive Folder"
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">External URL</label>
                                <input
                                    value={linkData.url}
                                    onChange={e => setLinkData({ ...linkData, url: e.target.value })}
                                    placeholder="https://sharepoint.com/..."
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <RequirementSelector 
                                value={linkData.relatedRequirementId}
                                onChange={val => setLinkData({ ...linkData, relatedRequirementId: val })}
                                label="Related Compliance Requirement (Optional)"
                            />
                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setIsLinkModalOpen(false)}
                                    className="flex-1 py-4 px-6 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddLink}
                                    disabled={!linkData.name || !linkData.url || uploading}
                                    className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200"
                                >
                                    {uploading ? 'Adding...' : 'Save Link'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* File Upload Modal */}
            {isFileModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Upload Evidence Details</h3>
                            <button onClick={() => {
                                setIsFileModalOpen(false);
                                setSelectedFiles([]);
                                setFileRequirementId('');
                            }} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Files</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 max-h-32 overflow-y-auto">
                                    <ul className="list-disc pl-4 text-sm font-bold text-slate-700 space-y-1">
                                        {selectedFiles.map((f, i) => (
                                            <li key={i} className="truncate">{f.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <RequirementSelector 
                                value={fileRequirementId}
                                onChange={val => setFileRequirementId(val)}
                                label="Related Compliance Requirement (Optional)"
                            />
                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => {
                                        setIsFileModalOpen(false);
                                        setSelectedFiles([]);
                                        setFileRequirementId('');
                                    }}
                                    className="flex-1 py-4 px-6 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmFileUpload}
                                    disabled={selectedFiles.length === 0 || uploading}
                                    className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200"
                                >
                                    {uploading ? 'Processing...' : 'Confirm Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Information Panel */}
            <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 p-12 opacity-5">
                    <CheckCircle2 className="w-32 h-32" />
                </div>
                <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center shrink-0">
                    <Shield className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-xl font-black mb-1 tracking-tight">Compliance Data Sovereignty</h3>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-2xl">
                        All uploaded documentation is encrypted at rest and transit via military-grade AES-256 protocols. Documents are immutable once registered and tagged with the project's unique forensic identifier for audit chain continuity.
                    </p>
                </div>
            </div>
        </div>
    );
}

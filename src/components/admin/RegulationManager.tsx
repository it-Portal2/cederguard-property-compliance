import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Plus, Search, Filter, Edit2, Trash2, 
    Save, X, ChevronDown, AlertCircle, CheckCircle2,
    Loader2, Layers, Tag, Info, AlertTriangle, BookOpen
} from 'lucide-react';
import { useStore, type ComplianceItem as GlobalComplianceItem } from '../../store/useStore';
import { api } from '../../lib/api';
import { clsx } from 'clsx';

interface ComplianceItem {
    id: string;
    domain: string;
    reg: string;
    auth: string;
    risk: 'High' | 'Medium' | 'Low';
    req: string;
    penalty: string;
    trigger: string;
    stage_link: string;
    tasks: string[];
    dod: string;
    auto?: string;
}

interface Domain {
    id: string;
    label: string;
    color: string;
    abbr: string;
}

export function RegulationManager() {
    const { remoteDomains, setRemoteDomains } = useStore();
    const [activeTab, setActiveTab] = useState<'items' | 'domains'>('items');
    const [items, setItems] = useState<ComplianceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    
    // Filters & Search
    const [search, setSearch] = useState('');
    const [domainFilter, setDomainFilter] = useState('all');
    const [riskFilter, setRiskFilter] = useState('all');

    // Editing State
    const [editingItem, setEditingItem] = useState<Partial<ComplianceItem> | null>(null);
    const [editingDomain, setEditingDomain] = useState<Partial<Domain> | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [itemsRes, domainsRes] = await Promise.all([
                api.getComplianceLibrary(),
                api.getComplianceDomains()
            ]);

            if (itemsRes.success) setItems(itemsRes.items || []);
            if (domainsRes.success) setRemoteDomains(domainsRes.domains || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [setRemoteDomains]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveItem = async (item: Partial<ComplianceItem>) => {
        if (!item.domain || !item.reg || !item.req) {
            setError('Please fill in required fields (Domain, Regulation, Requirement)');
            return;
        }

        setSaving(item.id || 'new');
        try {
            const res = await api.upsertComplianceLibraryItem(item);
            if (res.success) {
                setSuccess('Item saved successfully');
                setEditingItem(null);
                loadData();
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(res.error || 'Failed to save item');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(null);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Are you sure you want to delete this compliance item?')) return;
        
        try {
            const res = await api.deleteComplianceLibraryItem(id);
            if (res.success) {
                setItems(prev => prev.filter(i => i.id !== id));
                setSuccess('Item deleted');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (e: any) {
            setError('Delete failed: ' + e.message);
        }
    };

    const handleSaveDomain = async (domain: Partial<Domain>) => {
        if (!domain.id || !domain.label || !domain.abbr) {
            setError('Please fill in required fields (ID, Label, Abbreviation)');
            return;
        }

        setSaving(domain.id);
        try {
            const res = await api.upsertComplianceDomain(domain as any);
            if (res.success) {
                setSuccess('Domain saved successfully');
                setEditingDomain(null);
                loadData();
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(res.error || 'Failed to save domain');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(null);
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.reg.toLowerCase().includes(search.toLowerCase()) || 
                             item.req.toLowerCase().includes(search.toLowerCase());
        const matchesDomain = domainFilter === 'all' || item.domain === domainFilter;
        const matchesRisk = riskFilter === 'all' || item.risk === riskFilter;
        return matchesSearch && matchesDomain && matchesRisk;
    });

    const getDomainColor = (domainId: string) => {
        return remoteDomains.find(d => d.id === domainId)?.color || '#94a3b8';
    };

    const getDomainLabel = (domainId: string) => {
        return remoteDomains.find(d => d.id === domainId)?.label || domainId;
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-600" />
                        Regulation Manager
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Manage the global compliance library and architectural domain definitions.</p>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'items' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        Compliance Items
                    </button>
                    <button
                        onClick={() => setActiveTab('domains')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'domains' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        Domains
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">{success}</span>
                </div>
            )}

            {activeTab === 'items' ? (
                <div className="space-y-4">
                    {/* Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search regulations or requirements..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                        </div>
                        <div className="relative">
                            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={domainFilter}
                                onChange={e => setDomainFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm appearance-none outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="all">All Domains</option>
                                {remoteDomains.map(d => (
                                    <option key={d.id} value={d.id}>{d.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        <button
                            onClick={() => setEditingItem({ risk: 'High', tasks: [], domain: remoteDomains[0]?.id || '' })}
                            className="bg-indigo-600 text-white rounded-lg font-bold py-2.5 px-4 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                        >
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                    </div>

                    {/* Form for New/Edit */}
                    {editingItem && (
                        <ItemForm 
                            item={editingItem} 
                            domains={remoteDomains}
                            onSave={handleSaveItem}
                            onCancel={() => setEditingItem(null)}
                            isSaving={saving === (editingItem.id || 'new')}
                        />
                    )}

                    {/* items grid */}
                    <div className="grid grid-cols-1 gap-4">
                        {filteredItems.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-lg py-20 text-center">
                                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-slate-900 font-bold">No items found</h3>
                                <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters.</p>
                            </div>
                        ) : (
                        filteredItems.map(item => (
                            <div key={item.id}>
                                <ItemCard 
                                    item={item} 
                                    domainLabel={getDomainLabel(item.domain)}
                                    domainColor={getDomainColor(item.domain)}
                                    onEdit={() => setEditingItem(item)}
                                    onDelete={() => handleDeleteItem(item.id)}
                                />
                            </div>
                        ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Compliance Domains</h3>
                        <button
                            onClick={() => setEditingDomain({ color: '#6366f1', abbr: '', label: '' })}
                            className="bg-slate-900 text-white rounded-lg text-xs font-bold py-2 px-4 flex items-center gap-2 hover:bg-slate-800 transition-all"
                        >
                            <Plus className="w-4 h-4" /> New Domain
                        </button>
                    </div>

                    {editingDomain && (
                        <DomainForm 
                            domain={editingDomain}
                            onSave={handleSaveDomain}
                            onCancel={() => setEditingDomain(null)}
                            isSaving={saving === editingDomain.id}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {remoteDomains.map(domain => (
                            <div key={domain.id}>
                                <DomainCard 
                                    domain={domain}
                                    onEdit={() => setEditingDomain(domain)}
                                    isSaving={saving === domain.id}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ItemCard({ item, domainLabel, domainColor, onEdit, onDelete }: { 
    item: ComplianceItem; 
    domainLabel: string;
    domainColor: string;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-indigo-200 transition-all group">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                    <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: domainColor }} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{domainLabel}</span>
                            <span className={clsx(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                item.risk === 'High' ? "bg-red-50 text-red-600" :
                                item.risk === 'Medium' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                                {item.risk} Risk
                            </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{item.reg}</h4>
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{item.req}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-50">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Authority</p>
                    <p className="text-xs font-bold text-slate-700">{item.auth}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Trigger</p>
                    <p className="text-xs font-bold text-slate-700">{item.trigger}</p>
                </div>
                <div className="col-span-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Penalty</p>
                    <p className="text-xs text-slate-500 truncate">{item.penalty}</p>
                </div>
            </div>
        </div>
    );
}

function ItemForm({ item, domains, onSave, onCancel, isSaving }: { 
    item: Partial<ComplianceItem>; 
    domains: Domain[];
    onSave: (item: Partial<ComplianceItem>) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [formData, setFormData] = useState(item);

    return (
        <div className="bg-slate-50 border-2 border-indigo-200 rounded-lg p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-600" />
                    {item.id ? 'Edit Compliance Item' : 'New Compliance Item'}
                </h3>
                <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Domain *</label>
                    <select
                        value={formData.domain}
                        onChange={e => setFormData({ ...formData, domain: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                    >
                        {domains.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Regulation *</label>
                    <input
                        value={formData.reg}
                        onChange={e => setFormData({ ...formData, reg: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. Building Safety Act 2022"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Authority</label>
                    <input
                        value={formData.auth}
                        onChange={e => setFormData({ ...formData, auth: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. BSR"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Requirement *</label>
                <textarea
                    value={formData.req}
                    onChange={e => setFormData({ ...formData, req: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm min-h-[80px]"
                    placeholder="Describe the compliance requirement..."
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Trigger Event</label>
                    <input
                        value={formData.trigger}
                        onChange={e => setFormData({ ...formData, trigger: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. Completion / Pre-handover"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Risk Level</label>
                    <div className="flex gap-2">
                        {(['High', 'Medium', 'Low'] as const).map(risk => (
                            <button
                                key={risk}
                                onClick={() => setFormData({ ...formData, risk })}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg text-xs font-bold border transition-all",
                                    formData.risk === risk 
                                        ? (risk === 'High' ? "bg-red-600 border-red-600 text-white" : 
                                           risk === 'Medium' ? "bg-amber-500 border-amber-500 text-white" : 
                                           "bg-emerald-600 border-emerald-600 text-white")
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {risk}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Penalty / Risk Source</label>
                    <input
                        value={formData.penalty}
                        onChange={e => setFormData({ ...formData, penalty: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. Stop notices, fines, criminal liability"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Definition of Done (DoD)</label>
                    <input
                        value={formData.dod}
                        onChange={e => setFormData({ ...formData, dod: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. BSR Gateway 3 approval letter"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button onClick={onCancel} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
                <button
                    onClick={() => onSave(formData)}
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Compliance Item
                </button>
            </div>
        </div>
    );
}

function DomainCard({ domain, onEdit, isSaving }: { domain: Domain; onEdit: () => void; isSaving: boolean }) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-indigo-200 transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white shadow-lg" style={{ backgroundColor: domain.color }}>
                        {domain.abbr}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">{domain.label}</h4>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{domain.id}</p>
                    </div>
                </div>
                <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Edit2 className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-xs text-slate-500 font-medium">Color: <code className="bg-slate-50 px-1 rounded">{domain.color}</code></span>
                <div className="w-4 h-4 rounded-full border border-slate-100" style={{ backgroundColor: domain.color }} />
            </div>
        </div>
    );
}

function DomainForm({ domain, onSave, onCancel, isSaving }: { 
    domain: Partial<Domain>; 
    onSave: (domain: Partial<Domain>) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [formData, setFormData] = useState(domain);

    return (
        <div className="bg-slate-50 border-2 border-indigo-200 rounded-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-600" />
                    {domain.id ? 'Edit Domain' : 'New Domain'}
                </h3>
                <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Domain ID (immutable for existing) *</label>
                    <input
                        value={formData.id}
                        disabled={!!domain.id}
                        onChange={e => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s/g, '') })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm disabled:bg-slate-100"
                        placeholder="e.g. hs"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Label *</label>
                    <input
                        value={formData.label}
                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. Health & Safety"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Abbreviation *</label>
                    <input
                        value={formData.abbr}
                        maxLength={5}
                        onChange={e => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm"
                        placeholder="e.g. H&S"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Brand Color *</label>
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={formData.color}
                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                            className="h-10 w-20 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        />
                        <input
                            value={formData.color}
                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                            className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-sm uppercase"
                            placeholder="#000000"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button onClick={onCancel} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
                <button
                    onClick={() => onSave(formData)}
                    disabled={isSaving}
                    className="bg-slate-900 text-white px-8 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Domain
                </button>
            </div>
        </div>
    );
}

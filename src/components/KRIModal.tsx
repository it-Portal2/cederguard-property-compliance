import { useState, useEffect } from 'react';
import { KRI, useStore } from '../store/useStore';
import { X, AlertTriangle, Target } from 'lucide-react';
import { KRI_METADATA, KRI_OWNERS } from '../data/riskData';
import { clsx } from 'clsx';

import { Loader2 } from 'lucide-react';

interface KRIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (kri: Partial<KRI>) => Promise<void> | void;
    initialData?: KRI | null;
}

const emptyForm = (): Partial<KRI> => ({
    name: '',
    owner: '',
    totalRisks: 0,
    highRisks: 0,
    overdue: 0,
    overduePct: 0,
    avgRiskAge: 0,
    projectsPct: 0,
    residualExposure: 0,
    riskReductionPct: 0,
    status: 'Green',
    escalation: 'None',
});

export function KRIModal({ isOpen, onClose, onSave, initialData }: KRIModalProps) {
    const [formData, setFormData] = useState<Partial<KRI>>(emptyForm());
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData(emptyForm());
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (field: keyof KRI, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await onSave(formData);
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{initialData ? 'Edit KRI' : 'Add New KRI'}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <datalist id="kri-names">
                    {Object.keys(KRI_METADATA).map(name => (
                        <option key={name} value={name} />
                    ))}
                </datalist>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">KRI Name <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                list="kri-names"
                                value={formData.name || ''} 
                                onChange={e => {
                                    const val = e.target.value;
                                    handleChange('name', val);
                                    if (KRI_METADATA[val]) {
                                        const meta = KRI_METADATA[val];
                                        setFormData(prev => ({
                                            ...prev,
                                            name: val,
                                            components: meta.components,
                                            thresholdType: meta.thresholdType,
                                            green: meta.green,
                                            amber: meta.amber,
                                            owner: KRI_OWNERS[val] || prev.owner
                                        }));
                                    }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="Select or type a KRI Name" required />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">KRI Components</label>
                            <textarea value={formData.components || ''} onChange={e => handleChange('components', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                                placeholder="e.g. Building Control delays, Fire safety compliance..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                            <input type="text" value={formData.owner || ''} onChange={e => handleChange('owner', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                placeholder="E.g. Jane Cooper" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Escalation</label>
                            <select value={formData.escalation || 'None'} onChange={e => handleChange('escalation', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                                <option value="None">None</option>
                                <option value="Project">Project</option>
                                <option value="Programme">Programme</option>
                            </select>
                        </div>
                        
                        <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">Threshold Configuration</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Threshold Type</label>
                                    <select 
                                        value={formData.thresholdType || 'high_risks'} 
                                        onChange={e => handleChange('thresholdType', e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="high_risks">High Risks Count</option>
                                        <option value="overdue">Overdue Count</option>
                                        <option value="pct_overdue">Overdue Percentage</option>
                                        <option value="avg_age">Average Risk Age</option>
                                        <option value="project_pct">Project Impact %</option>
                                        <option value="residual_exp">Residual Exposure (£)</option>
                                        <option value="reduction_pct">Risk Reduction %</option>
                                    </select>
                                    <p className="mt-1 text-[9px] text-slate-400 italic">
                                        {formData.thresholdType === 'residual_exp' ? 'Supports £, K, M units' : 
                                         formData.thresholdType?.includes('pct') ? 'Enter as percentage (e.g. 20%)' : 
                                         'Numeric count or range'}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Green Bound</label>
                                    <input type="text" value={formData.green || ''} onChange={e => handleChange('green', e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-inner"
                                        placeholder="e.g. <=3 or <=£2M" />
                                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter">Healthy boundary</span>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amber Range</label>
                                    <input type="text" value={formData.amber || ''} onChange={e => handleChange('amber', e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-inner"
                                        placeholder="e.g. 4-6 or £2M-£4M" />
                                    <span className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter">Cautionary range</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Manual Overrides / Fallbacks</h3>
                            <span className="text-[9px] text-slate-400 font-bold italic">Values are auto-calculated if risks are linked</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Risks', field: 'totalRisks' },
                                { label: 'High', field: 'highRisks' },
                                { label: 'Overdue', field: 'overdue' },
                                { label: 'Age (d)', field: 'avgRiskAge' },
                                { label: 'Exp (£k)', field: 'residualExposure', transform: (v: any) => v * 1000 },
                                { label: 'Reduc %', field: 'riskReductionPct' }
                            ].map(item => (
                                <div key={item.field}>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{item.label}</label>
                                    <input 
                                        type="number" 
                                        value={formData[item.field as keyof KRI] ?? 0} 
                                        onChange={e => handleChange(item.field as keyof KRI, parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500" 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={!formData.name || isSubmitting}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center min-w-[120px]">
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : initialData ? (
                            'Update KRI'
                        ) : (
                            'Create KRI'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

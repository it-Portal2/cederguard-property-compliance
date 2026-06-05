import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import { DEFAULT_PRICING } from '../../features/admin/pages/InvoiceManager';
import { Loader2, Save } from 'lucide-react';

export function PricingTab() {
    const { pricingConfig, fetchPricingConfig, addNotification } = useStore();
    const [config, setConfig] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!pricingConfig) {
            fetchPricingConfig();
        }
    }, [pricingConfig]);

    useEffect(() => {
        const base = JSON.parse(JSON.stringify(DEFAULT_PRICING));
        if (pricingConfig) {
            const merged = {
                ...base,
                ...pricingConfig,
                firestore: { ...base.firestore, ...(pricingConfig.firestore || {}) },
                gemini: { ...base.gemini, ...(pricingConfig.gemini || {}) },
                vercel: { ...base.vercel, ...(pricingConfig.vercel || {}) },
                firebaseStorage: { ...base.firebaseStorage, ...(pricingConfig.firebaseStorage || {}) },
                support: { ...base.support, ...(pricingConfig.support || {}) },
                training: { ...base.training, ...(pricingConfig.training || {}) },
                devOps: { ...base.devOps, ...(pricingConfig.devOps || {}) },
            };
            setConfig(merged);
        } else if (!config) {
            setConfig(base);
        }
    }, [pricingConfig]);

    const updateConfig = (path: string[], val: number) => {
        setConfig((prev: any) => {
            const next = { ...prev };
            let curr = next;
            for (let i = 0; i < path.length - 1; i++) {
                curr[path[i]] = { ...curr[path[i]] };
                curr = curr[path[i]];
            }
            curr[path[path.length - 1]] = val;
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.adminUpdatePricingConfig(config);
            await fetchPricingConfig();
            addNotification({ title: 'Pricing Saved', body: 'Pricing configuration saved successfully!', type: 'system' });
        } catch (e: any) {
            addNotification({ title: 'Save Failed', body: 'Failed to save: ' + e.message, type: 'system' });
        } finally {
            setSaving(false);
        }
    };

    if (!config) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    const renderInput = (label: string, value: number, path: string[]) => (
        <div key={path.join('.')}>
            <label className="block text-xs font-medium text-slate-500 mb-1 truncate" title={label}>{label}</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 sm:text-sm">$</span>
                </div>
                <input
                    type="number"
                    value={value || 0}
                    onChange={(e) => updateConfig(path, parseFloat(e.target.value) || 0)}
                    className="block w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Pricing & Cost Configuration</h2>
                    <p className="text-sm text-slate-500">Manage base rates, multipliers, and fixed costs used in the Cost Calculator.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Configuration
                </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-8 shadow-sm">
                
                {/* Infrastructure & SaaS Sections */}
                {['firestore', 'gemini', 'vercel', 'firebaseStorage', 'support', 'training', 'devOps'].map(sectionKey => (
                    <div key={sectionKey}>
                        <h3 className="font-mono text-md font-semibold text-slate-800 mb-4 border-b pb-2 uppercase tracking-wide">
                            {sectionKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(config[sectionKey] || {}).map(([k, v]) => 
                                typeof v === 'number' ? renderInput(k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), v as number, [sectionKey, k]) : null
                            )}
                        </div>
                    </div>
                ))}

                {/* Legacy/Other Sections (if any) */}
                {Object.entries(config).map(([key, val]) => {
                    if (['firestore', 'gemini', 'vercel', 'firebaseStorage', 'support', 'training', 'devOps', 'usdToGbp'].includes(key)) return null;
                    if (typeof val !== 'object' || val === null) return null;
                    return (
                        <div key={key}>
                            <h3 className="font-mono text-md font-semibold text-slate-800 mb-4 border-b pb-2 uppercase tracking-wide">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(val).map(([k, v]) => 
                                    typeof v === 'number' ? renderInput(k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), v as number, [key, k]) : null
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Conversion Rates */}
                <div>
                    <h3 className="text-md font-semibold text-slate-800 mb-4 border-b pb-2">Global Settings</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderInput('USD to GBP Rate', config.usdToGbp, ['usdToGbp'])}
                    </div>
                </div>
            </div>
        </div>
    );
}

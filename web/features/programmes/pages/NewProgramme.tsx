import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Save, ArrowLeft, Target, Shield, LayoutTemplate, Users, Loader2 as LoaderIcon } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { api } from '../../../lib/api';
import { isAtLeastClientAdmin } from '../../../lib/roles';
import { useEffect } from 'react';
import type { Programme } from '../../../store/useStore';
import PageHeader from '../../../components/PageHeader';

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors bg-white";
const labelCls = "font-mono block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";

export function NewProgramme() {
    const navigate = useNavigate();
    const { setProgrammes, programmes, setActiveProgramme, user } = useStore();
    const [saving, setSaving] = useState(false);
    const userRole = user?.role || (user as any)?.profile?.role;

    useEffect(() => {
        if (user && !isAtLeastClientAdmin(userRole)) {
            navigate('/programmes');
        }
    }, [user, userRole, navigate]);
    const formRef = React.useRef<HTMLFormElement>(null);

    const loadDummyData = () => {
        if (!formRef.current) return;
        const form = formRef.current;
        (form.elements.namedItem('name') as HTMLInputElement).value = 'Demo - Tower Decarbonisation';
        (form.elements.namedItem('reference') as HTMLInputElement).value = 'PRG-DEC-001';
        (form.elements.namedItem('type') as HTMLSelectElement).value = 'Decarbonisation / Retrofit';
        (form.elements.namedItem('geographicScope') as HTMLInputElement).value = 'London Portfolio - North Region';

        (form.elements.namedItem('sro') as HTMLInputElement).value = 'Jane Doe (Director of Sustainability)';
        (form.elements.namedItem('pm') as HTMLInputElement).value = 'John Smith (Senior PM)';
        (form.elements.namedItem('sponsor') as HTMLInputElement).value = 'Executive Board';
        (form.elements.namedItem('boardComposition') as HTMLInputElement).value = 'Sustainability, Finance, Operations, Legal';
        (form.elements.namedItem('reportingCycle') as HTMLSelectElement).value = 'Monthly to Programme Board';
        (form.elements.namedItem('governanceFramework') as HTMLInputElement).value = 'Green Capital Governance v2.0';

        (form.elements.namedItem('strategicObjectives') as HTMLTextAreaElement).value = 'Achieve EPC C minimum across all 15 included towers. Reduce carbon footprint by 30% by 2028.';
        (form.elements.namedItem('programmeStartDate') as HTMLInputElement).value = '2024-04-01';
        (form.elements.namedItem('programmeEndDate') as HTMLInputElement).value = '2028-12-31';
        (form.elements.namedItem('totalUnits') as HTMLInputElement).value = '1,200';
        (form.elements.namedItem('totalValue') as HTMLInputElement).value = '£45M';

        (form.elements.namedItem('totalGrant') as HTMLInputElement).value = '£15M SHDF Wave 2';
        (form.elements.namedItem('contingencyPct') as HTMLInputElement).value = '£4.5M (10%)';
        (form.elements.namedItem('riskAppetite') as HTMLTextAreaElement).value = 'Low risk appetite for health & safety (asbestos, fire stopping). Moderate appetite for supply chain delays.';
        (form.elements.namedItem('resourceConstraints') as HTMLInputElement).value = 'Shortage of qualified retrofit coordinators.';
        (form.elements.namedItem('keyDependencies') as HTMLInputElement).value = 'Tenant engagement approvals, Supplier mobilization';
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, isDraft: boolean = false) => {
        e.preventDefault();
        setSaving(true);
        const formData = new FormData(e.currentTarget);

        try {
            const newProg: Programme = {
                id: `PROG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                reference: formData.get('reference') as string,
                name: formData.get('name') as string,
                type: formData.get('type') as string,
                status: isDraft ? 'Draft' : 'Active',
                sro: formData.get('sro') as string,
                pm: formData.get('pm') as string,
                sponsor: formData.get('sponsor') as string,
                boardComposition: formData.get('boardComposition') as string,
                reportingCycle: formData.get('reportingCycle') as string,
                governanceFramework: formData.get('governanceFramework') as string,
                strategicObjectives: formData.get('strategicObjectives') as string,
                geographicScope: formData.get('geographicScope') as string,
                programmeStartDate: formData.get('programmeStartDate') as string,
                programmeEndDate: formData.get('programmeEndDate') as string,
                createdBy: 'System Admin',
                totalProjects: 0,
                totalUnits: formData.get('totalUnits') as string,
                totalValue: formData.get('totalValue') as string,
                totalGrant: formData.get('totalGrant') as string,
                contingencyPct: formData.get('contingencyPct') as string,
                riskAppetite: formData.get('riskAppetite') as string,
                fundingSources: formData.get('fundingSources') as string,
                resourceConstraints: formData.get('resourceConstraints') as string,
                keyDependencies: (formData.get('keyDependencies') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                criticalSuccessFactors: (formData.get('criticalSuccessFactors') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                boardMembers: (formData.get('boardMembers') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                rshStandards: (formData.get('rshStandards') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                regulatoryObligations: (formData.get('regulatoryObligations') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                hrbScheme: formData.get('hrbScheme') as string,
                leaseholderStatus: formData.get('leaseholderStatus') as string,
                knownStrategicRisks: formData.get('knownStrategicRisks') as string,
                notes: formData.get('notes') as string,
                createdAt: new Date().toISOString(),
            };

            const safeProgrammes = Array.isArray(programmes) ? programmes : [];
            const updatedProgrammes = [...safeProgrammes, newProg];
            setProgrammes(updatedProgrammes);
            setActiveProgramme(newProg.id as any);

            await api.saveData('programmes', updatedProgrammes);

            if (isDraft) {
                navigate('/programmes');
            } else {
                navigate('/risk/programme-context');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
                <PageHeader
                    title="Create New Programme"
                    subtitle="Set up a high-level programme context to aggregate projects and strategic risks."
                    breadcrumbs={[{label:"Programme Initiation"},{label:"New Programme"}]}
                />
                <button type="button" onClick={loadDummyData} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-2 py-1 bg-indigo-50 rounded-lg transition-all border border-indigo-100 hover:border-indigo-200"><LayoutTemplate className="w-3.5 h-3.5" /> Load Dummy Data</button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                {/* General Info */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                        <h2 className="font-semibold text-slate-800">Programme Identity</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelCls}>Programme Name *</label>
                            <input name="name" required className={inputCls} placeholder="e.g. Urban Regeneration Programme" />
                        </div>
                        <div>
                            <label className={labelCls}>Unique Reference</label>
                            <input name="reference" className={inputCls} placeholder="e.g. SCP-2024-01" />
                        </div>
                        <div>
                            <label className={labelCls}>Programme Type</label>
                            <select name="type" className={inputCls}>
                                <option>Mixed – HRB & Regeneration</option>
                                <option>HRB Only</option>
                                <option>Decarbonisation / Retrofit</option>
                                <option>Capital Works</option>
                                <option>Estate Regeneration</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Geographic Scope</label>
                            <input name="geographicScope" className={inputCls} placeholder="e.g. Central Region" />
                        </div>
                    </div>
                </div>

                {/* Governance & Leadership */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <h2 className="font-semibold text-slate-800">Governance & Leadership</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className={labelCls}>SRO (Senior Responsible Owner)</label>
                            <input name="sro" className={inputCls} placeholder="e.g. Director of Housing" />
                        </div>
                        <div>
                            <label className={labelCls}>Lead Programme Manager</label>
                            <input name="pm" className={inputCls} placeholder="e.g. Senior PM" />
                        </div>
                        <div>
                            <label className={labelCls}>Executive Sponsor</label>
                            <input name="sponsor" className={inputCls} placeholder="Cabinet Member" />
                        </div>
                        <div className="col-span-1 md:col-span-3">
                            <label className={labelCls}>Board Composition</label>
                            <input name="boardComposition" className={inputCls} placeholder="Housing, Finance, Legal, Technical Leads" />
                        </div>
                        <div className="col-span-3 md:col-span-1">
                            <label className={labelCls}>Reporting Cycle</label>
                            <select name="reportingCycle" className={inputCls}>
                                <option>Monthly to Programme Board</option>
                                <option>Bi-Weekly</option>
                                <option>Quarterly</option>
                            </select>
                        </div>
                        <div className="col-span-3 md:col-span-2">
                            <label className={labelCls}>Governance Framework</label>
                            <input name="governanceFramework" className={inputCls} placeholder="e.g. LBS Capital Works Governance v3.2" />
                        </div>
                    </div>
                </div>

                {/* Strategic Objectives */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <h2 className="font-semibold text-slate-800">Strategy & Scale</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className={labelCls}>Strategic Objectives</label>
                            <textarea name="strategicObjectives" className={`${inputCls} h-24 resize-none`} placeholder="Describe the overarching goals of the programme..." />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className={labelCls}>Start Date</label>
                                <input name="programmeStartDate" type="date" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>End Date</label>
                                <input name="programmeEndDate" type="date" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Total Units</label>
                                <input name="totalUnits" className={inputCls} placeholder="500+" />
                            </div>
                            <div>
                                <label className={labelCls}>Overall Value</label>
                                <input name="totalValue" className={inputCls} placeholder="£120M" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financials & Risks */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <h2 className="font-semibold text-slate-800">Financials & Risk Context</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelCls}>Grant Funding Detail</label>
                            <input name="totalGrant" className={inputCls} placeholder="e.g. £45M (Homes England)" />
                        </div>
                        <div>
                            <label className={labelCls}>Contingency Buffer</label>
                            <input name="contingencyPct" className={inputCls} placeholder="e.g. 10% on works" />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className={labelCls}>Risk Appetite Statement</label>
                            <textarea name="riskAppetite" className={`${inputCls} h-20 resize-none`} placeholder="Describe the organisation's risk appetite for this programme..." />
                        </div>
                        <div>
                            <label className={labelCls}>Resource Constraints</label>
                            <input name="resourceConstraints" className={inputCls} placeholder="Limited internal PM capacity, etc." />
                        </div>
                        <div>
                            <label className={labelCls}>Key Dependencies</label>
                            <input name="keyDependencies" className={inputCls} placeholder="Planning approvals, BSR gateways..." />
                        </div>
                    </div>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={(e) => {
                            const form = e.currentTarget.closest('form');
                            if (form) {
                                // @ts-ignore
                                handleSubmit({ preventDefault: () => { }, currentTarget: form } as any, true);
                            }
                        }}
                        className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors bg-slate-50 rounded-lg border border-slate-200 hover:bg-white"
                    >
                        Save Draft
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Create Programme
                    </button>
                </div>
            </form>
        </div>
    );
}

function Loader({ className }: { className?: string }) {
    return <LoaderIcon className={className} />;
}

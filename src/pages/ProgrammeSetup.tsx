import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Save, ChevronRight, ChevronLeft, LayoutTemplate, CheckCircle2, ArrowLeft, Lightbulb, Target, AlertTriangle, Shield, Settings, FileSearch, Info, DollarSign, ScanSearch } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { stripMarkdown } from '../lib/utils';
import type { Programme } from '../store/useStore';
import { Plus } from 'lucide-react';
import { isAtLeastClientAdmin } from '../lib/roles';

const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white/80 backdrop-blur-sm placeholder:text-slate-400 shadow-sm hover:border-slate-300";
const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 ml-1";
const textareaCls = `${inputCls} resize-none min-h-[100px]`;

// ─── Lookup data (from client HTML reference) ───────────────────────────────
const PROGRAMME_TYPES = [
    "Housing Delivery — New Build",
    "Housing Delivery — Regeneration",
    "Housing Delivery — Acquisition / ESP",
    "Fire Safety Programme",
    "Building Safety (BSA 2022) Programme",
    "Decarbonisation / SHDF Programme",
    "Damp & Mould Remediation Programme",
    "Estate Renewal / Regeneration",
    "Capital Works Framework",
    "Supported Housing Programme",
    "Temporary Accommodation Programme",
    "Planned Maintenance Programme",
    "Mixed Portfolio Programme",
    "Strategic Delivery Framework",
];

const REPORTING_CYCLES = ["Monthly", "Bi-monthly", "Quarterly", "Six-monthly", "Ad hoc"];

const GOVERNANCE_FRAMEWORKS = [
    "PRINCE2 / MSP",
    "Agile / Scrum",
    "RIBA Plan of Work",
    "Homes England Delivery Framework",
    "GLA Grant Conditions Framework",
    "Bespoke / Internal",
    "PCR 2015 / Procurement Act 2023",
];

const RISK_APPETITES = [
    "Averse — zero tolerance for strategic risk",
    "Minimal — limited tolerance",
    "Cautious — balanced approach",
    "Open — prepared to accept risk for strategic gain",
];

const PROG_FUNDERS = [
    "Homes England AHP / SAHP",
    "GLA Affordable Housing Programme",
    "Social Housing Decarbonisation Fund (SHDF)",
    "Decent Homes Programme",
    "DLUHC / MHCLG Direct",
    "Prudential Borrowing (Council HRA)",
    "RP Internal Reserves",
    "Section 106 / CIL",
    "Private Finance / JV",
    "Mixed / Multiple Sources",
];

const RSH_STANDARDS = [
    "Safety and Quality Standard",
    "Transparency, Influence & Accountability Standard",
    "Neighbourhood & Community Standard",
    "Tenancy Standard",
    "Governance & Financial Viability Standard",
    "All Consumer Standards",
    "Not directly applicable",
];

const REGULATORY_OBLIGATIONS = [
    "Homes England AHP Grant Conditions",
    "GLA AHP Grant Conditions",
    "Social Housing Decarbonisation Fund (SHDF) Conditions",
    "BSA 2022 — HRB Gateway Regime",
    "RSH Consumer Standards — Quarterly Returns",
    "RSH Governance & Financial Viability Standard",
    "Section 20 Consultation (leaseholder schemes)",
    "PCR 2015 / Procurement Act 2023",
    "Decent Homes Standard — Compliance Reporting",
    "Awaab's Law — 14-day Response Obligations",
    "Golden Thread — Digital Records (BSA 2022)",
    "CDM 2015 — Programme-Wide H&S Oversight",
    "Freedom of Information Act 2000",
    "Equality Act 2010 — PSED",
    "Environmental obligations (BNG, SHDF carbon targets)",
    "Social Value Act 2012 — Programme KPIs",
];

// ─── Multi-checkbox component ────────────────────────────────────────────────
function CheckGroup({ options, selected, onChange }: {
    options: string[];
    selected: string[];
    onChange: (val: string[]) => void;
}) {
    const toggle = (opt: string) => {
        onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt]);
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {options.map(opt => {
                const on = selected.includes(opt);
                return (
                    <label
                        key={opt}
                        onClick={() => toggle(opt)}
                        className={`group flex items-start gap-3 cursor-pointer rounded-xl border p-4 text-[11px] transition-all select-none ${on
                            ? 'border-indigo-500 bg-indigo-50/50 shadow-sm shadow-indigo-100/50'
                            : 'border-slate-200 bg-white/50 hover:border-indigo-300 hover:bg-white hover:shadow-md'}`}
                    >
                        <div className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-all ${on ? 'border-indigo-600 bg-indigo-600 shadow-sm' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                            {on && <CheckCircle2 className="w-3 h-3 text-white stroke-[3px]" />}
                        </div>
                        <div className="flex-1">
                            <span className={`block transition-colors ${on ? 'text-indigo-900 font-bold' : 'text-slate-600 group-hover:text-slate-900'}`}>{opt}</span>
                        </div>
                    </label>
                );
            })}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function ProgrammeSetup() {
    const navigate = useNavigate();
    const { programmes, setProgrammes, activeProgrammeId, setActiveProgramme, setActiveProgrammeId, user, addNotification } = useStore();
    const userRole = user?.role || (user as any)?.profile?.role;
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');

    const safeProgrammes = Array.isArray(programmes) ? programmes : [];
    const existing = safeProgrammes.find(p => p.id === activeProgrammeId);

    const [form, setForm] = useState<Record<string, any>>({
        // Phase 1
        ref: existing?.reference || '',
        name: existing?.name || '',
        type: existing?.type || '',
        overallRAG: (existing as any)?.overallRAG || '',
        strategicObjectives: existing?.strategicObjectives || '',
        geographicScope: (existing as any)?.geographicScope || '',
        sro: existing?.sro || '',
        pm: existing?.pm || '',
        sponsor: existing?.sponsor || '',
        escalationRoute: (existing as any)?.escalationRoute || '',
        boardComposition: existing?.boardComposition || '',
        reportingCycle: existing?.reportingCycle || '',
        governanceFramework: existing?.governanceFramework || '',
        programmeStartDate: existing?.programmeStartDate || '',
        programmEndDate: existing?.programmeEndDate || (existing as any)?.endDate || '',
        createdBy: (user as any)?.displayName || '',
        // Phase 2
        totalProjects: (existing as any)?.totalProjects || '',
        totalUnits: existing?.totalUnits || '',
        totalValue: existing?.totalValue || '',
        totalGrant: existing?.totalGrant || '',
        contingencyPct: existing?.contingencyPct || '',
        complianceReportingBody: (existing as any)?.complianceReportingBody || '',
        riskAppetite: existing?.riskAppetite || '',
        funders: Array.isArray((existing as any)?.funders) ? (existing as any).funders : (typeof (existing as any)?.funders === 'string' ? (existing as any).funders.split(',') : []),
        resourceConstraints: (existing as any)?.resourceConstraints || '',
        keyDependencies: (existing as any)?.keyDependencies || '',
        // Phase 3
        rshStandards: Array.isArray((existing as any)?.rshStandards) ? (existing as any).rshStandards : (typeof (existing as any)?.rshStandards === 'string' ? (existing as any).rshStandards.split(',') : []),
        regulatoryObligations: Array.isArray(existing?.regulatoryObligations)
            ? existing.regulatoryObligations
            : (typeof existing?.regulatoryObligations === 'string' ? (existing.regulatoryObligations as string).split(',') : []),
        hasHRB: (existing as any)?.hasHRB || '',
        hasLeasehold: (existing as any)?.hasLeasehold || '',
        // Phase 4
        knownStrategicRisks: existing?.knownStrategicRisks || '',
        notes: (existing as any)?.notes || '',
    });

    const set = (field: string, val: any) => setForm(prev => ({ ...prev, [field]: val }));

    // ── Real AI Analysis using the backend Gemini proxy ──────────────────────
    const runAiAnalysis = async () => {
        setAiAnalyzing(true);
        setAiError('');
        try {
            const prompt = `You are a senior UK public sector risk and compliance consultant specialising in social housing, housing delivery, and property development programmes.

PROGRAMME DETAILS:
- Name: ${form.name || 'Not specified'}
- Type: ${form.type || 'Not specified'}
- Geographic Scope: ${form.geographicScope || 'Not specified'}
- Strategic Objectives: ${form.strategicObjectives || 'Not specified'}
- SRO: ${form.sro || 'Not specified'}
- Total Projects: ${form.totalProjects || 'Not specified'}
- Total Units: ${form.totalUnits || 'Not specified'}
- Total Value: ${form.totalValue ? `£${Number(form.totalValue).toLocaleString()}` : 'Not specified'}
- Funding Sources: ${form.funders?.length > 0 ? form.funders.join(', ') : 'Not specified'}
- HRB Schemes Present: ${form.hasHRB || 'Not specified'}
- Leaseholder Units: ${form.hasLeasehold || 'Not specified'}
- Regulatory Obligations: ${form.regulatoryObligations?.length > 0 ? form.regulatoryObligations.join('; ') : 'Not specified'}
- RSH Standards: ${form.rshStandards?.length > 0 ? form.rshStandards.join('; ') : 'Not specified'}
- Resource Constraints: ${form.resourceConstraints || 'None stated'}
- Key Dependencies: ${form.keyDependencies || 'None stated'}
- Risk Appetite: ${form.riskAppetite || 'Not specified'}

Based on the above, identify 6-8 strategic programme-level risks. For each, provide:
1. A concise risk title (max 10 words)
2. Brief description of cause/effect
3. Risk category (Financial / Regulatory / Operational / Reputational / Strategic / Safety)

Format each risk on its own line as:
[CATEGORY] Risk Title — Brief description of cause and potential impact.

Use precise, formal language appropriate for a board-level risk register. Focus on realistic, programme-specific risks rather than generic ones.`;

            const result = await api.testGemini(prompt);
            const text = result?.text || result?.response || result?.result || '';
            if (text) {
                set('knownStrategicRisks', stripMarkdown(text));
            } else {
                setAiError('AI returned an empty response. Please try again.');
            }
        } catch (err: any) {
            console.error('AI analysis error:', err);
            setAiError(err?.message || 'AI analysis failed. Please check your connection and try again.');
        } finally {
            setAiAnalyzing(false);
        }
    };

    const handleSave = async (isDraft: boolean = false) => {
        if (!form.name || !form.type) {
            addNotification({ title: 'Validation Error', body: 'Programme Name and Type are required.', type: 'system' });
            return;
        }
        setSaving(true);
        try {
            const newId = activeProgrammeId || `PROG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const updated: Programme = {
                id: newId,
                reference: form.ref || newId,
                name: form.name,
                type: form.type,
                strategicObjectives: form.strategicObjectives,
                riskAppetite: form.riskAppetite,
                sro: form.sro,
                pm: form.pm,
                sponsor: form.sponsor,
                boardComposition: form.boardComposition,
                reportingCycle: form.reportingCycle,
                governanceFramework: form.governanceFramework,
                totalValue: form.totalValue,
                totalUnits: form.totalUnits,
                totalGrant: form.totalGrant,
                contingencyPct: form.contingencyPct,
                regulatoryObligations: form.regulatoryObligations,
                knownStrategicRisks: form.knownStrategicRisks,
                totalProjects: existing?.totalProjects || 0,
                createdBy: form.createdBy,
                programmeStartDate: form.programmeStartDate,
                programmeEndDate: form.programmEndDate,
                status: isDraft ? 'Draft' : 'Active',
                createdAt: (existing as any)?.createdAt || new Date().toISOString(),
                // Spread all extra fields so nothing is lost
                ...(form as any),
            };
            const safeProgrammesList = Array.isArray(programmes) ? programmes : [];
            const updatedList = activeProgrammeId
                ? safeProgrammesList.map(p => p.id === activeProgrammeId ? updated : p)
                : [...safeProgrammesList, updated];
            setProgrammes(updatedList);
            if (!activeProgrammeId) setActiveProgrammeId(newId);
            await api.saveData('programmes', updatedList);
            navigate('/programmes');
        } catch (err) {
            console.error(err);
            addNotification({ title: 'Save Failed', body: 'Failed to save programme. Please try again.', type: 'system' });
        } finally {
            setSaving(false);
        }
    };

    const STEPS = [
        { id: 1, title: 'Identity & Governance', icon: LayoutTemplate, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 2, title: 'Scale & Financials', icon: Target },
        { id: 3, title: 'Regulatory & Compliance', icon: Shield },
        { id: 4, title: 'Strategic Risk Context', icon: AlertTriangle },
    ];

    return (
        <div className="max-w-5xl mx-auto pb-24">
            {/* Reference Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                <Link
                    to="/tools/compliance-profiler"
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all group"
                >
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                        <Shield className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Compliance Profiler</h3>
                        <p className="text-xs text-slate-500">Interactive guide to determine required compliance domains.</p>
                    </div>
                </Link>
                <Link
                    to="/tools/risk-identifier"
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-300 hover:shadow-lg transition-all group"
                >
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                        <AlertTriangle className="w-6 h-6 text-amber-500 group-hover:text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Risk Identifier</h3>
                        <p className="text-xs text-slate-500">Industry-standard risk library and mitigation reference.</p>
                    </div>
                </Link>
            </div>

            {/* Page header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900">Create a Programme</h1>
                        {isAtLeastClientAdmin(userRole) && (
                            <button
                                onClick={() => {
                                    useStore.getState().setActiveProgramme(null);
                                    navigate('/programmes/new');
                                }}
                                className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-lg transition-all text-[11px] font-black uppercase tracking-wider"
                            >
                                <Plus className="w-3.5 h-3.5 text-indigo-500" />
                                New Programme
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">Define the strategic context, governance and regulatory obligations for your programme.</p>
                </div>
            </div>

            {/* Step indicator */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-10 bg-white/40 backdrop-blur-md p-2 rounded-[24px] border border-white/40 shadow-xl shadow-indigo-900/5 overflow-x-auto hide-scrollbar">
                {STEPS.map((s) => {
                    const done = step > s.id;
                    const active = step === s.id;
                    const Icon = s.icon;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setStep(s.id)}
                            className={`flex flex-1 items-center gap-3 px-6 py-4 rounded-[18px] transition-all relative overflow-hidden group min-w-[200px] md:min-w-0 ${active
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02] z-10'
                                    : done
                                        ? 'bg-white/60 text-indigo-600 border border-indigo-100 hover:bg-white'
                                        : 'text-slate-400 hover:bg-white/50'
                                }`}
                        >
                            {active && (
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl rounded-full translate-x-12 -translate-y-12" />
                            )}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${active
                                    ? 'bg-white text-indigo-600 shadow-inner'
                                    : done
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-400 group-hover:bg-white'
                                }`}>
                                {done ? <CheckCircle2 className="w-5 h-5 stroke-[2.5px]" /> : s.id}
                            </div>
                            <div className="text-left">
                                <p className={`text-[8px] uppercase tracking-[0.2em] font-black ${active ? 'text-indigo-100' : done ? 'text-indigo-400' : 'text-slate-400'}`}>Phase 0{s.id}</p>
                                <p className={`text-[13px] font-bold leading-none mt-1 ${active ? 'text-white' : done ? 'text-slate-900' : 'text-slate-500'}`}>{s.title}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Form card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/40 shadow-2xl shadow-indigo-900/10 overflow-hidden min-h-[500px] flex flex-col">

                {/* ── PHASE 1: Identity & Governance ── */}
                {step === 1 && (
                    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-indigo-50 rounded-xl"><LayoutTemplate className="w-5 h-5 text-indigo-600" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Programme Identity & Governance</h2>
                                <p className="text-xs text-slate-500">Core identity, leadership structure, governance and timeline.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className={labelCls}>Programme Reference *</label>
                                <input className={inputCls} value={form.ref} onChange={e => set('ref', e.target.value)} placeholder="e.g. PROG001" />
                            </div>
                            <div className="col-span-2">
                                <label className={labelCls}>Programme Name *</label>
                                <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Urban Regeneration Programme" />
                            </div>
                            <div>
                                <label className={labelCls}>Overall RAG Status</label>
                                <select className={inputCls} value={form.overallRAG} onChange={e => set('overallRAG', e.target.value)}>
                                    <option value="">— Select —</option>
                                    <option>Green</option><option>Amber</option><option>Red</option><option>Not Started</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Programme Type *</label>
                                <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
                                    <option value="">— Select type —</option>
                                    {PROGRAMME_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Geographic Scope</label>
                                <input className={inputCls} value={form.geographicScope} onChange={e => set('geographicScope', e.target.value)} placeholder="e.g. Central Region / National" />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Strategic Objectives *</label>
                            <textarea className={textareaCls} rows={3} value={form.strategicObjectives} onChange={e => set('strategicObjectives', e.target.value)} placeholder="What does this programme exist to deliver? Key outcomes, targets, policy objectives…" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className={labelCls}>Senior Responsible Owner (SRO)</label>
                                <input className={inputCls} value={form.sro} onChange={e => set('sro', e.target.value)} placeholder="Name / job title" />
                            </div>
                            <div>
                                <label className={labelCls}>Programme Manager</label>
                                <input className={inputCls} value={form.pm} onChange={e => set('pm', e.target.value)} placeholder="Name / job title" />
                            </div>
                            <div>
                                <label className={labelCls}>Programme Sponsor</label>
                                <input className={inputCls} value={form.sponsor} onChange={e => set('sponsor', e.target.value)} placeholder="e.g. Cabinet Member for Housing" />
                            </div>
                            <div>
                                <label className={labelCls}>Escalation Route</label>
                                <input className={inputCls} value={form.escalationRoute} onChange={e => set('escalationRoute', e.target.value)} placeholder="PM → Director → Board…" />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Programme Board Composition</label>
                            <textarea className={textareaCls} rows={2} value={form.boardComposition} onChange={e => set('boardComposition', e.target.value)} placeholder="List all board members / roles…" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                                <label className={labelCls}>Reporting Cycle</label>
                                <select className={inputCls} value={form.reportingCycle} onChange={e => set('reportingCycle', e.target.value)}>
                                    <option value="">— Select —</option>
                                    {REPORTING_CYCLES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Governance Framework</label>
                                <select className={inputCls} value={form.governanceFramework} onChange={e => set('governanceFramework', e.target.value)}>
                                    <option value="">— Select —</option>
                                    {GOVERNANCE_FRAMEWORKS.map(f => <option key={f}>{f}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Created By</label>
                                <input className={inputCls} value={form.createdBy} onChange={e => set('createdBy', e.target.value)} placeholder="Programme Manager name" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Programme Start Date</label>
                                <input type="date" className={inputCls} value={form.programmeStartDate} onChange={e => set('programmeStartDate', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Programme End Date</label>
                                <input type="date" className={inputCls} value={form.programmEndDate} onChange={e => set('programmEndDate', e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PHASE 2: Scale & Financials ── */}
                {step === 2 && (
                    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-emerald-50 rounded-xl"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Scale, Portfolio & Financials</h2>
                                <p className="text-xs text-slate-500">Portfolio size, budget, funding sources and resource constraints.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className={labelCls}>Total Number of Projects / Schemes</label>
                                <input type="number" className={inputCls} value={form.totalProjects} onChange={e => set('totalProjects', e.target.value)} placeholder="e.g. 54" />
                            </div>
                            <div>
                                <label className={labelCls}>Total Units to be Delivered</label>
                                <input type="number" className={inputCls} value={form.totalUnits} onChange={e => set('totalUnits', e.target.value)} placeholder="e.g. 3200" />
                            </div>
                            <div>
                                <label className={labelCls}>Total Programme Value (£)</label>
                                <input type="number" className={inputCls} value={form.totalValue} onChange={e => set('totalValue', e.target.value)} placeholder="e.g. 485000000" />
                            </div>
                            <div>
                                <label className={labelCls}>Total Grant Funding (£)</label>
                                <input type="number" className={inputCls} value={form.totalGrant} onChange={e => set('totalGrant', e.target.value)} placeholder="e.g. 145000000" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                                <label className={labelCls}>Programme Contingency (%)</label>
                                <input type="number" className={inputCls} value={form.contingencyPct} onChange={e => set('contingencyPct', e.target.value)} placeholder="e.g. 8" min="0" max="100" />
                            </div>
                            <div>
                                <label className={labelCls}>Compliance Reporting Body</label>
                                <input className={inputCls} value={form.complianceReportingBody} onChange={e => set('complianceReportingBody', e.target.value)} placeholder="e.g. Homes England / GLA / RSH" />
                            </div>
                            <div>
                                <label className={labelCls}>Programme Risk Appetite</label>
                                <select className={inputCls} value={form.riskAppetite} onChange={e => set('riskAppetite', e.target.value)}>
                                    <option value="">— Select —</option>
                                    {RISK_APPETITES.map(a => <option key={a}>{a}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Funding Sources (select all that apply)</label>
                            <CheckGroup options={PROG_FUNDERS} selected={form.funders} onChange={v => set('funders', v)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Key Resource Constraints</label>
                                <textarea className={textareaCls} rows={3} value={form.resourceConstraints} onChange={e => set('resourceConstraints', e.target.value)} placeholder="Internal PM capacity, QS cover, legal resource, CDM coordinators, finance team…" />
                            </div>
                            <div>
                                <label className={labelCls}>Key Inter-Project Dependencies</label>
                                <textarea className={textareaCls} rows={3} value={form.keyDependencies} onChange={e => set('keyDependencies', e.target.value)} placeholder="Grant draw-down tied to milestones, BSR Gateway dependencies, shared contractor packages…" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PHASE 3: Regulatory & Compliance ── */}
                {step === 3 && (
                    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-violet-50 rounded-xl"><Shield className="w-5 h-5 text-violet-600" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Regulatory & Compliance Obligations</h2>
                                <p className="text-xs text-slate-500">Programme-level cross-cutting regulatory obligations that apply across all projects.</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
                            These are programme-level regulatory obligations — cross-cutting requirements that apply to the whole programme, not individual projects. They determine programme-level compliance tracking, board reporting, and regulatory return obligations.
                        </div>

                        <div>
                            <label className={labelCls}>RSH Consumer Standards applicable to this programme</label>
                            <CheckGroup options={RSH_STANDARDS} selected={form.rshStandards} onChange={v => set('rshStandards', v)} />
                        </div>

                        <div>
                            <label className={labelCls}>Programme-Level Regulatory Obligations (select all that apply)</label>
                            <CheckGroup options={REGULATORY_OBLIGATIONS} selected={form.regulatoryObligations} onChange={v => set('regulatoryObligations', v)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Are there HRB schemes (≥18m / ≥7 storeys) in this programme?</label>
                                <select className={inputCls} value={form.hasHRB} onChange={e => set('hasHRB', e.target.value)}>
                                    <option value="">— Select —</option>
                                    <option>Yes</option><option>No</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Are there leaseholder / shared ownership units across the programme?</label>
                                <select className={inputCls} value={form.hasLeasehold} onChange={e => set('hasLeasehold', e.target.value)}>
                                    <option value="">— Select —</option>
                                    <option>Yes</option><option>No</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PHASE 4: Strategic Risk Context ── */}
                {step === 4 && (
                    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-rose-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-rose-600" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Strategic Risk Context</h2>
                                <p className="text-xs text-slate-500">Document known programme-level risks and any additional context.</p>
                            </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                                <ScanSearch className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-indigo-800">AI Strategic Risk Identification</p>
                                    <p className="text-xs text-indigo-600 mt-0.5">
                                        {form.strategicObjectives
                                            ? 'Click to generate programme-specific strategic risks using AI.'
                                            : 'Complete Strategic Objectives in Phase 1 first for best results.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={runAiAnalysis}
                                disabled={aiAnalyzing || !form.strategicObjectives}
                                className="px-4 py-2 w-full sm:w-auto bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
                            >
                                {aiAnalyzing ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing…</>
                                ) : 'Run AI Analysis'}
                            </button>
                        </div>

                        {aiError && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                                {aiError}
                            </div>
                        )}

                        {/* Moved inside the container to correctly structure it */}
                        <div className="!mt-0">
                            <label className={labelCls}>Known Strategic / Programme-Level Risks</label>
                            <textarea
                                className={`${textareaCls} font-mono text-[12px] leading-relaxed`}
                                rows={10}
                                value={form.knownStrategicRisks}
                                onChange={e => set('knownStrategicRisks', e.target.value)}
                                placeholder="Supply chain constraints, regulatory change, funding shortfalls, political risks, capacity gaps…&#10;&#10;Or click 'Run AI Analysis' above to generate risks automatically."
                            />
                            {!form.knownStrategicRisks && !aiAnalyzing && (
                                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 italic">
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                                    Tip: Complete Strategic Objectives (Phase 1) for the most accurate AI risk identification.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className={labelCls}>Additional Context / Notes</label>
                            <textarea
                                className={textareaCls}
                                rows={4}
                                value={form.notes}
                                onChange={e => set('notes', e.target.value)}
                                placeholder="Anything else relevant to programme risk and compliance — political context, policy environment, history…"
                            />
                        </div>
                    </div>
                )}

                {/* Footer nav */}
                <div className="px-6 py-6 md:px-10 md:py-8 bg-slate-50/50 border-t border-slate-100 mt-auto flex flex-col-reverse md:flex-row items-center justify-between gap-4">
                    <button
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1}
                        className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 disabled:opacity-0 transition-all px-4 py-2 rounded-xl hover:bg-white"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back
                    </button>

                    <div className="flex items-center gap-2.5">
                        {STEPS.map(s => (
                            <div key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${step === s.id ? 'bg-indigo-600 w-8' : step > s.id ? 'bg-indigo-200 w-3' : 'bg-slate-200 w-3'}`} />
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <button onClick={() => handleSave(true)} className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors rounded-xl hover:bg-white border sm:border-transparent border-slate-200">
                            Save Draft
                        </button>
                        {step < 4 ? (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 active:scale-95"
                            >
                                Continue <ChevronRight className="w-4 h-4 stroke-[3px]" />
                            </button>
                        ) : (
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-3 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all hover:scale-[1.05] active:scale-95 disabled:opacity-50"
                            >
                                {saving ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                                ) : (
                                    <>Finalise Programme <Save className="w-4 h-4" /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

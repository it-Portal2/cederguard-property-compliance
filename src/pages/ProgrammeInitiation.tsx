import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, ScanSearch, DollarSign, Rocket, Target, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { stripMarkdown } from '../lib/utils';
import type { Programme, TeamMember } from '../store/useStore';
import { isSuperAdmin, isAtLeastClientAdmin } from '../lib/roles';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { calculateProgrammeProgress } from '../lib/progress';
import { DeliveryTeamCRUD } from '../components/DeliveryTeamCRUD';
import { PublicationChecklist } from '../components/PublicationChecklist';

const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white/80 backdrop-blur-sm placeholder:text-slate-400 shadow-sm hover:border-slate-300";
const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 ml-1";
const textareaCls = `${inputCls} resize-none min-h-[100px]`;

// ─── Constants ──────────────────────────────────────────────────────────────
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
    // Guard against non-array values that may arrive from DB hydration
    const safeSelected = Array.isArray(selected) ? selected : [];
    const toggle = (opt: string) => {
        onChange(safeSelected.includes(opt) ? safeSelected.filter(o => o !== opt) : [...safeSelected, opt]);
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {options.map(opt => {
                const on = safeSelected.includes(opt);
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



export function ProgrammeInitiation() {
    const navigate = useNavigate();
    const { programmes, setProgrammes, activeProgrammeId, setActiveProgramme, setActiveProgrammeId, updateProgramme, addNotification, user, clientId } = useStore();
    const [loading, setLoading] = useState(false);
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');
    const [success, setSuccess] = useState(false);
    const [pms, setPMs] = useState<any[]>([]);
    const [teamSaving, setTeamSaving] = useState(false);
    const [teamSaved, setTeamSaved] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const aiSubmitting = useRef(false);

    useEffect(() => {
        const loadPMs = async () => {
            try {
                const res = await api.getAssignablePMs();
                if (res) setPMs(res);
            } catch (err) {
                console.error('Failed to load PMs:', err);
            }
        };
        loadPMs();
    }, []);

    // ─── Access Guard: Client Admins only ───────────────────────────────────────
    const _userRole = user?.role || (user as any)?.profile?.role;
    const _isAdmin = isSuperAdmin(user?.email, _userRole);
    const _isClientAdmin = isAtLeastClientAdmin(_userRole) || _isAdmin;
    useEffect(() => {
        if (user && !_isClientAdmin) navigate('/dashboard');
    }, [user, _isClientAdmin, navigate]);

    const { id } = useParams();
    const effectiveId = id || activeProgrammeId;
    const existing = (Array.isArray(programmes) ? programmes : []).find(p => p.id === effectiveId);

    // Sync active programme if ID is in URL
    useEffect(() => {
        if (id && id !== activeProgrammeId) {
            setActiveProgrammeId(id);
        }
    }, [id, activeProgrammeId, setActiveProgrammeId]);

    const resetForm = useCallback(() => setForm({
        reference: '',
        name: '',
        type: '',
        overallRAG: '',
        strategicObjectives: '',
        geographicScope: '',
        sro: '',
        pm: user?.email || '',
        sponsor: '',
        escalationRoute: '',
        boardComposition: '',
        reportingCycle: '',
        governanceFramework: '',
        programmeStartDate: format(new Date(), 'yyyy-MM-dd'),
        programmeEndDate: '',
        createdBy: user?.email || '',
        totalProjects: '',
        totalUnits: '',
        totalValue: '',
        totalGrant: '',
        contingencyPct: '5',
        complianceReportingBody: '',
        riskAppetite: '',
        funders: [],
        resourceConstraints: '',
        keyDependencies: [],
        rshStandards: [],
        regulatoryObligations: [],
        hasHRB: '',
        hasLeasehold: '',
        knownStrategicRisks: '',
        notes: '',
        milestones: [],
        deliveryTeam: [],
        deliveryTeamDone: false,
    }), [user?.email]);

    const [form, setForm] = useState<Record<string, any>>({
        reference: '',
        name: '',
        type: '',
        overallRAG: '',
        strategicObjectives: '',
        geographicScope: '',
        sro: '',
        pm: user?.email || '',
        sponsor: '',
        escalationRoute: '',
        boardComposition: '',
        reportingCycle: '',
        governanceFramework: '',
        programmeStartDate: format(new Date(), 'yyyy-MM-dd'),
        programmeEndDate: '',
        createdBy: user?.email || '',
        totalProjects: '',
        totalUnits: '',
        totalValue: '',
        totalGrant: '',
        contingencyPct: '5',
        complianceReportingBody: '',
        riskAppetite: '',
        funders: [],
        resourceConstraints: '',
        keyDependencies: [],
        rshStandards: [],
        regulatoryObligations: [],
        hasHRB: '',
        hasLeasehold: '',
        knownStrategicRisks: '',
        notes: '',
        milestones: [],
        deliveryTeam: [],
        deliveryTeamDone: false,
    });

    // Update form when switching to an existing programme — keyed on stable ID string,
    // not the object reference, so store updates elsewhere don't reset local edits.
    useEffect(() => {
        if (!effectiveId) return;
        const prog = (Array.isArray(programmes) ? programmes : []).find(p => p.id === effectiveId);
        if (!prog) return;
        const toArr = (v: any): string[] => {
            if (Array.isArray(v)) return v;
            if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
            return [];
        };
        setForm({
            reference: prog.reference || '',
            name: prog.name || '',
            type: prog.type || '',
            overallRAG: (prog as any).overallRAG || '',
            strategicObjectives: prog.strategicObjectives || '',
            geographicScope: prog.geographicScope || '',
            sro: prog.sro || '',
            pm: prog.pm || user?.email || '',
            sponsor: prog.sponsor || '',
            escalationRoute: (prog as any).escalationRoute || '',
            boardComposition: prog.boardComposition || '',
            reportingCycle: prog.reportingCycle || '',
            governanceFramework: prog.governanceFramework || '',
            programmeStartDate: prog.programmeStartDate || format(new Date(), 'yyyy-MM-dd'),
            programmeEndDate: prog.programmeEndDate || '',
            createdBy: user?.email || prog.createdBy || '',
            totalProjects: (prog as any).totalProjects || '',
            totalUnits: prog.totalUnits || '',
            totalValue: prog.totalValue || '',
            totalGrant: prog.totalGrant || '',
            contingencyPct: prog.contingencyPct || '5',
            complianceReportingBody: (prog as any).complianceReportingBody || '',
            riskAppetite: prog.riskAppetite || '',
            funders: toArr((prog as any).funders),
            resourceConstraints: prog.resourceConstraints || '',
            keyDependencies: toArr((prog as any).keyDependencies),
            rshStandards: toArr((prog as any).rshStandards),
            regulatoryObligations: toArr(prog.regulatoryObligations),
            hasHRB: (prog as any).hasHRB || '',
            hasLeasehold: (prog as any).hasLeasehold || '',
            knownStrategicRisks: prog.knownStrategicRisks || '',
            notes: (prog as any).notes || '',
            milestones: Array.isArray(prog.milestones) ? prog.milestones : [],
            deliveryTeam: Array.isArray(prog.deliveryTeam) ? prog.deliveryTeam : [],
            deliveryTeamDone: !!prog.deliveryTeamDone,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveId, user?.email]);

    // Reset form if activeProgrammeId becomes null (e.g. from nav or "New" button)
    useEffect(() => {
        if (!activeProgrammeId) {
            resetForm();
            setFormErrors({});
        }
    }, [activeProgrammeId, resetForm]);

    const handlePublish = async () => {
        if (!activeProgrammeId) return;

        if (existing?.isPublished) {
            navigate('/dashboard');
            return;
        }

        setLoading(true);
        try {
            await updateProgramme(activeProgrammeId, {
                isPublished: true,
                setupProgress: 100,
                status: 'Active'
            });
            toast.success('Programme published successfully.');
            addNotification({ title: 'Success', body: 'Programme published successfully.', type: 'system' });
            setTimeout(() => navigate('/dashboard'), 1000);
        } catch (err: any) {
            const msg = 'Failed to publish programme. Please try again.';
            toast.error(msg);
            addNotification({ title: 'Error', body: msg, type: 'system' });
        } finally {
            setLoading(false);
        }
    };

    const set = (field: string, val: any) => setForm(prev => ({ ...prev, [field]: val }));

    const unfinishedProgrammes = (Array.isArray(programmes) ? programmes : []).filter(p => !p.isPublished);

    const handleContinue = (id: string) => {
        const prog = (Array.isArray(programmes) ? programmes : []).find(p => p.id === id);
        if (prog) {
            setActiveProgrammeId(id);
            setForm({
                reference: prog.reference || '',
                name: prog.name || '',
                type: prog.type || '',
                overallRAG: (prog as any).overallRAG || '',
                strategicObjectives: prog.strategicObjectives || '',
                geographicScope: (prog as any).geographicScope || '',
                sro: prog.sro || '',
                pm: prog.pm || '',
                sponsor: prog.sponsor || '',
                escalationRoute: (prog as any).escalationRoute || '',
                boardComposition: prog.boardComposition || '',
                reportingCycle: prog.reportingCycle || '',
                governanceFramework: prog.governanceFramework || '',
                programmeStartDate: prog.programmeStartDate || '',
                programmeEndDate: prog.programmeEndDate || '',
                createdBy: prog.createdBy || '',
                totalProjects: (prog as any).totalProjects || '',
                totalUnits: prog.totalUnits || '',
                totalValue: prog.totalValue || '',
                totalGrant: prog.totalGrant || '',
                contingencyPct: prog.contingencyPct || '5',
                complianceReportingBody: (prog as any).complianceReportingBody || '',
                riskAppetite: prog.riskAppetite || '',
                funders: Array.isArray((prog as any).funders)
                    ? (prog as any).funders
                    : (typeof (prog as any).funders === 'string' ? (prog as any).funders.split(',').map((s: string) => s.trim()).filter(Boolean) :
                       typeof (prog as any).fundingSources === 'string' ? (prog as any).fundingSources.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                resourceConstraints: (prog as any).resourceConstraints || '',
                keyDependencies: Array.isArray((prog as any).keyDependencies)
                    ? (prog as any).keyDependencies
                    : (typeof (prog as any).keyDependencies === 'string' ? (prog as any).keyDependencies.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                rshStandards: Array.isArray((prog as any).rshStandards) ? (prog as any).rshStandards : [],
                regulatoryObligations: Array.isArray(prog.regulatoryObligations)
                    ? prog.regulatoryObligations
                    : (typeof prog.regulatoryObligations === 'string' ? (prog.regulatoryObligations as string).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                hasHRB: (prog as any).hasHRB || '',
                hasLeasehold: (prog as any).hasLeasehold || '',
                knownStrategicRisks: prog.knownStrategicRisks || '',
                notes: (prog as any).notes || '',
                milestones: Array.isArray(prog.milestones) ? prog.milestones : [],
                deliveryTeam: Array.isArray(prog.deliveryTeam) ? prog.deliveryTeam : [],
                deliveryTeamDone: !!prog.deliveryTeamDone,
            });
            setFormErrors({});
        }
    };

    const runAiAnalysis = async () => {
        if (aiSubmitting.current) return;
        aiSubmitting.current = true;
        setAiAnalyzing(true);
        setAiError('');
        try {
            const prompt = `You are a senior UK public sector risk and compliance consultant specialising in social housing, housing delivery, and property development programmes.

            PROGRAMME DETAILS:
            - Name: ${form.name || 'Not specified'}
            - Type: ${form.type || 'Not specified'}
            - Geographic Scope: ${form.geographicScope || 'Region / Borough'}
            - Strategic Objectives: ${form.strategicObjectives || 'Not specified'}

            identify 6-8 strategic programme-level risks. Format each as: [CATEGORY] Title — Description.`;

            const result = await api.testGemini(prompt);
            const text = result?.text || result?.response || result?.result || '';
            if (text) {
                set('knownStrategicRisks', stripMarkdown(text));
            } else {
                setAiError('AI returned an empty response. Please try again.');
            }
        } catch (err: any) {
            setAiError('AI analysis failed. Please try again.');
        } finally {
            setAiAnalyzing(false);
            aiSubmitting.current = false;
        }
    };

    const handleSave = async (isDraft: boolean = false) => {
        // Inline field validation (Bug 10)
        const errors: Record<string, string> = {};
        if (!form.name) errors.name = 'Programme name is required.';
        if (!form.type) errors.type = 'Programme type is required.';
        if (!isDraft && !form.strategicObjectives) errors.strategicObjectives = 'Strategic objectives are required.';
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            toast.error('Please fill in all required fields.');
            return;
        }
        setFormErrors({});

        const safeFunders = Array.isArray(form.funders) ? form.funders : [];
        setLoading(true);
        try {
            const newId = activeProgrammeId || `PROG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const updated: Programme = {
                id: newId,
                name: form.name,
                type: form.type,
                reference: form.reference || newId,
                status: isDraft ? 'Draft' : 'Active',
                createdAt: existing?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                complianceSetupDone: existing?.complianceSetupDone || false,
                riskSetupDone: existing?.riskSetupDone || false,
                aiRiskDiscoveryDone: existing?.aiRiskDiscoveryDone || false,
                deliveryTeamDone: !!form.deliveryTeamDone,
                isPublished: existing?.isPublished || false,
                setupProgress: calculateProgrammeProgress({
                    ...existing,
                    name: form.name,
                    type: form.type,
                    regulatoryObligations: form.regulatoryObligations,
                    riskAppetite: form.riskAppetite,
                    boardMembers: Array.isArray(existing?.boardMembers) ? existing.boardMembers : [],
                    boardComposition: form.boardComposition,
                    strategicObjectives: form.strategicObjectives
                } as any).percentage,
                // Identity & Governance
                sro: form.sro || '',
                pm: form.pm || user?.email || '',
                sponsor: form.sponsor || '',
                boardComposition: form.boardComposition || '',
                reportingCycle: form.reportingCycle || '',
                governanceFramework: form.governanceFramework || '',
                strategicObjectives: form.strategicObjectives || '',
                geographicScope: form.geographicScope || '',
                escalationRoute: form.escalationRoute || '',
                overallRAG: form.overallRAG || '',
                programmeStartDate: form.programmeStartDate || format(new Date(), 'yyyy-MM-dd'),
                programmeEndDate: form.programmeEndDate || '',
                createdBy: form.createdBy || user?.email || '',
                // Scale & Financials
                totalProjects: form.totalProjects || '',
                totalUnits: form.totalUnits || '',
                totalValue: form.totalValue || '',
                totalGrant: form.totalGrant || '',
                contingencyPct: form.contingencyPct || '5',
                fundingSources: safeFunders.join(', '),
                funders: safeFunders,
                resourceConstraints: form.resourceConstraints || '',
                // Regulatory & Compliance
                rshStandards: Array.isArray(form.rshStandards) ? form.rshStandards : [],
                regulatoryObligations: Array.isArray(form.regulatoryObligations) ? form.regulatoryObligations : [],
                riskAppetite: form.riskAppetite || '',
                complianceReportingBody: form.complianceReportingBody || '',
                keyDependencies: Array.isArray(form.keyDependencies) ? form.keyDependencies : [],
                hrbScheme: form.hasHRB || '',
                leaseholderStatus: form.hasLeasehold || '',
                hasHRB: form.hasHRB || '',
                hasLeasehold: form.hasLeasehold || '',
                // Strategic Risk
                knownStrategicRisks: form.knownStrategicRisks || '',
                notes: form.notes || '',
                // Delivery Team
                deliveryTeam: Array.isArray(form.deliveryTeam) ? form.deliveryTeam : [],
                milestones: Array.isArray(form.milestones) ? form.milestones : [],
                // Multi-tenancy scoping
                clientId: clientId || undefined,
                userId: user?.uid || undefined,
            };

            const safeProgrammes = Array.isArray(programmes) ? programmes : [];
            const updatedList = activeProgrammeId
                ? safeProgrammes.map(p => p.id === activeProgrammeId ? updated : p)
                : [...safeProgrammes, updated];

            setProgrammes(updatedList);
            if (!activeProgrammeId) setActiveProgrammeId(newId);
            await api.saveData('programmes', updatedList);

            const targetId = newId;
            toast.success(`Programme ${isDraft ? 'draft saved' : 'finalised'} successfully.`);
            addNotification({ title: 'Success', body: `Programme ${isDraft ? 'draft saved' : 'finalised'} successfully.`, type: 'system' });
            setSuccess(true);
            // Reset success state after 2s so buttons re-enable (Bug 14)
            setTimeout(() => setSuccess(false), 2000);
            setTimeout(() => navigate(`/compliance/setup?type=programme&id=${targetId}&from=initiation`), 1000);
        } catch (err) {
            toast.error('Failed to save programme. Your data has been preserved — please try again.');
            addNotification({ title: 'Error', body: 'Failed to save programme.', type: 'system' });
        } finally {
            setLoading(false);
        }
    };

    const loadDemo = () => {
        setForm(prev => ({
            ...prev,
            name: "Greater London Housing Renewal 2026",
            reference: "GLHR-26",
            type: "Housing Delivery — Regeneration",
            strategicObjectives: "Demolish and rebuild 1,200 units across 5 estates. Target Net Zero carbon by completion. 50% affordable housing split.",
            geographicScope: "London Region Portfolio",
            sro: "Director of Housing Delivery",
            pm: "Senior Programme Manager",
            sponsor: "Cabinet Member for Regeneration",
            totalProjects: 12,
            totalUnits: 1200,
            totalValue: 450000000,
            totalGrant: 120000000,
            riskAppetite: "Cautious — balanced approach",
            funders: ["GLA Affordable Housing Programme", "RP Internal Reserves"]
        }));
    };

    const requiredDone = form.name && form.type && form.strategicObjectives;

    return (
        <div className="min-h-screen bg-slate-50/50 pb-24 md:pb-12 pt-safe">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
                {/* ── HEADER SECTION ────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12 border-b border-slate-100 pb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Programme Initiation</h1>
                                <div className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-wider">Strategic Setup</div>
                                
                                {isAtLeastClientAdmin(_userRole) && (
                                    <button
                                        onClick={() => {
                                            setActiveProgramme(null);
                                            navigate('/programmes/new');
                                        }}
                                        className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider"
                                    >
                                        <Plus className="w-3 h-3 text-indigo-500" />
                                        New Programme
                                    </button>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1 font-medium">Define governance, financials and regulatory context.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={loadDemo}
                            className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all text-sm font-bold border border-transparent hover:border-indigo-100"
                        >
                            <Target className="w-4 h-4" /> Load Demo
                        </button>
                        
                        <button 
                            onClick={() => handleSave(true)}
                            disabled={loading || success}
                            className="px-5 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-all text-sm font-black shadow-sm"
                        >
                            Save Draft
                        </button>

                        <button 
                            onClick={() => handleSave(false)}
                            disabled={loading || !requiredDone || success}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all text-sm font-black shadow-lg shadow-indigo-200",
                                (loading || !requiredDone || success) 
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                                    : "bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5"
                            )}
                        >
                            {loading ? 'Saving...' : success ? 'Success!' : 'Finalise Programme'}
                            {!loading && !success && <Rocket className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* ── MAIN CONTENT ── */}
                <div className="relative flex flex-col lg:flex-row gap-8">
                    {/* Full-section loader overlay during create / update */}
                    {loading && (
                        <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-[3px] rounded-2xl flex flex-col items-center justify-center gap-4 min-h-[200px]">
                            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin shadow-md" />
                            <span className="text-sm font-black text-indigo-900 tracking-widest uppercase">
                                {existing ? 'Updating Programme…' : 'Creating Programme…'}
                            </span>
                        </div>
                    )}
                    {/* ── LEFT: Main Form ────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0 space-y-8">
                        {/* Continue Setup Section */}
                        {unfinishedProgrammes.length > 0 && !activeProgrammeId && (
                            <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-xl shadow-sm border border-indigo-100">
                                            <Rocket className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Continue Setup</h3>
                                            <p className="text-xs text-indigo-700/70 font-medium">You have {unfinishedProgrammes.length} programme{unfinishedProgrammes.length > 1 ? 's' : ''} in progress.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <select 
                                            className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm min-w-[180px]"
                                            onChange={(e) => handleContinue(e.target.value)}
                                            value={activeProgrammeId || ""}
                                        >
                                            <option value="" disabled>Select Programme to Continue...</option>
                                            {unfinishedProgrammes.map(p => (
                                                <option key={p.id} value={p.id}>{stripMarkdown(p.name)} ({p.setupProgress}%)</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-6 md:space-y-8">
                            {/* Section 1: Identity & Governance */}
                            <div id="programme-identity" className="p-5 md:p-8 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
                                <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl"><Target className="w-5 h-5 text-indigo-600" /></div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Identity & Governance</h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Define core identifiers and leadership structure.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="col-span-1">
                                        <label className={labelCls}>Reference Code *</label>
                                        <input className={clsx(inputCls, formErrors.reference && 'border-rose-400 focus:border-rose-500')} value={form.reference} onChange={e => { set('reference', e.target.value); setFormErrors(p => ({ ...p, reference: '' })); }} placeholder="PROG-001" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={labelCls}>Programme Full Name *</label>
                                        <input className={clsx(inputCls, formErrors.name && 'border-rose-400 focus:border-rose-500')} value={form.name} onChange={e => { set('name', e.target.value); setFormErrors(p => ({ ...p, name: '' })); }} placeholder="e.g. Manchester Net Zero Housing Programme" />
                                        {formErrors.name && <p className="mt-1 ml-1 text-[11px] text-rose-500 font-bold">{formErrors.name}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Programme Type *</label>
                                        <select className={clsx(inputCls, formErrors.type && 'border-rose-400 focus:border-rose-500')} value={form.type} onChange={e => { set('type', e.target.value); setFormErrors(p => ({ ...p, type: '' })); }}>
                                            <option value="">— Select —</option>
                                            {Array.isArray(PROGRAMME_TYPES) && PROGRAMME_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                        {formErrors.type && <p className="mt-1 ml-1 text-[11px] text-rose-500 font-bold">{formErrors.type}</p>}
                                    </div>
                                    <div>
                                        <label className={labelCls}>Geographic Scope</label>
                                        <input className={inputCls} value={form.geographicScope} onChange={e => set('geographicScope', e.target.value)} placeholder="Region / Borough" />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Strategic Objectives *</label>
                                    <textarea className={clsx(textareaCls, formErrors.strategicObjectives && 'border-rose-400 focus:border-rose-500')} rows={3} value={form.strategicObjectives} onChange={e => { set('strategicObjectives', e.target.value); setFormErrors(p => ({ ...p, strategicObjectives: '' })); }} placeholder="Define the core mission of this programme..." />
                                    {formErrors.strategicObjectives && <p className="mt-1 ml-1 text-[11px] text-rose-500 font-bold">{formErrors.strategicObjectives}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50 pt-6">
                                    <div>
                                        <label className={labelCls}>Senior Responsible Owner (SRO)</label>
                                        <input className={inputCls} value={form.sro} onChange={e => set('sro', e.target.value)} placeholder="e.g. Director of Housing" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Strategic Sponsor</label>
                                        <input className={inputCls} value={form.sponsor} onChange={e => set('sponsor', e.target.value)} placeholder="e.g. Project Board" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Governance Framework</label>
                                        <select className={inputCls} value={form.governanceFramework} onChange={e => set('governanceFramework', e.target.value)}>
                                            <option value="">— Select —</option>
                                            {Array.isArray(GOVERNANCE_FRAMEWORKS) && GOVERNANCE_FRAMEWORKS.map(g => <option key={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Reporting Cycle</label>
                                        <select className={inputCls} value={form.reportingCycle} onChange={e => set('reportingCycle', e.target.value)}>
                                            <option value="">— Select —</option>
                                            {Array.isArray(REPORTING_CYCLES) && REPORTING_CYCLES.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Board Composition</label>
                                        <input className={inputCls} value={form.boardComposition} onChange={e => set('boardComposition', e.target.value)} placeholder="e.g. Executive Board, Non-exec Directors" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Escalation Route</label>
                                        <input className={inputCls} value={form.escalationRoute} onChange={e => set('escalationRoute', e.target.value)} placeholder="e.g. Programme Board → Cabinet Member" />
                                    </div>
                                </div>
                            </div>


                            {/* Section 3: Scale & Financials */}
                            <div id="programme-finance" className="p-5 md:p-8 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
                                <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                                    <div className="p-2.5 bg-emerald-50 rounded-xl"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Scale & Portfolio Financials</h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Budget targets and unit volume.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className={labelCls}>Volume Targets (Units)</label>
                                        <input type="number" className={inputCls} value={form.totalUnits} onChange={e => set('totalUnits', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Project Count</label>
                                        <input type="number" className={inputCls} value={form.totalProjects} onChange={e => set('totalProjects', e.target.value)} placeholder="Est. projects" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Total Value (£)</label>
                                        <input type="number" className={inputCls} value={form.totalValue} onChange={e => set('totalValue', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Grant Funding (£)</label>
                                        <input type="number" className={inputCls} value={form.totalGrant} onChange={e => set('totalGrant', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Contingency (%)</label>
                                        <input type="number" min="0" max="100" className={inputCls} value={form.contingencyPct} onChange={e => set('contingencyPct', e.target.value)} placeholder="5" />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Resource Constraints</label>
                                    <textarea className={textareaCls} rows={2} value={form.resourceConstraints} onChange={e => set('resourceConstraints', e.target.value)} placeholder="e.g. Land availability, contractor capacity, planning timeline..." />
                                </div>

                                <div>
                                    <label className={labelCls}>Primary Funding Sources</label>
                                    <CheckGroup options={PROG_FUNDERS} selected={form.funders} onChange={v => set('funders', v)} />
                                </div>
                            </div>

                            {/* Section 4: Regulatory & Compliance */}
                            <div id="programme-compliance" className="p-5 md:p-8 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
                                <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                                    <div className="p-2.5 bg-violet-50 rounded-xl"><Shield className="w-5 h-5 text-violet-600" /></div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Regulatory Compliance</h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Cross-cutting standards and standards alignment.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelCls}>Risk Appetite</label>
                                        <select className={inputCls} value={form.riskAppetite} onChange={e => set('riskAppetite', e.target.value)}>
                                            <option value="">— Select —</option>
                                            {RISK_APPETITES.map(r => <option key={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Higher Risk Building (HRB)?</label>
                                        <select className={inputCls} value={form.hasHRB} onChange={e => set('hasHRB', e.target.value)}>
                                            <option value="">— Select —</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Leasehold Properties?</label>
                                        <select className={inputCls} value={form.hasLeasehold} onChange={e => set('hasLeasehold', e.target.value)}>
                                            <option value="">— Select —</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Compliance Reporting Body</label>
                                    <input className={inputCls} value={form.complianceReportingBody} onChange={e => set('complianceReportingBody', e.target.value)} placeholder="e.g. RSH, Homes England, GLA" />
                                </div>

                                <div>
                                    <label className={labelCls}>RSH Consumer Standards Alignment</label>
                                    <CheckGroup options={RSH_STANDARDS} selected={form.rshStandards} onChange={v => set('rshStandards', v)} />
                                </div>

                                <div>
                                    <label className={labelCls}>Secondary Obligations</label>
                                    <CheckGroup options={REGULATORY_OBLIGATIONS} selected={form.regulatoryObligations} onChange={v => set('regulatoryObligations', v)} />
                                </div>
                            </div>

                            {/* Section 5: Strategic Risk Identification */}
                            <div id="programme-risk" className="p-5 md:p-8 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
                                <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                                    <div className="p-2.5 bg-rose-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-rose-600" /></div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Strategic Risk Identification</h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">High-level risk discovery and AI insights.</p>
                                    </div>
                                </div>

                                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-32 -translate-y-32" />
                                    <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                                        <div className="flex-1 text-center sm:text-left">
                                            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                                                <ScanSearch className="w-5 h-5 text-indigo-200" />
                                                <span className="text-sm font-black uppercase tracking-wider">AI Strategic Advisor</span>
                                            </div>
                                            <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                                                Using your Strategic Objectives, we can generate a baseline set of programme-level risks automatically.
                                            </p>
                                        </div>
                                        <button
                                            onClick={runAiAnalysis}
                                            disabled={aiAnalyzing || !form.strategicObjectives}
                                            className="w-full sm:w-auto px-6 py-3 bg-white text-indigo-600 text-xs font-black rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                                        >
                                            {aiAnalyzing
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                                                : <><ScanSearch className="w-4 h-4" /> Run Discovery</>
                                            }
                                        </button>
                                    </div>
                                </div>

                                {aiError && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-bold">{aiError}</div>}

                                <div>
                                    <label className={labelCls}>Strategic Risks</label>
                                    <textarea 
                                        className={`${textareaCls} font-mono text-[12px] h-[300px]`} 
                                        value={form.knownStrategicRisks} 
                                        onChange={e => set('knownStrategicRisks', e.target.value)} 
                                        placeholder="[FINANCIAL] Inflation impact...&#10;[REGULATORY] BSA 2022 Gateway delays..."
                                    />
                                </div>
                            </div>

                            {/* Section 5: Delivery Team */}
                            <div id="programme-delivery" className="scroll-mt-24">
                                <DeliveryTeamCRUD
                                    members={Array.isArray(form.deliveryTeam) ? form.deliveryTeam : []}
                                    isDone={!!form.deliveryTeamDone}
                                    saving={teamSaving}
                                    saved={teamSaved}
                                    onUpdate={async (members: TeamMember[], isDone: boolean) => {
                                        // Always update local form state
                                        setForm(prev => ({ ...prev, deliveryTeam: members, deliveryTeamDone: isDone }));
                                        // Only write directly to Firestore in edit mode (programme already in DB)
                                        if (existing) {
                                            setTeamSaving(true);
                                            setTeamSaved(false);
                                            try {
                                                await updateProgramme(existing.id, { deliveryTeam: members, deliveryTeamDone: isDone });
                                                setTeamSaved(true);
                                                setTimeout(() => setTeamSaved(false), 2000);
                                            } catch {
                                                toast.error('Failed to save team member. Please try again.');
                                            } finally {
                                                setTeamSaving(false);
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Sidebar ────────────────────────────────────────── */}
                    <div className="w-full lg:w-80 flex-shrink-0 order-first lg:order-last">
                        <div className="sticky top-20 lg:top-6 z-20">
                            <PublicationChecklist onPublish={handlePublish} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

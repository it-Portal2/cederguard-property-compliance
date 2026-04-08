import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LayoutTemplate, Save, ArrowLeft, Shield, AlertTriangle, AlertCircle, ChevronRight, CheckCircle2, ScanSearch, Lightbulb, Info, DollarSign, Rocket, CheckSquare, Target, Trash2, Users, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { stripMarkdown } from '../lib/utils';
import type { Programme } from '../store/useStore';
import { isSuperAdmin, isAtLeastClientAdmin } from '../lib/roles';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { calculateProgrammeProgress } from '../lib/progress';
import { DeliveryTeamCRUD } from '../components/DeliveryTeamCRUD';

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

// ─── Publication Checklist (Step tracker) ───────────────────────────────────
type StepStatus = 'complete' | 'active' | 'not-started';

interface PubStepProps {
    num: string;
    label: string;
    info: string;
    status: StepStatus;
    onClick?: () => void;
}

const PubStep: React.FC<PubStepProps> = ({ num, label, info, status, onClick }) => {
    const cfg: Record<StepStatus, { bg: string; icon: React.ReactNode; text: string }> = {
        complete:    { bg: 'bg-emerald-500', icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />, text: 'text-emerald-700' },
        active:      { bg: 'bg-amber-400',   icon: <AlertCircle  className="w-3.5 h-3.5 text-white" />, text: 'text-slate-800'   },
        'not-started': { bg: 'bg-slate-200', icon: <span className="text-[10px] font-bold text-slate-400">{num}</span>, text: 'text-slate-400' },
    };
    const c = cfg[status];
    return (
        <button 
            onClick={onClick}
            disabled={status === 'not-started'}
            className={clsx(
                "w-full flex items-start gap-3 py-2.5 text-left transition-all rounded-xl px-2 -mx-2 hover:bg-slate-50",
                status === 'not-started' ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            )}
        >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-slate-100">
                {c.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className={clsx('text-[13px] font-bold leading-tight', c.text)}>{label}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{info}</p>
            </div>
        </button>
    );
};

function ProgrammeSetupTracker({ programme, onPublish, loading }: { programme?: Programme; onPublish: () => void; loading?: boolean }) {
    const navigate = useNavigate();
    const { user, complianceItems, risks, activeProgrammeId } = useStore();
    const userRole = user?.role || (user as any)?.profile?.role;

    const safeComplianceItems = Array.isArray(complianceItems) ? complianceItems : [];
    const safeRisks = Array.isArray(risks) ? risks : [];
    const prog = programme || {} as Programme;

    const steps: { num: string; label: string; info: string; status: StepStatus; id: string }[] = [
        {
            num: '1',
            label: '1. Programme Identity',
            info: 'Core metadata and objectives.',
            status: programme ? 'complete' : 'active',
            id: 'programme-identity'
        },
        {
            num: '2',
            label: '2. Complete Compliance Profile',
            info: 'Regulatory obligations and regime.',
            status: (programme?.complianceSetupDone || (activeProgrammeId && safeComplianceItems.some(i => i.programmeId === activeProgrammeId)))
                ? 'complete' 
                : (programme ? 'active' : 'not-started'),
            id: 'programme-compliance'
        },
        {
            num: '3',
            label: '3. Complete Risk Setup',
            info: 'AI-driven strategic risk discovery.',
            status: (
                (programme?.riskSetupDone && programme?.aiRiskDiscoveryDone) || 
                (activeProgrammeId && safeRisks.filter(r => r.programmeId === activeProgrammeId).length >= 1)
            ) 
                ? 'complete' 
                : ((programme?.complianceSetupDone || (activeProgrammeId && safeComplianceItems.some(i => i.programmeId === activeProgrammeId))) 
                    ? 'active' 
                    : 'not-started'),
            id: 'programme-risk'
        },
        {
            num: '4',
            label: '4. Assign Delivery Team',
            info: 'Key roles and lead members.',
            status: programme?.deliveryTeamDone ? 'complete' : (
                ((programme?.riskSetupDone && programme?.aiRiskDiscoveryDone) || (activeProgrammeId && safeRisks.filter(r => r.programmeId === activeProgrammeId).length >= 1))
                ? 'active' 
                : 'not-started'
            ),
            id: 'programme-delivery'
        },
        {
            num: '5',
            label: '5. Publish',
            info: 'Go live on the dashboard.',
            status: programme?.isPublished ? 'complete' : (programme?.deliveryTeamDone ? 'active' : 'not-started'),
            id: 'programme-publish'
        },
    ];

    const scrollToSection = (id: string) => {
        // Delay ensures any layout shifts or initial renders are complete
        setTimeout(() => {
            const el = document.getElementById(id);
            const main = document.querySelector('main');
            if (el && main) {
                const offset = 140; // Increased offset for better focus
                const elementRect = el.getBoundingClientRect();
                const mainRect = main.getBoundingClientRect();
                const relativeTop = elementRect.top - mainRect.top + main.scrollTop - offset;
                
                main.scrollTo({
                    top: Math.max(0, relativeTop),
                    behavior: 'smooth'
                });
            }
        }, 350);
    };

    const completedCount = steps.filter(s => s.status === 'complete').length;
    const progress       = calculateProgrammeProgress(programme).percentage;
    const canPublish     = programme?.deliveryTeamDone && 
                           (programme?.complianceSetupDone || (activeProgrammeId && safeComplianceItems.some(i => i.programmeId === activeProgrammeId))) && 
                           ((programme?.riskSetupDone && programme?.aiRiskDiscoveryDone) || (activeProgrammeId && safeRisks.filter(r => r.programmeId === activeProgrammeId).length >= 1));
    const isComplete     = programme?.isPublished;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden sticky top-6">
            <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl border-2 bg-emerald-50 border-emerald-100 text-emerald-700">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-black text-slate-900 leading-none">Programme Readiness</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">Publication Status</p>
                    </div>
                </div>
                <div className={clsx(
                    'text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm',
                    isComplete ? 'bg-emerald-500 text-white' : canPublish ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                )}>
                    {isComplete ? 'Published' : canPublish ? 'Ready' : 'Incomplete'}
                </div>
            </div>

            <div className="px-6 py-5 border-b border-slate-100">
                <div className="space-y-1.5">
                    <div className="flex items-end justify-between">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Setup Progress</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">{progress}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden shadow-inner border border-slate-100 p-0.5">
                        <div 
                            className={clsx(
                                'h-full rounded-full transition-all duration-1000 ease-out shadow-sm',
                                isComplete ? 'bg-emerald-500' : canPublish ? 'bg-amber-500' : 'bg-indigo-600'
                            )}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="px-6 pt-5 pb-2">
                <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-50">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    Mandatory Steps
                </div>
                <div className="space-y-1">
                    {steps.map((step) => (
                        <div key={step.num}>
                            <PubStep 
                                num={step.num} 
                                label={step.label} 
                                info={step.info} 
                                status={step.status} 
                                onClick={() => scrollToSection(step.id)}
                            />
                            {/* Actions for Step 2 (Compliance) */}
                            {step.num === '2' && (
                                <div className="pl-9 pb-2">
                                    {(programme && step.status === 'active') ? (
                                        <button
                                            onClick={() => navigate(`/compliance/setup?type=programme&from=initiation&programmeId=${programme.id}`)}
                                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all active:scale-95"
                                        >
                                            Setup Compliance Profile
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    ) : (step.status === 'complete' && programme) ? (
                                        <button
                                            onClick={() => navigate(`/compliance/dashboard?type=programme&from=initiation&programmeId=${programme.id}`)}
                                            className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all active:scale-95"
                                        >
                                            View Performance
                                            <CheckCircle2 className="w-3 h-3" />
                                        </button>
                                    ) : null}
                                </div>
                            )}
                            {/* Actions for Step 3 (Risk) */}
                            {step.num === '3' && (
                                <div className="pl-9 pb-2">
                                    {(!!programme && !programme?.riskSetupDone && step.status === 'active') ? (
                                        <button
                                            onClick={() => navigate(`/risk/setup?type=programme&from=initiation&programmeId=${programme.id}`)}
                                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all active:scale-95"
                                        >
                                            Identify Risks
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    ) : (programme?.riskSetupDone && !programme?.aiRiskDiscoveryDone && !!programme) ? (
                                        <button
                                            onClick={() => navigate(`/risk/ai?type=programme&from=initiation&programmeId=${programme.id}`)}
                                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all active:scale-95 animate-pulse shadow-sm"
                                        >
                                            Run AI Discovery
                                            <ScanSearch className="w-3 h-3" />
                                        </button>
                                    ) : (step.status === 'complete' && programme) ? (
                                        <button
                                            onClick={() => navigate(`/risk/dashboard?type=programme&from=initiation&programmeId=${programme.id}`)}
                                            className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all active:scale-95"
                                        >
                                            View Register
                                            <CheckCircle2 className="w-3 h-3" />
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-6 pb-6 pt-2">
                <button
                    disabled={!canPublish || loading}
                    onClick={() => {
                        const isAdmin = isSuperAdmin(user?.email, userRole);
                        const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
                        if (isComplete) navigate('/dashboard?type=programme');
                        else if (onPublish) onPublish();
                    }}
                    className={clsx(
                        'w-full flex items-center justify-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl active:scale-95 mt-4',
                        canPublish && !loading
                            ? (isComplete ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200')
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                        , 'text-white'
                    )}
                >
                    {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isComplete ? (
                        <><CheckCircle2 className="w-4 h-4" /> VIEW DASHBOARD</>
                    ) : (
                        <><Rocket className="w-4 h-4" /> PUBLISH PROGRAMME</>
                    )}
                </button>
                {!isComplete && (
                    <p className="text-[11px] text-center text-slate-500 mt-3 font-bold px-4 leading-relaxed bg-slate-50 py-2.5 rounded-xl border border-dashed border-slate-200">
                        Complete all steps to publish this programme.
                    </p>
                )}
            </div>
        </div>
    );
}

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
    const { programmes, setProgrammes, activeProgrammeId, setActiveProgramme, setActiveProgrammeId, updateProgramme, addNotification, user } = useStore();
    const [loading, setLoading] = useState(false);
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');
    const [success, setSuccess] = useState(false);
    const [pms, setPMs] = useState<any[]>([]);

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

    const resetForm = () => setForm({
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

    // Update form when existing programme loads
    useEffect(() => {
        if (existing) {
            setForm({
                reference: existing.reference || '',
                name: existing.name || '',
                type: existing.type || '',
                overallRAG: (existing as any).overallRAG || '',
                strategicObjectives: existing.strategicObjectives || '',
                geographicScope: (existing as any).geographicScope || '',
                sro: existing.sro || '',
                pm: existing.pm || user?.email || '',
                sponsor: existing.sponsor || '',
                escalationRoute: (existing as any).escalationRoute || '',
                boardComposition: existing.boardComposition || '',
                reportingCycle: existing.reportingCycle || '',
                governanceFramework: existing.governanceFramework || '',
                programmeStartDate: existing.programmeStartDate || format(new Date(), 'yyyy-MM-dd'),
                programmeEndDate: (existing as any).programmeEndDate || '',
                createdBy: user?.email || existing.createdBy || '',
                totalProjects: (existing as any).totalProjects || '',
                totalUnits: existing.totalUnits || '',
                totalValue: existing.totalValue || '',
                totalGrant: existing.totalGrant || '',
                contingencyPct: existing.contingencyPct || '5',
                complianceReportingBody: (existing as any).complianceReportingBody || '',
                riskAppetite: existing.riskAppetite || '',
                funders: Array.isArray((existing as any).funders) ? (existing as any).funders : 
                         (typeof (existing as any).funders === 'string' ? (existing as any).funders.split(',').filter(Boolean) : []),
                resourceConstraints: (existing as any).resourceConstraints || '',
                keyDependencies: Array.isArray((existing as any).keyDependencies) ? (existing as any).keyDependencies : 
                                 (typeof (existing as any).keyDependencies === 'string' ? (existing as any).keyDependencies.split(',').filter(Boolean) : []),
                rshStandards: Array.isArray((existing as any).rshStandards) ? (existing as any).rshStandards : 
                              (typeof (existing as any).rshStandards === 'string' ? (existing as any).rshStandards.split(',').filter(Boolean) : []),
                regulatoryObligations: Array.isArray(existing.regulatoryObligations) ? existing.regulatoryObligations : 
                                       (typeof existing.regulatoryObligations === 'string' ? (existing as any).regulatoryObligations.split(',').filter(Boolean) : []),
                hasHRB: (existing as any).hasHRB || '',
                hasLeasehold: (existing as any).hasLeasehold || '',
                knownStrategicRisks: existing.knownStrategicRisks || '',
                notes: (existing as any).notes || '',
                milestones: Array.isArray(existing.milestones) ? existing.milestones : [],
                deliveryTeam: Array.isArray(existing.deliveryTeam) ? existing.deliveryTeam : [],
                deliveryTeamDone: !!existing.deliveryTeamDone,
            });
        }
    }, [existing, user?.email]);

    // Reset form if activeProgrammeId becomes null (e.g. from nav or "New" button)
    useEffect(() => {
        if (!activeProgrammeId) {
            resetForm();
        }
    }, [activeProgrammeId]);

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
            setActiveProgrammeId(activeProgrammeId);
            setSuccess(true);
            addNotification({ title: 'Success', body: 'Programme published successfully.', type: 'system' });
            setTimeout(() => {
                navigate('/dashboard');
            }, 1000);
        } catch (err: any) {
            setAiError(err.message || 'Failed to publish programme.');
            addNotification({ title: 'Error', body: err.message || 'Failed to publish programme.', type: 'system' });
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
            });
        }
    };

    const runAiAnalysis = async () => {
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
                setAiError('AI returned an empty response.');
            }
        } catch (err: any) {
            setAiError('AI analysis failed.');
        } finally {
            setAiAnalyzing(false);
        }
    };

    const handleSave = async (isDraft: boolean = false) => {
        const safeFunders = Array.isArray(form.funders) ? form.funders : [];
        if (!form.name || !form.type) {
            addNotification({ title: 'Validation Error', body: 'Programme Name and Type are required.', type: 'system' });
            return;
        }
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
                deliveryTeamDone: existing?.deliveryTeamDone || false,
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
                // Map all form fields explicitly to ensure type safety
                sro: form.sro,
                pm: form.pm || user?.email || '',
                sponsor: form.sponsor || '',
                boardComposition: form.boardComposition || '',
                reportingCycle: form.reportingCycle || '',
                governanceFramework: form.governanceFramework || '',
                strategicObjectives: form.strategicObjectives || '',
                geographicScope: form.geographicScope || '',
                programmeStartDate: form.programmeStartDate || format(new Date(), 'yyyy-MM-dd'),
                programmeEndDate: form.programmeEndDate || '',
                createdBy: form.createdBy || user?.email || '',
                totalProjects: form.totalProjects,
                totalUnits: form.totalUnits,
                totalValue: form.totalValue,
                totalGrant: form.totalGrant,
                contingencyPct: form.contingencyPct,
                fundingSources: safeFunders.join(', '),
                resourceConstraints: form.resourceConstraints,
                rshStandards: Array.isArray(form.rshStandards) ? form.rshStandards : [],
                regulatoryObligations: Array.isArray(form.regulatoryObligations) ? form.regulatoryObligations : [],
                hrbScheme: form.hasHRB || 'No',
                leaseholderStatus: form.hasLeasehold || 'No',
                knownStrategicRisks: form.knownStrategicRisks,
                notes: form.notes,
                overallRAG: form.overallRAG,
                escalationRoute: form.escalationRoute,
                funders: safeFunders,
                milestones: Array.isArray(form.milestones) ? form.milestones : []
            };
            
            const safeProgrammes = Array.isArray(programmes) ? programmes : [];
            const updatedList = activeProgrammeId
                ? safeProgrammes.map(p => p.id === activeProgrammeId ? updated : p)
                : [...safeProgrammes, updated];
            
            setProgrammes(updatedList);
            if (!activeProgrammeId) setActiveProgrammeId(newId);
            await api.saveData('programmes', updatedList);
            
            setSuccess(true);
            addNotification({ title: 'Success', body: `Programme ${isDraft ? 'draft saved' : 'finalised'} successfully.`, type: 'system' });
            setTimeout(() => navigate(`/compliance/setup?type=programme&id=${activeProgrammeId || newId}&from=initiation`), 1000);
        } catch (err) {
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
                                            useStore.getState().setActiveProgramme(null);
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
                <div className="flex flex-col lg:flex-row gap-8">
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
                                        <input className={inputCls} value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="PROG-001" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={labelCls}>Programme Full Name *</label>
                                        <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Manchester Net Zero Housing Programme" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Programme Type *</label>
                                        <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
                                            <option value="">— Select —</option>
                                            {Array.isArray(PROGRAMME_TYPES) && PROGRAMME_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Geographic Scope</label>
                                        <input className={inputCls} value={form.geographicScope} onChange={e => set('geographicScope', e.target.value)} placeholder="Region / Borough" />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Strategic Objectives *</label>
                                    <textarea className={textareaCls} rows={3} value={form.strategicObjectives} onChange={e => set('strategicObjectives', e.target.value)} placeholder="Define the core mission of this programme..." />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50 pt-6">
                                    <div>
                                        <label className={labelCls}>Strategic Sponsor</label>
                                        <input className={inputCls} value={form.sponsor} onChange={e => set('sponsor', e.target.value)} placeholder="e.g. Project Board" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Reporting Cycle</label>
                                        <select className={inputCls} value={form.reportingCycle} onChange={e => set('reportingCycle', e.target.value)}>
                                            <option value="">— Select —</option>
                                            {Array.isArray(REPORTING_CYCLES) && REPORTING_CYCLES.map(c => <option key={c}>{c}</option>)}
                                        </select>
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
                                            {aiAnalyzing ? 'Analyzing...' : 'Run Discovery'}
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
                                    activeId={activeProgrammeId || ''}
                                    type="programme"
                                    deliveryTeam={form.deliveryTeam}
                                    deliveryTeamDone={form.deliveryTeamDone}
                                    onUpdate={async (data) => {
                                        setForm(prev => ({ ...prev, ...data }));
                                        if (activeProgrammeId) {
                                            await updateProgramme(activeProgrammeId, data);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Sidebar ────────────────────────────────────────── */}
                    <div className="w-full lg:w-80 flex-shrink-0 order-first lg:order-last">
                        <div className="sticky top-20 lg:top-6 z-20">
                            <ProgrammeSetupTracker programme={existing} onPublish={handlePublish} loading={loading} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

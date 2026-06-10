import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router';
import { Briefcase, ScanSearch, Building2, ShieldAlert, FileWarning, AlertTriangle, ArrowRight, Settings, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { analyzeCompliance } from '../../../services/aiService';
import { api } from '../../../lib/api';
import { clsx } from 'clsx';
import { useStore } from '../../../store/useStore';
import { RIBA_STAGES } from '../../../constants/ribaStages';
import { PublicationChecklist } from '../../../components/PublicationChecklist';
import { stripMarkdown } from '../../../lib/utils';
import { isAtLeastClientAdmin, UserRole, isSuperAdmin, isAtLeastPM } from '../../../lib/roles';
import { inputBase } from '../../../components/forms';

const inputCls = inputBase;
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5 cursor-pointer";
// Used inside the 2-column questionnaire grid: reserves 2 lines of label
// height so 1-line and 2-line labels in the same row produce inputs that
// align horizontally across columns.
const questionLabelCls = "block text-sm font-medium text-slate-700 mb-1.5 cursor-pointer min-h-10 leading-snug";

interface Question {
    id: string;
    label: string;
    type: string;
    opts?: any[];
    required?: boolean;
    placeholder?: string;
    trigger?: string;
}

interface Phase {
    phase: string;
    questions: Question[];
    hint?: string;
}

const AI_QUESTIONS: Phase[] = [
    {
        phase: "Phase 1: Project Setup & Governance",
        hint: "Covers client-side governance, SRO appointment, brief clarity and regulatory accountability.",
        questions: [
            { id: "g1", label: "Has a Senior Responsible Owner (SRO) been formally appointed?", type: "select", opts: ["Yes — appointed and active", "Informally identified but not confirmed", "Not yet appointed"], trigger: "Absence of a confirmed SRO means no single accountable authority for project decisions — a primary governance risk." },
            { id: "g2", label: "Is the project brief and scope clearly defined?", type: "select", opts: ["Fully defined with sign-off", "Mostly defined with minor gaps", "Partially defined", "Scope not yet established"], trigger: "Undefined or partially defined scope at project mobilisation is a leading driver of variation, cost overrun and programme delay." },
            { id: "g3", label: "Who is the client organisation?", type: "select", opts: ["Local Authority", "Registered Provider / Housing Association", "Joint Venture / SPV", "Private developer", "Other public body"] },
            { id: "g4", label: "What is the primary driver of this project?", type: "select", opts: ["Planned maintenance / stock improvement", "Building safety remediation", "Decarbonisation / energy upgrade", "Housing supply — new units", "Estate regeneration", "Regulatory compliance deadline", "Emergency or reactive works"], trigger: "Regulatory compliance and safety remediation deadlines carry legal consequences if missed." },
            { id: "g5", label: "How would you rate the project's technical complexity?", type: "select", opts: ["Standard / Routine", "Moderate complexity", "High complexity — specialist inputs required", "Critically complex / First-of-a-kind"], trigger: "High technical complexity requires enhanced design coordination and specialist risk oversight." },
            { id: "g6", label: "Reporting and oversight frequency?", type: "select", opts: ["Weekly", "Fortnightly", "Monthly", "Quarterly"] }
        ]
    },
    {
        phase: "Phase 2: Site & Building Conditions",
        hint: "Analyzes physical site constraints, building height/type, and known hazards like asbestos.",
        questions: [
            { id: "s1", label: "What is the primary site classification?", type: "select", opts: ["Greenfield (Clean)", "Brownfield (Previously developed)", "In-fill (Constrained urban)", "Existing occupied building(s)"], trigger: "Existing occupied buildings and brownfield sites carry the highest levels of unknown technical and safety risk." },
            { id: "s2", label: "Is the building height over 18 metres (or 7 storeys)?", type: "select", opts: ["Yes — Higher-Risk Building (HRB)", "No — standard height building", "N/A — external works only"], trigger: "Buildings over 18m/7 storeys are 'Higher-Risk Buildings' under the Building Safety Act 2022, requiring BSR Gateways." },
            { id: "s3", label: "Are there known structural or ground condition issues?", type: "select", opts: ["None identified", "Moderate issues (remediation required)", "Significant issues (structural repair)", "Critical stability concerns"], trigger: "Significant structural or ground issues require specialist design and carry high cost/schedule risk." },
            { id: "s4", label: "What is the asbestos risk profile?", type: "select", opts: ["Low (Post-2000 build)", "Moderate (Managed presence)", "High (Major removal required)", "Unknown (Surveys outstanding)"], trigger: "Major asbestos removal or unknown status is a primary driver of delay and cost increase in refurb projects." }
        ]
    },
    {
        phase: "Phase 3: Design & Technical Readiness",
        hint: "Evaluates design development status (RIBA stages) and specialist technical input.",
        questions: [
            { id: "t1", label: "What is the current RIBA Design Stage?", type: "select", opts: RIBA_STAGES.map(s => s.label), trigger: "Tendering before RIBA Stage 3 is complete typically leads to significant design-driven variations and cost growth." },
            { id: "t2", label: "Is a Multi-Disciplinary design team appointed?", type: "select", opts: ["Yes — fully appointed", "Partially appointed", "No — internal team only", "Not yet appointed"], trigger: "Absence of specialist designers (Fire, MEP, Structural) on complex works is a primary safety and compliance risk." },
            { id: "t3", label: "What is the status of the 'Golden Thread' digital record?", type: "select", opts: ["Fully established (BIM/Common Data Environment)", "Partially established", "Scanning/Manual records only", "Not yet started"], trigger: "Absence of a digital 'Golden Thread' for HRBs is a regulatory breach under the Building Safety Act." }
        ]
    },
    {
        phase: "Phase 4: CDM, Safety & BSA Compliance",
        hint: "Covers health & safety roles, fire safety status, and Building Safety Act Gateway readiness.",
        questions: [
            { id: "b1", label: "Have Principal Designer (CDM) and Contractor roles been appointed?", type: "select", opts: ["Yes — formally appointed", "One appointed only", "Roles identified but not formalised", "Not yet appointed"], trigger: "Failing to formally appoint PD/PC roles is a breach of CDM 2015 regulations." },
            { id: "b2", label: "What is the Building Safety Regulator (BSR) status?", type: "select", opts: ["Gateway 2 Approved", "Gateway 2 Submitted", "Pre-submission / Design development", "Gateway 2 not yet required"], trigger: "HRB works cannot lawfully commence on site without BSR Gateway 2 approval." },
            { id: "b3", label: "What is the fire safety profile of the project?", type: "select", opts: ["Low (Passive protection only)", "Moderate (Standard remediation)", "High (Cladding/External wall systems)", "Life safety critical (Waking watch in place)"], trigger: "Life safety critical fire issues and external wall remediation carry high regulatory and reputational risk." }
        ]
    },
    {
        phase: "Phase 5: Procurement & Contract Risk",
        hint: "Focuses on the commercial model, pricing mechanism, and contractor market stability.",
        questions: [
            { id: "p1", label: "What is the form of contract?", type: "select", opts: ["JCT Design and Build", "JCT Standard Building Contract", "NEC4 ECC (Option A/B)", "NEC4 ECC (Option C/D)", "PCSA (Pre-Construction)"], trigger: "Option C/D (Target Cost) contracts require high levels of open-book audit and internal client resource." },
            { id: "p2", label: "What is the pricing mechanism?", type: "select", opts: ["Fixed Price / Lump Sum", "Target Cost with Pain/Gain", "Approximate Quantities", "Cost Reimbursable / Open Book"], trigger: "Cost reimbursable pricing carries near-unlimited financial exposure for the client." },
            { id: "p3", label: "How would you rate the main contractor's financial stability?", type: "select", opts: ["Strong / Low risk", "Moderate / Monitored", "Weak / High risk", "No contractor appointed yet"], trigger: "Contractor insolvency is currently a leading cause of project failure in the UK construction sector." }
        ]
    },
    {
        phase: "Phase 6: Residents, Leaseholders & Stakeholders",
        hint: "Analyzes resident occupancy during works, leaseholder exposure, and community sensitivity.",
        questions: [
            { id: "r1", label: "What is the occupancy status during works?", type: "select", opts: ["Vacant possession", "Residents remain in-situ", "Phased decant", "Temporary relocation required"], trigger: "Works in occupied buildings significantly increase CDM, fire safety and resident welfare risk." },
            { id: "r2", label: "What is the level of stakeholder sensitivity?", type: "select", opts: ["High — vocal opposition / media interest", "Moderate — standard engagement", "Low — supportive community", "Internal stakeholders only"], trigger: "High stakeholder sensitivity requires a dedicated communication and reputation plan." },
            { id: "r3", label: "Are leaseholders being recharged for these works?", type: "select", opts: ["Yes — Section 20 notices issued", "Yes — process pending", "No — costs covered by grant/internal", "Not applicable"], trigger: "Section 20 challenges can cause significant delays to project commencement and funding recovery." }
        ]
    },
    {
        phase: "Phase 7: Funding, Schedule & Delivery Pressure",
        hint: "Covers grant dependencies (e.g., SHDF, BSF), budget certainty, and critical deadlines.",
        questions: [
            { id: "f1", label: "What is the primary funding source?", type: "select", opts: ["Internal Capital / Reserves", "Homes England / GLA Grant", "Social Housing Decarb Fund (SHDF)", "Building Safety Fund (BSF)", "Private Finance / Loan"], trigger: "Grant funding usually carries strict 'spend-by' deadlines and clawback risks." },
            { id: "f2", label: "What is the schedule pressure profile?", type: "select", opts: ["No schedule pressure", "Moderate schedule pressure", "Significant delivery pressure", "Critical delivery deadlines"], trigger: "Critical deadlines with external dependencies (like grant expiry) create the highest probability of project failure." },
            { id: "f3", label: "What is the level of contingency held?", type: "select", opts: ["Over 15% (High Risk)", "10% (Standard)", "5% (Low / Optimistic)", "0% (No contingency)"], trigger: "0—5% contingency on refurbishment projects is insufficient to cover standard project variations." }
        ]
    }
];

const PROGRAMME_AI_QUESTIONS: Phase[] = [
    {
        phase: "Phase 1: Strategic Governance & Programme Scale",
        hint: "Evaluates the overarching programme structure, accountability and scale of delivery. Clear governance is the foundation of successful programme delivery.",
        questions: [
            { id: "pg1", label: "What is the programme governance structure?", type: "select", opts: ["Dedicated Programme Board", "Sub-committee of Main Board", "Informal working group", "No formal programme governance"], required: true, trigger: "Absence of a formal Programme Board means no strategic oversight for cross-project risks." },
            { id: "pg2", label: "Has a Programme Director / SRO been formally appointed?", type: "select", opts: ["Yes — appointed and active", "Informally identified but not confirmed", "Not yet appointed"], trigger: "Absence of a confirmed SRO means no single accountable authority for programme-level decisions." },
            { id: "pg3", label: "Which organisation holds regulatory accountability?", type: "select", opts: ["Local Authority", "Registered Provider / Housing Association", "Joint Venture governance structure", "Private developer-led delivery", "Accountability not yet defined"], required: true, trigger: "Undefined regulatory accountability creates enforcement gaps and reporting risk." },
            { id: "pg4", label: "What is the primary strategic driver of the programme?", type: "select", opts: ["Housing supply targets", "Estate regeneration", "Building safety remediation", "Decarbonisation / retrofit programme", "Policy or political commitment", "Mixed drivers"], required: true, trigger: "Political commitment and policy-driven programmes carry elevated exposure to scope change and external pressure." },
            { id: "pg5", label: "How many projects are included in the programme?", type: "select", opts: ["Single project", "2–5 projects", "6–15 projects", "15+ projects"], trigger: "Programmes of 15+ projects carry significant coordination and dependency risk." },
            { id: "pg6", label: "Does the programme involve multiple project types?", type: "select", opts: ["Single project type", "Limited variation (2 types)", "Multiple complex project types"], trigger: "High type variation compounds programme management complexity and requires multi-discipline oversight." },
            { id: "pg7", label: "Are projects spread across multiple sites or locations?", type: "select", opts: ["Single site", "Multiple sites in one area", "Multiple sites across the region"], trigger: "Multi-site regional programmes increase coordination, logistics and supply chain pressure." }
        ]
    },
    {
        phase: "Phase 2: Delivery Capacity & Supply Chain",
        hint: "Covers internal delivery team resourcing, specialist skills gaps and contractor market conditions. Capacity and supply chain are consistently the highest-impact risk domains in UK housing delivery.",
        questions: [
            { id: "pc1", label: "What is the internal programme resource capacity?", type: "select", opts: ["Fully resourced delivery team", "Mostly resourced with minor gaps", "Partially resourced", "Significant capability gaps", "Delivery team not yet established"], trigger: "Significant resourcing gaps or an unestablished delivery team are a critical programme risk." },
            {
                id: "pc2", label: "Does the programme require specialist expertise?", type: "checkboxes", opts: [
                    { v: "fire_eng", l: "Fire engineering expertise" },
                    { v: "retrofit", l: "Retrofit / decarbonisation specialists" },
                    { v: "safety", l: "Building safety specialists" },
                    { v: "structural", l: "Complex structural engineering" },
                    { v: "none", l: "None identified" }
                ], trigger: "Specialist skills shortages in retrofit and building safety are currently acute in the UK market."
            },
            { id: "pc3", label: "Does the organisation have experience delivering similar programmes?", type: "select", opts: ["Extensive experience", "Moderate experience", "Limited experience", "No comparable experience"], trigger: "No comparable delivery experience significantly elevates programme execution risk." },
            { id: "pc4", label: "What is the supply chain strategy?", type: "select", opts: ["Framework contractors secured", "Strategic delivery partners appointed", "Open procurement per project", "Hybrid model", "Supply chain strategy not yet defined"], trigger: "Undefined supply chain strategy at programme stage is a major commercial and schedule risk." },
            { id: "pc5", label: "How would you describe current contractor market conditions?", type: "select", opts: ["Highly competitive market", "Moderate competition", "Limited contractor availability", "Specialist contractor market only"] },
            {
                id: "pc6", label: "Which market volatility risks apply?", type: "checkboxes", opts: [
                    { v: "inflation", l: "Inflation risk" },
                    { v: "supply_vol", l: "Material supply volatility" },
                    { v: "labour", l: "Labour shortages" },
                    { v: "energy", l: "Energy cost volatility" }
                ], trigger: "Concurrent inflation, material and labour pressures compound cost and programme exposure."
            }
        ]
    },
    {
        phase: "Phase 3: Land, Site & Planning Risk",
        hint: "Covers land ownership, site constraints, environmental conditions and planning status. Unresolved land and planning risk is among the most common causes of programme delay.",
        questions: [
            { id: "pl1", label: "What is the land ownership status across the programme?", type: "select", opts: ["Land fully secured", "Majority secured", "Partial ownership issues", "Land assembly required"], trigger: "Land assembly requirements introduce legal, compulsory purchase and timing risk." },
            {
                id: "pl2", label: "Which site constraints are present?", type: "checkboxes", opts: [
                    { v: "ground", l: "Ground condition uncertainty" },
                    { v: "access", l: "Access constraints" },
                    { v: "utilities", l: "Utility infrastructure limitations" },
                    { v: "neighbors", l: "Neighbouring property constraints" },
                    { v: "none", l: "None known" }
                ], trigger: "Multiple concurrent site constraints significantly increase pre-construction risk."
            },
            {
                id: "pl3", label: "Which environmental site conditions apply?", type: "checkboxes", opts: [
                    { v: "brownfield", l: "Brownfield / contaminated land" },
                    { v: "flood", l: "Flood risk zone" },
                    { v: "habitats", l: "Protected habitats" },
                    { v: "archaeology", l: "Archaeological sensitivity" }
                ], trigger: "Contamination, flood risk and ecological designations require early specialist investigation and may delay planning."
            },
            { id: "pl4", label: "What is the current planning status?", type: "select", opts: ["Planning permission secured", "Planning application submitted", "Pre-application engagement underway", "Planning strategy not yet defined"], trigger: "Undefined planning strategy at programme stage is a material risk to delivery timescales." },
            {
                id: "pl5", label: "Which heritage and conservation constraints apply?", type: "checkboxes", opts: [
                    { v: "listed", l: "Listed building constraints" },
                    { v: "conservation", l: "Conservation area restrictions" },
                    { v: "heritage_prot", l: "Heritage protection requirements" },
                    { v: "none", l: "None" }
                ], trigger: "Heritage constraints require specialist assessment and may significantly extend pre-delivery programme."
            },
            {
                id: "pl6", label: "Which regulatory approvals are required?", type: "checkboxes", opts: [
                    { v: "bsr", l: "Building Safety Regulator approval required" },
                    { v: "eia", l: "Environmental impact assessment required" },
                    { v: "highways", l: "Highway approvals required" },
                    { v: "utilities_app", l: "Utility authority approvals required" }
                ], trigger: "Multiple concurrent regulatory approvals create programme dependency and gateway risk."
            }
        ]
    },
    {
        phase: "Phase 4: Construction & Technical Risk",
        hint: "Covers construction complexity, site hazards and delivery strategy. Technical risk must be assessed against delivery model — self-delivery, contractor or framework.",
        questions: [
            {
                id: "pct1", label: "Which construction complexity factors apply?", type: "checkboxes", opts: [
                    { v: "demolition", l: "Demolition or major strip-out works" },
                    { v: "high_rise", l: "High-rise construction (>18m)" },
                    { v: "structural_alt", l: "Structural alterations to existing buildings" },
                    { v: "mixed_use", l: "Mixed-use development" },
                    { v: "phased", l: "Phased or multi-stage construction" }
                ], trigger: "High-rise, demolition and phased delivery significantly elevate construction programme and safety risk."
            },
            {
                id: "pct2", label: "Which site construction risks are present?", type: "checkboxes", opts: [
                    { v: "asbestos", l: "Potential asbestos or hazardous materials" },
                    { v: "contaminated", l: "Contaminated ground conditions" },
                    { v: "temp_works", l: "Complex temporary works required" },
                    { v: "occupied", l: "Construction in occupied buildings" }
                ], trigger: "Occupied-building construction and asbestos are the highest-consequence construction site risks."
            },
            { id: "pct3", label: "What is the construction delivery strategy?", type: "select", opts: ["Single contractor delivery", "Multiple contractors across projects", "Framework delivery model", "Development partner model"], trigger: "Multiple contractors without coordinated oversight introduces interface, quality and programme risk." }
        ]
    },
    {
        phase: "Phase 5: Residents, Stakeholders & Funding",
        hint: "Covers resident occupancy risk, vulnerability profile, stakeholder sensitivity and funding certainty. Resident and political risk are often underweighted in early programme planning.",
        questions: [
            { id: "pr1", label: "What is the resident occupancy position during works?", type: "select", opts: ["Vacant possession", "Residents remain during works", "Partial decant required", "Full decant required"], trigger: "Full decant and occupied-works scenarios carry significant resident welfare, legal and reputational risk." },
            { id: "pr2", label: "What is the resident vulnerability profile?", type: "select", opts: ["General needs housing", "Families with children", "Elderly residents", "Supported housing / care", "Mixed resident profile"], trigger: "Vulnerable and supported residents require tailored engagement strategies and enhanced safeguarding." },
            {
                id: "pr3", label: "Which stakeholder risk factors apply?", type: "checkboxes", opts: [
                    { v: "opposition", l: "Community opposition risk" },
                    { v: "political", l: "Political sensitivity" },
                    { v: "displacement", l: "Resident displacement concerns" },
                    { v: "heritage_stake", l: "Heritage or conservation concerns" }
                ], trigger: "Political sensitivity combined with displacement concerns creates high reputational and programme risk."
            },
            { id: "pr4", label: "What is the funding certainty position?", type: "select", opts: ["Fully funded programme", "Majority funding secured", "Partial funding secured", "Funding strategy still being developed"], trigger: "Funding uncertainty at programme stage is a critical risk to delivery commitment and contract placement." },
            {
                id: "pr5", label: "Which grant funding dependencies apply?", type: "checkboxes", opts: [
                    { v: "homes_england", l: "Homes England grant milestones" },
                    { v: "gla", l: "GLA funding conditions" },
                    { v: "decarb", l: "Decarbonisation funding milestones" },
                    { v: "none", l: "No grant dependency" }
                ], trigger: "Multiple grant milestone dependencies create cascading schedule risk across the programme."
            },
            { id: "pr6", label: "What is the cost certainty position?", type: "select", opts: ["Costs well defined with contingency", "Moderate cost uncertainty", "Significant cost uncertainty"], trigger: "Significant cost uncertainty alongside partial funding creates a compound commercial risk." }
        ]
    },
    {
        phase: "Phase 6: Dependencies, Integration & Schedule Pressure",
        hint: "Covers cross-programme dependencies, infrastructure requirements and delivery timeline pressures. Dependency risk is often invisible until it becomes critical.",
        questions: [
            {
                id: "pd1", label: "Which cross-programme dependencies exist?", type: "checkboxes", opts: [
                    { v: "grant_milestones", l: "Grant funding cross-project milestones" },
                    { v: "shared_contractor", l: "Shared contractor across schemes" },
                    { v: "masterplanning", l: "Masterplanning / area-wide planning" },
                    { v: "bsa_gateways", l: "Building Safety Gateway approvals" },
                    { v: "infra_upgrades", l: "Infrastructure upgrades required" }
                ], trigger: "Shared contractors and cross-milestone grant dependencies are leading causes of cascading programme slippage."
            },
            {
                id: "pd2", label: "Which infrastructure dependencies apply?", type: "checkboxes", opts: [
                    { v: "utility_upgrades", l: "Utility upgrades required" },
                    { v: "transport", l: "Transport infrastructure changes" },
                    { v: "third_party", l: "External infrastructure delivery by third parties" },
                    { v: "none", l: "None identified" }
                ], trigger: "Third-party infrastructure dependencies are outside programme control and carry significant schedule risk."
            },
            { id: "pd3", label: "What is the schedule pressure profile?", type: "select", opts: ["No schedule pressure", "Moderate schedule pressure", "Significant delivery pressure", "Critical delivery deadlines"], trigger: "Critical deadlines with external dependencies create the highest probability of programme failure." },
            {
                id: "pd4", label: "Which external delivery drivers are creating schedule pressure?", type: "checkboxes", opts: [
                    { v: "political_commit", l: "Political commitments" },
                    { v: "grant_deadlines", l: "Grant funding deadlines" },
                    { v: "safety_deadlines", l: "Safety remediation deadlines" },
                    { v: "reg_deadlines", l: "Regulatory compliance deadlines" },
                    { v: "none", l: "None" }
                ], trigger: "Safety remediation and regulatory deadlines carry legal consequence if missed — these cannot be negotiated."
            }
        ]
    },
    {
        phase: "Phase 7: Information, Data & Design Readiness",
        hint: "Covers programme data quality, survey completeness and design development stage. Information gaps discovered late are a consistent driver of cost overrun and programme delay.",
        questions: [
            { id: "pi1", label: "What is the programme information and data certainty?", type: "select", opts: ["Comprehensive programme data available", "Partial data available with known gaps", "Significant information gaps", "Data position unknown"], trigger: "Significant information gaps at programme stage undermine risk assessment accuracy and cost certainty." },
            { id: "pi2", label: "What is the design and survey data position?", type: "select", opts: ["Detailed surveys and design completed", "Partial survey information available", "Survey and design work not yet commenced"], trigger: "Incomplete survey data is a primary driver of cost variance and programme delay at construction stage." },
            {
                id: "pi3", label: "Which information risk factors apply?", type: "checkboxes", opts: [
                    { v: "asbestos_surveys", l: "Asbestos / hazardous materials surveys outstanding" },
                    { v: "structural_surveys", l: "Structural condition surveys outstanding" },
                    { v: "energy_data", l: "EPC / energy assessment data gaps" },
                    { v: "legal_gaps", l: "Legal / title information gaps" },
                    { v: "resident_profiles", l: "Resident data and vulnerabilities not yet profiled" }
                ], trigger: "Outstanding surveys at programme mobilisation stage are a direct risk to pre-construction timeline."
            }
        ]
    }
];

export function RiskSetup() {
    const { activeProjectId, projects, setProjectInfo, programmes, activeProgrammeId, user, updateProject, updateProgramme } = useStore();
    const [searchParams] = useSearchParams();
    const fromParam = searchParams.get('from') === 'initiation' ? '?from=initiation' : '';
    const forcedType = searchParams.get('type') as 'project' | 'programme';
    const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
    const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
    const isClientAdmin = isAtLeastClientAdmin(userRole) || userIsSuperAdmin;
    const isPM = isAtLeastPM(userRole) || userIsSuperAdmin;

    const [contextType, setContextType] = useState<'project' | 'programme'>(
        forcedType || (activeProjectId ? 'project' : activeProgrammeId ? 'programme' : (isClientAdmin ? 'programme' : 'project'))
    );
    const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || '');
    const [selectedProgrammeId, setSelectedProgrammeId] = useState<string>(activeProgrammeId || '');
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [showAnalysisExists, setShowAnalysisExists] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [activePhase, setActivePhase] = useState(0);
    const navigate = useNavigate();

    // Scroll spy for phase navigation
    useEffect(() => {
        const main = document.querySelector('main');
        if (!main) return;

        const handleScroll = () => {
            const sections = document.querySelectorAll('section[data-phase]');
            let current = 0;
            sections.forEach((section, idx) => {
                const rect = section.getBoundingClientRect();
                const mainRect = main.getBoundingClientRect();
                // Check position relative to main container top
                if (rect.top - mainRect.top <= 200) current = idx;
            });
            setActivePhase(current);
        };
        main.addEventListener('scroll', handleScroll);
        return () => main.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToPhase = (idx: number) => {
        // Increased delay (550ms) to ensure any layout shifts or animations are fully complete
        setTimeout(() => {
            const section = document.querySelector(`section[data-phase="${idx}"]`);
            const main = document.querySelector('main');
            if (section && main) {
                const mainRect = main.getBoundingClientRect();
                const sectionRect = section.getBoundingClientRect();
                // Calculate position relative to the main scroll container
                const relativeTop = sectionRect.top - mainRect.top + main.scrollTop - 100;
                
                main.scrollTo({ 
                    top: Math.max(0, relativeTop), 
                    behavior: 'smooth' 
                });
            }
        }, 550);
    };

    useEffect(() => {
        const urlType = searchParams.get('type') as 'project' | 'programme';
        if (urlType === 'programme' && activeProjectId) {
            // Only wipe if we are explicitly switching types via URL
            useStore.getState().setActiveProject(null);
            setContextType('programme');
        } else if (urlType === 'project' && activeProgrammeId) {
            // Only wipe if we are explicitly switching types via URL
            useStore.getState().setActiveProgramme(null);
            setContextType('project');
        } else if (urlType) {
            setContextType(urlType);
        }
    }, [searchParams, activeProjectId, activeProgrammeId]);

    // Check for existing analysis
    const project = (Array.isArray(projects) ? projects : []).find(p => p.id === activeProjectId);
    const programme = (Array.isArray(programmes) ? programmes : []).find(p => p.id === activeProgrammeId);
    const suggestedRisks = useStore(state => state.suggestedRisks);
    const risks = useStore(state => state.risks);

    useEffect(() => {
        // Only check for existing analysis if we have a valid entity ID selected
        if (contextType === 'project' && !activeProjectId) {
            setShowAnalysisExists(false);
            return;
        }
        if (contextType === 'programme' && !activeProgrammeId) {
            setShowAnalysisExists(false);
            return;
        }

        // "Risk Analysis Complete" means riskSetupDone was set — i.e. the user
        // submitted the questionnaire and was sent to the AI page.
        // Having risks in the register does NOT mean setup is done (they could be
        // manually added or from a previous run) so we do NOT use hasRisks here.
        const hasExisting = contextType === 'project'
            ? !!project?.riskSetupDone
            : !!programme?.riskSetupDone;

        if (hasExisting) {
            setShowAnalysisExists(true);
        } else {
            setShowAnalysisExists(false);
        }
    }, [project?.riskSetupDone, programme?.riskSetupDone, activeProjectId, activeProgrammeId, contextType]);

    // Sync selected project/programme back if store changes externally
    useEffect(() => {
        if (activeProjectId) setSelectedProjectId(activeProjectId);
    }, [activeProjectId]);

    useEffect(() => {
        if (activeProgrammeId) setSelectedProgrammeId(activeProgrammeId);
    }, [activeProgrammeId]);

    // Projects filtered by selected programme for client admin
    const projectsInProgramme = selectedProgrammeId
        ? (Array.isArray(projects) ? projects : []).filter(p => p.programmeId === selectedProgrammeId)
        : (Array.isArray(projects) ? projects : []);

    const currentQuestions = contextType === 'programme' ? PROGRAMME_AI_QUESTIONS : AI_QUESTIONS;

    const handleInput = (id: string, val: any) => {
        setAnswers(prev => ({ ...prev, [id]: val }));
    };

    const toggleCheck = (id: string, val: string) => {
        setAnswers(prev => {
            const arr = Array.isArray(prev[id]) ? prev[id] : [];
            if (arr.includes(val)) return { ...prev, [id]: arr.filter((v: string) => v !== val) };
            return { ...prev, [id]: [...arr, val] };
        });
    };

    const loadDemo = () => {
        if (contextType === 'programme') {
            setAnswers({
                pg1: "Dedicated Programme Board",
                pg2: "Yes — appointed and active",
                pg3: "Registered Provider / Housing Association",
                pg4: "Estate Regeneration",
                pg5: "6–15 projects",
                pc1: "Mostly resourced with minor gaps",
                pc2: ["fire_eng", "safety"],
                pc4: "Strategic delivery partners appointed",
                pl1: "Majority secured",
                pl4: "Planning application submitted",
                pct3: "Framework delivery model",
                pr1: "Residents remain during works",
                pr4: "Fully funded programme",
                pd1: ["grant_milestones", "masterplanning"],
                pd3: "Moderate schedule pressure",
                pi1: "Partial data available with known gaps"
            });
        } else {
            setAnswers({
                g1: "Yes — appointed and active",
                g2: "Fully defined with sign-off",
                g3: "Registered Provider / Housing Association",
                g4: "Building safety remediation",
                g5: "High complexity — specialist inputs required",
                g6: "Monthly",
                s1: "Existing occupied building(s)",
                s2: "Yes — Higher-Risk Building (HRB)",
                s3: "Moderate issues (remediation required)",
                s4: "High (Major removal required)",
                t1: "Stage 3 (Developed)",
                t2: "Yes — fully appointed",
                t3: "Partially established",
                b1: "Yes — formally appointed",
                b2: "Gateway 2 Submitted",
                b3: "High (Cladding/External wall systems)",
                p1: "JCT Design and Build",
                p2: "Fixed Price / Lump Sum",
                p3: "Strong / Low risk",
                r1: "Residents remain in-situ",
                r2: "High — vocal opposition / media interest",
                r3: "No — costs covered by grant/internal",
                f1: "Building Safety Fund (BSF)",
                f2: "Significant delivery pressure",
                f3: "10% (Standard)"
            });
        }
    };

    const runAnalysis = async () => {
        if (contextType === 'project') {
            if (!answers.g3 || !answers.g4) {
                setError("Please fill in: Client Organisation and Primary Driver (Phase 1) before analysing.");
                return;
            }
        } else {
            if (!answers.pg1 || !answers.pg3 || !answers.pg4) {
                setError("Please fill in: Governance Structure, Regulatory Accountability and Strategic Driver (Phase 1) before analysing.");
                return;
            }
        }

        setError('');
        setLoading(true);

        try {
            if (contextType === 'project') {
                const currentProject = (Array.isArray(projects) ? projects : []).find(p => p.id === activeProjectId);
                const info = {
                    name: currentProject?.name || "Target Project",
                    type: answers.g4 || 'General Project',
                    loc: currentProject?.loc || 'Not specified',
                    orgtype: answers.g3 || 'Not specified',
                    funding: answers.f1 || 'Not specified',
                    proc: answers.p1 || 'Not specified',
                    chars: [
                        ...(answers.s2 === "Yes — Higher-Risk Building (HRB)" ? ["high_rise"] : []),
                        ...(answers.r1 === "Residents remain in-situ" ? ["occupied"] : [])
                    ],
                    notes: (answers.notes || '') +
                        (answers.s1 ? `\nSite Status: ${answers.s1}` : '') +
                        (answers.f2 ? `\nSchedule Pressure: ${answers.f2}` : '') +
                        (answers.t1 ? `\nRIBA Stage: ${answers.t1}` : ''),
                    scope: `Project: ${currentProject?.name}. Driver: ${answers.g4}. Funding: ${answers.f1}. Procurement: ${answers.p1}. Residents: ${answers.r1}. Schedule: ${answers.f2}.`
                };
                setProjectInfo(info as any);
            } else {
                const prog = (Array.isArray(programmes) ? programmes : []).find(p => p.id === activeProgrammeId);
                const info = {
                    name: prog?.name || "Target Programme",
                    type: "Programme",
                    orgtype: answers.pg3 || 'Not specified',
                    notes: `Governance: ${answers.pg1}\nRegulatory Accountability: ${answers.pg3}\nStrategic Driver: ${answers.pg4}\nResource Capacity: ${answers.pc1}\nDelivery Strategy: ${answers.pct3}\nResident Position: ${answers.pr1}\nFunding Certainty: ${answers.pr4}\nDependencies: ${(answers.pd1 || []).join(', ')}\nSchedule Pressure: ${answers.pd3}\nData Readiness: ${answers.pi1}`,
                    scope: `Programme: ${prog?.name}. Governance: ${answers.pg1}. Driver: ${answers.pg4}. Resource: ${answers.pc1}. Status: ${answers.pl4}. Resident: ${answers.pr1}. Schedule: ${answers.pd3}. Readiness: ${answers.pi1}.`
                };
                setProjectInfo(info as any);
            }
            // Update project/programme setup status
            const { updateProject, updateProgramme } = useStore.getState();
            if (activeProjectId) {
                await updateProject(activeProjectId, { riskSetupDone: true, aiRiskDiscoveryDone: false });
            } else if (activeProgrammeId) {
                await updateProgramme(activeProgrammeId, { riskSetupDone: true, aiRiskDiscoveryDone: false });
            }
            navigate(`/risk/ai${fromParam}`);
        } catch (err: any) {
            setError(err.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRestart = () => {
        setShowRestartConfirm(true);
    };

    const handleRestartConfirmed = async () => {
        setShowRestartConfirm(false);
        const contextId = activeProjectId || activeProgrammeId;
        if (!contextId) return;

        setIsRestarting(true);
        setShowAnalysisExists(false);
        try {
            const clearOps: Promise<any>[] = [];

            // 1. Clear flags from DB
            if (activeProjectId) {
                clearOps.push(updateProject(activeProjectId, { riskSetupDone: false, aiRiskDiscoveryDone: false }));
            } else if (activeProgrammeId) {
                clearOps.push(updateProgramme(activeProgrammeId, { riskSetupDone: false, aiRiskDiscoveryDone: false }));
            }

            // 2. Clear questionnaire answer keys from projectInfo, keep core fields
            const currentInfo = { ...useStore.getState().projectInfo } as any;
            const answerKeyPrefixes = ['g', 'pg', 'f', 's', 'r', 'p1', 'p2', 'p3', 'p4', 'p5', 'pc', 'pl', 'pr', 'pd', 'pi', 'pct'];
            Object.keys(currentInfo).forEach((key) => {
                if (answerKeyPrefixes.some(prefix => key.startsWith(prefix)) || key === 'notes' || key === 'chars' || key === 'scope' || key === 'orgtype' || key === 'funding' || key === 'proc') {
                    delete currentInfo[key];
                }
            });
            clearOps.push(api.saveData('projectInfo', currentInfo, contextId));

            // 3. Clear the risk register for this context from DB
            clearOps.push(api.saveData('risks', [], contextId));

            await Promise.all(clearOps);

            // 4. Sync store state — wipe risks for this context + all AI suggestion state
            const currentRisks = useStore.getState().risks;
            useStore.setState({
                suggestedRisks: [],
                projectInfo: currentInfo,
                risks: currentRisks.filter((r: any) =>
                    activeProjectId
                        ? r.projectId !== activeProjectId
                        : r.programmeId !== activeProgrammeId
                ),
            });

            // 5. Reset local component state
            setAnswers({});
            setDone(false);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to reset risk analysis. Please try again.');
        } finally {
            setIsRestarting(false);
        }
    };

    const reset = () => {
        setAnswers({});
        setDone(false);
    };

    return (
        <div>
            {/* Restart Confirmation Dialog*/}
            {showRestartConfirm && createPortal(
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                                <AlertTriangle className="w-5 h-5" />
                            </span>
                            <h3 className="text-lg font-semibold text-slate-900">Restart risk analysis?</h3>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed mb-6">
                            This will permanently clear all risk profiling answers and AI setup data for this {contextType}. This action cannot be undone.
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                            <button
                                onClick={() => setShowRestartConfirm(false)}
                                className="inline-flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRestartConfirmed}
                                className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
                            >
                                Yes, restart
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* Restart Loading Overlay*/}
            {isRestarting && createPortal(
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50">
                    <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3 max-w-xs w-full mx-4">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <div className="text-center">
                            <p className="text-sm font-semibold text-slate-900">Clearing risk data</p>
                            <p className="text-xs text-slate-500 mt-1">Removing all previous risk analysis data…</p>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* Existing Analysis Overlay*/}
            {showAnalysisExists && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50">
                    <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 sm:p-8">
                        <div className="text-center">
                            <span className="inline-flex w-12 h-12 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 mx-auto mb-4">
                                <ShieldAlert className="w-6 h-6" />
                            </span>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">Risk analysis complete</h3>
                            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
                                A risk analysis has already been performed for this {contextType}. Would you like to view the results or start fresh?
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        if (suggestedRisks.length > 0) {
                                            navigate(`/risk/ai${fromParam}`);
                                        } else {
                                            navigate(contextType === 'project' ? `/risk/register${fromParam}` : `/risk/programme-register${fromParam}`);
                                        }
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                                >
                                    {suggestedRisks.length > 0 ? "Review AI suggestions" : "View risk register"} <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleRestart}
                                    className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                                >
                                    Restart analysis
                                </button>
                            </div>

                            <div className="mt-6 flex flex-col items-center gap-3">
                                {searchParams.get('from') === 'initiation' ? (
                                    <button
                                        onClick={async () => {
                                            const contextId = activeProjectId || activeProgrammeId;
                                            if (contextId) {
                                                if (contextType === 'project') await updateProject(contextId, { riskSetupDone: true });
                                                else await updateProgramme(contextId, { riskSetupDone: true });
                                            }
                                            navigate(contextType === 'programme' ? '/programmes/new' : '/initiate');
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Continue to initiation step 4
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate((contextType === 'project' ? '/risk/register' : '/risk/programme-register') + fromParam)}
                                        className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                                    >
                                        Go to risk register
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            <div className="space-y-6">
                {/* ── HEADER SECTION ───────────*/}
                <div className="pb-6 border-b border-slate-200">
                    <h1 className="text-2xl font-semibold text-slate-900">AI risk identification</h1>
                    <p className="mt-1 text-sm text-slate-500 max-w-2xl leading-relaxed">
                        {contextType === 'programme'
                            ? "Analyse your programme portfolio to surface strategic risks, governance gaps, and cross-project dependencies."
                            : "Analyse your project context to surface specific risks with pre-scored ratings, designated owners, and strategic controls."}
                    </p>
                </div>

                {/* ── MAIN CONTENT GRID ───────────*/}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT: FORM SECTION (Column Span 8)*/}
                    <div className="lg:col-span-8 order-1 lg:order-1 space-y-8">
                        {!done && (
                            <div className="space-y-10">
                                {currentQuestions.map((phase, idx) => (
                                    <section 
                                        key={idx} 
                                        data-phase={idx}
                                        role="region"
                                        aria-label={phase.phase}
                                        className={clsx(
                                            "bg-white rounded-lg border border-slate-200 overflow-hidden transition-colors group",
                                            activePhase === idx && "border-indigo-300"
                                        )}
                                    >
                                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={clsx(
                                                    "w-1 h-8 rounded-full transition-colors",
                                                    activePhase === idx ? "bg-indigo-600" : "bg-slate-200"
                                                )}></div>
                                                <div>
                                                    <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide mb-0.5">Step {String(idx + 1).padStart(2, '0')}</p>
                                                    <h2 className="text-lg font-semibold text-slate-900">{phase.phase.split(': ')[1]}</h2>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                            {phase.questions.map(q => {
                                                const val = answers[q.id] || '';
                                                const inputId = `risk-${q.id}`;
                                                
                                                if (q.type === 'checkboxes') {
                                                    const checked = Array.isArray(val) ? val : [];
                                                    return (
                                                        <div key={q.id} className="col-span-1 md:col-span-2 space-y-6">
                                                            <label id={`${inputId}-label`} className={labelCls} title={q.label}>{q.label}</label>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="group" aria-labelledby={`${inputId}-label`}>
                                                                {q.opts?.map((o: any) => {
                                                                    const isChecked = checked.includes(o.v);
                                                                    return (
                                                                        <button
                                                                            key={o.v}
                                                                            type="button"
                                                                            aria-pressed={isChecked}
                                                                            className={clsx(
                                                                                "group flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
                                                                                isChecked
                                                                                    ? 'bg-indigo-50 border-indigo-400'
                                                                                    : 'bg-white border-slate-300 hover:border-slate-400',
                                                                            )}
                                                                            onClick={() => toggleCheck(q.id, o.v)}
                                                                        >
                                                                            <span className={clsx(
                                                                                "shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors",
                                                                                isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300',
                                                                            )}>
                                                                                {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                                            </span>
                                                                            <span className={clsx(
                                                                                "text-sm leading-snug",
                                                                                isChecked ? 'text-slate-900 font-medium' : 'text-slate-700',
                                                                            )} title={o.l}>
                                                                                {o.l}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={q.id} className="flex flex-col">
                                                        <label htmlFor={inputId} className={questionLabelCls} title={q.label}>
                                                            {q.label} {q.required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
                                                        </label>
                                                        {q.type === 'select' ? (
                                                            <select
                                                                id={inputId}
                                                                aria-required={q.required}
                                                                className={inputCls}
                                                                value={val}
                                                                onChange={(e) => handleInput(q.id, e.target.value)}
                                                            >
                                                                <option value="">— Select option —</option>
                                                                {q.opts?.map((o: any) => <option key={typeof o === 'string' ? o : o.v} value={typeof o === 'string' ? o : o.v}>{typeof o === 'string' ? o : o.l}</option>)}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                id={inputId}
                                                                type={q.type}
                                                                aria-required={q.required}
                                                                placeholder={q.placeholder}
                                                                value={val}
                                                                onChange={(e) => handleInput(q.id, e.target.value)}
                                                                className={inputCls}
                                                            />
                                                        )}

                                                        {/* AI Risk Insights (Trigger logic)*/}
                                                        {q.trigger && val && val !== "None identified" && val !== "Low" && val !== "No" && !val.includes("Not yet") && !val.includes("N/A") && (
                                                            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-3 flex gap-3">
                                                                <span className="shrink-0 inline-flex w-7 h-7 rounded-md bg-white border border-slate-200 items-center justify-center text-indigo-600">
                                                                    <ScanSearch className="w-4 h-4" />
                                                                </span>
                                                                <div className="space-y-0.5 min-w-0">
                                                                    <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide">AI risk insight</p>
                                                                    <p className="text-xs text-slate-600 leading-relaxed">
                                                                        {q.trigger}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}

                                <div className="flex flex-col items-center justify-center pt-6 pb-10 gap-4">
                                    <button
                                        onClick={runAnalysis}
                                        disabled={loading}
                                        className="inline-flex items-center gap-1.5 px-4 h-10 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                                        {loading ? "Analysing context…" : "Run AI risk analysis"}
                                    </button>
                                    {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
                                </div>
                            </div>
                        )}

                        {/* Suggested Risks Result*/}
                        {done && (
                            <div className="space-y-6">
                                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                                    <span className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-4">
                                        <Check className="w-6 h-6" strokeWidth={3} />
                                    </span>
                                    <h2 className="text-2xl font-semibold text-slate-900 mb-2">Analysis complete</h2>
                                    <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed mb-6">
                                        The Cedar Engine has processed your {contextType === 'project' ? 'project' : 'programme'} profile and identifies <span className="text-emerald-700 font-semibold">12 critical risk factors</span> relevant to your specific operational context.
                                    </p>
                                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                                        <button
                                            onClick={() => navigate('/risk/register' + fromParam)}
                                            className="inline-flex items-center justify-center gap-1.5 px-4 h-10 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors"
                                        >
                                            Access full risk register <ArrowRight className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={reset}
                                            className="inline-flex items-center justify-center gap-1.5 px-4 h-10 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
                                        >
                                            Modify setup
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: TRACKER & NAVIGATION SECTION (Column Span 4)*/}
                    <div className="lg:col-span-4 order-2 lg:order-2 space-y-6 lg:sticky lg:top-6">
                        {/* Publication Checklist (Consistency)*/}
                        <PublicationChecklist onPublish={async () => {
                            if (!activeProjectId) return;
                            setLoading(true);
                            try {
                                const proj = (projects || []).find((p: any) => p.id === activeProjectId);
                                const hasProgramme = !!(proj as any)?.programmeId;
                                await updateProject(activeProjectId, { isPublished: true, setupProgress: hasProgramme ? 100 : 90 });
                                navigate('/dashboard');
                            } catch (err: any) {
                                setError(err.message || 'Failed to publish');
                            } finally {
                                setLoading(false);
                            }
                        }} loading={loading} />

                        {/* Sticky Phase Navigation (Specific to Risk Setup)*/}
                        {!done && (
                            <aside className="hidden xl:block space-y-4">
                                <div className="p-4 bg-white rounded-lg border border-slate-200">
                                    <h3 className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide mb-3 px-1">Setup progress</h3>
                                    <nav className="space-y-0.5">
                                        {currentQuestions.map((p, i) => {
                                            const isComplete = p.questions.every(q => answers[q.id] && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true));
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => scrollToPhase(i)}
                                                    className={clsx(
                                                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                                                        activePhase === i
                                                            ? "bg-indigo-50 text-indigo-900"
                                                            : "text-slate-600 hover:bg-slate-50",
                                                    )}
                                                >
                                                    <span className={clsx(
                                                        "shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-semibold transition-colors",
                                                        isComplete && activePhase !== i && "bg-emerald-100 text-emerald-700",
                                                        activePhase === i && "bg-indigo-600 text-white",
                                                        !isComplete && activePhase !== i && "bg-slate-100 text-slate-500",
                                                    )}>
                                                        {isComplete ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
                                                    </span>
                                                    <span className="text-sm truncate" title={p.phase.split(': ')[1]}>
                                                        {p.phase.split(': ')[1]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </nav>
                                </div>

                                <div className="p-4 bg-white rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide">AI readiness</span>
                                        <span className="text-xs font-medium text-slate-700 tabular-nums">
                                            {Math.round((Object.keys(answers).length / Math.max(1, currentQuestions.reduce((acc, p) => acc + p.questions.length, 0))) * 100)}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-600 transition-all duration-300"
                                            style={{ width: `${(Object.keys(answers).length / Math.max(1, currentQuestions.reduce((acc, p) => acc + p.questions.length, 0))) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </aside>
                        )}

                        {/* Selector Controls (Moved from header for cleaner mobile flow)*/}
                        <div className="p-4 bg-white rounded-lg border border-slate-200">
                            <h3 className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide mb-3 px-1">Project context</h3>
                            <div className="space-y-3">
                                {!isClientAdmin && (
                                    <select
                                        className={inputCls}
                                        value={selectedProjectId}
                                        onChange={async (e) => {
                                            const pid = e.target.value;
                                            setSelectedProjectId(pid);
                                            setAnswers({});
                                            setDone(false);
                                            setError('');
                                            useStore.setState({ suggestedRisks: [], projectInfo: {} });
                                            if (pid) await useStore.getState().loadProjectData(pid);
                                        }}
                                    >
                                        <option value="">Select project</option>
                                        {(Array.isArray(projects) ? projects : []).map(p => <option key={p.id} value={p.id}>{stripMarkdown(p.name) || p.id}</option>)}
                                    </select>
                                )}

                                {isClientAdmin && (
                                    <>
                                        <select
                                            className={inputCls}
                                            value={selectedProgrammeId}
                                            onChange={async (e) => {
                                                const pid = e.target.value;
                                                setSelectedProgrammeId(pid);
                                                setSelectedProjectId('');
                                                setAnswers({});
                                                setDone(false);
                                                setError('');
                                                useStore.setState({ suggestedRisks: [], projectInfo: {} });
                                                if (pid) await useStore.getState().loadProgrammeData(pid);
                                                else useStore.getState().setActiveProgramme(null);
                                            }}
                                        >
                                            <option value="">Select programme</option>
                                            {(Array.isArray(programmes) ? programmes : []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        {contextType === 'project' && projectsInProgramme.length > 0 && (
                                            <select
                                                className={inputCls}
                                                value={selectedProjectId}
                                                onChange={async (e) => {
                                                    const pid = e.target.value;
                                                    setSelectedProjectId(pid);
                                                    setAnswers({});
                                                    setDone(false);
                                                    setError('');
                                                    useStore.setState({ suggestedRisks: [], projectInfo: {} });
                                                    if (pid) await useStore.getState().loadProjectData(pid);
                                                }}
                                            >
                                                <option value="">Select project</option>
                                                {projectsInProgramme.map(p => <option key={p.id} value={p.id}>{stripMarkdown(p.name) || p.id}</option>)}
                                            </select>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, BarChart, Activity, ShieldPlus, Bell, ClipboardCheck, ShieldCheck, Library, Database, UploadCloud, PieChart, FileText, Building2, Users, LayoutDashboard, ArrowRight, ScanSearch, Shield, CheckCircle2, LayoutGrid, Target, Globe, Lock, History, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MarketingImage from '../../components/public/MarketingImage';
import { WordPullUp } from '../../components/public/WordPullUp';

/* ═══════════════════════════════════════════════════
   PRODUCT DATA
   ═══════════════════════════════════════════════════ */
const productTabs = [
    {
        id: 'risk',
        label: 'Risk Management',
        features: [
            {
                icon: ClipboardList,
                title: 'Dynamic Risk Register',
                desc: 'Full enterprise RAID register with gross/residual ALE calculations, workstream tagging, and automated owner assignment.',
            },
            {
                icon: BarChart,
                title: 'Visual Risk Intel',
                desc: 'Real-time residual risk heatmaps, financial exposure charts, and category distribution dashboards.',
            },
            {
                icon: Activity,
                title: 'AI Risk Discovery',
                desc: 'Instantly generate contextual risks from project profiles against standard taxonomies to save hours of manual setup.',
            },
            {
                icon: ShieldPlus,
                title: 'AI Control Engine',
                desc: 'Evaluates high-rated risks and formulates industry-standard mitigation controls for direct application in one click.',
            },
            {
                icon: Bell,
                title: 'Risk Alert Board',
                desc: 'Live feed for critical risks, statutory deadlines, overdue items, and escalated issues with trackable actions.',
            },
        ],
    },
    {
        id: 'compliance',
        label: 'Compliance Tools',
        features: [
            {
                icon: ClipboardCheck,
                title: 'Compliance Dashboard',
                desc: 'Domain-by-domain progress for Fire Safety, Building Safety, Damp & Mould, Energy, Asbestos, and more.',
            },
            {
                icon: ShieldCheck,
                title: 'Compliance Tracker',
                desc: 'Task-level tracking per regulation. Manage completion stages, assign owners, and maintain a full audit trail.',
            },
            {
                icon: Library,
                title: 'Regulation Library',
                desc: 'Master repository of 240+ UK legislative obligations including BSA 2022 and Awaab\'s Law — fully searchable.',
            },
            {
                icon: Database,
                title: 'AI Narrative Summary',
                desc: 'Intelligent, narrative health summaries that surface gaps and recommended actions for management review.',
            },
            {
                icon: UploadCloud,
                title: 'Evidence Vault',
                desc: 'Securely upload and link compliance certificates and inspection reports directly to statutory requirements.',
            },
        ],
    },
    {
        id: 'reporting',
        label: 'Governance & Reporting',
        features: [
            {
                icon: PieChart,
                title: 'Executive PDF Reports',
                desc: 'Unified programme-wide view of compliance % and open risks, exportable as professional board-ready PDFs.',
            },
            {
                icon: FileText,
                title: 'Project Deep-Dives',
                desc: 'Comprehensive per-project reports consolidating risk exposure and progress into shareable governance documents.',
            },
            {
                icon: Building2,
                title: 'Portfolio Governance',
                desc: 'Hierarchical programme structure enabling client admins to manage multiple sites under unified frameworks.',
            },
            {
                icon: Users,
                title: 'Role-Based Access',
                desc: 'Granular controls for Admin, Sub-Admin, and PM roles — ensuring data integrity across multi-team environments.',
            },
            {
                icon: LayoutDashboard,
                title: 'Unified KPI View',
                desc: 'Live, cross-project visibility into escalated issues, compliance trends, and programme-level performance.',
            },
        ],
    },
    {
        id: 'technical',
        label: 'Technical Companion',
        features: [
            {
                icon: ScanSearch,
                title: 'Technical Enquiries',
                desc: 'Raise, route and resolve technical enquiries per scheme, each with a complete, exportable decision log.',
            },
            {
                icon: ClipboardList,
                title: 'RFI Register',
                desc: 'A workspace-wide register of Requests for Information, tracked from issue through to formal response.',
            },
            {
                icon: History,
                title: 'Decision Log & Audit',
                desc: 'An immutable record of every technical decision, with Compliance-Lead audit and feedback review.',
            },
            {
                icon: UploadCloud,
                title: 'Golden-Thread Evidence',
                desc: 'Attach drawings, certificates and reports to each enquiry — preserving the golden thread of information.',
            },
            {
                icon: Users,
                title: 'Scoped Access',
                desc: 'Owner-scoped visibility: users see their own and shared enquiries, while compliance leads see everything.',
            },
        ],
    },
    {
        id: 'resource',
        label: 'Resource & Capacity Planner',
        features: [
            {
                icon: BarChart,
                title: 'FTE Demand Forecast',
                desc: 'Quarter-by-quarter resourcing demand derived from scheme dates, complexity and a configurable rate card.',
            },
            {
                icon: Scale,
                title: 'Capacity Planning',
                desc: 'Compare available supply per role against forecast demand to flag shortfalls and surplus before they bite.',
            },
            {
                icon: Building2,
                title: 'Scheme Register',
                desc: 'Maintain every scheme with key dates, complexity and home counts — or bulk-import the whole programme from Excel.',
            },
            {
                icon: LayoutGrid,
                title: 'Stage Timeline',
                desc: 'A visual Gantt of each scheme across its Site, Design, Construction and Defects stages over the full horizon.',
            },
            {
                icon: Target,
                title: 'Editable Assumptions',
                desc: 'Tune the FTE rate card, overhead and annual-leave uplifts, and complexity mapping — all in one place.',
            },
        ],
    },
];

const aiFeatures = [
    { title: 'Risk discovery', icon: Activity },
    { title: 'Control Suggestions', icon: ShieldPlus },
    { title: 'Compliance Summary', icon: Database },
    { title: 'AI Risk Dashboard', icon: BarChart },
];

const stats = [
    { label: 'Integrated Capabilities', value: '15+', icon: ScanSearch },
    { label: 'Regulatory Modules', value: '3 Major', icon: Shield },
    { label: 'Statutory Obligations', value: '240+', icon: Library },
];

const securityItems = [
    { title: 'ISO Alignment', desc: 'Frameworks built for ISO 31000 & 27001.', icon: Lock },
    { title: 'UK Hosted', desc: 'All data resides in secure UK-based datacenters.', icon: Globe },
    { title: 'Full Audit Trail', desc: 'Immutable logs of every change and approval.', icon: History },
    { title: 'Role Security', desc: 'Enterprise IAM with granular project permissions.', icon: Users },
];

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const HEADLINE_WORDS: Array<{ word: string; gradient?: boolean; breakAfter?: boolean }> = [
    { word: 'One' },
    { word: 'Intelligence' },
    { word: 'Layer.', breakAfter: true },
    { word: 'Total', gradient: true },
    { word: 'Operational', gradient: true },
    { word: 'Control.', gradient: true },
];

const DESCRIPTION_DELAY_S = 0.35 + HEADLINE_WORDS.length * 0.12 + 0.4;
const CTA_DELAY_S = DESCRIPTION_DELAY_S + 0.25;

const CARD_CLASS =
    'group relative flex flex-col overflow-hidden rounded-xl border border-[oklch(0.91_0.006_270)] bg-white p-7 transition-[transform,border-color,box-shadow,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:scale-[1.01] hover:border-[oklch(0.62_0.24_278_/_0.45)] hover:shadow-[0_0_0_1px_oklch(0.62_0.24_278_/_0.20),0_20px_40px_-16px_oklch(0.62_0.24_278_/_0.30),0_0_60px_-10px_oklch(0.62_0.24_278_/_0.22)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(60%_80%_at_50%_0%,oklch(0.62_0.24_278_/_0.14),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-[320ms] before:content-[""] hover:before:opacity-100 dark:border-white/10 dark:bg-white/3';

const ICON_CHIP_CLASS =
    'relative z-[1] grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[oklch(0.62_0.24_278_/_0.22)] bg-[oklch(0.62_0.24_278_/_0.10)] text-[var(--accent)] transition-[transform,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.06] group-hover:-rotate-3 group-hover:bg-[oklch(0.62_0.24_278_/_0.18)] dark:text-indigo-300';

const SECTION_HEADING_CLASS =
    'text-[clamp(26px,3.6vw,40px)] font-medium leading-[1.08] tracking-[-0.035em] text-[oklch(0.20_0.012_270)] dark:text-white';

const GRADIENT_TEXT_CLASS =
    'not-italic bg-[linear-gradient(135deg,oklch(0.62_0.24_278),oklch(0.50_0.28_254))] bg-clip-text text-transparent';

export const Product: React.FC = () => {
    const [activeTab, setActiveTab] = useState('risk');
    const tab = productTabs.find(t => t.id === activeTab)!;

    return (
        <div
            className="relative overflow-hidden bg-white font-sans dark:bg-[#030303]"
            style={
                {
                    '--accent': 'oklch(0.62 0.24 278)',
                    '--accent-hot': 'oklch(0.70 0.26 280)',
                } as React.CSSProperties
            }
        >
            {/* Hero backdrop — masked accent grid (exact tokens) + radial glow */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-130"
                style={{
                    backgroundImage:
                        'linear-gradient(oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px)',
                    backgroundSize: '38px 38px',
                    WebkitMaskImage:
                        'radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)',
                    maskImage:
                        'radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)',
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[-80px] h-[540px] w-[1200px] max-w-none -translate-x-1/2"
                style={{
                    background:
                        'radial-gradient(60% 60% at 50% 30%, oklch(0.62 0.24 278 / 0.18), transparent 65%), radial-gradient(45% 40% at 30% 25%, oklch(0.68 0.24 248 / 0.12), transparent 70%)',
                    filter: 'blur(2px)',
                }}
            />

            <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-28 sm:pt-24">
                {/* ── HERO SECTION ── */}
                <div className="mx-auto max-w-4xl text-center">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: EASE }}
                        className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.91_0.006_270)] bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[oklch(0.32_0.012_270)] shadow-[0_2px_8px_-4px_oklch(0_0_0_/_0.06)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                        </span>
                        Platform Capabilities
                    </motion.span>

                    <WordPullUp
                        words={HEADLINE_WORDS}
                        className="mt-[22px] text-[clamp(30px,5.4vw,60px)] font-medium leading-[1.02] tracking-[-0.035em] text-[oklch(0.20_0.012_270)] dark:text-white"
                    />

                    <motion.p
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: DESCRIPTION_DELAY_S, ease: EASE }}
                        className="mx-auto mt-4 max-w-[640px] text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400"
                    >
                        "A definitive, enterprise-grade suite designed to eliminate fragmented spreadsheets and manual tracking in UK social housing."
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: CTA_DELAY_S, ease: EASE }}
                        className="mt-9 flex justify-center"
                    >
                        <Link
                            to="/login"
                            className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[oklch(0.54_0.24_278)] bg-[var(--accent)] px-7 text-[13.5px] font-semibold text-white shadow-[0_8px_22px_-8px_oklch(0.62_0.24_278_/_0.22)] transition-[background] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--accent-hot)]"
                        >
                            Enter Platform
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </motion.div>
                </div>

                {/* ── STATS BAR ── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: EASE }}
                    className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3"
                >
                    {stats.map((stat) => (
                        <div key={stat.label} className={CARD_CLASS + ' items-center text-center'}>
                            <span className={ICON_CHIP_CLASS}>
                                <stat.icon className="h-5 w-5" />
                            </span>
                            <div className="relative z-[1] mt-4 text-3xl font-semibold tracking-[-0.02em] text-[oklch(0.20_0.012_270)] tabular-nums dark:text-white">
                                {stat.value}
                            </div>
                            <div className="relative z-[1] mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* ── TABBED FEATURES GRID ── */}
                <div className="mt-28">
                    <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: EASE }}
                        className="mx-auto max-w-3xl text-center"
                    >
                        <h2 className={SECTION_HEADING_CLASS}>
                            Explore the <em className={GRADIENT_TEXT_CLASS}>Suite</em>
                        </h2>
                        <p className="mx-auto mt-4 max-w-[640px] text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                            Switch between modules to see how our unified architecture handles every dimension of your risk and compliance landscape.
                        </p>
                    </motion.div>

                    {/* Tab Navigation */}
                    <div className="mt-10 mb-12 flex justify-center">
                        <div className="flex max-w-full flex-wrap justify-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {productTabs.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 font-mono text-[11.5px] uppercase tracking-[0.04em] transition-all duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${activeTab === t.id
                                        ? 'border-[oklch(0.20_0.012_270)] bg-[oklch(0.20_0.012_270)] text-white dark:border-white dark:bg-white dark:text-slate-900'
                                        : 'border-[oklch(0.91_0.006_270)] bg-white text-[oklch(0.50_0.010_270)] hover:border-[oklch(0.85_0.008_270)] hover:text-[oklch(0.20_0.012_270)] dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Features Grid */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.35, ease: EASE }}
                            className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
                        >
                            {tab.features.map((f) => (
                                <div key={f.title} className={CARD_CLASS + ' gap-3'}>
                                    <span className={ICON_CHIP_CLASS}>
                                        <f.icon className="h-5 w-5" />
                                    </span>
                                    <h3 className="relative z-[1] mt-1 text-[19px] font-semibold tracking-[-0.02em] text-[oklch(0.20_0.012_270)] dark:text-white">
                                        {f.title}
                                    </h3>
                                    <p className="relative z-[1] text-[13.5px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                                        {f.desc}
                                    </p>
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── DEEP DIVE MODULES ── */}
                <div className="mt-28 space-y-24">
                    {/* Module 1: Risk */}
                    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                        <motion.div
                            initial={{ opacity: 0, x: -32 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: EASE }}
                            className="space-y-7"
                        >
                            <span className={'group ' + ICON_CHIP_CLASS}>
                                <Target className="h-5 w-5" />
                            </span>
                            <h2 className={SECTION_HEADING_CLASS}>
                                Risk <em className={GRADIENT_TEXT_CLASS}>Intelligence.</em>
                            </h2>
                            <p className="border-l-2 border-[oklch(0.62_0.24_278_/_0.35)] pl-6 text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                                "Move from passive tracking to proactive management with real-time exposure analytics and AI-driven discovery."
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Enterprise RAID register with full ALE data',
                                    'Automated KRI (Key Risk Indicator) alerts',
                                    'Cross-programme risk aggregation',
                                    'Contextual AI risk identification engine'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[oklch(0.62_0.24_278_/_0.10)]">
                                            <CheckCircle2 className="h-4 w-4 text-[var(--accent)] dark:text-indigo-300" />
                                        </span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: 32 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: EASE }}
                            className="relative aspect-square overflow-hidden rounded-xl border border-[oklch(0.91_0.006_270)] dark:border-white/10"
                        >
                            <MarketingImage base="marketing/risk-register-tablets" alt="CedarGuard risk register and risk dashboard on two tablets" width={1600} height={1280} sizes="(min-width: 1024px) 560px, 90vw" className="absolute inset-0 h-full w-full object-cover object-center" />
                        </motion.div>
                    </div>

                    {/* Module 2: Compliance */}
                    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                        <motion.div
                            initial={{ opacity: 0, x: -32 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: EASE }}
                            className="relative order-2 aspect-square overflow-hidden rounded-xl border border-[oklch(0.91_0.006_270)] lg:order-1 dark:border-white/10"
                        >
                            <MarketingImage base="marketing/compliance-tablet-person" alt="Person holding a tablet showing the CedarGuard compliance tracker" width={1600} height={1600} sizes="(min-width: 1024px) 560px, 90vw" className="absolute inset-0 h-full w-full object-cover object-center" />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: 32 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: EASE }}
                            className="order-1 space-y-7 lg:order-2"
                        >
                            <span className={'group ' + ICON_CHIP_CLASS}>
                                <ShieldCheck className="h-5 w-5" />
                            </span>
                            <h2 className={SECTION_HEADING_CLASS}>
                                Statutory <em className={GRADIENT_TEXT_CLASS}>Confidence.</em>
                            </h2>
                            <p className="border-l-2 border-[oklch(0.62_0.24_278_/_0.35)] pl-6 text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                                "Navigate the post-Grenfell regulatory landscape with absolute confidence and a definitive audit trail."
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Fire & Building Safety Act compliance',
                                    'Awaab\'s Law response tracking',
                                    'Master regulation library (240+ acts)',
                                    'AI-flagged compliance health summaries'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[oklch(0.62_0.24_278_/_0.10)]">
                                            <CheckCircle2 className="h-4 w-4 text-[var(--accent)] dark:text-indigo-300" />
                                        </span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>
                </div>

                {/* ── AI CAPABILITIES CALLOUT ── */}
                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: EASE }}
                    className="relative mt-28 overflow-hidden rounded-2xl px-8 py-14 text-center sm:px-14 sm:py-16"
                    style={{
                        background:
                            'radial-gradient(70% 90% at 50% 100%, oklch(0.62 0.24 278 / 0.22), transparent 60%), linear-gradient(180deg, oklch(0.18 0.018 270), oklch(0.13 0.012 270))',
                    }}
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            backgroundImage:
                                'linear-gradient(oklch(1 0 0 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.04) 1px, transparent 1px)',
                            backgroundSize: '36px 36px',
                            WebkitMaskImage: 'radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 80%)',
                            maskImage: 'radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 80%)',
                        }}
                    />

                    <div className="relative z-10 flex flex-col items-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                            className="mb-8 grid h-16 w-16 place-items-center rounded-xl border border-[oklch(0.70_0.26_280)] bg-[var(--accent)] shadow-[0_0_50px_oklch(0.62_0.24_278_/_0.35)]"
                        >
                            <Database className="h-8 w-8 text-white" />
                        </motion.div>

                        <h2 className="text-[clamp(26px,3.6vw,40px)] font-medium leading-[1.08] tracking-[-0.035em] text-white">
                            AI-Native <em className={GRADIENT_TEXT_CLASS}>Framework</em>
                        </h2>
                        <p className="mx-auto mt-4 max-w-[640px] text-[15px] leading-[1.6] text-white/60">
                            "We didn't just add AI; we built the platform around it. Our intelligence layer automates the high-value manual work that typically costs organisations thousands in consultant fees."
                        </p>

                        <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                            {aiFeatures.map((f, i) => (
                                <div
                                    key={i}
                                    className="group rounded-xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-md transition-[background,border-color,transform] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:border-[oklch(0.62_0.24_278_/_0.45)] hover:bg-white/10 sm:p-7"
                                >
                                    <f.icon className="mx-auto mb-4 h-7 w-7 text-indigo-300 opacity-80 transition-all duration-[320ms] group-hover:scale-110 group-hover:opacity-100" />
                                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] leading-relaxed text-white/50 transition-colors group-hover:text-indigo-300">
                                        {f.title}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* ── SECURITY & INFRA ── */}
                <div className="mt-24 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                    {securityItems.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                            className={CARD_CLASS + ' gap-3'}
                        >
                            <span className={ICON_CHIP_CLASS}>
                                <item.icon className="h-5 w-5" />
                            </span>
                            <h4 className="relative z-[1] mt-1 text-[17px] font-semibold tracking-[-0.015em] text-[oklch(0.20_0.012_270)] dark:text-white">
                                {item.title}
                            </h4>
                            <p className="relative z-[1] text-[13.5px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                                {item.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* ── FINAL CTA ── */}
                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: EASE }}
                    className="relative mt-28 overflow-hidden rounded-2xl px-8 py-16 text-center sm:px-14 sm:py-20"
                    style={{
                        background:
                            'radial-gradient(70% 90% at 50% 100%, oklch(0.62 0.24 278 / 0.22), transparent 60%), linear-gradient(180deg, oklch(0.18 0.018 270), oklch(0.13 0.012 270))',
                    }}
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            backgroundImage:
                                'linear-gradient(oklch(1 0 0 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.04) 1px, transparent 1px)',
                            backgroundSize: '36px 36px',
                            WebkitMaskImage: 'radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 80%)',
                            maskImage: 'radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 80%)',
                        }}
                    />

                    <div className="relative z-10">
                        <h2 className="mx-auto max-w-2xl text-[clamp(28px,4.2vw,48px)] font-medium leading-[1.08] tracking-[-0.035em] text-white">
                            Ready to Modernise
                            <br />
                            <em className={GRADIENT_TEXT_CLASS}>Your Programme?</em>
                        </h2>
                        <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-[1.6] text-white/60">
                            Join the next generation of social housing managers using intelligence to protect residents and budgets.
                        </p>
                        <div className="mt-9 flex justify-center">
                            <Link
                                to="/login"
                                className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[oklch(0.54_0.24_278)] bg-[var(--accent)] px-7 text-[13.5px] font-semibold text-white shadow-[0_8px_22px_-8px_oklch(0.62_0.24_278_/_0.40)] transition-[background] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--accent-hot)]"
                            >
                                Launch Portal
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

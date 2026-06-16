import React, { useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, BarChart, Activity, ShieldPlus, Bell, ClipboardCheck, ShieldCheck, Library, Database, UploadCloud, PieChart, FileText, Building2, Users, LayoutDashboard, ArrowRight, ScanSearch, Shield, CheckCircle2, LayoutGrid, Target, Globe, Lock, History, Scale, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ═══════════════════════════════════════════════════
   PRODUCT DATA
   ═══════════════════════════════════════════════════ */
const productTabs = [
    {
        id: 'risk',
        label: 'Risk Management',
        accent: 'cyan',
        theme: 'from-cyan-500/10 to-transparent',
        border: 'border-cyan-500/20',
        iconColor: 'text-cyan-400',
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
        accent: 'teal',
        theme: 'from-teal-500/10 to-transparent',
        border: 'border-teal-500/20',
        iconColor: 'text-teal-400',
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
        accent: 'indigo',
        theme: 'from-indigo-500/10 to-transparent',
        border: 'border-indigo-500/20',
        iconColor: 'text-indigo-400',
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
        accent: 'violet',
        theme: 'from-violet-500/10 to-transparent',
        border: 'border-violet-500/20',
        iconColor: 'text-violet-400',
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
        accent: 'emerald',
        theme: 'from-emerald-500/10 to-transparent',
        border: 'border-emerald-500/20',
        iconColor: 'text-emerald-400',
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

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true }
};

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.1
        }
    }
};

export const Product: React.FC = () => {
    const [activeTab, setActiveTab] = useState('risk');
    const tab = productTabs.find(t => t.id === activeTab)!;

    return (
        <div className="bg-slate-50 dark:bg-[#030303] text-slate-600 dark:text-slate-300 font-sans antialiased selection:bg-cyan-500/30 selection:text-white min-h-screen transition-colors duration-500">
            {/* ── HERO SECTION ── */}
            <section className="relative pt-12 md:pt-16 pb-32 px-6 overflow-hidden flex flex-col items-center justify-center text-center">
                {/* Background decorative elements */}
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 dark:bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none opacity-50" />

                <div className="relative z-10 max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-3 px-4 py-2 rounded-lg border border-indigo-500/20 dark:border-cyan-500/20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md text-indigo-600 dark:text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] mb-10 shadow-xl shadow-indigo-500/5"
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Platform Capabilities
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-6xl md:text-8xl font-black text-slate-900 dark:text-white leading-[1.05] tracking-tight mb-10 font-display"
                    >
                        One Intelligence Layer. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-cyan-500 to-teal-400">Total Operational Control.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-2xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto font-light leading-relaxed mb-16 italic"
                    >
                        "A definitive, enterprise-grade suite designed to eliminate fragmented spreadsheets and manual tracking in UK social housing."
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6"
                    >
                        <Link to="/login" className="group w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-5 text-lg font-black bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg hover:bg-indigo-600 dark:hover:bg-cyan-400 transition-all duration-300 shadow-2xl shadow-indigo-500/20 dark:shadow-cyan-500/20">
                            Enter Platform <ArrowRight className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <div className="max-w-6xl mx-auto px-6 mb-32 relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 p-10 rounded-lg bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 shadow-2xl dark:shadow-none backdrop-blur-xl transition-all duration-500 hover:border-indigo-500/20 dark:hover:border-cyan-500/20"
                >
                    {[
                        { label: 'Integrated Capabilities', value: '15+', icon: ScanSearch, color: 'text-indigo-500' },
                        { label: 'Regulatory Modules', value: '3 Major', icon: Shield, color: 'text-cyan-500' },
                        { label: 'Statutory Obligations', value: '240+', icon: Library, color: 'text-teal-500' },
                    ].map((stat, i) => (
                        <div key={i} className="flex flex-col items-center justify-center text-center p-6 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-500 group">
                            <div className={`w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
                                <stat.icon className={`w-7 h-7 ${stat.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                            </div>
                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2 font-display">{stat.value}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em]">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* ── TABBED FEATURES GRID ── */}
            <section className="py-32 px-6 bg-slate-50 dark:bg-slate-900/20 border-y border-slate-200 dark:border-white/5 relative transition-colors duration-500 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-30" />
                
                <div className="max-w-6xl mx-auto relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-20"
                    >
                        <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-8 font-display">Explore the Suite</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xl max-w-3xl mx-auto font-light leading-relaxed">
                            Switch between modules to see how our unified architecture handles every dimension of your risk and compliance landscape.
                        </p>
                    </motion.div>

                    {/* Tab Navigation */}
                    <div className="flex justify-center mb-20">
                        <div className="inline-flex max-w-full gap-1.5 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl backdrop-blur-xl shadow-xl dark:shadow-none">
                            {productTabs.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`shrink-0 whitespace-nowrap rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-300 ${activeTab === t.id
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md shadow-indigo-500/10'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
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
                            initial="initial"
                            animate="animate"
                            variants={staggerContainer}
                            exit={{ opacity: 0, x: -20 }}
                            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                        >
                            {tab.features.map((f, i) => (
                                <motion.div
                                    key={f.title}
                                    variants={fadeInUp}
                                    className={`group relative bg-white dark:bg-slate-900/40 border border-slate-200 dark:${tab.border} rounded-lg p-10 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-cyan-500/10`}
                                >
                                    <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${tab.theme} opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

                                    <div className="relative z-10">
                                        <div className={`w-16 h-16 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner`}>
                                            <f.icon className={`w-8 h-8 ${tab.iconColor}`} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 font-display">{f.title}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed font-light">{f.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </section>

            {/* ── DEEP DIVE MODULES ── */}
            <section className="py-48 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="space-y-48">
                        {/* Module 1: Risk */}
                        <div className="grid lg:grid-cols-2 gap-24 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="space-y-10"
                            >
                                <div className="p-4 w-fit rounded-lg bg-indigo-500/10 dark:bg-cyan-500/10 border border-indigo-500/20 dark:border-cyan-500/20 shadow-xl shadow-indigo-500/5">
                                    <Target className="w-10 h-10 text-indigo-600 dark:text-cyan-400" />
                                </div>
                                <h2 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white font-display tracking-tight leading-tight">Risk Intelligence.</h2>
                                <p className="text-2xl text-slate-500 dark:text-slate-400 leading-relaxed font-light italic border-l-4 border-indigo-500/20 dark:border-cyan-500/20 pl-8">
                                    "Move from passive tracking to proactive management with real-time exposure analytics and AI-driven discovery."
                                </p>
                                <ul className="space-y-6">
                                    {[
                                        'Enterprise RAID register with full ALE data',
                                        'Automated KRI (Key Risk Indicator) alerts',
                                        'Cross-programme risk aggregation',
                                        'Contextual AI risk identification engine'
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-4 text-slate-700 dark:text-slate-300 font-bold text-lg">
                                            <div className="w-6 h-6 rounded-full bg-indigo-500/10 dark:bg-cyan-500/10 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="relative group"
                            >
                                <div className="absolute -inset-10 bg-indigo-500/20 dark:bg-cyan-500/20 blur-[100px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                                <div className="relative rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 p-12 shadow-2xl aspect-square flex flex-col items-center justify-center overflow-hidden transition-all duration-700 backdrop-blur-xl group-hover:scale-[1.02]">
                                    <div className="relative">
                                        <div className="absolute -inset-8 bg-indigo-500/10 blur-3xl rounded-full" />
                                        <BarChart className="w-32 h-32 text-indigo-600/30 dark:text-cyan-400/30 mb-8 mx-auto relative z-10" />
                                    </div>
                                    <div className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Risk Matrix Visualization</div>
                                    <div className="mt-8 flex gap-3">
                                        {[1,2,3].map(i => <div key={i} className="w-12 h-2 rounded-full bg-slate-200 dark:bg-white/5" />)}
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Module 2: Compliance */}
                        <div className="grid lg:grid-cols-2 gap-24 items-center">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="relative group order-2 lg:order-1"
                            >
                                <div className="absolute -inset-10 bg-teal-500/20 blur-[100px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                                <div className="relative rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 p-12 shadow-2xl aspect-square flex flex-col items-center justify-center overflow-hidden transition-all duration-700 backdrop-blur-xl group-hover:scale-[1.02]">
                                    <div className="relative">
                                        <div className="absolute -inset-8 bg-teal-500/10 blur-3xl rounded-full" />
                                        <ShieldCheck className="w-32 h-32 text-teal-600/30 dark:text-teal-400/30 mb-8 mx-auto relative z-10" />
                                    </div>
                                    <div className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Golden Thread Audit Trail</div>
                                    <div className="mt-8 flex gap-3">
                                        {[1,2,3].map(i => <div key={i} className="w-12 h-2 rounded-full bg-slate-200 dark:bg-white/5" />)}
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: 50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="order-1 lg:order-2 space-y-10"
                            >
                                <div className="p-4 w-fit rounded-lg bg-teal-500/10 border border-teal-500/20 shadow-xl shadow-teal-500/5">
                                    <ShieldCheck className="w-10 h-10 text-teal-500" />
                                </div>
                                <h2 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white font-display tracking-tight leading-tight">Statutory Confidence.</h2>
                                <p className="text-2xl text-slate-500 dark:text-slate-400 leading-relaxed font-light italic border-l-4 border-teal-500/20 pl-8">
                                    "Navigate the post-Grenfell regulatory landscape with absolute confidence and a definitive audit trail."
                                </p>
                                <ul className="space-y-6">
                                    {[
                                        'Fire & Building Safety Act compliance',
                                        'Awaab\'s Law response tracking',
                                        'Master regulation library (240+ acts)',
                                        'AI-flagged compliance health summaries'
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-4 text-slate-700 dark:text-slate-300 font-bold text-lg">
                                            <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-teal-500" />
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── AI CAPABILITIES CALLOUT ── */}
            <section className="py-48 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="p-16 md:p-24 rounded-lg bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-white/10 relative overflow-hidden shadow-2xl"
                    >
                        {/* Interactive Background */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center text-center">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-lg bg-cyan-500 border border-cyan-300 flex items-center justify-center mb-12 shadow-[0_0_50px_rgba(34,211,238,0.3)]"
                            >
                                <Database className="w-12 h-12 text-slate-950" />
                            </motion.div>
                            
                            <h2 className="text-5xl md:text-7xl font-black text-white mb-10 font-display tracking-tight">AI-Native Framework</h2>
                            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mb-16 leading-relaxed font-light">
                                "We didn't just add AI; we built the platform around it. Our intelligence layer automates the high-value manual work that typically costs organisations thousands in consultant fees."
                            </p>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
                                {aiFeatures.map((f, i) => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ y: -10 }}
                                        className="bg-white/5 border border-white/10 rounded-lg p-5 sm:p-8 text-center backdrop-blur-md group hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-500 shadow-xl"
                                    >
                                        <f.icon className="w-10 h-10 text-cyan-400 mb-6 mx-auto opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
                                        <div className="text-[10px] font-black uppercase tracking-widest leading-relaxed wrap-break-word text-white/50 group-hover:text-cyan-400 transition-colors">{f.title}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── SECURITY & INFRA ── */}
            <section className="py-32 px-6 bg-slate-950 border-t border-white/5">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                    {[
                        { title: 'ISO Alignment', desc: 'Frameworks built for ISO 31000 & 27001.', icon: Lock },
                        { title: 'UK Hosted', desc: 'All data resides in secure UK-based datacenters.', icon: Globe },
                        { title: 'Full Audit Trail', desc: 'Immutable logs of every change and approval.', icon: History },
                        { title: 'Role Security', desc: 'Enterprise IAM with granular project permissions.', icon: Users },
                    ].map((item, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="flex gap-6 items-start group"
                        >
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10 shrink-0 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-all duration-500">
                                <item.icon className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                            </div>
                            <div>
                                <h4 className="text-white font-black mb-2 text-lg uppercase tracking-wider">{item.title}</h4>
                                <p className="text-slate-500 text-sm leading-relaxed font-light">{item.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── FINAL CTA ── */}
            <section className="py-64 px-6 relative overflow-hidden bg-slate-950">
                <div className="absolute inset-0 bg-indigo-500 pointer-events-none opacity-[0.05] blur-[150px]" />
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <motion.h2 
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="text-5xl md:text-8xl font-black text-white mb-10 tracking-tight font-display leading-[1.05]"
                    >
                        Ready to Modernise <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">Your Programme?</span>
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-2xl text-slate-400 mb-16 max-w-3xl mx-auto leading-relaxed font-light italic"
                    >
                        Join the next generation of social housing managers using intelligence to protect residents and budgets.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        <Link to="/login" className="group inline-flex items-center gap-4 px-12 py-6 text-xl font-black bg-cyan-500 text-slate-950 rounded-lg hover:bg-white hover:scale-105 transition-all duration-500 shadow-[0_0_60px_rgba(34,211,238,0.4)]">
                            Launch Portal <ArrowRight className="w-7 h-7 transform group-hover:translate-x-2 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

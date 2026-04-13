import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ChevronDown, ChevronRight, Check } from 'lucide-react';

/* ═══════════════════════════════════════════════════
   UX MASTERPIECE: ANIMATION & STYLING CONSTANTS
   ═══════════════════════════════════════════════════ */
const fadeIn = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }
} as const;

const staggerContainer = {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true, margin: "-100px" },
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
};

const staggerItem = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }
};

/* ═══════════════════════════════════════════════════
   DYNAMIC TEXT COMPONENT
   ═══════════════════════════════════════════════════ */
const DynamicText = () => {
    const phrases = ["for Boards", "for Housing Associations", "for Executive Teams", "for Property Managers"];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % phrases.length);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={index}
                initial={{ opacity: 0, filter: 'blur(8px)', y: 15 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0, filter: 'blur(8px)', y: -15 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0"
            >
                {phrases[index]}
            </motion.span>
        </AnimatePresence>
    );
};

/* ═══════════════════════════════════════════════════
   FAQ SECTION
   ═══════════════════════════════════════════════════ */
const faqs = [
    {
        q: 'Is Cedar Guard compliant with WCAG 2.0 AA accessibility standards?',
        a: 'Yes. Cedar Guard is built with semantic, keyboard-navigable HTML and meets the majority of WCAG 2.0 AA criteria. A formal third-party audit is conducted prior to every major contract go-live, with full documented conformance provided.'
    },
    {
        q: 'How is data encrypted and secured?',
        a: 'All data is transmitted over TLS 1.3 (HTTPS) and stored encrypted at rest using AES-256 in our secure cloud databases. Authentication uses short-lived, encrypted JWTs. API access is controlled by revocable, scoped API Keys (Bearer tokens).'
    },
    {
        q: 'Can it be used on mobile devices — iPhones, iPads, and Android?',
        a: 'Yes. Cedar Guard is a fully responsive web application that works on all modern browsers including Safari on iOS, Chrome on Android, and desktop browsers. No app download is required. Device-level PIN/biometric lock is handled natively by the device OS.'
    },
    {
        q: 'Can Cedar Guard integrate with our existing systems like Northgate, SAP, or Apex?',
        a: 'Cedar Guard exposes a secure REST API that allows bidirectional data exchange with third-party systems. Integrations with Northgate Housing, SAP Finance, Apex, and Manhattan Asset Management are scoped and delivered during the implementation phase at no additional licensing cost.'
    },
    {
        q: 'Can we export data to Microsoft Excel?',
        a: 'Yes. All risk registers, compliance trackers, issue logs, and project data can be exported. Native formatted .xlsx workbook export (multi-tab, print-ready) is delivered within the implementation period.'
    },
    {
        q: 'Does it integrate with the Local Land and Property Gazetteer (LLPG)?',
        a: 'Yes. Cedar Guard\'s open REST API can be configured to query the Council\'s LLPG endpoint to auto-populate site and property references when creating new projects. This is configured during onboarding.'
    },
    {
        q: 'How does multi-tenancy work — can different teams see only their own data?',
        a: 'Cedar Guard enforces strict multi-tenancy at every layer. Client Admins see all their PMs and projects. Project Managers see only their assigned projects. All data isolation rules apply equally to both web portal access and API key access.'
    },
    {
        q: 'What support is provided for public sector procurement (ITT/Q&A responses)?',
        a: 'We provide full documentation to support procurement including WCAG conformance statements, security architecture summaries, integration capability statements, and scored supplier responses for ICT requirement sections. Contact us for a pre-ITT pack.'
    },
    {
        q: 'What does the pricing model look like for councils?',
        a: 'Cedar Guard is offered on a per-project-manager, annual SaaS subscription. Volume discounts apply for framework agreements. A free pilot for up to 3 projects is available to qualifying public sector bodies to evaluate before committing.'
    },
    {
        q: 'How long does it take to go live?',
        a: 'A standard implementation — including workspace setup, regulation library configuration, and PM onboarding — can be completed in 2–4 weeks. Integrations with third-party systems are typically scoped for weeks 4–8 of the project.'
    },
];

function FAQSection() {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <section className="py-32 px-6 bg-white dark:bg-[#030303]">
            <div className="max-w-4xl mx-auto">
                <motion.div {...fadeIn} className="mb-20 text-center">
                    <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-white/40 uppercase mb-4">Inquiries</p>
                    <h2 className="text-4xl font-light text-slate-900 dark:text-white tracking-tight mb-6">Frequently Asked Questions</h2>
                </motion.div>

                <div className="space-y-px bg-slate-200 dark:bg-white/5 border-y border-slate-200 dark:border-white/5">
                    {faqs.map((faq, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05, duration: 0.6 }}
                            className="bg-white dark:bg-[#030303]"
                        >
                            <button
                                className="w-full flex items-center justify-between py-8 text-left group"
                                onClick={() => setOpen(open === i ? null : i)}
                            >
                                <span className={`font-medium text-lg transition-colors duration-500 ${open === i ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-white/60 group-hover:text-slate-900 dark:text-white'}`}>
                                    {faq.q}
                                </span>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 ${open === i ? 'border-slate-300 dark:border-white text-slate-900 dark:text-white' : 'border-slate-200 dark:border-white/10 text-indigo-600 dark:text-white/40 group-hover:border-slate-400 dark:border-white/30 group-hover:text-slate-900 dark:text-white'}`}>
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${open === i ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            <AnimatePresence initial={false}>
                                {open === i && (
                                    <motion.div
                                        key="answer"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <p className="pb-8 text-slate-500 dark:text-white/50 text-base leading-relaxed font-light pr-12">{faq.a}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════════
   COMPARISON SECTION
   ═══════════════════════════════════════════════════ */
const comparisonData = [
    {
        category: "Strategic Intelligence",
        items: [
            {
                feature: "AI Compliance Discovery",
                cedar: "Automated mapping of evidence to regulations",
                legacy: "Manual spreadsheet reconciliation",
                generic: "Static upload-only repositories",
                niche: "Basic document storage",
            },
            {
                feature: "Predictive Risk RAG",
                cedar: "Forecasting failures before they occur",
                legacy: "Stale, retrospective reporting",
                generic: "Basic current-state alerts",
                niche: "Historical compliance logs",
            },
            {
                feature: "Safety Sentiment Analysis",
                cedar: "AI analysis of damp, mould & resident safety feedback",
                legacy: "Disconnected tenant logs",
                generic: "Standard helpdesk ticketing",
                niche: "Reactive keyword flagging",
            }
        ]
    },
    {
        category: "Statutory Governance",
        items: [
            {
                feature: "The 'Big 6' Compliance",
                cedar: "Automated Gas, Fire, Electric, Water, Asbestos, Lifts",
                legacy: "Fragmented across departments",
                generic: "Limited property safety modules",
                niche: "Manual statutory tracking",
            },
            {
                feature: "Awaab’s Law Readiness",
                cedar: "Integrated damp & mould AI workflows",
                legacy: "Ad-hoc task management",
                generic: "Generic inspection forms",
                niche: "Siloed legal compliance checklists",
            },
            {
                feature: "Board-Level Governance",
                cedar: "Instant, visual PDF strategic summaries",
                legacy: "Manual Excel data crunching",
                generic: "Basic CSV/Data exports",
                niche: "Functional table-only reports",
            }
        ]
    },
    {
        category: "Operations & UX",
        items: [
            {
                feature: "Implementation Speed",
                cedar: "Rapid 2-4 week setup & onboarding",
                legacy: "6-12 month enterprise cycles",
                generic: "Self-service / Minimal support",
                niche: "Manual data migration required",
            },
            {
                feature: "Modern Workspace",
                cedar: "Clean, reactive, accessible UI",
                legacy: "Clunky, legacy ERP interface",
                generic: "Standard web dashboard",
                niche: "Functional but dated Portal",
            },
            {
                feature: "Field-Ready Inspections",
                cedar: "Mobile-first capture on the doorstep",
                legacy: "Paper-based or offline sync errors",
                generic: "Mobile-responsive only",
                niche: "Native app required for sync",
            }
        ]
    },
    {
        category: "Trust & Security",
        items: [
            {
                feature: "ISO-Aligned Cryptography",
                cedar: "TLS 1.3 / AES-256 for all data",
                legacy: "Standard legacy encryption",
                generic: "Basic HTTPS/SSL layers",
                niche: "Standard data encryption",
            },
            {
                feature: "UK Sovereign Data",
                cedar: "UK data residency for public sector trust",
                legacy: "Often hosted in US/EU regions",
                generic: "Cloud-agnostic, variable residency",
                niche: "Hosted on standard public cloud",
            }
        ]
    }
];

function ComparisonSection() {
    return (
        <section id="comparison" className="py-24 md:py-40 px-6 border-t border-slate-200 dark:border-white/[0.03]">
            <div className="max-w-7xl mx-auto">
                <motion.div {...fadeIn} className="text-center max-w-3xl mx-auto mb-20 md:mb-28">
                    <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-indigo-400 uppercase mb-8">Competitive Edge</p>
                    <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-slate-900 dark:text-white mb-8 leading-tight">
                        Why Strategic Leaders <br className="hidden md:block" /> Choose Cedar Guard
                    </h2>
                    <p className="text-xl text-slate-500 dark:text-white/50 font-light leading-relaxed">
                        Comparing the next generation of risk management against legacy housing systems and generic property tools in the UK market.
                    </p>
                </motion.div>

                <div className="overflow-x-auto pb-8 -mx-6 px-6 md:mx-0 md:px-0">
                    <div className="min-w-[900px] border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/[0.01] backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                                    <th className="py-10 px-12 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-white/30 w-1/4">Strategic Metric</th>
                                    <th className="py-10 px-12 text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-500/[0.03] w-1/4 border-x border-slate-200 dark:border-white/5">
                                        Cedar Guard
                                    </th>
                                    <th className="py-10 px-12 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-white/30 w-[18%]">Legacy Housing (MRI, Aareon, NEC)</th>
                                    <th className="py-10 px-12 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-white/30 w-[18%]">Generic GRC (Ideagen, Diligent, JCAD)</th>
                                    <th className="py-10 px-12 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-white/30 w-[18%]">Niche Compliance (Riskhub, Propeller, AwaabSafe)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonData.map((cat, idx) => (
                                    <React.Fragment key={idx}>
                                        {/* Category Header Row */}
                                        <tr className="bg-slate-100/30 dark:bg-white/[0.01]">
                                            <td colSpan={5} className="py-4 px-12">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/60 dark:text-indigo-400/40">
                                                    {cat.category}
                                                </span>
                                            </td>
                                        </tr>
                                        {cat.items.map((row, i) => (
                                            <tr key={i} className="group border-b border-slate-200 dark:border-white/5 last:border-0 hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors duration-500">
                                                <td className="py-10 px-12">
                                                    <p className="text-slate-900 dark:text-white font-medium mb-1">{row.feature}</p>
                                                </td>
                                                <td className="py-10 px-12 bg-indigo-50/20 dark:bg-indigo-500/[0.01] border-x border-slate-200 dark:border-white/5">
                                                    <div className="flex items-start gap-4">
                                                        <div className="mt-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200 dark:shadow-none animate-pulse">
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                        <p className="text-indigo-600 dark:text-indigo-300 text-sm font-medium leading-relaxed">{row.cedar}</p>
                                                    </div>
                                                </td>
                                                <td className="py-10 px-12 font-light text-slate-500 dark:text-white/40 text-sm leading-relaxed">
                                                    {row.legacy}
                                                </td>
                                                <td className="py-10 px-12 font-light text-slate-500 dark:text-white/40 text-sm leading-relaxed">
                                                    {row.generic}
                                                </td>
                                                <td className="py-10 px-12 font-light text-slate-500 dark:text-white/40 text-sm leading-relaxed">
                                                    {row.niche}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <motion.div {...fadeIn} className="mt-12 text-center">
                    <p className="text-sm text-slate-400 dark:text-white/20 font-light">
                        * Comparison based on standard market feature sets as of Q1 2024.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}


export const Landing: React.FC = () => {
    return (
        <div className="bg-slate-50 dark:bg-[#030303] text-slate-800 dark:text-white/80 font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-white min-h-screen transition-colors duration-500">
            
            {/* ── HERO SECTION ── */}
            <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
                {/* Background ambient lighting */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-slate-100 dark:bg-white/[0.02] blur-[120px] rounded-[100%] pointer-events-none" />
                
                <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center w-full mt-32 md:mt-40">
                    <motion.div
                        initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <p className="text-[10px] font-medium tracking-[0.3em] text-indigo-600 dark:text-indigo-400 uppercase mb-8">Cedar Guard</p>
                    </motion.div>

                    <motion.h1 
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="text-6xl sm:text-7xl md:text-[6rem] font-medium text-slate-900 dark:text-white leading-[1.05] tracking-[-0.04em] mb-6"
                    >
                        Compliance & <br className="hidden md:block" />
                        <span className="text-indigo-600 dark:text-white/40">Risk Suite</span>
                    </motion.h1>

                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.6 }}
                        className="relative h-16 w-full flex items-center justify-center mb-12 text-2xl sm:text-3xl font-light tracking-tight text-slate-500 dark:text-white/60"
                    >
                        <DynamicText />
                    </motion.div>

                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="text-lg sm:text-xl text-indigo-600 dark:text-white/40 font-light max-w-2xl mb-16"
                    >
                        A definitive, intelligent platform designed specifically for UK Social Housing Providers.
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-md"
                    >
                        <Link 
                            to="/login" 
                            className="w-full sm:w-auto px-10 py-4 text-sm font-medium bg-indigo-600 text-white dark:bg-white dark:text-slate-950 shadow-lg dark:shadow-[0_0_20px_rgba(255,255,255,0.3)] rounded-full hover:bg-indigo-700 dark:hover:bg-cyan-50 hover:scale-[1.02] transition-all duration-500 flex items-center justify-center gap-3"
                        >
                            Enter Portal <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a 
                            href="#solution" 
                            className="w-full sm:w-auto px-10 py-4 text-sm font-medium text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-full hover:bg-slate-200 dark:bg-white/5 transition-all duration-500"
                        >
                            Explore Solution
                        </a>
                    </motion.div>

                    {/* Hero Dashboard Showcase Image */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full max-w-[1200px] mt-24 relative z-20 group hidden md:block"
                        style={{ perspective: "2000px" }}
                    >
                        <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-500 via-cyan-400 to-purple-500 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                        <motion.img 
                            whileHover={{ rotateX: 2, rotateY: 2, scale: 1.02 }}
                            transition={{ duration: 0.5 }}
                            src="/dashboard_showcase.png" 
                            alt="Cedar Guard Risk Intelligence Dashboard - Tower A Retrofit Showcase" 
                            title="Interactive Risk Trends and AI Insights Dashboard" 
                            className="relative w-full h-auto rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.6)] border-4 border-white/40 dark:border-white/5 object-cover object-top"
                        />
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1 }}
                    className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
                >
                    <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent" />
                </motion.div>
            </section>

            {/* ── RISK MANAGEMENT FAILURE ── */}
            <section id="risk" className="py-40 px-6 border-t border-slate-200 dark:border-slate-200 dark:border-white/[0.03]">
                <div className="max-w-7xl mx-auto">
                    <motion.div {...fadeIn} className="mb-24 md:flex md:items-end md:justify-between gap-12">
                        <div className="max-w-3xl">
                            <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-white/40 uppercase mb-8">The Landscape</p>
                            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight mb-8 leading-tight">
                                Risk management failure in UK Housing
                            </h2>
                            <p className="text-xl text-slate-500 dark:text-white/50 font-light leading-relaxed">
                                The strategic and operational landscape is shifting rapidly, creating a 'perfect storm' for housing delivery. Success depends on moving from reactive tracking to proactive, intelligence-led risk management.
                            </p>
                        </div>
                    </motion.div>

                    {/* Reality Check Statistics */}
                    <motion.div 
                        variants={staggerContainer}
                        initial="initial"
                        whileInView="whileInView"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5 mb-32"
                    >
                        {[
                            { label: 'Annual Capital Investment', value: '£12-15B', sub: 'across UK housing' },
                            { label: 'Typical Budget Overruns', value: '5-15%', sub: 'due to late risk detection' },
                            { label: 'Contractor Cost', value: '£2M+', sub: 'for a single major project' },
                            { label: 'Automation Potential', value: '40%', sub: 'of work activities (McKinsey)' }
                        ].map((stat, idx) => (
                            <motion.div variants={staggerItem} key={idx} className="bg-white dark:bg-[#030303] p-10 flex flex-col justify-between aspect-square group">
                                <p className="text-[10px] text-slate-500 dark:text-white/30 uppercase tracking-[0.2em] font-medium">{stat.label}</p>
                                <div>
                                    <h4 className="text-5xl font-light text-slate-900 dark:text-white tracking-tight mb-4 group-hover:scale-105 group-hover:text-slate-900 dark:text-white transition-all duration-700 origin-left">{stat.value}</h4>
                                    <p className="text-sm text-indigo-600 dark:text-white/40 font-light">{stat.sub}</p>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Columns */}
                    <div className="grid lg:grid-cols-3 gap-0 border-y border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.01]">
                        {/* Column 1 */}
                        <motion.div {...fadeIn} className="p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/5">
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white uppercase tracking-widest mb-12">01 — Strategic Pressures</h3>
                            <div className="space-y-10">
                                {[
                                    { title: "Regulatory pressure", sub: "intensifying across all sectors" },
                                    { title: "Budgets tightening", sub: "as demand for services rises" },
                                    { title: "Debt costs increasing", sub: "impact of rising interest rates" },
                                    { title: "Manual processes", sub: "slowing critical decision making" },
                                    { title: "Revenue constrained", sub: "by statutory rent caps" }
                                ].map((item, i) => (
                                    <div key={i} className="group">
                                        <h4 className="text-slate-900 dark:text-white text-base font-medium mb-1 group-hover:text-slate-700 dark:text-white/80 transition-colors">{item.title}</h4>
                                        <p className="text-indigo-600 dark:text-white/40 text-sm font-light">{item.sub}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Column 2 */}
                        <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/5">
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white uppercase tracking-widest mb-12">02 — Operating Environment</h3>
                            <div className="space-y-10">
                                {[
                                    { title: "Compliance costs rising", sub: "(safety & environmental mandates)" },
                                    { title: "Political change", sub: "disrupting long-term delivery" },
                                    { title: "Delays & cancellations", sub: "increasing public & media pressure" },
                                    { title: "Contractor failures", sub: "rising across the supply chain" },
                                    { title: "Funding uncertainty", sub: "making planning impossible" },
                                    { title: "Cashflow gaps widening", sub: "straining capital programmes" }
                                ].map((item, i) => (
                                    <div key={i} className="group">
                                        <h4 className="text-slate-900 dark:text-white text-base font-medium mb-1">{item.title}</h4>
                                        <p className="text-indigo-600 dark:text-white/40 text-sm font-light">{item.sub}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Column 3 */}
                        <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="p-10 lg:p-16">
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white uppercase tracking-widest mb-12">03 — What Councils Must Do</h3>
                            <div className="space-y-10">
                                {[
                                    { title: "Introduce KRI-driven risk management", sub: "early warning system" },
                                    { title: "Align project to executive", sub: "executive risk visibility" },
                                    { title: "Define risk appetite", sub: "measurable thresholds" },
                                    { title: "Automate risk detection", sub: "escalation, and reporting" },
                                    { title: "Shift from tracking to prediction", sub: "Move from retrospective logging to intelligence" }
                                ].map((item, i) => (
                                    <div key={i} className="group relative">
                                        <div className="absolute -left-6 top-1.5 w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20 group-hover:bg-white transition-colors" />
                                        <h4 className="text-slate-900 dark:text-white text-base font-medium mb-1">{item.title}</h4>
                                        <p className="text-indigo-600 dark:text-white/40 text-sm font-light">{item.sub}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── COMPLIANCE ── */}
            <section id="compliance" className="py-40 px-6 border-t border-slate-200 dark:border-white/[0.03] bg-slate-50 dark:bg-white/[0.01]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-24 items-start">
                        {/* Left */}
                        <motion.div {...fadeIn}>
                            <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-white/40 uppercase mb-8">The Priority</p>
                            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-slate-900 dark:text-white mb-10 leading-tight">The Compliance <br /> Imperative</h2>
                            
                            <div className="text-slate-500 dark:text-white/50 text-lg font-light leading-relaxed space-y-8">
                                <p>
                                    Since the Grenfell tragedy, regulations have become significantly more stringent. The government now holds construction stakeholders to exceptionally high standards to ensure safety and accountability.
                                </p>
                                <p>
                                    Compliance in social housing is more crucial than ever, as it directly impacts the safety and wellbeing of residents. The Grenfell incident highlighted the devastating consequences of inadequate safety measures, prompting a nationwide emphasis on rigorous building standards, fire safety protocols, and transparent oversight.
                                </p>
                                <div className="pl-6 border-l border-slate-300 dark:border-white/20 mt-12 py-2">
                                    <p className="text-slate-900 dark:text-white text-xl font-medium leading-relaxed">
                                        Ensuring compliance not only protects residents but also restores public trust and promotes sustainable, responsible development within social housing sectors.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Right */}
                        <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="lg:mt-32 border border-slate-200 dark:border-white/10 bg-white dark:bg-[#030303] p-12 lg:p-16 rounded-[2rem]">
                            <h3 className="text-2xl font-light text-slate-900 dark:text-white mb-12">Immediate Action Plan</h3>
                            <ul className="space-y-12">
                                {[
                                    "Introduce an Ai-powered compliance autopilot that makes compliance simple and easy to do for managers.",
                                    "Introduce a technology that communicates to managers what compliance expectations is at any given time of their project alerting them to act in a timely fashion.",
                                    "Have regulations that affect the managers with the interpretations at the finger tips of the managers.",
                                    "Educate Managers on project delivery and compliance."
                                ].map((item, idx) => (
                                    <li key={idx} className="flex gap-6">
                                        <span className="text-xs font-mono text-slate-400 dark:text-white/30 pt-1">0{idx + 1}</span>
                                        <p className="text-slate-600 dark:text-white/70 font-light leading-relaxed">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>

                    {/* Compliance Showcase Image */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full mt-24 relative z-20 group hidden md:block"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-[2.5rem] blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-1000" />
                        <img 
                            src="/compliance_showcase.png" 
                            alt="Cedar Guard Regulatory Reference - UK Social Housing and Construction Framework" 
                            title="Automated Regulatory Compliance Audit Interface" 
                            className="relative w-full h-auto rounded-[2.5rem] shadow-2xl border-4 border-white/40 dark:border-white/5 object-cover object-top transition-transform duration-1000 group-hover:scale-[1.01]"
                        />
                    </motion.div>
                </div>
            </section>

            {/* ── PLATFORM TEASER ── */}
            <section className="py-40 px-6 border-t border-slate-200 dark:border-white/[0.03]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-24 items-center">
                        <motion.div {...fadeIn}>
                            <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-white/40 uppercase mb-8">Ecosystem</p>
                            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-slate-900 dark:text-white mb-8 leading-tight">
                                Everything your team needs in one place
                            </h2>
                            <p className="text-slate-500 dark:text-white/50 text-xl font-light leading-relaxed mb-12">
                                A fully integrated suite covering every dimension of risk and regulatory compliance — from automated AI risk discovery to board-ready reporting.
                            </p>
                            <Link to="/product" className="inline-flex items-center gap-3 text-sm font-medium text-slate-900 dark:text-white border-b border-slate-300 dark:border-white/20 pb-1 hover:border-slate-300 dark:border-white transition-colors">
                                Explore All Features <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        <motion.div 
                            variants={staggerContainer}
                            initial="initial"
                            whileInView="whileInView"
                            className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5"
                        >
                            {[
                                { label: 'Risk Mgmt', desc: 'Enterprise RAID \n& AI Discovery' },
                                { label: 'Compliance', desc: 'Statutory Trackers \n& Vault' },
                                { label: 'Governance', desc: 'Portfolio-wide \nPDF Reporting' },
                                { label: 'AI Engine', desc: 'Narrative Summaries \n& Analysis' },
                            ].map((item, i) => (
                                <motion.div variants={staggerItem} key={i} className="bg-white dark:bg-[#030303] p-8 aspect-square flex flex-col justify-end group cursor-default">
                                    <p className="text-indigo-600 dark:text-white/40 text-xs font-light leading-relaxed whitespace-pre-line group-hover:text-slate-700 dark:text-white/80 transition-colors duration-500 mb-4">
                                        {item.desc}
                                    </p>
                                    <h4 className="text-slate-900 dark:text-white text-lg font-medium tracking-tight">
                                        {item.label}
                                    </h4>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── WHY AI ── */}
            <section className="py-40 px-6 border-t border-slate-200 dark:border-white/[0.03] bg-slate-50 dark:bg-white/[0.01]">
                <div className="max-w-7xl mx-auto">
                    <motion.div {...fadeIn} className="text-center max-w-4xl mx-auto mb-24">
                        <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-slate-900 dark:text-white mb-8 leading-tight">
                            Why the management of risk and compliance requires AI
                        </h2>
                        <p className="text-xl text-slate-500 dark:text-white/50 font-light leading-relaxed">
                            Traditional manual methods are no longer sufficient to navigate the increasing complexity of regulatory standards. AI provides speed, accuracy, and foresight.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-px bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                        <motion.div {...fadeIn} className="bg-white dark:bg-[#030303] p-12 lg:p-20">
                            <h3 className="text-2xl font-light text-slate-500 dark:text-white/50 mb-12">The Manual Ceiling</h3>
                            <ul className="space-y-8">
                                {[
                                    "Fragmented data across spreadsheets leads to critical visibility gaps.",
                                    "Reactive reporting means acting only after a compliance failure has occurred.",
                                    "Inconsistent interpretations of complex regulations create massive organizational liability."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-6 text-indigo-600 dark:text-white/40 font-light leading-relaxed">
                                        <span className="shrink-0 pt-1.5 w-1 h-1 bg-slate-300 dark:bg-white/20 rounded-full" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="bg-white dark:bg-[#030303] p-12 lg:p-20 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-slate-100 dark:bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-12 relative z-10">The AI-Powered Frontier</h3>
                            <ul className="space-y-8 relative z-10">
                                {[
                                    "Unified risk-compliance intelligence for a definitive 360° operational view.",
                                    "Predictive analytics to identify and mitigate safety risks before they manifest.",
                                    "Intelligent, automated oversight ensuring absolute regulatory confidence and trust."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-6 text-slate-700 dark:text-white/80 font-light leading-relaxed">
                                        <span className="shrink-0 pt-1.5 w-1 h-1 bg-white rounded-full" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── THE SOLUTION ── */}
            <section id="solution" className="py-40 px-6 border-t border-slate-200 dark:border-white/[0.03]">
                <div className="max-w-7xl mx-auto">
                    <motion.div {...fadeIn} className="max-w-3xl mb-24">
                        <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-white/40 uppercase mb-8">The Solution</p>
                        <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-slate-900 dark:text-white mb-8 leading-tight">An End-to-End Approach</h2>
                        <p className="text-xl text-slate-500 dark:text-white/50 font-light leading-relaxed">
                            Designed specifically for UK social housing providers, our solution combines people, process, and technology to deliver stronger protection.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5 mb-24">
                        {[
                            {
                                title: "Targeted Risk & Compliance Training",
                                desc: "Structured, role-based training to equip teams with the knowledge, confidence, and accountability required to identify, manage, and escalate risk."
                            },
                            {
                                title: "Robust Governance Frameworks",
                                desc: "Clear governance structures aligned to regulatory expectations, embedding consistent policies, controls, and oversight to support strong decision-making."
                            },
                            {
                                title: "AI-Powered Risk Platform",
                                desc: "An intelligent, data-driven platform built for UK social housing managers, providing real-time visibility of risks, compliance status, and emerging issues."
                            }
                        ].map((pillar, i) => (
                            <motion.div {...fadeIn} transition={{ delay: i * 0.1 }} key={i} className="bg-white dark:bg-[#030303] p-12 flex flex-col gap-8 group">
                                <span className="text-[10px] font-mono text-slate-400 dark:text-white/30 group-hover:text-slate-900 dark:text-white transition-colors">{`0${i + 1}`}</span>
                                <h3 className="text-xl font-medium text-slate-900 dark:text-white">{pillar.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-white/50 font-light leading-relaxed mt-auto">
                                    {pillar.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div {...fadeIn} className="text-center max-w-3xl mx-auto py-12 px-6 border border-slate-200 dark:border-white/10 rounded-2xl">
                        <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-6">Delivering Smarter Decisions</h3>
                        <p className="text-slate-500 dark:text-white/50 font-light leading-relaxed">
                            Together, this solution enables organisations to move from reactive compliance to proactive, insight-led risk management, delivering smarter decisions, improved regulatory confidence, and stronger protection for residents and stakeholders.
                        </p>
                    </motion.div>
                </div>
            </section>
            {/* ── COMPARISON ── */}
            <ComparisonSection />

            {/* ── GOVERNMENT READINESS & INTEGRATIONS ── */}
            <section className="py-40 px-6 border-t border-slate-200 dark:border-white/[0.03] bg-slate-50 dark:bg-white/[0.01]">
                <div className="max-w-7xl mx-auto">
                    <motion.div {...fadeIn} className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-12">
                        <div className="max-w-2xl">
                            <p className="text-[10px] font-medium tracking-[0.2em] text-indigo-600 dark:text-white/40 uppercase mb-8">Architecture</p>
                            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-slate-900 dark:text-white leading-tight">Built for Public Sector Requirements</h2>
                        </div>
                        <p className="text-lg text-slate-500 dark:text-white/50 font-light md:max-w-md">Cedar Guard meets or exceeds UK Government ICT procurement standards including security, accessibility, and integration requirements.</p>
                    </motion.div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5 mb-32">
                        {[
                            { label: 'TLS 1.3 Encrypted', sub: 'All data in transit & at rest' },
                            { label: 'WCAG 2.0 AA', sub: 'Accessibility compliant' },
                            { label: 'Mobile Responsive', sub: 'iOS, Android, all browsers' },
                            { label: 'Open REST API', sub: 'Integrates with council systems' },
                        ].map((badge, i) => (
                            <motion.div {...fadeIn} transition={{ delay: i * 0.1 }} key={i} className="bg-white dark:bg-[#030303] p-10 flex flex-col justify-center">
                                <p className="text-slate-900 dark:text-white font-medium mb-2">{badge.label}</p>
                                <p className="text-indigo-600 dark:text-white/40 text-xs font-light">{badge.sub}</p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-20">
                        <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-12">Integrations & Interoperability</h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                            {[
                                { label: 'Microsoft Excel Export', desc: 'Export any register or tracker to .xlsx with one click', status: 'Available' },
                                { label: 'Microsoft Outlook / Email', desc: 'Email alerts, notifications and risk summaries sent directly to inboxes', status: 'Available' },
                                { label: 'Northgate Housing System', desc: 'Bidirectional sync via REST API — scoped at implementation', status: 'On request' },
                                { label: 'SAP Finance', desc: 'Cost centre code and budget line sync with SAP RFC/REST', status: 'On request' },
                                { label: 'Apex Asset Management', desc: 'Asset reference linking and data exchange via Apex APIs', status: 'On request' },
                                { label: 'Local Land & Property Gazetteer', desc: 'Council LLPG integration via API for property data lookup', status: 'On request' },
                            ].map((item, i) => (
                                <motion.div {...fadeIn} transition={{ delay: i * 0.05 }} key={i} className="bg-white dark:bg-[#030303] p-8 group">
                                    <div className="flex items-start justify-between mb-8">
                                        <p className="font-medium text-slate-900 dark:text-white group-hover:text-slate-700 dark:text-white/80 transition-colors">{item.label}</p>
                                        <span className={`text-[9px] font-mono tracking-widest px-2 py-1 rounded border uppercase ${
                                            item.status === 'Available' ? 'border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80' : 'border-slate-200 dark:border-white/5 text-slate-400 dark:text-white/30'
                                        }`}>{item.status}</span>
                                    </div>
                                    <p className="text-sm font-light text-slate-500 dark:text-white/50 leading-relaxed pr-6">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div {...fadeIn} className="mt-12 bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/10 rounded-2xl p-8 lg:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-sm">
                            <div>
                                <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-4">Developer API</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed font-light text-lg">
                                    Build custom integrations, sync project RAG statuses directly to your corporate PowerBI or Tableau dashboards, and programmatically manage risk registers. Full role-based access control (RBAC) enforced at the API level.
                                </p>
                            </div>
                            <Link to="/api-docs" className="shrink-0 inline-flex items-center justify-center px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                                View API Documentation <ChevronRight className="w-5 h-5 ml-2" />
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <FAQSection />

            {/* ── CTA ── */}
            <section className="py-40 px-6 border-t border-slate-200 dark:border-white/[0.03] text-center flex flex-col items-center">
                <motion.div {...fadeIn} className="max-w-3xl flex flex-col items-center">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight text-slate-900 dark:text-white mb-8 leading-tight">Ready to modernise your compliance?</h2>
                    <p className="text-xl text-slate-500 dark:text-white/50 font-light leading-relaxed mb-16 max-w-2xl">Secure, auditable, and built explicitly for the complexities of UK public sector housing.</p>
                    <Link to="/login" className="inline-flex items-center justify-center px-12 py-5 text-sm font-medium bg-white text-black rounded-full hover:bg-white/90 hover:scale-[1.02] transition-all duration-500">
                        Enter Production Portal
                    </Link>
                </motion.div>
            </section>

            {/* Global simple footer for visual breathing room */}
            <footer className="py-12 text-center text-slate-300 dark:text-white/20 text-xs font-light tracking-widest uppercase border-t border-slate-200 dark:border-white/10">
                Cedar Guard © {new Date().getFullYear()}
            </footer>

        </div>
    );
};

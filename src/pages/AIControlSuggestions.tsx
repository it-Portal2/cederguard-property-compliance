import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    AlertTriangle,
    Activity,
    CheckCircle2,
    Search,
    Plus,
    ArrowRight,
    Radar,
    FileText,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import ValidateButton from '../components/validation/ValidateButton';
import { versionedTargetId } from '../lib/validation';
import PageHeader from '../components/PageHeader';
import toast from 'react-hot-toast';
import { analyzeControls, analyzeContextSentence } from '../services/aiService';
import { clsx } from 'clsx';
import { stripMarkdown, parseAISuggestion } from '../lib/utils';

// ── Animation variants ────────────────────────────────────────────
const fadeVariants: Variants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit:    { opacity: 0, transition: { duration: 0.2 } },
};

const slideUpVariants: Variants = {
    hidden:  { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } },
    exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const listVariants: Variants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function AIControlSuggestions() {
    const { risks, updateRisk, activeProject, activeProgramme, activeProjectId, activeProgrammeId, projectInfo, pendingMutations } = useStore();
    const isRiskPending = (id: string) => pendingMutations.has(`risk:${id}`);
    const [isAutoLoading,     setIsAutoLoading]     = useState(false);
    const [isManualLoading,   setIsManualLoading]   = useState(false);
    const [suggestedControls, setSuggestedControls] = useState<any[]>([]);
    const [manualSentence,    setManualSentence]    = useState('');
    const [manualIdeas,       setManualIdeas]       = useState<string[]>([]);
    const [error,             setError]             = useState('');
    const [isFocused,         setIsFocused]         = useState(false);

    const highRisks = risks.filter(r => r.status === 'Open' && (r.residualRating || 0) >= 12);

    // Fact-Check / Validation gate (Q4=A) — versioned by the exact suggestions so
    // re-generating requires a fresh check; one passing check unlocks the Add buttons.
    const mitigationCtxId = activeProjectId || activeProgrammeId || (activeProject as any)?.id || (activeProgramme as any)?.id || '';
    const mitigationContentStr = suggestedControls
        .map((sc: any) => `${sc.riskTitle || sc.riskId}: ${(sc.suggestions || []).join('; ')}`)
        .join('\n');
    const mitigationValidationTargetId = versionedTargetId(mitigationCtxId, mitigationContentStr);
    const mitigationValidation = useStore((s) => s.validationsByKey[`mitigation:${mitigationValidationTargetId}`] ?? null);
    const isMitigationValidationBlocked =
        !!mitigationCtxId &&
        suggestedControls.length > 0 &&
        (mitigationValidation?.status ?? 'unchecked') !== 'validated';

    const runAutomatedAnalysis = async () => {
        if (highRisks.length === 0) {
            setError('No high-rated open risks to analyze.');
            return;
        }
        setError('');
        setIsAutoLoading(true);
        setManualIdeas([]);
        try {
            const suggestions = await analyzeControls(highRisks, activeProject || activeProgramme, projectInfo);
            setSuggestedControls(suggestions);
        } catch (err: any) {
            setError(err.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setIsAutoLoading(false);
        }
    };

    const runManualAnalysis = async () => {
        if (!manualSentence.trim()) return;
        setError('');
        setIsManualLoading(true);
        setSuggestedControls([]);
        try {
            const ideas = await analyzeContextSentence(manualSentence, 'risk');
            setManualIdeas(ideas);
        } catch (err: any) {
            setError(err.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setIsManualLoading(false);
        }
    };

    const addControl = (riskId: string, suggestion: string) => {
        if (isMitigationValidationBlocked) {
            toast.error('Please fact-check & validate the mitigation strategy before adding controls.');
            return;
        }
        const risk = risks.find(r => r.id === riskId);
        if (!risk) return;
        const newControls = risk.controls && risk.controls !== 'None'
            ? `${risk.controls}\n- ${suggestion}`
            : `- ${suggestion}`;
        // Optimistically prune the suggestion from the local panel — the store
        // rolls the risk back on failure, and the toast surfaces the error.
        setSuggestedControls(prev =>
            prev.map(sc =>
                sc.riskId === riskId
                    ? { ...sc, suggestions: sc.suggestions.filter((s: string) => s !== suggestion) }
                    : sc
            ).filter(sc => sc.suggestions.length > 0)
        );
        updateRisk(riskId, { controls: newControls }).then(
            () => toast.success('Control added.'),
            (err: any) => {
                toast.error(err?.message || 'Failed to add control.');
            },
        );
    };

    return (
        <div className="space-y-6 sm:space-y-8">

            <PageHeader
                breadcrumbs={[{ label: "Automated Intelligence" }, { label: "Mitigation & Control Strategy" }]}
                title="Mitigation & Control Strategy"
                subtitle="Generate industrial-grade mitigation strategies for your project risk profile."
                actions={
                    <div className="flex items-center gap-2">
                        {mitigationCtxId && suggestedControls.length > 0 && (
                            <ValidateButton
                                surface="mitigation"
                                targetId={mitigationValidationTargetId}
                                contextId={mitigationCtxId}
                                label="Mitigation & control strategy"
                                content={mitigationContentStr}
                            />
                        )}
                        <AnimatePresence>
                        {highRisks.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.75 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.75 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                                className="flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full bg-red-50 border border-red-200"
                            >
                                <span className="relative flex h-1.5 w-1.5">
                                    <motion.span
                                        animate={{ scale: [1, 1.9, 1], opacity: [0.55, 0.05, 0.55] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                        className="absolute inline-flex h-full w-full rounded-full bg-red-400"
                                    />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                                </span>
                                <span className="text-[11px] font-mono font-medium text-red-700 uppercase tracking-wide tabular-nums">
                                    {highRisks.length} high-risk open
                                </span>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>
                }
            />

            <div className="space-y-6">

                {/* ── Analysis Modules ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Manual Idea Generator */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center ring-1 ring-inset ring-indigo-100">
                                    <Search className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-800">AI Idea Generator</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Context-driven mitigation generation</p>
                                </div>
                            </div>
                            <span className="hidden sm:inline-block text-[9px] font-mono font-medium uppercase tracking-wide text-slate-300 border border-slate-200 rounded-md px-2 py-1 select-none">
                                Manual
                            </span>
                        </div>

                        <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Describe a specific concern or situation to generate targeted mitigation controls for this portfolio.
                            </p>

                            {/* Textarea with animated focus line */}
                            <div className={clsx(
                                "relative rounded-lg overflow-hidden transition-all duration-200",
                                isFocused ? "ring-2 ring-indigo-400" : "ring-1 ring-slate-200"
                            )}>
                                <textarea
                                    value={manualSentence}
                                    onChange={(e) => setManualSentence(e.target.value)}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder="e.g. We are concerned about potential delays in the S20 consultation process for the Bermondsey Estate..."
                                    className="w-full h-28 px-4 py-3.5 bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none transition-colors duration-200 leading-relaxed"
                                />
                                <AnimatePresence>
                                    {isFocused && (
                                        <motion.div
                                            initial={{ scaleX: 0, opacity: 0 }}
                                            animate={{ scaleX: 1, opacity: 1 }}
                                            exit={{ scaleX: 0, opacity: 0 }}
                                            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                            style={{ originX: 0 }}
                                            className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500"
                                        />
                                    )}
                                </AnimatePresence>
                                <div className="absolute bottom-3 right-3 pointer-events-none">
                                    <motion.span
                                        animate={{ color: manualSentence.length > 0 ? '#94a3b8' : '#cbd5e1' }}
                                        transition={{ duration: 0.2 }}
                                        className="text-[10px] font-semibold tabular-nums"
                                    >
                                        {manualSentence.length}
                                    </motion.span>
                                </div>
                            </div>

                            <motion.button
                                onClick={runManualAnalysis}
                                disabled={isManualLoading || !manualSentence.trim()}
                                whileHover={!isManualLoading && !!manualSentence.trim() ? { scale: 1.008, boxShadow: '0 8px 28px rgba(79,70,229,0.28)' } : {}}
                                whileTap={!isManualLoading && !!manualSentence.trim() ? { scale: 0.985 } : {}}
                                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                                className={clsx(
                                    "mt-auto w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-medium rounded-lg select-none transition-colors duration-200",
                                    isManualLoading || !manualSentence.trim()
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                                )}
                            >
                                {isManualLoading ? (
                                    <>
                                        <motion.span
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full shrink-0 inline-block"
                                        />
                                        Processing…
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="w-4 h-4 shrink-0" />
                                        Generate Mitigation Ideas
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </div>

                    {/* Automated Programme Analysis */}
                    <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-700/80 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center ring-1 ring-inset ring-white/10">
                                    <Activity className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-100">Programme Auto-Analysis</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Full portfolio high-risk scan</p>
                                </div>
                            </div>
                            <span className="hidden sm:inline-block text-[9px] font-mono font-medium uppercase tracking-wide text-slate-500 border border-slate-700 rounded-md px-2 py-1 select-none">
                                Auto
                            </span>
                        </div>

                        <div className="p-5 sm:p-6 flex flex-col gap-5 flex-1">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3.5">
                                    <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1.5">Risks Queued</p>
                                    <motion.p
                                        key={highRisks.length}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                        className="text-2xl font-medium text-white tabular-nums leading-none"
                                    >
                                        {highRisks.length}
                                    </motion.p>
                                </div>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3.5">
                                    <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1.5">Score Threshold</p>
                                    <p className="text-2xl font-medium text-amber-400 tabular-nums leading-none">≥ 12</p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed">
                                The system will automatically evaluate{' '}
                                <span className="text-slate-200 font-semibold">{highRisks.length} high-rated open risks</span>{' '}
                                across this portfolio and formulate specific statutory mitigation tactics.
                            </p>

                            <motion.button
                                onClick={runAutomatedAnalysis}
                                disabled={isAutoLoading || highRisks.length === 0}
                                whileHover={!isAutoLoading && highRisks.length > 0 ? { scale: 1.008, boxShadow: '0 8px 28px rgba(99,102,241,0.3)' } : {}}
                                whileTap={!isAutoLoading && highRisks.length > 0 ? { scale: 0.985 } : {}}
                                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                                className={clsx(
                                    "mt-auto w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-medium rounded-lg select-none transition-colors duration-200",
                                    isAutoLoading || highRisks.length === 0
                                        ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                                        : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/20"
                                )}
                            >
                                {isAutoLoading ? (
                                    <>
                                        <motion.span
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                                            className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full shrink-0 inline-block"
                                        />
                                        Analysing…
                                    </>
                                ) : (
                                    <>
                                        <Radar className="w-4 h-4 shrink-0" />
                                        {highRisks.length === 0 ? 'No High Risks to Analyse' : 'Run Full Analysis'}
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </div>

                </div>

                {/* ── Error Banner ────────────────────────────────────── */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            variants={slideUpVariants}
                            initial="hidden" animate="visible" exit="exit"
                            className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
                        >
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-800">Analysis Error</p>
                                <p className="text-sm text-red-600 mt-0.5">{error}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Loading State ───────────────────────────────────── */}
                <AnimatePresence>
                    {(isAutoLoading || isManualLoading) && (
                        <motion.div
                            variants={fadeVariants}
                            initial="hidden" animate="visible" exit="exit"
                            className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="h-[2px] bg-slate-100 overflow-hidden">
                                <motion.div
                                    initial={{ width: '0%' }}
                                    animate={{ width: '90%' }}
                                    transition={{ duration: 3.8, ease: [0.4, 0, 0.2, 1] }}
                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-r-full"
                                />
                            </div>
                            <div className="p-6 flex items-center gap-5">
                                <div className="relative w-12 h-12 shrink-0 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-indigo-500 relative z-10" />
                                    <motion.div
                                        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                                        className="absolute inset-0 rounded-lg border-2 border-indigo-400"
                                    />
                                </div>
                                <div className="flex-1 min-w-0 space-y-3">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Intelligence Engine Active</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Formulating statutory mitigation strategies…</p>
                                    </div>
                                    <div className="space-y-2">
                                        {[1, 0.78, 0.52].map((w, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ opacity: [0.4, 0.9, 0.4] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                                                className="h-2 rounded-full bg-slate-100"
                                                style={{ width: `${w * 100}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Manual Ideas Results ────────────────────────────── */}
                <AnimatePresence>
                    {manualIdeas.length > 0 && (
                        <motion.div
                            variants={fadeVariants}
                            initial="hidden" animate="visible" exit="exit"
                            className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <h3 className="text-sm font-bold text-slate-800">AI Mitigation Ideas</h3>
                                </div>
                                <motion.span
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="inline-flex items-center px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-mono font-medium uppercase tracking-wide rounded-full tabular-nums"
                                >
                                    {manualIdeas.length} strategies
                                </motion.span>
                            </div>

                            <div className="p-5 sm:p-6">
                                <motion.div
                                    variants={listVariants}
                                    initial="hidden" animate="visible"
                                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                >
                                    {manualIdeas.map((idea, idx) => (
                                        <motion.div
                                            key={idx}
                                            variants={itemVariants}
                                            whileHover={{ borderColor: '#a5b4fc' }}
                                            className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow duration-200"
                                        >
                                            <div className="flex items-stretch">
                                                <div className="w-10 shrink-0 bg-slate-50 border-r border-slate-100 flex flex-col items-center pt-3.5 gap-1">
                                                    <span className="text-[11px] font-mono font-medium text-slate-300 tabular-nums leading-none">
                                                        {String(idx + 1).padStart(2, '0')}
                                                    </span>
                                                    <div className="mt-2 w-px flex-1 max-h-6 rounded-full bg-slate-200" />
                                                </div>
                                                <div className="flex-1 min-w-0 p-4 space-y-1">
                                                    <span className="text-[10px] font-mono font-medium text-indigo-500 uppercase tracking-wide block mb-2">
                                                        Strategy {String(idx + 1).padStart(2, '0')}
                                                    </span>
                                                    <div className="divide-y divide-slate-100">
                                                        {parseAISuggestion(idea).map((part, pIdx) => (
                                                            <div key={pIdx} className={clsx(
                                                                "flex gap-3 items-baseline",
                                                                part.label ? "py-2.5 first:pt-0 last:pb-0" : "pt-0"
                                                            )}>
                                                                {part.label && (
                                                                    <span className="shrink-0 w-12 text-[9px] font-mono font-medium text-indigo-400 uppercase tracking-wide pt-0.5">
                                                                        {part.label}
                                                                    </span>
                                                                )}
                                                                <p className="flex-1 text-sm text-slate-700 leading-relaxed min-w-0">
                                                                    {stripMarkdown(part.content)}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>

                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <p className="text-xs text-slate-400">
                                        These strategies can be used to update existing risks in the Risk Register.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Automated Results ───────────────────────────────── */}
                <AnimatePresence>
                    {suggestedControls.length > 0 && (
                        <motion.div
                            variants={fadeVariants}
                            initial="hidden" animate="visible" exit="exit"
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-2.5 px-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                <h3 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide">Automated Results</h3>
                                <motion.span
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-mono font-medium uppercase tracking-wide rounded-full tabular-nums"
                                >
                                    {suggestedControls.length} risks
                                </motion.span>
                            </div>

                            <motion.div
                                variants={listVariants}
                                initial="hidden" animate="visible"
                                className="space-y-4"
                            >
                                {suggestedControls.map((item, i) => {
                                    const riskDoc = risks.find(r => r.id === item.riskId);
                                    if (!riskDoc) return null;
                                    const rating = riskDoc.residualRating || 0;

                                    return (
                                        <motion.div
                                            key={i}
                                            variants={itemVariants}
                                            className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
                                        >
                                            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className={clsx(
                                                        'w-2 h-2 rounded-full shrink-0',
                                                        rating >= 16 ? 'bg-red-500' : 'bg-amber-500'
                                                    )} />
                                                    <span className="text-sm font-bold text-slate-800 truncate">{riskDoc.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide">Residual</span>
                                                    <span className={clsx(
                                                        'px-2 py-0.5 text-xs font-mono font-medium rounded-full border tabular-nums',
                                                        rating >= 16
                                                            ? 'bg-red-50 border-red-200 text-red-700'
                                                            : 'bg-amber-50 border-amber-200 text-amber-700'
                                                    )}>
                                                        {rating}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-5">
                                                <motion.div
                                                    variants={listVariants}
                                                    initial="hidden" animate="visible"
                                                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                                                >
                                                    {item.suggestions.map((s: string, j: number) => (
                                                        <motion.div
                                                            key={j}
                                                            variants={itemVariants}
                                                            whileHover={{ borderColor: '#a5b4fc', backgroundColor: 'rgba(238,242,255,0.4)' }}
                                                            className="group relative border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200"
                                                        >
                                                            <div className="pr-8 divide-y divide-slate-100">
                                                                {parseAISuggestion(s).map((part, pIdx) => (
                                                                    <div key={pIdx} className={clsx(
                                                                        "flex gap-3 items-baseline",
                                                                        part.label ? "py-2 first:pt-0 last:pb-0" : "pt-0"
                                                                    )}>
                                                                        {part.label && (
                                                                            <span className="font-mono shrink-0 w-12 text-[9px] font-semibold text-indigo-400 uppercase tracking-wide pt-0.5">
                                                                                {part.label}
                                                                            </span>
                                                                        )}
                                                                        <p className="flex-1 text-xs font-medium text-slate-700 leading-relaxed min-w-0">
                                                                            {stripMarkdown(part.content)}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <motion.button
                                                                onClick={() => addControl(item.riskId, s)}
                                                                disabled={isRiskPending(item.riskId) || isMitigationValidationBlocked}
                                                                title="Add to risk"
                                                                initial={{ opacity: 0 }}
                                                                whileHover={{ scale: 1.1, backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#ffffff' }}
                                                                whileTap={{ scale: 0.9 }}
                                                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                                                className="absolute top-3.5 right-3.5 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </motion.button>
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}
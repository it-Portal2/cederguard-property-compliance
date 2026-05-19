import { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  Briefcase,
  FileSearch,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  FileCheck,
  Plus,
  Activity,
  Layers,
} from "lucide-react";
import { analyzeContextSentence } from "../services/aiService";
import { useStore } from "../store/useStore";
import { clsx } from "clsx";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────
interface ComplianceSuggestion {
  req:    string;
  reg:    string;
  domain: string;
  who:    string;
  when:   string;
  how:    string;
  risk:   "Low" | "Medium" | "High" | "Critical";
  stage:  "Information Gap" | "Risk Identified" | "In Progress";
  status: "applicable";
}

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

// ── Component ─────────────────────────────────────────────────────
export function AIComplianceOutlook() {
  const {
    addComplianceItem,
    activeProjectId,
    activeProgrammeId,
    activeProject,
    activeProgramme,
  } = useStore();

  const [loading,      setLoading]      = useState(false);
  const [sentence,     setSentence]     = useState("");
  const [suggestions,  setSuggestions]  = useState<ComplianceSuggestion[]>([]);
  const [error,        setError]        = useState("");
  const [isFocused,    setIsFocused]    = useState(false);
  const [addedIndices,  setAddedIndices]  = useState<Set<number>>(new Set());
  const [addingIndex,   setAddingIndex]   = useState<number | null>(null);
  const [addingAll,     setAddingAll]     = useState(false);

  const contextName = activeProject?.name || activeProgramme?.name || null;
  const hasContext  = !!(activeProjectId || activeProgrammeId);

  const runAnalysis = async () => {
    if (!sentence.trim()) return;
    setError("");
    setLoading(true);
    setSuggestions([]);
    setAddedIndices(new Set());

    try {
      const ideas = await analyzeContextSentence(sentence, "compliance");
      setSuggestions(ideas as ComplianceSuggestion[]);
    } catch (err: any) {
      setError(err.message || "Failed to generate AI insights. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addOne = async (idx: number) => {
    if (addedIndices.has(idx) || addingIndex !== null || addingAll || !hasContext) return;
    const item = suggestions[idx];
    setAddingIndex(idx);
    try {
      await addComplianceItem({
        req:         item.req,
        reg:         item.reg,
        domain:      item.domain,
        who:         item.who,
        risk:        item.risk,
        stage:       item.stage,
        status:      item.status,
        projectId:   activeProjectId   || undefined,
        programmeId: activeProgrammeId || undefined,
      });
      setAddedIndices(prev => new Set(prev).add(idx));
      toast.success("Added to compliance tracker");
    } catch {
      toast.error("Failed to add. Please try again.");
    } finally {
      setAddingIndex(null);
    }
  };

  const addAll = async () => {
    if (!hasContext || addingAll) return;
    const remaining = suggestions
      .map((_, i) => i)
      .filter(i => !addedIndices.has(i));
    if (remaining.length === 0) return;
    setAddingAll(true);
    try {
      for (const idx of remaining) {
        const item = suggestions[idx];
        await addComplianceItem({
          req:         item.req,
          reg:         item.reg,
          domain:      item.domain,
          who:         item.who,
          risk:        item.risk,
          stage:       item.stage,
          status:      item.status,
          projectId:   activeProjectId   || undefined,
          programmeId: activeProgrammeId || undefined,
        });
        setAddedIndices(prev => new Set(prev).add(idx));
      }
      toast.success(`${remaining.length} requirement${remaining.length > 1 ? 's' : ''} added to tracker`);
    } catch {
      toast.error("Some items failed to add. Please try again.");
    } finally {
      setAddingAll(false);
    }
  };

  const remainingCount = suggestions.filter((_, i) => !addedIndices.has(i)).length;

  return (
    <div>
      {/* ── Sticky Header ──────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/70 sticky top-0 z-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center shadow-sm shadow-indigo-600/30">
              <Briefcase className="w-3.5 h-3.5 text-white" />
            </div>
            <nav className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-slate-400 hidden sm:block">Compliance</span>
              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0 hidden sm:block" />
              <span className="text-xs font-semibold text-slate-700 truncate">Posture Outlook</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Context badge */}
            {contextName ? (
              <div className="hidden sm:flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                <Layers className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="text-[11px] font-bold text-indigo-700 truncate max-w-[160px]">
                  {contextName}
                </span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="text-[11px] font-bold text-amber-700">No project selected</span>
              </div>
            )}

            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.75 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full bg-emerald-50 border border-emerald-200"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <motion.span
                      animate={{ scale: [1, 1.9, 1], opacity: [0.55, 0.05, 0.55] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
                    />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 tabular-nums">
                    {suggestions.length} items
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ── Page Body ──────────────────────────────────────────── */}
      <div className="max-w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1 pb-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Compliance Posture Outlook</h1>
          <p className="text-sm text-slate-500">
            Generate statutory compliance requirements from natural language project descriptions.
          </p>
        </div>

        {/* ── Input Card ──────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center ring-1 ring-inset ring-indigo-100">
                <FileSearch className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Automated Compliance Identifier</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Natural language → statutory framework mapping</p>
              </div>
            </div>
            <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-widest text-slate-300 border border-slate-200 rounded-md px-2 py-1 select-none">
              NLP Engine
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Describe a project or programme in plain language to identify applicable statutory requirements.
            </p>

            <div className={clsx(
              "relative rounded-lg overflow-hidden transition-all duration-200",
              isFocused ? "ring-2 ring-indigo-400" : "ring-1 ring-slate-200",
            )}>
              <textarea
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="e.g. We are planning a major building safety retrofit for Bermondsey Estate including fire door replacements..."
                className="w-full h-32 px-4 py-3.5 bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none transition-colors duration-200 leading-relaxed"
              />
              <AnimatePresence>
                {isFocused && (
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    exit={{ scaleX: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    style={{ originX: 0 }}
                    className="absolute bottom-0 inset-x-0 h-[2px] bg-linear-to-r from-indigo-500 via-violet-400 to-indigo-500"
                  />
                )}
              </AnimatePresence>
              <div className="absolute bottom-3 right-3 pointer-events-none">
                <motion.span
                  animate={{ color: sentence.length > 0 ? "#94a3b8" : "#cbd5e1" }}
                  transition={{ duration: 0.2 }}
                  className="text-[10px] font-semibold tabular-nums"
                >
                  {sentence.length}
                </motion.span>
              </div>
            </div>

            <motion.button
              onClick={runAnalysis}
              disabled={loading || !sentence.trim()}
              whileHover={!loading && !!sentence.trim() ? { scale: 1.008, boxShadow: "0 8px 28px rgba(79,70,229,0.28)" } : {}}
              whileTap={!loading && !!sentence.trim() ? { scale: 0.985 } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className={clsx(
                "w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-bold rounded-lg select-none transition-colors duration-200",
                loading || !sentence.trim()
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20",
              )}
            >
              {loading ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full shrink-0 inline-block"
                  />
                  Analysing Regulatory Frameworks…
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  Generate Compliance Outlook
                </>
              )}
            </motion.button>
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
                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading State ───────────────────────────────────── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              variants={fadeVariants}
              initial="hidden" animate="visible" exit="exit"
              className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="h-[2px] bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "90%" }}
                  transition={{ duration: 3.8, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-r-full"
                />
              </div>
              <div className="p-6 flex items-center gap-5">
                <div className="relative w-12 h-12 shrink-0 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-indigo-500 relative z-10" />
                  <motion.div
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-lg border-2 border-indigo-400"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Compliance Identifier Engine</p>
                    <p className="text-xs text-slate-400 mt-0.5">Mapping statutory instruments to project scope…</p>
                  </div>
                  <div className="space-y-2">
                    {[1, 0.78, 0.52].map((w, i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.4, 0.9, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
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

        {/* ── Results ─────────────────────────────────────────── */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              variants={fadeVariants}
              initial="hidden" animate="visible" exit="exit"
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Identified Compliance Requirements
                </span>
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="ml-auto inline-flex items-center px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-full tabular-nums"
                >
                  {suggestions.length} items
                </motion.span>
              </div>

              {/* Suggestion cards */}
              <motion.div
                variants={listVariants}
                initial="hidden" animate="visible"
                className="space-y-3"
              >
                {suggestions.map((item, idx) => {
                  const isAdded = addedIndices.has(idx);
                  return (
                    <motion.div
                      key={idx}
                      variants={itemVariants}
                      whileHover={!isAdded ? { borderColor: "#6ee7b7" } : {}}
                      className={clsx(
                        "group bg-white rounded-lg border overflow-hidden transition-shadow duration-300",
                        isAdded ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 hover:shadow-md"
                      )}
                    >
                      <div className="flex items-stretch">
                        {/* Left index strip */}
                        <div className={clsx(
                          "w-11 shrink-0 border-r flex flex-col items-center justify-start pt-4 gap-1 transition-colors duration-300",
                          isAdded
                            ? "bg-emerald-50 border-emerald-100"
                            : "bg-slate-50 border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100"
                        )}>
                          <span className={clsx(
                            "text-[11px] font-black tabular-nums leading-none transition-colors duration-300",
                            isAdded ? "text-emerald-500" : "text-slate-300 group-hover:text-emerald-500"
                          )}>
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className={clsx(
                            "mt-2 w-px flex-1 max-h-8 rounded-full transition-colors duration-300",
                            isAdded ? "bg-emerald-200" : "bg-slate-200 group-hover:bg-emerald-200"
                          )} />
                        </div>

                        {/* Card content */}
                        <div className="flex-1 min-w-0 px-4 py-4">
                          {/* Header row: reg badge + add button */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CheckCircle2 className={clsx(
                                "w-3.5 h-3.5 shrink-0 transition-colors duration-300",
                                isAdded ? "text-emerald-500" : "text-slate-300 group-hover:text-emerald-500"
                              )} />
                              {item.reg && (
                                <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md uppercase tracking-widest">
                                  {item.reg}
                                </span>
                              )}
                            </div>
                            {isAdded ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> Added
                              </span>
                            ) : addingIndex === idx ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg shrink-0">
                                <motion.span
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                  className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full shrink-0 inline-block"
                                />
                                Adding…
                              </span>
                            ) : (
                              <button
                                onClick={() => addOne(idx)}
                                disabled={!hasContext || addingIndex !== null || addingAll}
                                title={hasContext ? "Add to compliance tracker" : "Select a project or programme first"}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-lg shrink-0 transition-colors shadow-sm shadow-indigo-200"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            )}
                          </div>

                          {/* Requirement text */}
                          <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-3">
                            {item.req}
                          </p>

                          {/* Who / When / How rows */}
                          <div className="divide-y divide-slate-100">
                            {[
                              { label: "WHO",  value: item.who  },
                              { label: "WHEN", value: item.when },
                              { label: "HOW",  value: item.how  },
                            ].map(({ label, value }) => value ? (
                              <div key={label} className="flex gap-4 py-2 first:pt-0 last:pb-0 items-baseline">
                                <span className="shrink-0 w-10 text-[9px] font-black text-indigo-400 uppercase tracking-widest pt-0.5">
                                  {label}
                                </span>
                                <p className="flex-1 text-xs text-slate-600 leading-relaxed min-w-0">{value}</p>
                              </div>
                            ) : null)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* ── Bottom CTA strip ──────────────────────────── */}
              <motion.div
                variants={itemVariants}
                className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden"
                whileHover={{ borderColor: "#475569" }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center shrink-0">
                      <FileCheck className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Integrate with Compliance Tracker</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">
                        {hasContext
                          ? contextName
                            ? `Adding to: ${contextName}`
                            : "Add to active context"
                          : "Select a project or programme first"}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    onClick={addAll}
                    disabled={!hasContext || addingAll || remainingCount === 0}
                    whileHover={hasContext && remainingCount > 0 ? { scale: 1.03, backgroundColor: "#f1f5f9" } : {}}
                    whileTap={hasContext && remainingCount > 0 ? { scale: 0.97 } : {}}
                    transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 text-xs font-bold rounded-lg shrink-0 uppercase tracking-widest shadow-sm transition-colors"
                  >
                    {addingAll ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                          className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-700 rounded-full shrink-0 inline-block"
                        />
                        Adding…
                      </>
                    ) : remainingCount === 0 ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> All Added</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Add All ({remainingCount})</>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

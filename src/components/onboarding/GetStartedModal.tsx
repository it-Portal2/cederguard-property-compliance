// OB-1 — First-login Get Started modal.
//
// Modern SaaS onboarding moment styled after Linear / Notion / Stripe
// onboarding flows. Hero region carries a layered cityscape SVG over a
// deep indigo→violet gradient (CedarGuard's property/built-environment
// context). Step list uses arrow-indicator cards with hover lift.
// All buttons use rounded-lg corners.
//
// Mounts inside Dashboard on first login. Dismissal flips
// `userPreferences.hasSeenOnboardingModal: true` via the existing
// savePreference API — never shown again.

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import type { OnboardingStep } from "./onboardingSteps";

interface GetStartedModalProps {
  open: boolean;
  steps: OnboardingStep[];
  /** Optional first-name shown in the headline ("Welcome, Sarah"). */
  userName?: string | null;
  /** Called when the user dismisses. `navigate=true` when they clicked
   *  the primary "Get Started" CTA — caller should route to steps[0].href. */
  onDismiss: (navigate: boolean) => void;
}

const HEADLINE_ID = "onboarding-title";

// Cityscape SVG. Layered building silhouettes — front layer in white at
// 18% opacity, back layer at 10%. Sized to fill 100% width of the hero
// and anchored to the bottom. Buildings include towers + a low-rise
// + a couple of cranes (CedarGuard is property-management).
function CitySkyline() {
  return (
    <svg
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="1200" height="320" fill="url(#skyfade)" />

      {/* Back layer — distant towers, lower opacity */}
      <g fill="white" opacity="0.12">
        <rect x="40" y="180" width="60" height="140" />
        <rect x="120" y="150" width="80" height="170" />
        <rect x="220" y="200" width="50" height="120" />
        <rect x="290" y="120" width="100" height="200" />
        <rect x="410" y="170" width="70" height="150" />
        <rect x="500" y="140" width="90" height="180" />
        <rect x="610" y="180" width="55" height="140" />
        <rect x="685" y="100" width="110" height="220" />
        <rect x="815" y="160" width="70" height="160" />
        <rect x="905" y="190" width="60" height="130" />
        <rect x="985" y="140" width="95" height="180" />
        <rect x="1100" y="175" width="70" height="145" />
      </g>

      {/* Front layer — closer buildings, higher opacity, with windows */}
      <g fill="white" opacity="0.22">
        <rect x="10" y="220" width="55" height="100" />
        <rect x="80" y="180" width="70" height="140" />
        <rect x="170" y="200" width="50" height="120" />
        <rect x="240" y="160" width="90" height="160" />
        <rect x="350" y="190" width="65" height="130" />
        <rect x="430" y="150" width="80" height="170" />
        <rect x="525" y="195" width="55" height="125" />
        <rect x="595" y="170" width="100" height="150" />
        <rect x="710" y="200" width="60" height="120" />
        <rect x="785" y="155" width="85" height="165" />
        <rect x="885" y="195" width="60" height="125" />
        <rect x="960" y="175" width="75" height="145" />
        <rect x="1050" y="200" width="65" height="120" />
        <rect x="1130" y="180" width="55" height="140" />
      </g>

      {/* Window dots — small accent on a few of the front buildings */}
      <g fill="white" opacity="0.45">
        {/* On 240,160 - 90x160 building */}
        <rect x="252" y="180" width="6" height="6" />
        <rect x="270" y="180" width="6" height="6" />
        <rect x="288" y="180" width="6" height="6" />
        <rect x="306" y="180" width="6" height="6" />
        <rect x="252" y="200" width="6" height="6" />
        <rect x="270" y="200" width="6" height="6" />
        <rect x="288" y="200" width="6" height="6" />
        <rect x="252" y="220" width="6" height="6" />
        <rect x="288" y="220" width="6" height="6" />
        {/* On 595,170 - 100x150 building */}
        <rect x="610" y="190" width="6" height="6" />
        <rect x="630" y="190" width="6" height="6" />
        <rect x="650" y="190" width="6" height="6" />
        <rect x="670" y="190" width="6" height="6" />
        <rect x="610" y="210" width="6" height="6" />
        <rect x="650" y="210" width="6" height="6" />
        <rect x="670" y="210" width="6" height="6" />
        <rect x="610" y="230" width="6" height="6" />
        <rect x="630" y="230" width="6" height="6" />
        {/* On 785,155 - 85x165 building */}
        <rect x="800" y="175" width="6" height="6" />
        <rect x="820" y="175" width="6" height="6" />
        <rect x="840" y="175" width="6" height="6" />
        <rect x="800" y="195" width="6" height="6" />
        <rect x="820" y="195" width="6" height="6" />
        <rect x="840" y="195" width="6" height="6" />
        <rect x="800" y="215" width="6" height="6" />
        <rect x="840" y="215" width="6" height="6" />
      </g>

      {/* Crane — building activity hint */}
      <g
        stroke="white"
        strokeWidth="1.5"
        opacity="0.45"
        fill="none"
        strokeLinecap="round"
      >
        <line x1="332" y1="90" x2="332" y2="160" />
        <line x1="290" y1="100" x2="380" y2="100" />
        <line x1="290" y1="100" x2="332" y2="90" />
        <line x1="380" y1="100" x2="332" y2="90" />
        <line x1="305" y1="100" x2="305" y2="115" />
      </g>
      <g
        stroke="white"
        strokeWidth="1.5"
        opacity="0.45"
        fill="none"
        strokeLinecap="round"
      >
        <line x1="745" y1="120" x2="745" y2="170" />
        <line x1="710" y1="128" x2="785" y2="128" />
        <line x1="710" y1="128" x2="745" y2="120" />
        <line x1="785" y1="128" x2="745" y2="120" />
        <line x1="725" y1="128" x2="725" y2="143" />
      </g>
    </svg>
  );
}

export function GetStartedModal({
  open,
  steps,
  userName,
  onDismiss,
}: GetStartedModalProps) {
  // ESC key dismisses (treats as Later — no nav).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const trimmedName =
    typeof userName === "string" && userName.trim()
      ? userName.trim().split(/\s+/)[0]
      : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-200 bg-slate-950/75 backdrop-blur-md"
            aria-hidden="true"
            onClick={() => onDismiss(false)}
          />

          {/* Card wrapper — centred, scrollable on small screens */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={HEADLINE_ID}
            className="fixed inset-0 z-201 flex items-start justify-center overflow-y-auto px-4 py-6 sm:items-center sm:py-10"
            onClick={(e) => {
              if (e.target === e.currentTarget) onDismiss(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              className="relative w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.5)] ring-1 ring-slate-900/5 sm:max-w-xl"
            >
              {/* Close button (treats as Later) */}
              <button
                type="button"
                onClick={() => onDismiss(false)}
                aria-label="Close onboarding"
                className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/60 backdrop-blur transition-all hover:bg-white hover:text-slate-900 hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>

              {/* Hero — gradient + cityscape */}
              <div className="relative h-44 overflow-hidden bg-linear-to-br from-indigo-700 via-violet-600 to-fuchsia-600 sm:h-52">
                {/* Subtle radial light from top-left */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 55%)",
                  }}
                />

                {/* Slow drifting glow blob — adds life without distraction */}
                <motion.div
                  className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/15 blur-3xl"
                  animate={{
                    scale: [1, 1.12, 1],
                    opacity: [0.25, 0.4, 0.25],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  className="absolute -left-12 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-fuchsia-300/20 blur-3xl"
                  animate={{
                    scale: [1, 1.18, 1],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.5,
                  }}
                />

                {/* Cityscape SVG anchored to bottom */}
                <CitySkyline />

                {/* Bottom fade so the skyline blends into the white card */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-black/10" />

                {/* Welcome pill — top-centred */}
                <div className="relative z-10 flex h-full flex-col items-center justify-start pt-7 sm:pt-8">
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="inline-flex items-center rounded-lg bg-white/95 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 shadow-lg shadow-indigo-950/30 ring-1 ring-white/40 backdrop-blur"
                  >
                    Welcome to CedarGuard
                  </motion.div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-7">
                <motion.h2
                  id={HEADLINE_ID}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.3 }}
                  className="text-center text-xl font-bold tracking-tight text-slate-900 sm:text-[22px]"
                >
                  {trimmedName
                    ? `Let's get you set up, ${trimmedName}`
                    : "Let's get your workspace set up"}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="mx-auto mt-1.5 max-w-md text-center text-[13px] leading-relaxed text-slate-500"
                >
                  Follow these {steps.length} steps to start managing risks,
                  compliance and governance across your portfolio.
                </motion.p>

                {/* Step list */}
                <ol className="mt-5 space-y-2">
                  {steps.map((step, index) => (
                    <motion.li
                      key={step.key}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.15 + index * 0.05,
                        duration: 0.25,
                      }}
                      className={clsx(
                        "group relative flex items-center gap-3 overflow-hidden rounded-lg border bg-white p-3 transition-all duration-200",
                        index === 0
                          ? "border-indigo-200 bg-linear-to-r from-indigo-50/80 to-white shadow-sm shadow-indigo-100/60"
                          : "border-slate-200/60 hover:border-indigo-200 hover:shadow-sm",
                      )}
                    >
                      {/* Step number badge */}
                      <span
                        className={clsx(
                          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                          index === 0
                            ? "bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                            : "bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700",
                        )}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <step.icon
                            className={clsx(
                              "h-3.5 w-3.5 shrink-0 transition-colors",
                              index === 0
                                ? "text-indigo-600"
                                : "text-slate-500 group-hover:text-indigo-500",
                            )}
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                          <p className="truncate text-[13px] font-semibold text-slate-900">
                            {step.title}
                          </p>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
                          {step.description}
                        </p>
                      </div>

                      {/* Arrow indicator (only on the active first step) */}
                      {index === 0 && (
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-indigo-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                      )}
                    </motion.li>
                  ))}
                </ol>

                {/* Footer actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: 0.15 + steps.length * 0.05,
                    duration: 0.25,
                  }}
                  className="mt-6 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end"
                >
                  <button
                    type="button"
                    onClick={() => onDismiss(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(true)}
                    autoFocus
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-linear-to-br from-slate-900 to-slate-800 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 transition-all hover:from-slate-800 hover:to-slate-700 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
                  >
                    Get started
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

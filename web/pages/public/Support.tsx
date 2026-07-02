import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  BookOpen,
  Code2,
  MessageSquare,
  Search,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { WordPullUp } from "../../components/public/WordPullUp";

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const HEADLINE_WORDS: Array<{ word: string; gradient?: boolean }> = [
  { word: "How" },
  { word: "can" },
  { word: "we" },
  { word: "help?", gradient: true },
];

const DESCRIPTION_DELAY_S = 0.35 + HEADLINE_WORDS.length * 0.12 + 0.4;
const SEARCH_DELAY_S = DESCRIPTION_DELAY_S + 0.25;
const SUGGESTED_DELAY_S = SEARCH_DELAY_S + 0.2;
const CARDS_START_DELAY_S = SUGGESTED_DELAY_S + 0.35;
const CARD_STAGGER_S = 0.16;
const CARD_SLIDE_DURATION_S = 0.75;

const CARD_CLASS =
  'group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[oklch(0.91_0.006_270)] bg-white p-7 transition-[transform,border-color,box-shadow,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:scale-[1.01] hover:border-[oklch(0.62_0.24_278_/_0.45)] hover:shadow-[0_0_0_1px_oklch(0.62_0.24_278_/_0.20),0_20px_40px_-16px_oklch(0.62_0.24_278_/_0.30),0_0_60px_-10px_oklch(0.62_0.24_278_/_0.22)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(60%_80%_at_50%_0%,oklch(0.62_0.24_278_/_0.14),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-[320ms] before:content-[""] hover:before:opacity-100 dark:border-white/10 dark:bg-white/3';

const supportCards: Array<{
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  to: string;
}> = [
  {
    icon: BookOpen,
    eyebrow: "Guides",
    title: "Documentation",
    description:
      "Comprehensive guides and tutorials to help you get the most out of Cedar Risk. Role-based walkthroughs for Client Admins, Senior PMs, PMs, and Coordinators.",
    cta: "Read docs",
    to: "/help",
  },
  {
    icon: Code2,
    eyebrow: "Developers",
    title: "API Reference",
    description:
      "Detailed API documentation for developers integrating with CedarGuard. RPC endpoints, authentication, RBAC scopes, and copy-ready cURL examples.",
    cta: "View API",
    to: "/api-docs",
  },
  {
    icon: MessageSquare,
    eyebrow: "Talk to humans",
    title: "Technical Support",
    description:
      "Need help with something specific? Our support team replies within one working day to every message — email, phone, or in-app.",
    cta: "Contact us",
    to: "/contact",
  },
];

const suggestedSearches: Array<{ label: string; to: string }> = [
  { label: "create a project", to: "/help" },
  { label: "authentication", to: "/api-docs#authentication" },
  { label: "invite users", to: "/help" },
  { label: "RBAC roles", to: "/api-docs#rbac" },
  { label: "AI risk inquiry", to: "/help" },
];

const popularGuides: Array<{ label: string; to: string }> = [
  { label: "Creating a new project — budget, units, funding streams", to: "/help" },
  { label: "Inviting & managing users — roles, permissions, magic links", to: "/help" },
  { label: "Using AI Risk Inquiry to surface risks automatically", to: "/help" },
  { label: "Configuring the Regulation Library for your organisation", to: "/help" },
  { label: "Generating Executive & Programme Reports", to: "/help" },
  {
    label: "API authentication & generating your first API key",
    to: "/api-docs#authentication",
  },
];

const statusRows = [
  "Platform API",
  "AI inference",
  "Authentication (SSO)",
  "Reporting & exports",
  "Regulation sync",
];

export const Support: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate("/help");
  };

  return (
    <div
      className="relative overflow-hidden bg-white font-sans dark:bg-[#030303]"
      style={
        {
          "--accent": "oklch(0.62 0.24 278)",
          "--accent-hot": "oklch(0.70 0.26 280)",
        } as React.CSSProperties
      }
    >
      {/* Hero backdrop — masked accent grid (exact tokens) + radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-130"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          WebkitMaskImage:
            "radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)",
          maskImage:
            "radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-80px] h-[540px] w-[1200px] max-w-none -translate-x-1/2"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 30%, oklch(0.62 0.24 278 / 0.18), transparent 65%), radial-gradient(45% 40% at 30% 25%, oklch(0.68 0.24 248 / 0.12), transparent 70%)",
          filter: "blur(2px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-28 sm:pt-24">
        {/* Hero header */}
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
            Support · Documentation · API
          </motion.span>

          <WordPullUp
            words={HEADLINE_WORDS}
            className="mt-[22px] text-[clamp(30px,5.4vw,60px)] font-medium leading-[1.02] tracking-[-0.035em] text-[oklch(0.20_0.012_270)] md:whitespace-nowrap dark:text-white"
          />

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: DESCRIPTION_DELAY_S, ease: EASE }}
            className="mx-auto mt-4 max-w-[600px] text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400"
          >
            Search help articles, guides, and documentation — or jump straight
            to the developer reference.
          </motion.p>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: SEARCH_DELAY_S, ease: EASE }}
            className="relative mx-auto mt-8 max-w-[600px]"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="flex h-14 items-center gap-3 rounded-xl border border-[oklch(0.91_0.006_270)] bg-white pr-2 pl-5 shadow-[0_8px_24px_-16px_oklch(0_0_0/0.10),0_2px_6px_-2px_oklch(0_0_0/0.04)] transition-[border-color,box-shadow] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_oklch(0.62_0.24_278_/_0.10)] dark:border-white/10 dark:bg-white/5"
            >
              <Search className="h-[18px] w-[18px] shrink-0 text-[oklch(0.50_0.010_270)] dark:text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guides, API endpoints, regulations…"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-[oklch(0.20_0.012_270)] outline-none placeholder:text-[oklch(0.68_0.010_270)] dark:text-white dark:placeholder:text-slate-500"
              />
              <span className="hidden shrink-0 rounded-md border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] px-2 py-1 font-mono text-[10.5px] text-[oklch(0.32_0.012_270)] sm:inline-block dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                ⌘K
              </span>
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[oklch(0.54_0.24_278)] bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-white transition-[background] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--accent-hot)]"
              >
                <span className="hidden sm:inline">Search</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </form>
          </motion.div>

          {/* Suggested searches */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: SUGGESTED_DELAY_S, ease: EASE }}
            className="mt-[18px] flex flex-wrap items-center justify-center gap-1.5 text-[12px] text-[oklch(0.50_0.010_270)]"
          >
            <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-[oklch(0.68_0.010_270)]">
              Try
            </span>
            {suggestedSearches.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="rounded-full border border-[oklch(0.91_0.006_270)] bg-white px-2.5 py-1 font-mono text-[11px] text-[oklch(0.32_0.012_270)] transition-[color,border-color,background] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:border-[oklch(0.62_0.24_278_/_0.30)] hover:bg-[oklch(0.62_0.24_278_/_0.06)] hover:text-[var(--accent)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                {label}
              </Link>
            ))}
          </motion.div>
        </div>

        {/* 3 support cards */}
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {supportCards.map(({ icon: Icon, eyebrow, title, description, cta, to }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: CARD_SLIDE_DURATION_S,
                delay: CARDS_START_DELAY_S + index * CARD_STAGGER_S,
                ease: EASE,
              }}
            >
              <Link to={to} className={CARD_CLASS}>
                <span className="relative z-[1] grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[oklch(0.62_0.24_278_/_0.22)] bg-[oklch(0.62_0.24_278_/_0.10)] text-[var(--accent)] transition-[transform,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.06] group-hover:-rotate-3 group-hover:bg-[oklch(0.62_0.24_278_/_0.18)] dark:text-indigo-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="relative z-[1] mt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                  {eyebrow}
                </span>
                <h3 className="relative z-[1] text-[19px] font-semibold tracking-[-0.02em] text-[oklch(0.20_0.012_270)] dark:text-white">
                  {title}
                </h3>
                <p className="relative z-[1] flex-1 text-[13.5px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                  {description}
                </p>
                <span className="relative z-[1] mt-1.5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--accent)] transition-[gap] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:gap-2.5">
                  {cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Popular guides + status */}
        <div className="mt-14 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: CARD_SLIDE_DURATION_S,
              delay: CARDS_START_DELAY_S + supportCards.length * CARD_STAGGER_S,
              ease: EASE,
            }}
            className="rounded-xl border border-[oklch(0.91_0.006_270)] bg-white p-6 dark:border-white/10 dark:bg-white/3 sm:p-7"
          >
            <h4 className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
              Popular guides
              <span className="h-px flex-1 bg-[oklch(0.91_0.006_270)] dark:bg-white/10" />
            </h4>
            <ul className="flex flex-col gap-0.5">
              {popularGuides.map(({ label, to }, index) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group/item flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13.5px] text-[oklch(0.32_0.012_270)] transition-[background,color,padding] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[oklch(0.98_0.004_270)] hover:pl-3.5 hover:text-[oklch(0.20_0.012_270)] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] font-mono text-[10px] font-semibold text-[oklch(0.50_0.010_270)] transition-[background,border-color,color] duration-[140ms] group-hover/item:border-[oklch(0.62_0.24_278_/_0.30)] group-hover/item:bg-[oklch(0.62_0.24_278_/_0.12)] group-hover/item:text-[var(--accent)] dark:border-white/10 dark:bg-white/5 dark:text-slate-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">{label}</span>
                    <ArrowRight className="ml-auto h-[11px] w-[11px] shrink-0 -translate-x-1 text-[oklch(0.68_0.010_270)] opacity-0 transition-all duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover/item:translate-x-0 group-hover/item:text-[var(--accent)] group-hover/item:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: CARD_SLIDE_DURATION_S,
              delay: CARDS_START_DELAY_S + (supportCards.length + 1) * CARD_STAGGER_S,
              ease: EASE,
            }}
            className="flex flex-col gap-4 rounded-xl border border-[oklch(0.62_0.24_278_/_0.22)] bg-[linear-gradient(180deg,oklch(0.62_0.24_278_/_0.06),oklch(0.62_0.24_278_/_0.02))] p-6"
          >
            <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.72_0.16_155)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.72_0.16_155)]" />
              </span>
              System status · Live
            </div>
            <div className="text-[16px] font-semibold tracking-[-0.015em] text-[oklch(0.20_0.012_270)] dark:text-white">
              All systems operational
            </div>
            <div className="flex flex-col gap-2">
              {statusRows.map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between text-[12.5px] text-[oklch(0.32_0.012_270)] dark:text-slate-300"
                >
                  <span>{row}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.72_0.16_155_/_0.22)] bg-[oklch(0.72_0.16_155_/_0.08)] px-2 py-0.75 font-mono text-[10px] uppercase tracking-[0.04em] text-[oklch(0.72_0.16_155)]">
                    <span className="h-[5px] w-[5px] rounded-full bg-[oklch(0.72_0.16_155)]" />
                    Operational
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

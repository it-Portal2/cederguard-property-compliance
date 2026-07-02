import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { clsx } from 'clsx';
import {
  Search,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Lightbulb,
  Menu,
  X,
  MessageSquare,
  Mail,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { isSuperAdmin, isAtLeastClientAdmin } from '../../../lib/roles';
import { DOC_ROLES, type DocTopic } from '../../../data/docsContent';

const ACCENT_VARS = {
  '--accent': 'oklch(0.62 0.24 278)',
  '--accent-hot': 'oklch(0.70 0.26 280)',
} as React.CSSProperties;

function resolveDefaultRoleKey(userRole: unknown, isClientAdmin: boolean): string {
  if (isClientAdmin) return 'client-admin';
  if (userRole === 'senior_pm' || userRole === 'senior-pm') return 'senior-pm';
  if (userRole === 'coordinator') return 'coordinator';
  if (userRole === 'assistant_pm' || userRole === 'assistant-pm') return 'assistant-pm';
  return 'pm';
}

const TopicAccordion: React.FC<{ topic: DocTopic; isOpen: boolean; onToggle: () => void }> = ({
  topic,
  isOpen,
  onToggle,
}) => {
  return (
    <div
      id={`topic-${topic.id}`}
      className={clsx(
        'scroll-mt-28 overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 dark:bg-white/3',
        isOpen
          ? 'border-[oklch(0.62_0.24_278_/_0.32)] shadow-[0_0_0_1px_oklch(0.62_0.24_278_/_0.16),0_14px_30px_-16px_oklch(0.62_0.24_278_/_0.20)]'
          : 'border-[oklch(0.91_0.006_270)] dark:border-white/10',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[oklch(0.98_0.004_270)] dark:hover:bg-white/5"
      >
        <span
          className={clsx(
            'grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border transition-colors',
            isOpen
              ? 'border-[oklch(0.62_0.24_278_/_0.30)] bg-[oklch(0.62_0.24_278_/_0.12)] text-[var(--accent)]'
              : 'border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] text-[oklch(0.32_0.012_270)] dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
          )}
        >
          <ChevronRight className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold tracking-[-0.01em] text-[oklch(0.20_0.012_270)] dark:text-white">
            {topic.title}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
            {topic.description}
          </span>
        </span>
        <ChevronDown
          className={clsx(
            'h-4 w-4 shrink-0 text-[oklch(0.50_0.010_270)] transition-transform duration-200',
            isOpen && 'rotate-180 text-[var(--accent)]',
          )}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 px-4 pb-5 pl-[62px] pt-1">
          {topic.steps && (
            <ol className="flex flex-col gap-2.5">
              {topic.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border border-[oklch(0.62_0.24_278_/_0.22)] bg-[oklch(0.62_0.24_278_/_0.08)] font-mono text-[10px] font-semibold text-[var(--accent)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13.5px] leading-relaxed text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {topic.tip && (
            <div className="grid grid-cols-[18px_1fr] gap-2.5 rounded-lg border border-[oklch(0.78_0.15_78_/_0.25)] bg-[oklch(0.78_0.15_78_/_0.08)] px-3.5 py-3">
              <Lightbulb className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[oklch(0.78_0.15_78)]" />
              <p className="text-[12.5px] leading-relaxed text-[oklch(0.42_0.10_78)]">{topic.tip}</p>
            </div>
          )}
          {topic.link && (
            <Link
              to={topic.link}
              className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] transition-[gap] hover:gap-2.5"
            >
              {topic.linkLabel || 'Go there now'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export function HelpCenter() {
  const { user } = useStore();
  const userRole = user?.role || user?.profile?.role;
  const isAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
  const defaultRoleKey = useMemo(() => resolveDefaultRoleKey(userRole, isClientAdmin), [userRole, isClientAdmin]);

  const [activeRoleKey, setActiveRoleKey] = useState(defaultRoleKey);
  const [search, setSearch] = useState('');
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeRole = DOC_ROLES.find((r) => r.key === activeRoleKey) ?? DOC_ROLES[0];

  useEffect(() => {
    setOpenTopicId(activeRole.topics[0]?.id ?? null);
  }, [activeRoleKey]);

  const filteredTopics = activeRole.topics.filter(
    (t) =>
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()),
  );

  const selectRole = (key: string) => {
    setActiveRoleKey(key);
    setSearch('');
    setMobileSidebarOpen(false);
  };

  const jumpToTopic = (id: string) => {
    setOpenTopicId(id);
    document.getElementById(`topic-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative" style={ACCENT_VARS}>
      <div className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_220px] lg:items-start lg:gap-10 lg:px-8 lg:pt-10">
        {/* Mobile drawer backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Left sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.30)] transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] dark:bg-[#0a0a0a]',
            'lg:sticky lg:top-6 lg:z-auto lg:max-h-[calc(100vh-3rem)] lg:w-auto lg:translate-x-0 lg:border-r lg:border-[oklch(0.91_0.006_270)] lg:bg-transparent lg:p-0 lg:pr-6 lg:shadow-none dark:lg:border-white/10',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <span className="font-mono text-[11px] uppercase tracking-wide text-[oklch(0.50_0.010_270)]">
              Documentation
            </span>
            <button type="button" onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5 text-[oklch(0.32_0.012_270)] dark:text-slate-300" />
            </button>
          </div>

          <div className="mb-5 flex h-9 items-center gap-2 rounded-lg border border-[oklch(0.91_0.006_270)] bg-white px-2.5 transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_oklch(0.62_0.24_278_/_0.10)] dark:border-white/10 dark:bg-white/5">
            <Search className="h-3.5 w-3.5 shrink-0 text-[oklch(0.50_0.010_270)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[oklch(0.20_0.012_270)] outline-none placeholder:text-[oklch(0.68_0.010_270)] dark:text-white"
            />
          </div>

          <div className="mb-1">
            <h4 className="px-2 pb-1.5 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[oklch(0.68_0.010_270)]">
              By role
            </h4>
            {DOC_ROLES.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => selectRole(role.key)}
                className={clsx(
                  'relative flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] transition-colors',
                  role.key === activeRoleKey
                    ? 'bg-[oklch(0.62_0.24_278_/_0.08)] font-medium text-[oklch(0.20_0.012_270)] dark:text-white'
                    : 'text-[oklch(0.32_0.012_270)] hover:bg-[oklch(0.96_0.005_270)] dark:text-slate-300 dark:hover:bg-white/5',
                )}
              >
                {role.key === activeRoleKey && (
                  <span className="absolute -left-px top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--accent)]" />
                )}
                <role.icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-85" />
                {role.label}
              </button>
            ))}
          </div>

          <div>
            <h4 className="px-2 pb-1.5 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[oklch(0.68_0.010_270)]">
              Reference
            </h4>
            <Link
              to="/contact"
              className="flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13px] text-[oklch(0.32_0.012_270)] transition-colors hover:bg-[oklch(0.96_0.005_270)] dark:text-slate-300 dark:hover:bg-white/5"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-85" />
              Contact support
            </Link>
          </div>
        </aside>

        {/* Main column */}
        <main className="min-w-0 py-1">
          <div className="mb-3.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.50_0.010_270)]">
            <span>Help</span>
            <span className="text-[oklch(0.68_0.010_270)]">/</span>
            <span>Documentation</span>
            <span className="text-[oklch(0.68_0.010_270)]">/</span>
            <span className="text-[oklch(0.32_0.012_270)] dark:text-slate-300">{activeRole.label}</span>
          </div>

          <h1 className="mb-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-[oklch(0.20_0.012_270)] dark:text-white">
            {activeRole.label} guide
          </h1>
          <p className="mb-8 max-w-[60ch] text-[16px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
            {activeRole.description}
          </p>

          <div className="mb-7 grid grid-cols-[38px_1fr] gap-3.5 rounded-xl border border-[oklch(0.62_0.24_278_/_0.22)] bg-[linear-gradient(180deg,oklch(0.62_0.24_278_/_0.06),oklch(0.62_0.24_278_/_0.02))] px-5 py-4">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-[9px] bg-[oklch(0.62_0.24_278_/_0.14)] text-[var(--accent)]">
              <activeRole.icon className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--accent)]">
                Role · {activeRole.label}
              </div>
              <p className="text-[13px] leading-relaxed text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                {activeRole.description}
              </p>
            </div>
          </div>

          {filteredTopics.length === 0 ? (
            <div className="py-16 text-center text-[oklch(0.68_0.010_270)]">
              <Search className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-[13.5px]">
                No guides found matching "<span className="font-semibold">{search}</span>"
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredTopics.map((topic) => (
                <TopicAccordion
                  key={topic.id}
                  topic={topic}
                  isOpen={openTopicId === topic.id}
                  onToggle={() => setOpenTopicId(openTopicId === topic.id ? null : topic.id)}
                />
              ))}
            </div>
          )}

          {/* Bottom help block */}
          <div className="mt-10 grid grid-cols-[44px_1fr] items-start gap-3.5 rounded-xl border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] p-6 dark:border-white/10 dark:bg-white/3">
            <span className="grid h-11 w-11 place-items-center rounded-[10px] border border-[oklch(0.62_0.24_278_/_0.22)] bg-[oklch(0.62_0.24_278_/_0.12)] text-[var(--accent)]">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <h4 className="mb-1 text-[15px] font-semibold text-[oklch(0.20_0.012_270)] dark:text-white">
                Still need help?
              </h4>
              <p className="mb-3 text-[13px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                Contact your Client Admin for workspace-specific questions, or reach out to the
                CedarGuard support team for anything else.
              </p>
              <div className="flex flex-wrap items-center gap-3.5 text-[13px]">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)] transition-[gap] hover:gap-2.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Contact support
                </Link>
                <span className="text-[oklch(0.68_0.010_270)]">·</span>
                <a
                  href="mailto:support@cedarguard.co.uk"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)] transition-[gap] hover:gap-2.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  support@cedarguard.co.uk
                </a>
              </div>
            </div>
          </div>
        </main>

        {/* Right TOC */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:py-1">
          <h5 className="mb-3.5 pl-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[oklch(0.68_0.010_270)]">
            On this page
          </h5>
          <div className="flex flex-col">
            {activeRole.topics.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => jumpToTopic(t.id)}
                className={clsx(
                  'border-l-2 py-1.5 pl-2.5 text-left text-[12px] leading-snug transition-colors',
                  openTopicId === t.id
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[oklch(0.50_0.010_270)] hover:text-[oklch(0.20_0.012_270)] dark:hover:text-white',
                )}
              >
                {i + 1}. {t.title}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* Mobile "Topics" toggle */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-[oklch(0.54_0.24_278)] bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_12px_30px_-10px_oklch(0.62_0.24_278_/_0.45)] lg:hidden"
      >
        <Menu className="h-4 w-4" />
        Topics
      </button>
    </div>
  );
}

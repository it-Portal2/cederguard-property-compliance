import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { clsx } from 'clsx';
import { Search, Copy, Check, ArrowLeft, Menu, X, MessageSquare } from 'lucide-react';
import {
  API_PRIMERS,
  API_ACTIONS,
  GROUP_ORDER,
  type ApiParam,
} from '../../../../shared/lib/apiCatalog';

const ACCENT_VARS = {
  '--accent': 'oklch(0.62 0.24 278)',
  '--accent-hot': 'oklch(0.70 0.26 280)',
} as React.CSSProperties;

const BASE_URL = 'https://cedarguard.co.uk/api';
const PAGE_LEDE =
  'A single POST endpoint with an action selector, authenticated by an API key. Generate a key in Developer Settings, then call any action below. Every action ships a copy-paste cURL you can run from your terminal.';

interface CodeVariant {
  id: string;
  label: string;
  code: string;
}

type Section =
  | {
      kind: 'primer';
      id: string;
      group: string;
      navLabel: string;
      paragraphs: string[];
      code: CodeVariant[];
    }
  | {
      kind: 'action';
      id: string;
      group: string;
      navLabel: string;
      action: string;
      description: string;
      requiredRole: string;
      params?: ApiParam[];
      code: CodeVariant[];
      responseExample?: string;
    };

// A runnable cURL for any action: required params become typed placeholders.
function synthCurl(action: string, params?: ApiParam[]): string {
  const required = (params ?? []).filter((p) => p.required);
  const body = required.length
    ? `{ ${required.map((p) => `"${p.name}": <${p.type}>`).join(', ')} }`
    : '{}';
  return `curl -X POST "${BASE_URL}?action=${action}" \\\n  -H "Authorization: Bearer cdR_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
}

const SECTIONS: Section[] = (() => {
  const out: Section[] = [];
  for (const group of GROUP_ORDER) {
    for (const primer of API_PRIMERS.filter((p) => p.group === group)) {
      const code: CodeVariant[] = [];
      if (primer.example?.curl) code.push({ id: 'curl', label: 'cURL', code: primer.example.curl });
      if (primer.example?.node) code.push({ id: 'node', label: 'Node.js', code: primer.example.node });
      if (primer.example?.python) code.push({ id: 'python', label: 'Python', code: primer.example.python });
      out.push({
        kind: 'primer',
        id: primer.id,
        group,
        navLabel: primer.title,
        paragraphs: primer.body.split('\n').filter(Boolean),
        code,
      });
    }
    for (const a of API_ACTIONS.filter((x) => x.group === group)) {
      const code: CodeVariant[] = [];
      if (a.example?.curl) code.push({ id: 'curl', label: 'cURL', code: a.example.curl });
      if (a.example?.node) code.push({ id: 'node', label: 'Node.js', code: a.example.node });
      if (a.example?.python) code.push({ id: 'python', label: 'Python', code: a.example.python });
      if (!code.length) code.push({ id: 'curl', label: 'cURL', code: synthCurl(a.action, a.params) });
      out.push({
        kind: 'action',
        id: a.action,
        group,
        navLabel: a.title,
        action: a.action,
        description: a.description,
        requiredRole: a.requiredRole,
        params: a.params,
        code,
        responseExample: a.responseExample,
      });
    }
  }
  return out;
})();

interface NavGroup {
  group: string;
  items: Section[];
}

const NAV_GROUPS: NavGroup[] = SECTIONS.reduce<NavGroup[]>((acc, section) => {
  const last = acc[acc.length - 1];
  if (last && last.group === section.group) last.items.push(section);
  else acc.push({ group: section.group, items: [section] });
  return acc;
}, []);

const CodePanel: React.FC<{
  sectionId: string;
  variants: CodeVariant[];
  activeVariantId: string;
  onSelectTab: (id: string) => void;
  copiedKey: string | null;
  onCopy: (key: string, code: string) => void;
}> = ({ sectionId, variants, activeVariantId, onSelectTab, copiedKey, onCopy }) => {
  const active = variants.find((v) => v.id === activeVariantId) ?? variants[0];
  const copyKey = `${sectionId}:${active.id}`;
  const isCopied = copiedKey === copyKey;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[oklch(0.30_0.014_270_/_0.6)] bg-[oklch(0.155_0.012_270)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_20px_40px_-20px_rgba(0,0,0,0.30)]">
        <div className="flex items-center justify-between border-b border-[oklch(0.30_0.014_270_/_0.6)] bg-[oklch(0.20_0.014_270)] px-3 py-2.5">
          {variants.length > 1 ? (
            <div className="inline-flex gap-0.5 rounded-md bg-white/[0.04] p-0.5">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectTab(v.id)}
                  className={clsx(
                    'h-6 rounded px-2.5 font-mono text-[11px] tracking-wide transition-colors',
                    v.id === active.id
                      ? 'bg-[oklch(0.155_0.012_270)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                      : 'text-white/50 hover:text-white/85',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[oklch(0.62_0.012_270)]">
              {active.label}
            </span>
          )}
          <button
            type="button"
            onClick={() => onCopy(copyKey, active.code)}
            className={clsx(
              'inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.04em] transition-colors',
              isCopied
                ? 'border-[oklch(0.72_0.16_155_/_0.40)] bg-[oklch(0.72_0.16_155_/_0.10)] text-[oklch(0.72_0.16_155)]'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="max-h-[380px] overflow-auto px-4 py-4">
          <pre className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-[oklch(0.92_0.008_270)]">
            <code>{active.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

const ParamTable: React.FC<{ title: string; params: ApiParam[] }> = ({ title, params }) => (
  <div className="mb-6">
    <h3 className="mb-2.5 mt-6 text-[16px] font-semibold tracking-[-0.015em] text-[oklch(0.20_0.012_270)] dark:text-white">
      {title}
    </h3>
    <div className="overflow-hidden rounded-lg border border-[oklch(0.91_0.006_270)] bg-white dark:border-white/10 dark:bg-white/3">
      {params.map((p, i) => (
        <div
          key={p.name}
          className={clsx(
            'grid grid-cols-1 gap-1 px-4 py-3 text-[13px] sm:grid-cols-[180px_90px_1fr] sm:gap-4',
            i !== params.length - 1 && 'border-b border-[oklch(0.91_0.006_270)] dark:border-white/10',
          )}
        >
          <span className="font-mono text-[12.5px] font-medium text-[oklch(0.20_0.012_270)] dark:text-white">
            {p.name}
          </span>
          <span className="font-mono text-[11px] text-[oklch(0.50_0.010_270)]">
            {p.type}
            {p.required && <span className="ml-1 font-semibold text-[oklch(0.66_0.21_25)]">*</span>}
          </span>
          <span className="leading-relaxed text-[oklch(0.32_0.012_270)] dark:text-slate-300">{p.description}</span>
        </div>
      ))}
    </div>
  </div>
);

export function APIDocs() {
  const [search, setSearch] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeVariantBySection, setActiveVariantBySection] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSectionId(entry.target.id);
        });
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleCopy = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
  };

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return NAV_GROUPS;
    const q = search.toLowerCase();
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (s) => s.navLabel.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  const visibleIds = useMemo(() => {
    const set = new Set<string>();
    filteredGroups.forEach((g) => g.items.forEach((s) => set.add(s.id)));
    return set;
  }, [filteredGroups]);

  return (
    <div className="relative" style={ACCENT_VARS}>
      <div className="mx-auto max-w-[1640px] px-4 pt-6 pb-20 sm:px-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8 lg:pt-10">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.30)] transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] dark:bg-[#0a0a0a]',
            'lg:sticky lg:top-6 lg:z-auto lg:max-h-[calc(100vh-3rem)] lg:w-auto lg:translate-x-0 lg:border-r lg:border-[oklch(0.91_0.006_270)] lg:bg-transparent lg:p-0 lg:pr-6 lg:shadow-none dark:lg:border-white/10',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <span className="font-mono text-[11px] uppercase tracking-wide text-[oklch(0.50_0.010_270)]">
              API Reference
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
              placeholder="Search API…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[oklch(0.20_0.012_270)] outline-none placeholder:text-[oklch(0.68_0.010_270)] dark:text-white"
            />
          </div>

          {filteredGroups.map((group) => (
            <div key={group.group} className="mb-1">
              <h4 className="px-2 pb-1.5 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[oklch(0.68_0.010_270)]">
                {group.group}
              </h4>
              {group.items.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileSidebarOpen(false);
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={clsx(
                    'relative flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] leading-snug transition-colors',
                    activeSectionId === section.id
                      ? 'bg-[oklch(0.62_0.24_278_/_0.08)] font-medium text-[oklch(0.20_0.012_270)] dark:text-white'
                      : 'text-[oklch(0.32_0.012_270)] hover:bg-[oklch(0.96_0.005_270)] dark:text-slate-300 dark:hover:bg-white/5',
                  )}
                >
                  {activeSectionId === section.id && (
                    <span className="absolute -left-px top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--accent)]" />
                  )}
                  {section.kind === 'action' && (
                    <span className="shrink-0 rounded-[3px] border border-[oklch(0.72_0.16_155_/_0.25)] bg-[oklch(0.72_0.16_155_/_0.10)] px-1 py-px font-mono text-[9px] font-semibold tracking-[0.04em] text-[oklch(0.72_0.16_155)]">
                      POST
                    </span>
                  )}
                  {section.navLabel}
                </a>
              ))}
            </div>
          ))}

          <div className="mb-1">
            <h4 className="px-2 pb-1.5 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[oklch(0.68_0.010_270)]">
              Reference
            </h4>
            <Link
              to="/help"
              className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] text-[oklch(0.32_0.012_270)] transition-colors hover:bg-[oklch(0.96_0.005_270)] dark:text-slate-300 dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-85" />
              Back to documentation
            </Link>
            <Link
              to="/contact"
              className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] text-[oklch(0.32_0.012_270)] transition-colors hover:bg-[oklch(0.96_0.005_270)] dark:text-slate-300 dark:hover:bg-white/5"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-85" />
              Contact support
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 py-1">
          <div className="mb-3.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.50_0.010_270)]">
            <span>Developer</span>
            <span className="text-[oklch(0.68_0.010_270)]">/</span>
            <span className="text-[oklch(0.32_0.012_270)] dark:text-slate-300">API Reference</span>
          </div>
          <h1 className="mb-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-[oklch(0.20_0.012_270)] dark:text-white">
            CedarGuard API Reference
          </h1>
          <p className="mb-10 max-w-[60ch] text-[16px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
            {PAGE_LEDE}
          </p>

          <div className="flex flex-col gap-14">
            {SECTIONS.filter((s) => visibleIds.has(s.id)).map((section) => {
              const activeVariantId = activeVariantBySection[section.id] ?? section.code[0]?.id ?? '';
              return (
                <section
                  key={section.id}
                  id={section.id}
                  ref={(el) => {
                    sectionRefs.current[section.id] = el;
                  }}
                  className="scroll-mt-24 border-b border-[oklch(0.91_0.006_270)] pb-14 last:border-b-0 last:pb-0 dark:border-white/10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-10"
                >
                  <div className="min-w-0 max-w-[640px]">
                    <h2 className="mb-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[oklch(0.20_0.012_270)] dark:text-white">
                      {section.navLabel}
                    </h2>

                    {section.kind === 'primer' &&
                      section.paragraphs.map((p, i) => (
                        <p key={i} className="mb-4 text-[15px] leading-relaxed text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                          {p}
                        </p>
                      ))}

                    {section.kind === 'action' && (
                      <>
                        <p className="mb-4 text-[15px] leading-relaxed text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                          {section.description}
                        </p>
                        <div className="mb-4 flex flex-wrap items-center gap-2.5 overflow-x-auto rounded-lg border border-[oklch(0.91_0.006_270)] bg-[oklch(0.98_0.004_270)] px-3.5 py-2.5 font-mono text-[13px] dark:border-white/10 dark:bg-white/5">
                          <span className="shrink-0 rounded-[5px] border border-[oklch(0.72_0.16_155_/_0.30)] bg-[oklch(0.72_0.16_155_/_0.10)] px-2 py-1 text-[11px] font-bold tracking-[0.04em] text-[oklch(0.72_0.16_155)]">
                            POST
                          </span>
                          <span className="font-medium text-[oklch(0.20_0.012_270)] dark:text-white">/api</span>
                          <span className="text-[oklch(0.50_0.010_270)]">
                            · action <b className="font-semibold text-[var(--accent)]">"{section.action}"</b>
                          </span>
                        </div>

                        <h3 className="mb-2 mt-6 text-[16px] font-semibold tracking-[-0.015em] text-[oklch(0.20_0.012_270)] dark:text-white">
                          Required role
                        </h3>
                        <p className="mb-4 text-[14px] text-[oklch(0.32_0.012_270)] dark:text-slate-300">
                          <code className="rounded-md border border-[oklch(0.62_0.24_278_/_0.18)] bg-[oklch(0.62_0.24_278_/_0.08)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--accent)]">
                            {section.requiredRole}
                          </code>
                        </p>

                        {section.params && section.params.length > 0 && (
                          <ParamTable title="Request body" params={section.params} />
                        )}
                      </>
                    )}
                  </div>

                  {(section.code.length > 0 || (section.kind === 'action' && section.responseExample)) && (
                    <div className="mt-6 flex flex-col gap-3.5 lg:sticky lg:top-6 lg:mt-0 lg:self-start">
                      {section.code.length > 0 && (
                        <CodePanel
                          sectionId={section.id}
                          variants={section.code}
                          activeVariantId={activeVariantId}
                          onSelectTab={(id) => setActiveVariantBySection((prev) => ({ ...prev, [section.id]: id }))}
                          copiedKey={copiedKey}
                          onCopy={handleCopy}
                        />
                      )}
                      {section.kind === 'action' && section.responseExample && (
                        <CodePanel
                          sectionId={`${section.id}-response`}
                          variants={[{ id: 'response', label: 'Response', code: section.responseExample }]}
                          activeVariantId="response"
                          onSelectTab={() => {}}
                          copiedKey={copiedKey}
                          onCopy={handleCopy}
                        />
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </main>
      </div>

      {/* Mobile "Endpoints" toggle */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-[oklch(0.54_0.24_278)] bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_12px_30px_-10px_oklch(0.62_0.24_278_/_0.45)] lg:hidden"
      >
        <Menu className="h-4 w-4" />
        Endpoints
      </button>
    </div>
  );
}

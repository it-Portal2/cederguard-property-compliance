import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  Search,
  X,
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  FileBarChart,
  Activity,
  BarChart3,
  Calendar,
  CheckSquare,
  Folder,
  Layers,
  Building2,
  Sparkles,
  BookOpen,
  Trash2,
  Database,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { stripMarkdown } from '../lib/utils';

type Item = {
  id: string;
  group: 'Navigate' | 'Context' | 'Actions' | 'Projects' | 'Programmes';
  label: string;
  meta?: string;
  icon: React.ReactNode;
  run: () => void;
};

const GROUP_ORDER: Item['group'][] = [
  'Navigate',
  'Context',
  'Actions',
  'Projects',
  'Programmes',
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const {
    projects,
    programmes,
    setActiveProject,
    setActiveProgramme,
    loadDemoData,
    clearData,
  } = useStore();

  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refocus + reset on each open
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];

  const goto = (path: string) => {
    onClose();
    navigate(path);
  };

  const items: Item[] = useMemo(() => {
    const base: Item[] = [
      // Navigate
      { id: 'go-dash', group: 'Navigate', label: 'Go to Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" />, run: () => goto('/dashboard') },
      { id: 'go-cdash', group: 'Navigate', label: 'Compliance Dashboard', icon: <ShieldCheck className="w-3.5 h-3.5" />, run: () => goto('/compliance/dashboard') },
      { id: 'go-ctrack', group: 'Navigate', label: 'Compliance Tracker', icon: <CheckSquare className="w-3.5 h-3.5" />, run: () => goto('/compliance/tracker') },
      { id: 'go-evid', group: 'Navigate', label: 'Evidence & Documents', icon: <Folder className="w-3.5 h-3.5" />, run: () => goto('/compliance/evidence') },
      { id: 'go-rreg', group: 'Navigate', label: 'Risk Register', icon: <ShieldAlert className="w-3.5 h-3.5" />, run: () => goto('/risk/register') },
      { id: 'go-rdash', group: 'Navigate', label: 'Risk Dashboard', icon: <BarChart3 className="w-3.5 h-3.5" />, run: () => goto('/risk/dashboard') },
      { id: 'go-kri', group: 'Navigate', label: 'KRI Tracker', icon: <Activity className="w-3.5 h-3.5" />, run: () => goto('/monitoring/kri') },
      { id: 'go-trend', group: 'Navigate', label: 'Trends & Heatmaps', icon: <BarChart3 className="w-3.5 h-3.5" />, run: () => goto('/monitoring/heatmaps') },
      { id: 'go-exec', group: 'Navigate', label: 'Executive Report', icon: <FileBarChart className="w-3.5 h-3.5" />, run: () => goto('/reporting/executive') },
      { id: 'go-progrep', group: 'Navigate', label: 'Programme Report', icon: <FileBarChart className="w-3.5 h-3.5" />, run: () => goto('/reporting/programme') },
      { id: 'go-cal', group: 'Navigate', label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" />, run: () => goto('/calendar') },
      { id: 'go-tasks', group: 'Navigate', label: 'My Tasks', icon: <CheckSquare className="w-3.5 h-3.5" />, run: () => goto('/my-tasks') },
      { id: 'go-regs', group: 'Navigate', label: 'Regulations Library', icon: <BookOpen className="w-3.5 h-3.5" />, run: () => goto('/regulations') },

      // Context
      { id: 'ctx-all', group: 'Context', label: 'Switch to Portfolio Aggregate', meta: 'all projects', icon: <Layers className="w-3.5 h-3.5" />, run: () => { setActiveProject(null); setActiveProgramme(null); onClose(); navigate('/dashboard'); } },

      // Actions
      { id: 'act-clear', group: 'Actions', label: 'Clear all data', meta: 'destructive', icon: <Trash2 className="w-3.5 h-3.5" />, run: () => { onClose(); void clearData?.(); } },
      { id: 'act-demo', group: 'Actions', label: 'Load demo data', meta: 'sample dataset', icon: <Database className="w-3.5 h-3.5" />, run: () => { onClose(); void loadDemoData?.(); } },
    ];

    // Programmes
    safeProgrammes.forEach((p) => {
      base.push({
        id: `prog-${p.id}`,
        group: 'Programmes',
        label: stripMarkdown(p.name || 'Programme'),
        meta: 'jump · scope',
        icon: <Folder className="w-3.5 h-3.5" />,
        run: () => { setActiveProject(null); setActiveProgramme(p.id); onClose(); navigate(`/dashboard?programmeId=${p.id}`); },
      });
    });

    // Projects
    safeProjects.forEach((p) => {
      base.push({
        id: `proj-${p.id}`,
        group: 'Projects',
        label: stripMarkdown(p.name || 'Project'),
        meta: p.type ? stripMarkdown(p.type) : 'jump · scope',
        icon: <Building2 className="w-3.5 h-3.5" />,
        run: () => { setActiveProgramme(null); setActiveProject(p.id); onClose(); navigate(`/dashboard?projectId=${p.id}`); },
      });
    });

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeProjects, safeProgrammes, open]);

  // Fuzzy match — substring (higher score) or char-skip subsequence (lower)
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    const scored = items.map((it) => {
      const s = it.label.toLowerCase();
      let score = 0;
      const idx = s.indexOf(query);
      if (idx >= 0) score = 100 - idx;
      else {
        let qi = 0;
        for (let i = 0; i < s.length && qi < query.length; i++) {
          if (s[i] === query[qi]) qi++;
        }
        if (qi === query.length) score = 30;
      }
      return { it, score };
    });
    return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.it);
  }, [q, items]);

  const groups = useMemo(() => {
    const by: Record<string, Item[]> = {};
    filtered.forEach((it) => {
      (by[it.group] ||= []).push(it);
    });
    return GROUP_ORDER.filter((g) => by[g]?.length).map((g) => ({ g, items: by[g] }));
  }, [filtered]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); const item = filtered[sel]; if (item?.run) item.run(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sel, filtered, onClose]);

  // Reset selection when filter changes
  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-start justify-center pt-[12vh] px-4 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-160 bg-white rounded-lg border border-slate-300 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-200">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to search projects, risks, regulations, actions…"
            className="w-full pl-11 pr-12 py-4 bg-transparent border-0 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 font-sans"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No matches for <span className="font-mono">"{q}"</span>
            </div>
          ) : (
            groups.map((grp) => (
              <div key={grp.g}>
                <div className="px-4 pt-2 pb-1 font-mono uppercase tracking-wide text-[10px] font-medium text-slate-400">
                  {grp.g}
                </div>
                {grp.items.map((it) => {
                  const i = filtered.indexOf(it);
                  const isActive = i === sel;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onMouseEnter={() => setSel(i)}
                      onClick={() => it.run()}
                      className={clsx(
                        'w-full grid grid-cols-[22px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isActive ? 'bg-indigo-50' : 'bg-transparent hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-flex w-5.5 h-5.5 items-center justify-center rounded-md border',
                          isActive
                            ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500',
                        )}
                      >
                        {it.icon}
                      </span>
                      <span className="text-sm text-slate-900 truncate">{it.label}</span>
                      {it.meta && (
                        <span className="font-mono uppercase tracking-wide text-[10px] text-slate-400">
                          {it.meta}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2.5 flex items-center gap-4 text-[11px] text-slate-500 border-t border-slate-200 bg-slate-50">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            select
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            close
          </span>
          <span className="ml-auto font-mono tabular-nums text-slate-400">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-500">
      {children}
    </span>
  );
}

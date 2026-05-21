import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, FileWarning, ClipboardList } from 'lucide-react';
import { clsx } from 'clsx';

type ActivityKind = 'compliance' | 'risk' | 'issue';

type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  meta?: string;
  date: Date;
};

type SourceItem = {
  id?: string;
  title?: string;
  name?: string;
  status?: string;
  severity?: string | number;
  dateAdded?: string | number | Date;
  [k: string]: any;
};

type Props = {
  compliance: any[];
  risks: any[];
  issues: any[];
  limit?: number;
  className?: string;
};

const KIND_STYLES: Record<ActivityKind, { bg: string; icon: any; iconColor: string; label: string }> = {
  compliance: { bg: 'bg-indigo-50', icon: ClipboardList, iconColor: 'text-indigo-600', label: 'Compliance' },
  risk:       { bg: 'bg-rose-50',   icon: AlertTriangle, iconColor: 'text-rose-600',   label: 'Risk' },
  issue:      { bg: 'bg-amber-50',  icon: FileWarning,   iconColor: 'text-amber-600',  label: 'Issue' },
};

function toDate(raw: any): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function relativeTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function statusLabel(it: SourceItem) {
  const s = (it.status || '').toString();
  if (!s) return '';
  return s;
}

export function ActivityTimeline({ compliance, risks, issues, limit = 8, className }: Props) {
  const entries: ActivityEntry[] = [];

  compliance.forEach((c) => {
    const d = toDate(c.dateAdded);
    if (!d) return;
    entries.push({
      id: `c-${c.id || c.title || Math.random()}`,
      kind: 'compliance',
      title: c.title || c.name || 'Compliance item',
      meta: statusLabel(c),
      date: d,
    });
  });
  risks.forEach((r) => {
    const d = toDate(r.dateAdded);
    if (!d) return;
    entries.push({
      id: `r-${r.id || r.title || Math.random()}`,
      kind: 'risk',
      title: r.title || r.name || 'Risk',
      meta: r.severity ? `${r.severity}` : statusLabel(r),
      date: d,
    });
  });
  issues.forEach((i) => {
    const d = toDate(i.dateAdded);
    if (!d) return;
    entries.push({
      id: `i-${i.id || i.title || Math.random()}`,
      kind: 'issue',
      title: i.title || i.name || 'Issue',
      meta: statusLabel(i),
      date: d,
    });
  });

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  const top = entries.slice(0, limit);

  return (
    <div className={clsx('bg-white rounded-lg border border-slate-200 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {top.length} event{top.length === 1 ? '' : 's'}
        </span>
      </div>
      {top.length === 0 ? (
        <div className="py-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No recent activity in this context.</p>
        </div>
      ) : (
        <motion.ul
          className="space-y-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 1 },
            show: { opacity: 1, transition: { staggerChildren: 0.04 } },
          }}
          aria-label="Recent activity feed"
        >
          {top.map((e) => {
            const s = KIND_STYLES[e.kind];
            const Icon = s.icon;
            return (
              <motion.li
                key={e.id}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] } },
                }}
                className="flex items-start gap-3"
              >
                <span className={clsx('shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-md', s.bg)}>
                  <Icon className={clsx('w-4 h-4', s.iconColor)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{e.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.label}
                    {e.meta && <span className="mx-1.5 text-slate-300">·</span>}
                    {e.meta}
                    <span className="mx-1.5 text-slate-300">·</span>
                    {relativeTime(e.date)}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}

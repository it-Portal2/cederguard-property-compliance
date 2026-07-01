import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Settings, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import type { ProviderMeta } from '../providers';

// Two-line clamped description that reveals the full text in a hover tooltip,
// but only when the text is actually truncated. Uses a named group so it never
// fires off the card's own `group` hover.
function CardDescription({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="group/desc relative mt-1">
      <span ref={ref} className="line-clamp-2 block text-[13px] leading-snug text-slate-500">
        {text}
      </span>
      {truncated && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-64 max-w-[calc(100vw-3rem)] rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-normal leading-relaxed text-white shadow-xl group-hover/desc:block"
        >
          {text}
        </span>
      )}
    </div>
  );
}

export interface ProviderStatus {
  enabled: boolean;
  connected: boolean;
  config: Record<string, any>;
  lastError?: string | null;
  lastSyncAt?: string | null;
  [k: string]: any;
}

interface Props {
  meta: ProviderMeta;
  status?: ProviderStatus;
  canManage: boolean;
  onOpen: () => void;
  onToggle: (next: boolean) => void;
  busy?: boolean;
}

export default function IntegrationCard({ meta, status, canManage, onOpen, onToggle, busy }: Props) {
  const connected = !!status?.connected;
  const enabled = !!status?.enabled;
  const hasError = !!status?.lastError;

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
      <a
        href={meta.website}
        target="_blank"
        rel="noreferrer"
        className="absolute right-4 top-4 text-slate-300 transition-colors hover:text-slate-500"
        title={`Open ${meta.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-4 w-4" />
      </a>

      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50"
          aria-hidden="true"
        >
          <img src={meta.logo} alt="" className="h-7 w-7 object-contain" />
        </span>
        <div className="min-w-0 pr-6">
          <h3 className="truncate text-sm font-semibold text-slate-900">{meta.name}</h3>
          <CardDescription text={meta.description} />
        </div>
      </div>

      <div className="mt-3">
        {hasError ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-wide text-red-600">
            <AlertTriangle className="h-3 w-3" /> Error
          </span>
        ) : connected ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {enabled ? 'Connected' : 'Configured'}
          </span>
        ) : (
          <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">Not configured</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Settings className="h-3.5 w-3.5" /> Settings
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Enable ${meta.name}`}
          disabled={!canManage || !connected || busy}
          title={!connected ? 'Configure this integration first' : enabled ? 'Turn off' : 'Turn on'}
          onClick={() => onToggle(!enabled)}
          className={clsx(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            enabled ? 'bg-emerald-500' : 'bg-slate-300',
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
  );
}

import { CheckCircle2, Copy, Loader2, Pencil, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import {
  type ReportTemplate,
  CATEGORY_LABEL,
  CATEGORY_STYLES,
} from './types';

interface TemplateCardProps {
  template: ReportTemplate;
  onOpen: (template: ReportTemplate) => void;
  onDuplicate: (template: ReportTemplate) => void;
  canEdit: boolean;
  /** True when this card's template is currently being fetched. */
  isOpening?: boolean;
  /** True when ANY card is currently opening — disables other cards so
   *  double-clicks don't stack requests. */
  anyOpening?: boolean;
}

export function TemplateCard({
  template,
  onOpen,
  onDuplicate,
  canEdit,
  isOpening = false,
  anyOpening = false,
}: TemplateCardProps) {
  const style = CATEGORY_STYLES[template.category];
  const sectionCount = Array.isArray(template.sections) ? template.sections.length : 0;

  return (
    <article
      className={clsx(
        'group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {template.code && (
              <span
                className={clsx(
                  'font-mono inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  style.badge,
                )}
              >
                {template.code}
              </span>
            )}
            <span
              className={clsx(
                'font-mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                style.badge,
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
              {CATEGORY_LABEL[template.category]}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-bold leading-snug text-slate-900 group-hover:text-indigo-700">
            {template.title}
          </h3>
        </div>
      </header>

      <p className="line-clamp-2 text-xs text-slate-500">{template.description}</p>

      <dl className="mt-auto grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="font-mono font-semibold uppercase tracking-wide text-slate-400">Version</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-slate-800">
            v{template.version}
            {template.status === 'published' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> published
              </span>
            )}
            {template.status === 'draft' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                draft
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold uppercase tracking-wide text-slate-400">Sections</dt>
          <dd className="mt-0.5 text-slate-800">{sectionCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono font-semibold uppercase tracking-wide text-slate-400">Route</dt>
          <dd className="mt-0.5 truncate text-slate-700" title={template.defaultRoute}>
            {template.defaultRoute || '—'}
          </dd>
        </div>
      </dl>

      {template.requireSeniorPmReview && (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 self-start">
          <ShieldCheck className="h-3 w-3" />
          Senior PM review required
        </span>
      )}

      <footer className="mt-2 flex items-center justify-end gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(template);
            }}
            disabled={anyOpening}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpen(template)}
          disabled={anyOpening}
          aria-busy={isOpening}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isOpening ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Opening…
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              {canEdit ? 'Open' : 'View'}
            </>
          )}
        </button>
      </footer>
    </article>
  );
}

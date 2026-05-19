import { useMemo } from 'react';
import { Plus, Users, Clock, Scale } from 'lucide-react';
import { clsx } from 'clsx';
import {
  type BodyTier,
  type FrameworkBody,
  TIER_LABEL,
  TIER_ORDER,
  TIER_STYLES,
} from './types';

interface FrameworkCanvasProps {
  bodies: FrameworkBody[];
  editMode: boolean;
  onOpenBody: (body: FrameworkBody) => void;
  onAddBody: (tier: BodyTier) => void;
}

// 4-tier framework canvas. One row per tier, bodies as cards within the row.
// Clicking a card opens the body editor. In edit mode, each tier gets an
// "Add body" slot appended.
export function FrameworkCanvas({ bodies, editMode, onOpenBody, onAddBody }: FrameworkCanvasProps) {
  const bodiesByTier = useMemo(() => {
    const map: Record<BodyTier, FrameworkBody[]> = {
      political: [],
      corporate: [],
      programme: [],
      project: [],
    };
    for (const body of bodies) {
      if (map[body.tier]) map[body.tier].push(body);
    }
    for (const tier of TIER_ORDER) {
      map[tier].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }
    return map;
  }, [bodies]);

  return (
    <div className="space-y-5">
      {TIER_ORDER.map((tier) => {
        const style = TIER_STYLES[tier];
        const tierBodies = bodiesByTier[tier];
        return (
          <section
            key={tier}
            className="rounded-lg border border-slate-200 bg-white shadow-sm"
            aria-label={`${TIER_LABEL[tier]} tier`}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className={clsx('inline-flex h-2.5 w-2.5 rounded-full', style.dot)} />
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  {TIER_LABEL[tier]}
                </h3>
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    style.badge,
                  )}
                >
                  {tierBodies.length} {tierBodies.length === 1 ? 'body' : 'bodies'}
                </span>
              </div>
              {editMode && (
                <button
                  type="button"
                  onClick={() => onAddBody(tier)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add body
                </button>
              )}
            </header>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tierBodies.map((body) => (
                <button
                  key={body._id}
                  type="button"
                  onClick={() => onOpenBody(body)}
                  className={clsx(
                    'group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all',
                    'hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">
                      {body.name}
                    </h4>
                    <span className={clsx('h-2 w-2 shrink-0 rounded-full', style.dot)} />
                  </div>
                  {body.cabinetMemberPortfolio && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      {body.cabinetMemberPortfolio}
                    </p>
                  )}
                  <p className="line-clamp-2 text-xs text-slate-500">{body.authority}</p>
                  <dl className="mt-1 grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="truncate" title={body.cadence}>
                        {body.cadence}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-slate-400" />
                      <span className="truncate" title={body.chair}>
                        {body.chair}
                      </span>
                    </div>
                    {body.acceptedReportTypes && body.acceptedReportTypes.length > 0 && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <Scale className="h-3 w-3 text-slate-400" />
                        <span
                          className="truncate"
                          title={body.acceptedReportTypes.join(', ')}
                        >
                          {body.acceptedReportTypes.join(' · ')}
                        </span>
                      </div>
                    )}
                  </dl>
                </button>
              ))}

              {editMode && (
                <button
                  type="button"
                  onClick={() => onAddBody(tier)}
                  className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 text-xs font-semibold text-slate-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50/60 hover:text-indigo-600"
                >
                  <Plus className="h-4 w-4" />
                  Add body
                </button>
              )}

              {!editMode && tierBodies.length === 0 && (
                <p className="col-span-full rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
                  No {TIER_LABEL[tier].toLowerCase()} bodies yet · enable edit mode to add one.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

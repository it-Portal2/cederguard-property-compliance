import { useState } from 'react';
import { Lightbulb, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import type { ReportTemplate } from './types';

interface AiRecommendationCardProps {
  onSelect: (template: ReportTemplate) => void;
  /** ID of the template currently being fetched by the parent (if any),
   *  so the recommendation buttons show a spinner + disable while loading. */
  openingId?: string | null;
}

interface Recommendation {
  recommended: ReportTemplate | null;
  supplementary: ReportTemplate[];
  reason: string;
  source: string;
}

export function AiRecommendationCard({ onSelect, openingId }: AiRecommendationCardProps) {
  const [intake, setIntake] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const run = async () => {
    if (!intake.trim()) {
      toast.error('Describe what you need to report on first.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.governanceAiRecommendTemplate(intake.trim());
      setRec({
        recommended: res.recommended ?? null,
        supplementary: res.supplementary ?? [],
        reason: res.reason ?? '',
        source: res.source ?? '',
      });
    } catch (e: any) {
      console.error('[AiRecommendationCard] failed', e);
      toast.error(e?.message ?? 'Recommendation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Lightbulb className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700">
            AI · recommend a template
          </p>
          <h2 className="text-sm font-bold text-slate-900">
            Tell the AI what you need to report on
          </h2>
          <p className="text-[11px] text-slate-600">
            Natural language works — e.g. "procurement strategy for a £2m housing HRB scheme" or "post-completion lessons learned".
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <input
          type="text"
          value={intake}
          onChange={(e) => setIntake(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
          placeholder="Describe your report in one or two sentences…"
          disabled={busy}
          className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Lightbulb className="h-3.5 w-3.5" />
          )}
          Recommend
        </button>
      </div>

      {rec && rec.recommended && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700">
            Recommended template
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900">
                {rec.recommended.code} · {rec.recommended.title}
              </h4>
              <p className="mt-1 text-xs text-slate-600">{rec.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => rec.recommended && onSelect(rec.recommended)}
              disabled={openingId != null}
              aria-busy={openingId === rec.recommended?.id}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {openingId === rec.recommended?.id ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  Open
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>

          {rec.supplementary.length > 0 && (
            <div className="mt-3 border-t border-indigo-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700">
                Also consider
              </p>
              <ul className="mt-1 space-y-1">
                {rec.supplementary.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      <span className="font-semibold text-slate-900">{t.code}</span>
                      <span className="text-slate-500"> · {t.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelect(t)}
                      disabled={openingId != null}
                      aria-busy={openingId === t.id}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {openingId === t.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Opening…
                        </span>
                      ) : (
                        <>Open →</>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-[10px] italic text-slate-400">{rec.source}</p>
        </div>
      )}
    </section>
  );
}

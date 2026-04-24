import { useEffect, useState } from 'react';
import { Loader2, Save, ScrollText, UploadCloud, History, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { api } from '../../../lib/api';
import type { TermsOfReference } from './types';

interface TorEditorProps {
  ownerBodyId: string;
  /** Active ToR — draft if one exists, else published, else null. */
  currentToR: TermsOfReference | null;
  /** Last published ToR, independent of whether a draft exists. */
  lastPublishedToR: TermsOfReference | null;
  onSaved: (tor: TermsOfReference) => void;
}

interface TorDraft {
  purpose: string;
  scope: string;
  authorityLevel: string;
  decisionRights: string;
  operatingPrinciples: string;
}

const EMPTY: TorDraft = {
  purpose: '',
  scope: '',
  authorityLevel: '',
  decisionRights: '',
  operatingPrinciples: '',
};

function torToDraft(tor: TermsOfReference | null): TorDraft {
  if (!tor) return { ...EMPTY };
  return {
    purpose: tor.purpose ?? '',
    scope: tor.scope ?? '',
    authorityLevel: tor.authorityLevel ?? '',
    decisionRights: tor.decisionRights ?? '',
    operatingPrinciples: tor.operatingPrinciples ?? '',
  };
}

export function TorEditor({
  ownerBodyId,
  currentToR,
  lastPublishedToR,
  onSaved,
}: TorEditorProps) {
  const [draft, setDraft] = useState<TorDraft>(torToDraft(currentToR));
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [versions, setVersions] = useState<TermsOfReference[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(torToDraft(currentToR));
  }, [currentToR]);

  const loadHistory = async () => {
    setLoadingVersions(true);
    try {
      const res = await api.governanceListToRVersions(ownerBodyId);
      setVersions(res.versions ?? []);
      setShowHistory(true);
    } catch (e: any) {
      console.error('[TorEditor] history load failed', e);
      toast.error(e?.message ?? 'Failed to load history.');
    } finally {
      setLoadingVersions(false);
    }
  };

  const save = async (publish: boolean) => {
    setSaving(publish ? 'publish' : 'draft');
    try {
      const res = await api.governanceUpsertToR(ownerBodyId, draft, publish);
      onSaved(res.tor);
      toast.success(publish ? 'ToR published' : 'ToR draft saved');
      // Keep the history panel in sync so the new / updated version is
      // visible immediately without closing + reopening the panel.
      if (showHistory) void loadHistory();
    } catch (e: any) {
      console.error('[TorEditor] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ScrollText className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Terms of Reference</h3>
            <p className="text-[11px] text-slate-500">
              Multi-field versioned document. Save as draft while editing; publish supersedes
              the previous version and appears on the public Constitution export.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          disabled={loadingVersions}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingVersions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
          History
        </button>
      </header>

      <TorStatusBanner current={currentToR} lastPublished={lastPublishedToR} />

      <div className="grid grid-cols-1 gap-4">
        <TorField
          label="Purpose"
          value={draft.purpose}
          onChange={(v) => setDraft((d) => ({ ...d, purpose: v }))}
          placeholder="Why this body exists. Describe the mandate in 2–3 sentences."
          rows={3}
        />
        <TorField
          label="Scope"
          value={draft.scope}
          onChange={(v) => setDraft((d) => ({ ...d, scope: v }))}
          placeholder="What this body does — decisions it takes, reports it receives, bodies it escalates to."
          rows={3}
        />
        <TorField
          label="Authority level"
          value={draft.authorityLevel}
          onChange={(v) => setDraft((d) => ({ ...d, authorityLevel: v }))}
          placeholder="Financial limits, delegated authority, statutory basis."
          rows={2}
        />
        <TorField
          label="Decision rights"
          value={draft.decisionRights}
          onChange={(v) => setDraft((d) => ({ ...d, decisionRights: v }))}
          placeholder="Who signs off what. Voting members, quorum, casting votes."
          rows={2}
        />
        <TorField
          label="Operating principles"
          value={draft.operatingPrinciples}
          onChange={(v) => setDraft((d) => ({ ...d, operatingPrinciples: v }))}
          placeholder="Meeting cadence, conflicts policy, reporting cycle, working-day offsets."
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
          Publish new version
        </button>
      </div>

      {showHistory && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Version history
            </h4>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-slate-400">No prior versions.</p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => {
                const isOpen = expandedVersionId === v._id;
                const isActiveDraft = v.status === 'draft' && v._id === currentToR?._id;
                return (
                  <li
                    key={v._id}
                    className="overflow-hidden rounded-lg bg-white"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedVersionId((prev) => (prev === v._id ? null : v._id))
                      }
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">
                            Version {v.version}
                          </p>
                          <p className="text-slate-500">
                            {v.status} ·{' '}
                            {v.publishedAt
                              ? new Date(v.publishedAt).toLocaleDateString('en-GB')
                              : v.updatedAt
                              ? new Date(v.updatedAt).toLocaleDateString('en-GB')
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-2">
                        {isActiveDraft && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            In editor
                          </span>
                        )}
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            v.status === 'published'
                              ? 'bg-emerald-100 text-emerald-700'
                              : v.status === 'draft'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {v.status}
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3 text-xs">
                        <VersionReadout tor={v} />
                        {isActiveDraft && (
                          <div className="mt-3 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setShowHistory(false);
                                setExpandedVersionId(null);
                                // The form is already bound to this draft —
                                // closing history returns focus there.
                              }}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700"
                            >
                              Continue editing this draft
                            </button>
                          </div>
                        )}
                        {v.status === 'draft' && !isActiveDraft && (
                          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                            This draft is stale — only the active draft can be edited.
                          </p>
                        )}
                        {(v.status === 'published' || v.status === 'superseded') && (
                          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-600">
                            {v.status === 'published'
                              ? 'Currently live. Use the editor above to create a new draft that supersedes this version.'
                              : 'Historical record. Retained for audit + FOI; cannot be edited directly.'}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface TorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

// Truthful status banner. Reflects what the author is ACTUALLY editing,
// independent of what was last published. Four distinct states:
//   1. No ToR at all yet         → "Drafting v1 (not yet published)" [indigo]
//   2. Active draft, no prior    → "Editing draft vN — no previous published version" [amber]
//   3. Active draft + prior pub  → "Editing draft vN — last published vM on {date}" [amber]
//   4. No draft, published only  → "Showing published vN from {date} — your edits will create draft v(N+1)" [emerald]
function TorStatusBanner({
  current,
  lastPublished,
}: {
  current: TermsOfReference | null;
  lastPublished: TermsOfReference | null;
}) {
  // Case 1 — brand new body, no ToR at all
  if (!current && !lastPublished) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        Drafting v1 · not yet published
      </div>
    );
  }

  // Case 4 — published exists, no active draft → user is about to create a new draft
  if (current && current.status === 'published' && !lastPublished) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Showing published v{current.version} · your edits will create a new draft
      </div>
    );
  }
  if (current && current.status === 'published' && lastPublished) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Published v{current.version}
        {current.publishedAt && (
          <> · {new Date(current.publishedAt).toLocaleDateString('en-GB')}</>
        )}
        {' '}· your edits will create draft v{current.version + 1}
      </div>
    );
  }

  // Case 2 + 3 — active is a draft
  if (current && current.status === 'draft') {
    return (
      <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Editing draft v{current.version}
        {lastPublished ? (
          <>
            {' '}· last published v{lastPublished.version}
            {lastPublished.publishedAt && (
              <> on {new Date(lastPublished.publishedAt).toLocaleDateString('en-GB')}</>
            )}
          </>
        ) : (
          <> · no previous published version</>
        )}
      </div>
    );
  }

  return null;
}

// Read-only preview of a historical ToR version. Mirrors the 5 editable
// fields from the live editor so authors can see exactly what that version
// contained without risking accidental edits.
function VersionReadout({ tor }: { tor: TermsOfReference }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Purpose', value: tor.purpose ?? '' },
    { label: 'Scope', value: tor.scope ?? '' },
    { label: 'Authority level', value: tor.authorityLevel ?? '' },
    { label: 'Decision rights', value: tor.decisionRights ?? '' },
    { label: 'Operating principles', value: tor.operatingPrinciples ?? '' },
  ];
  return (
    <dl className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {r.label}
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-xs text-slate-800">
            {r.value || <span className="italic text-slate-400">— empty —</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TorField({ label, value, onChange, placeholder, rows = 3 }: TorFieldProps) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="mb-1 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
    </label>
  );
}

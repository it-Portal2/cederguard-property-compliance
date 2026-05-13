// Two-step meeting picker.
//
// Step 1: pick a framework body (free choice — Q7 = a)
// Step 2: pick a Scheduled meeting of that body (sorted ascending,
//         formatted "8 May 2026 · 10:00 · DPB · 3 reports" per Q31)
//
// Used inside the ReportModal. Empty state when no schedule exists
// (Q22 = a) prompts the PM to ask their PgM to set up the year ahead.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../lib/api';
import type { FrameworkBody } from './framework/types';
import type { Meeting } from './meetings/types';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

interface Props {
  /** Currently selected meetingId (or null when nothing picked yet).*/
  value: string | null;
  /** Called with the new meetingId on every pick.*/
  onChange: (meetingId: string | null) => void;
  /** Disable interaction when the host modal is read-only.*/
  disabled?: boolean;
  /** Compact display in narrow contexts.*/
  compact?: boolean;
}

function formatGbDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function shortBodyName(name: string | undefined): string {
  if (!name) return '';
  const idx = name.indexOf(' · ');
  return idx > 0 ? name.slice(0, idx).trim() : name.trim();
}

export function MeetingPicker({ value, onChange, disabled, compact }: Props) {
  const [bodies, setBodies] = useState<FrameworkBody[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedBodyId, setPickedBodyId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [fwRes, mtgRes] = await Promise.all([
          api.governanceGetFramework(),
          api.governanceListMeetings(),
        ]);
        if (cancelled) return;
        setBodies(((fwRes?.bodies ?? []) as FrameworkBody[]) || []);
        const live = ((mtgRes?.items ?? []) as Meeting[]).filter(
          (m) => !m.softDeleted && m.status === 'Scheduled',
        );
        live.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
        setMeetings(live);
      } catch (e) {
        console.error('[MeetingPicker] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When `value` changes externally (e.g. modal opens with existing
  // meetingId), pre-fill the body picker from the matching meeting's
  // body so the second dropdown shows the right options.
  useEffect(() => {
    if (!value) return;
    const m = meetings.find((mtg) => mtg.id === value);
    if (m && m.governanceBodyId) {
      setPickedBodyId(m.governanceBodyId);
    }
  }, [value, meetings]);

  const sortedBodies = useMemo(() => {
    const order = { political: 0, corporate: 1, programme: 2, project: 3 };
    return [...bodies].sort((a, b) => {
      const ao = order[a.tier] ?? 9;
      const bo = order[b.tier] ?? 9;
      if (ao !== bo) return ao - bo;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [bodies]);

  const meetingsForBody = useMemo(() => {
    if (!pickedBodyId) return [];
    return meetings.filter((m) => m.governanceBodyId === pickedBodyId);
  }, [meetings, pickedBodyId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
        Loading bodies + meetings…
      </div>
    );
  }

  // Empty state — Q22 = a. No meetings scheduled yet.
  if (meetings.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="inline-flex items-center gap-1 font-semibold">
          <AlertTriangle className="h-3 w-3" />
          No board meetings scheduled yet
        </p>
        <p className="mt-1 text-amber-700">
          Your Programme Manager hasn't set up the year-ahead schedule.
          Save your report as Draft for now — you can pick a board date
          once the schedule is in place.
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}
    >
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          1. Board
        </label>
        <select
          className={clsx(inputCls, 'mt-1')}
          value={pickedBodyId}
          disabled={disabled}
          onChange={(e) => {
            setPickedBodyId(e.target.value);
            // Clearing the date picker when body changes prevents
            // accidentally keeping a meetingId from a different body.
            onChange(null);
          }}
        >
          <option value="">— Select board —</option>
          {sortedBodies.map((b) => (
            <option key={b._id ?? b.id} value={b.id ?? b._id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          2. Date
        </label>
        <select
          className={clsx(inputCls, 'mt-1')}
          value={value ?? ''}
          disabled={disabled || !pickedBodyId}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">
            {pickedBodyId
              ? meetingsForBody.length === 0
                ? '— No meetings scheduled for this board —'
                : '— Select date —'
              : '— Pick a board first —'}
          </option>
          {meetingsForBody.map((m) => {
            const reportsCount = (m.linkedReportIds ?? []).length;
            const short = shortBodyName(m.governanceBodyLabel);
            return (
              <option key={m.id} value={m.id}>
                {formatGbDate(m.date)} · {m.timeStart} · {short}
                {reportsCount > 0 ? ` · ${reportsCount} report${reportsCount === 1 ? '' : 's'}` : ''}
              </option>
            );
          })}
        </select>
        {value && (
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-indigo-600">
            <Calendar className="h-2.5 w-2.5" />
            Slot will request confirmation from the Programme Manager.
          </p>
        )}
      </div>
    </div>
  );
}

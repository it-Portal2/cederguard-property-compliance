import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Info,
  Users as UsersIcon,
  ListOrdered,
  FileText,
  Gavel,
  CheckSquare,
  CheckCircle2,
  Circle,
  Calendar,
  Link2,
  Search,
  FolderKanban,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import { useStore } from '../../../store/useStore';
import type { FrameworkBody } from '../framework/types';
import type {
  Attendee,
  Meeting,
  MeetingActionItem,
  MeetingDecision,
  MeetingStatus,
} from './types';
import { STATUS_STYLES } from './types';
import { GovernanceEditor } from '../editor/GovernanceEditor';
import ConfirmDialog from '../../table/ConfirmDialog';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-wider text-slate-500';

function makeMeetingId(title: string, body: string): string {
  const slug = `${title}-${body}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const suffix = (Date.now() % 1_000_000).toString(36);
  return `${slug || 'meeting'}-${suffix}`;
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

interface DetailsForm {
  title: string;
  governanceBodyId: string;
  governanceBodyLabel: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  chairLabel: string;
  attendees: Attendee[];
  agenda: string[];
}

const EMPTY_DETAILS: DetailsForm = {
  title: '',
  governanceBodyId: '',
  governanceBodyLabel: '',
  date: '',
  timeStart: '10:00',
  timeEnd: '12:00',
  location: '',
  chairLabel: '',
  attendees: [],
  agenda: [],
};

type TabKey =
  | 'details'
  | 'attendees'
  | 'agenda'
  | 'minutes'
  | 'decisions'
  | 'actions'
  | 'links';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When false the tab is hidden in the strip.*/
  show: (status: MeetingStatus, isNew: boolean) => boolean;
}

const TABS: TabDef[] = [
  { key: 'details', label: 'Details', icon: Info, show: () => true },
  { key: 'attendees', label: 'Attendees', icon: UsersIcon, show: () => true },
  { key: 'agenda', label: 'Agenda', icon: ListOrdered, show: () => true },
  // Minutes hidden until the meeting exists — empty Tiptap on a
  // not-yet-created meeting is just confusing.
  {
    key: 'minutes',
    label: 'Minutes',
    icon: FileText,
    show: (_s, isNew) => !isNew,
  },
  {
    key: 'decisions',
    label: 'Decisions',
    icon: Gavel,
    show: (s) => s === 'Held' || s === 'Cancelled',
  },
  {
    key: 'actions',
    label: 'Actions',
    icon: CheckSquare,
    show: (s) => s === 'Held' || s === 'Cancelled',
  },
  // Links visible after the meeting exists — links don't make sense
  // pre-create. Editable on Scheduled + Held, read-only on Cancelled.
  {
    key: 'links',
    label: 'Links',
    icon: Link2,
    show: (_s, isNew) => !isNew,
  },
];

interface Props {
  isOpen: boolean;
  meeting: Meeting | null;
  existingIds: string[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (m: Meeting) => void;
}

export function MeetingModal({
  isOpen,
  meeting,
  existingIds,
  canEdit,
  onClose,
  onSaved,
}: Props) {
  // ── Hooks first ──────────────────────────────────────────
  const [form, setForm] = useState<DetailsForm>(EMPTY_DETAILS);
  const [bodies, setBodies] = useState<FrameworkBody[]>([]);
  const [loadingBodies, setLoadingBodies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const initialSnapshot = useRef<DetailsForm>(EMPTY_DETAILS);
  // Local mirror of the meeting so server-side appends (decisions /
  // actions / minutes) update the modal without forcing a parent
  // re-render. Parent gets the latest copy via onSaved.
  const [meetingState, setMeetingState] = useState<Meeting | null>(meeting);

  useEffect(() => {
    setMeetingState(meeting);
  }, [meeting]);

  useEffect(() => {
    if (!isOpen) return;
    const next: DetailsForm = meeting
      ? {
          title: meeting.title ?? '',
          governanceBodyId: meeting.governanceBodyId ?? '',
          governanceBodyLabel: meeting.governanceBodyLabel ?? '',
          date: meeting.date ?? '',
          timeStart: meeting.timeStart ?? '10:00',
          timeEnd: meeting.timeEnd ?? '12:00',
          location: meeting.location ?? '',
          chairLabel: meeting.chairLabel ?? '',
          attendees: meeting.attendees ?? [],
          agenda: meeting.agenda ?? [],
        }
      : EMPTY_DETAILS;
    setForm(next);
    initialSnapshot.current = next;
    setActiveTab('details');
  }, [isOpen, meeting]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingBodies(true);
      try {
        const res = await api.governanceGetFramework();
        if (cancelled) return;
        setBodies(((res?.bodies ?? []) as FrameworkBody[]) || []);
      } catch (e: any) {
        console.error('[MeetingModal] framework load failed', e);
        if (!cancelled) {
          toast.error(
            e?.message ?? 'Failed to load governance bodies — body picker disabled.',
          );
        }
      } finally {
        if (!cancelled) setLoadingBodies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialSnapshot.current),
    [form],
  );

  const sortedBodies = useMemo(() => {
    const order = { political: 0, corporate: 1, programme: 2, project: 3 };
    return [...bodies].sort((a, b) => {
      const ao = order[a.tier] ?? 9;
      const bo = order[b.tier] ?? 9;
      if (ao !== bo) return ao - bo;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [bodies]);

  const isNew = !meetingState;
  const status: MeetingStatus = meetingState?.status ?? 'Scheduled';
  const statusStyle = STATUS_STYLES[status];
  const detailsLocked = !canEdit || (meetingState && status !== 'Scheduled');
  const minutesLocked = !canEdit || status === 'Cancelled';
  const childrenLocked = !canEdit || status !== 'Held';

  const visibleTabs = useMemo(
    () => TABS.filter((t) => t.show(status, isNew)),
    [status, isNew],
  );

  if (!isOpen) return null;

  const handleClose = () => {
    if (saving) return;
    // Details / Attendees / Agenda all share `form` state — any of
    // them can be dirty. Decisions / Actions / Minutes persist
    // per-action server-side, so they're never dirty on close.
    if (isDirty && (activeTab === 'details' || activeTab === 'attendees' || activeTab === 'agenda')) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const confirmDiscardClose = () => {
    setDiscardConfirmOpen(false);
    onClose();
  };

  const setField = <K extends keyof DetailsForm>(k: K, v: DetailsForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleBodyPick = (id: string) => {
    const found = sortedBodies.find((b) => b.id === id || b._id === id);
    setForm((p) => ({
      ...p,
      governanceBodyId: id,
      governanceBodyLabel: found?.name ?? p.governanceBodyLabel,
    }));
  };

  const handleSaveDetails = async () => {
    if (!canEdit) return;
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!form.date) {
      toast.error('Date is required.');
      return;
    }
    setSaving(true);
    try {
      let meetingId = meetingState?.id;
      if (!meetingId) {
        let attempt = makeMeetingId(form.title, form.governanceBodyLabel);
        let guard = 0;
        while (existingIds.includes(attempt) && guard < 12) {
          attempt = makeMeetingId(form.title, form.governanceBodyLabel);
          guard += 1;
        }
        meetingId = attempt;
      }
      const cleanAttendees = form.attendees.filter((a) => a.label.trim());
      const cleanAgenda = form.agenda
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      const patch: Record<string, any> = {
        title: form.title.trim(),
        governanceBodyId: form.governanceBodyId || null,
        governanceBodyLabel: form.governanceBodyLabel.trim(),
        date: form.date,
        timeStart: form.timeStart,
        timeEnd: form.timeEnd,
        location: form.location.trim(),
        chairUid: null,
        chairLabel: form.chairLabel.trim(),
        attendees: cleanAttendees,
        agenda: cleanAgenda,
      };
      const res = await api.governanceUpsertMeeting(meetingId, patch);
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      const saved = res.item as Meeting;
      onSaved(saved);
      setMeetingState(saved);
      initialSnapshot.current = form;
      toast.success(meetingState ? 'Meeting updated' : 'Meeting created');
    } catch (e: any) {
      console.error('[MeetingModal] save failed', e);
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // Push server response into both the modal mirror + the parent list.
  const acceptServerUpdate = (saved: Meeting) => {
    setMeetingState(saved);
    onSaved(saved);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative flex max-h-[92vh] w-[min(840px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Header*/}
          <header className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {meetingState ? 'Edit meeting' : 'New meeting'}
              </p>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">
                {meetingState?.title || form.title || 'Untitled meeting'}
              </h2>
              {meetingState && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {formatGbDate(meetingState.date)} ·{' '}
                  {meetingState.timeStart}–{meetingState.timeEnd} ·{' '}
                  {meetingState.governanceBodyLabel || 'No body assigned'}
                </p>
              )}
            </div>
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                statusStyle.cls,
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
              {statusStyle.label}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Tab strip*/}
          <nav className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-4 pt-3">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
                    isActive
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {tabBadge(t.key, meetingState)}
                </button>
              );
            })}
          </nav>

          {/* Body*/}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'details' && (
              <DetailsTab
                form={form}
                setField={setField}
                handleBodyPick={handleBodyPick}
                sortedBodies={sortedBodies}
                loadingBodies={loadingBodies}
                readOnly={!!detailsLocked}
                statusBanner={
                  meetingState && status !== 'Scheduled' ? (
                    <ReadOnlyBanner status={status} />
                  ) : null
                }
              />
            )}
            {activeTab === 'attendees' && (
              <AttendeesTab
                attendees={form.attendees}
                onChange={(next) => setField('attendees', next)}
                readOnly={!!detailsLocked}
              />
            )}
            {activeTab === 'agenda' && (
              <AgendaTab
                agenda={form.agenda}
                onChange={(next) => setField('agenda', next)}
                readOnly={!!detailsLocked}
              />
            )}
            {activeTab === 'minutes' && meetingState && (
              <MinutesTab
                meetingId={meetingState.id}
                initialContent={meetingState.minutes?.content ?? null}
                lastEditedAt={meetingState.minutes?.lastEditedAt ?? null}
                wordCount={meetingState.minutes?.wordCount ?? 0}
                readOnly={!!minutesLocked}
                onSaved={acceptServerUpdate}
                aiContext={[
                  meetingState.governanceBodyLabel || meetingState.title || 'Meeting',
                  meetingState.date ? `held ${meetingState.date}` : null,
                  Array.isArray(meetingState.agenda) && meetingState.agenda.length
                    ? `agenda: ${meetingState.agenda.slice(0, 5).join('; ')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            {activeTab === 'decisions' && meetingState && (
              <DecisionsTab
                meetingId={meetingState.id}
                decisions={meetingState.decisions ?? []}
                readOnly={!!childrenLocked}
                onUpdate={acceptServerUpdate}
              />
            )}
            {activeTab === 'actions' && meetingState && (
              <ActionsTab
                meetingId={meetingState.id}
                actionItems={meetingState.actionItems ?? []}
                readOnly={!!childrenLocked}
                onUpdate={acceptServerUpdate}
              />
            )}
            {activeTab === 'links' && meetingState && (
              <LinksTab
                meetingId={meetingState.id}
                linkedReportIds={meetingState.linkedReportIds ?? []}
                linkedProjectIds={meetingState.linkedProjectIds ?? []}
                readOnly={!canEdit || status === 'Cancelled'}
                onUpdate={acceptServerUpdate}
              />
            )}
          </div>

          {/* Footer*/}
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {detailsLocked && activeTab === 'details' ? 'Close' : 'Cancel'}
            </button>
            {/* Details-tab Save button. Other tabs persist per action
 via their own server endpoints.*/}
            {activeTab === 'details' && !detailsLocked && (
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={saving}
                className="inline-flex h-9 min-w-30 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {meetingState ? 'Save details' : 'Create meeting'}
              </button>
            )}
            {(activeTab === 'attendees' || activeTab === 'agenda') &&
              !detailsLocked &&
              meetingState && (
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  disabled={saving}
                  className="inline-flex h-9 min-w-30 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save changes
                </button>
              )}
          </footer>
        </motion.div>
      </motion.div>
      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        message="You have edits in Details, Attendees or Agenda that haven't been saved. Closing the modal will discard them."
        confirmLabel="Discard changes"
        variant="danger"
        onConfirm={confirmDiscardClose}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </AnimatePresence>
  );
}

// ── Tab badges ───────────────────────────────────────────────────────────

function tabBadge(key: TabKey, m: Meeting | null) {
  if (!m) return null;
  let count = 0;
  if (key === 'attendees') count = m.attendees?.length ?? 0;
  else if (key === 'agenda') count = m.agenda?.length ?? 0;
  else if (key === 'decisions') count = m.decisions?.length ?? 0;
  else if (key === 'links')
    count = (m.linkedReportIds?.length ?? 0) + (m.linkedProjectIds?.length ?? 0);
  else if (key === 'actions') {
    const open = (m.actionItems ?? []).filter((a) => a.status === 'open').length;
    if (open > 0) {
      return (
        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">
          {open}
        </span>
      );
    }
    count = m.actionItems?.length ?? 0;
  }
  if (count <= 0) return null;
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
      {count}
    </span>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function ReadOnlyBanner({ status }: { status: MeetingStatus }) {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      This meeting is {status.toLowerCase()} — details are read-only. Use the
      list-page actions to change status.
    </div>
  );
}

function DetailsTab({
  form,
  setField,
  handleBodyPick,
  sortedBodies,
  loadingBodies,
  readOnly,
  statusBanner,
}: {
  form: DetailsForm;
  setField: <K extends keyof DetailsForm>(k: K, v: DetailsForm[K]) => void;
  handleBodyPick: (id: string) => void;
  sortedBodies: FrameworkBody[];
  loadingBodies: boolean;
  readOnly: boolean;
  statusBanner: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {statusBanner}
      <div>
        <label className={labelCls}>Title</label>
        <input
          className={clsx(inputCls, 'mt-1')}
          value={form.title}
          disabled={readOnly}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="e.g. DPB · 8 May 2026"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls}>Governance body</label>
          <select
            className={clsx(inputCls, 'mt-1')}
            value={form.governanceBodyId}
            disabled={readOnly || loadingBodies}
            onChange={(e) => handleBodyPick(e.target.value)}
          >
            <option value="">— Select body —</option>
            {sortedBodies.map((b) => (
              <option key={b._id ?? b.id} value={b.id ?? b._id}>
                {b.name}
              </option>
            ))}
          </select>
          {loadingBodies && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Loading bodies…
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input
            type="date"
            className={clsx(inputCls, 'mt-1')}
            value={form.date}
            disabled={readOnly}
            onChange={(e) => setField('date', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Start time</label>
          <input
            type="time"
            className={clsx(inputCls, 'mt-1')}
            value={form.timeStart}
            disabled={readOnly}
            onChange={(e) => setField('timeStart', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>End time</label>
          <input
            type="time"
            className={clsx(inputCls, 'mt-1')}
            value={form.timeEnd}
            disabled={readOnly}
            onChange={(e) => setField('timeEnd', e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Location</label>
          <input
            className={clsx(inputCls, 'mt-1')}
            value={form.location}
            disabled={readOnly}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="e.g. Tooley Street · Room 4.12 / MS Teams"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Chair</label>
          <input
            className={clsx(inputCls, 'mt-1')}
            value={form.chairLabel}
            disabled={readOnly}
            onChange={(e) => setField('chairLabel', e.target.value)}
            placeholder="e.g. Strategic Director · Housing"
          />
        </div>
      </div>
    </div>
  );
}

interface WorkspaceMember {
  uid: string;
  name: string;
  email: string;
  role: string;
  pmLevel: string | null;
}

// Derive a readable display name. Priority:
//   1. Explicit `name` field on the user doc.
//   2. Email's local part, title-cased ("tusharbhowal3211@gmail.com" →
//      "Tusharbhowal3211"). Workspace users created via invite-flow
//      don't always have a `name` set, so this fallback prevents the
//      raw email duplicating in the row.
//   3. The uid as a last resort.
function memberLabel(m: WorkspaceMember): string {
  const name = m.name?.trim();
  if (name) return name;
  const local = (m.email ?? '').split('@')[0];
  if (local) {
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return m.uid;
}

function memberRoleLabel(m: WorkspaceMember): string {
  if (m.role === 'project_manager') {
    return m.pmLevel === 'senior' ? 'Senior PM' : 'PM';
  }
  if (m.role === 'client_admin') return 'Client Admin';
  if (m.role === 'super_admin') return 'Super Admin';
  if (m.role === 'strategic_director') return 'Strategic Director';
  if (m.role === 'admin') return 'Admin';
  return m.role;
}

function AttendeesTab({
  attendees,
  onChange,
  readOnly,
}: {
  attendees: Attendee[];
  onChange: (next: Attendee[]) => void;
  readOnly: boolean;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Structured external-attendee form (3 fields per
  // industry-standard request). Stored as { uid: null, label, email, role }
  // so future cross-meeting reporting / FOI exports can group by role.
  const [externalName, setExternalName] = useState('');
  const [externalRole, setExternalRole] = useState('');
  const [externalEmail, setExternalEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMembers(true);
      try {
        const res = await api.governanceListWorkspaceMembers();
        if (cancelled) return;
        setMembers((res?.members ?? []) as WorkspaceMember[]);
      } catch (e: any) {
        console.error('[AttendeesTab] members load failed', e);
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedUids = useMemo(
    () =>
      new Set(
        attendees
          .map((a) => a.uid)
          .filter((u): u is string => typeof u === 'string' && u.length > 0),
      ),
    [attendees],
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => !selectedUids.has(m.uid))
      .filter(
        (m) =>
          !q ||
          memberLabel(m).toLowerCase().includes(q) ||
          (m.email ?? '').toLowerCase().includes(q) ||
          memberRoleLabel(m).toLowerCase().includes(q),
      );
  }, [members, selectedUids, search]);

  const addMember = (m: WorkspaceMember) => {
    onChange([
      ...attendees,
      {
        uid: m.uid,
        label: memberLabel(m),
        email: m.email || null,
        role: memberRoleLabel(m),
      },
    ]);
    setSearch('');
    setPickerOpen(false);
  };

  const addExternal = () => {
    const name = externalName.trim();
    const role = externalRole.trim();
    const email = externalEmail.trim();
    if (!name) {
      toast.error('Name is required for an external attendee.');
      return;
    }
    onChange([
      ...attendees,
      {
        uid: null,
        label: name,
        role: role || null,
        email: email || null,
      },
    ]);
    setExternalName('');
    setExternalRole('');
    setExternalEmail('');
    setPickerOpen(false);
  };

  const remove = (idx: number) =>
    onChange(attendees.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Pick from your workspace below, or add an external attendee as
          plain text.
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-3 w-3" />
            {pickerOpen ? 'Close picker' : 'Add attendee'}
          </button>
        )}
      </div>

      {/* Selected attendees*/}
      {attendees.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] italic text-slate-400">
          No attendees yet.{!readOnly && ' Click Add attendee to start.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attendees.map((a, idx) => {
            const isInternal = !!a.uid;
            // Derive a clean initials avatar from the label (workspace
            // members have a real name; externals enter their own).
            const initials = ((a.label ?? '').match(/\b[A-Za-z]/g) ?? [])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <li
                key={`${a.uid ?? 'ext'}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span
                  className={clsx(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    isInternal
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600',
                  )}
                  title={isInternal ? 'Workspace member' : 'External attendee'}
                >
                  {initials || (isInternal ? '?' : 'EXT')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">
                    {a.label}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {[a.role, a.email].filter(Boolean).join(' · ') ||
                      (isInternal ? 'Workspace member' : 'External attendee')}
                  </p>
                </div>
                {!isInternal && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    External
                  </span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove attendee"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Picker*/}
      {!readOnly && pickerOpen && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Add from workspace
            </p>
          </header>
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className={clsx(inputCls, 'h-8 pl-7 text-xs')}
                placeholder="Search by name, email or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loadingMembers ? (
              <div className="space-y-2 p-3">
                <div className="h-8 animate-pulse rounded bg-slate-100" />
                <div className="h-8 animate-pulse rounded bg-slate-100" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] italic text-slate-400">
                {search
                  ? 'No matches in your workspace.'
                  : 'Everyone in your workspace is already added.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {filteredMembers.map((m) => {
                  const display = memberLabel(m);
                  const initials =
                    (display.match(/\b[A-Za-z]/g) ?? [])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '?';
                  return (
                    <li key={m.uid}>
                      <button
                        type="button"
                        onClick={() => addMember(m)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                      >
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                          {initials}
                        </span>
                        <span className="flex-1 min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {display}
                          </p>
                          {m.email && display !== m.email && (
                            <p className="truncate text-[10px] text-slate-500">
                              {m.email}
                            </p>
                          )}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {memberRoleLabel(m)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/40 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Or add external attendee
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className={clsx(inputCls, 'h-8 text-xs')}
                  placeholder="e.g. Jane Smith"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExternal();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">
                  Role
                </label>
                <input
                  type="text"
                  className={clsx(inputCls, 'h-8 text-xs')}
                  placeholder="e.g. S151 Officer"
                  value={externalRole}
                  onChange={(e) => setExternalRole(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExternal();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  className={clsx(inputCls, 'h-8 text-xs')}
                  placeholder="optional"
                  value={externalEmail}
                  onChange={(e) => setExternalEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExternal();
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={addExternal}
                disabled={!externalName.trim()}
                className="inline-flex h-8 items-center rounded-md bg-slate-700 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add external attendee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaTab({
  agenda,
  onChange,
  readOnly,
}: {
  agenda: string[];
  onChange: (next: string[]) => void;
  readOnly: boolean;
}) {
  const add = () => onChange([...agenda, '']);
  const update = (idx: number, text: string) => {
    const next = [...agenda];
    next[idx] = text;
    onChange(next);
  };
  const remove = (idx: number) => onChange(agenda.filter((_, i) => i !== idx));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          One bullet per agenda item — they appear in order on the meeting page.
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-3 w-3" />
            Add item
          </button>
        )}
      </div>
      {agenda.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] italic text-slate-400">
          No agenda items yet.{!readOnly && ' Click Add item to start.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {agenda.map((text, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400">
                {idx + 1}.
              </span>
              <input
                className={clsx(inputCls, 'flex-1')}
                value={text}
                disabled={readOnly}
                onChange={(e) => update(idx, e.target.value)}
                placeholder="Agenda item"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove agenda item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Minutes (Tiptap via shared GovernanceEditor) ─────────────────────────

function MinutesTab({
  meetingId,
  initialContent,
  lastEditedAt,
  wordCount: initialWordCount,
  readOnly,
  onSaved,
  aiContext,
}: {
  meetingId: string;
  initialContent: any | null;
  lastEditedAt: string | null;
  wordCount: number;
  readOnly: boolean;
  onSaved: (m: Meeting) => void;
  aiContext?: string;
}) {
  // Auto-save on every doc change (debounced inside the editor) →
  // hits governanceSaveMeetingMinutes → server merges + returns
  // updated meeting; we propagate via onSaved.
  const onAutoSave = async (json: any, words: number) => {
    try {
      const res = await api.governanceSaveMeetingMinutes(meetingId, json, words);
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      onSaved(res.item as Meeting);
    } catch (e: any) {
      console.error('[MinutesTab] save failed', e);
      toast.error(e?.message ?? 'Failed to save minutes.');
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>
          {lastEditedAt
            ? `Last saved ${formatGbDate(lastEditedAt)} · ${initialWordCount} words`
            : 'Not edited yet'}
        </span>
        {readOnly && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            <Info className="h-3 w-3" /> Read-only — meeting cancelled
          </span>
        )}
      </div>
      <div className="rounded-lg border border-slate-200">
        <GovernanceEditor
          initialContent={initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }}
          editable={!readOnly}
          placeholder="Capture minutes — discussion, decisions, follow-up notes."
          onAutoSave={onAutoSave}
          aiContext={aiContext}
        />
      </div>
    </div>
  );
}

// ── Decisions ────────────────────────────────────────────────────────────

function DecisionsTab({
  meetingId,
  decisions,
  readOnly,
  onUpdate,
}: {
  meetingId: string;
  decisions: MeetingDecision[];
  readOnly: boolean;
  onUpdate: (m: Meeting) => void;
}) {
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const add = async () => {
    if (adding) return;
    if (newText.trim().length < 3) {
      toast.error('Decision text required (min 3 chars).');
      return;
    }
    setAdding(true);
    try {
      const res = await api.governanceAddMeetingDecision(meetingId, newText);
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      onUpdate(res.item as Meeting);
      setNewText('');
      toast.success('Decision recorded');
    } catch (e: any) {
      console.error('[DecisionsTab] add failed', e);
      toast.error(e?.message ?? 'Failed to record decision.');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (decisionId: string) => {
    if (deletingId) return;
    setDeletingId(decisionId);
    try {
      const res = await api.governanceDeleteMeetingDecision(meetingId, decisionId);
      if (!res?.success) throw new Error(res?.error ?? 'Delete failed.');
      onUpdate(res.item as Meeting);
      toast.success('Decision removed');
    } catch (e: any) {
      console.error('[DecisionsTab] delete failed', e);
      toast.error(e?.message ?? 'Failed to remove decision.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <label className={labelCls}>New decision</label>
          <textarea
            className={clsx(inputCls, 'mt-1 min-h-16 resize-none')}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g. Approved Aspen Court KM4 recommendations subject to S151 sign-off."
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={adding}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adding && <Loader2 className="h-3 w-3 animate-spin" />}
              Record decision
            </button>
          </div>
        </div>
      )}
      {decisions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] italic text-slate-400">
          No decisions recorded yet.
        </p>
      ) : (
        <ol className="space-y-2">
          {decisions.map((d, idx) => (
            <li
              key={d.id}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="text-xs leading-snug text-slate-800">{d.text}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Recorded {formatGbDate(d.takenAt)}
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  disabled={deletingId === d.id}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Remove decision"
                >
                  {deletingId === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Action items ─────────────────────────────────────────────────────────

function ActionsTab({
  meetingId,
  actionItems,
  readOnly,
  onUpdate,
}: {
  meetingId: string;
  actionItems: MeetingActionItem[];
  readOnly: boolean;
  onUpdate: (m: Meeting) => void;
}) {
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async () => {
    if (adding) return;
    if (text.trim().length < 3) {
      toast.error('Action text required (min 3 chars).');
      return;
    }
    setAdding(true);
    try {
      const res = await api.governanceAddMeetingActionItem(
        meetingId,
        text,
        owner,
        dueDate || null,
      );
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      onUpdate(res.item as Meeting);
      setText('');
      setOwner('');
      setDueDate('');
      toast.success('Action recorded');
    } catch (e: any) {
      console.error('[ActionsTab] add failed', e);
      toast.error(e?.message ?? 'Failed to record action.');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (actionItemId: string) => {
    if (busyId) return;
    setBusyId(actionItemId);
    try {
      const res = await api.governanceToggleMeetingActionItem(
        meetingId,
        actionItemId,
      );
      if (!res?.success) throw new Error(res?.error ?? 'Action failed.');
      onUpdate(res.item as Meeting);
    } catch (e: any) {
      console.error('[ActionsTab] toggle failed', e);
      toast.error(e?.message ?? 'Failed to update action.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (actionItemId: string) => {
    if (busyId) return;
    setBusyId(actionItemId);
    try {
      const res = await api.governanceDeleteMeetingActionItem(
        meetingId,
        actionItemId,
      );
      if (!res?.success) throw new Error(res?.error ?? 'Delete failed.');
      onUpdate(res.item as Meeting);
      toast.success('Action removed');
    } catch (e: any) {
      console.error('[ActionsTab] delete failed', e);
      toast.error(e?.message ?? 'Failed to remove action.');
    } finally {
      setBusyId(null);
    }
  };

  // Open items first (most urgent), then done, by oldest-first within
  // each group so newly-added open items appear at the bottom.
  const sorted = useMemo(() => {
    const open = actionItems
      .filter((a) => a.status === 'open')
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    const done = actionItems
      .filter((a) => a.status === 'done')
      .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
    return [...open, ...done];
  }, [actionItems]);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <label className={labelCls}>New action</label>
          <textarea
            className={clsx(inputCls, 'mt-1 min-h-14 resize-none')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Resubmit GW2 with revised financials."
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner · e.g. PM · Cladding"
            />
            <input
              type="date"
              className={inputCls}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={adding}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adding && <Loader2 className="h-3 w-3 animate-spin" />}
              Add action
            </button>
          </div>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] italic text-slate-400">
          No actions recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => {
            const isDone = a.status === 'done';
            return (
              <li
                key={a.id}
                className={clsx(
                  'flex items-start gap-3 rounded-lg border bg-white p-3 transition-colors',
                  isDone
                    ? 'border-slate-100'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <button
                  type="button"
                  onClick={() => !readOnly && toggle(a.id)}
                  disabled={readOnly || busyId === a.id}
                  className={clsx(
                    'mt-0.5 shrink-0 rounded-md p-0.5 transition-colors',
                    !readOnly && 'hover:bg-slate-100',
                    readOnly && 'cursor-default',
                  )}
                  aria-label={isDone ? 'Mark as open' : 'Mark as done'}
                >
                  {busyId === a.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-400" />
                  )}
                </button>
                <div className="flex-1">
                  <p
                    className={clsx(
                      'text-xs leading-snug',
                      isDone ? 'text-slate-400 line-through' : 'text-slate-800',
                    )}
                  >
                    {a.text}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    {a.ownerLabel && (
                      <span className="inline-flex items-center gap-0.5">
                        <UsersIcon className="h-2.5 w-2.5" />
                        {a.ownerLabel}
                      </span>
                    )}
                    {a.dueDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        Due {formatGbDate(a.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    disabled={busyId === a.id}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Remove action"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Links (reports + projects) ───────────────────────────────────────────

interface LinkOption {
  id: string;
  label: string;
  sublabel?: string;
}

function LinksTab({
  meetingId,
  linkedReportIds,
  linkedProjectIds,
  readOnly,
  onUpdate,
}: {
  meetingId: string;
  linkedReportIds: string[];
  linkedProjectIds: string[];
  readOnly: boolean;
  onUpdate: (m: Meeting) => void;
}) {
  // Pull projects from the Zustand store rather than refetching via
  // `clientGetProjects`. The store is already populated with the
  // project switcher's projects (which includes programme-linked ones
  // for client admins — `clientGetProjects` has a known gap there).
  // Single source of truth + no second round-trip.
  const storeProjects = useStore((s) => s.projects);

  const [reports, setReports] = useState<LinkOption[]>([]);
  const [loadingPickers, setLoadingPickers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  // Project options derived from the store — no fetch needed.
  const projects: LinkOption[] = useMemo(
    () =>
      (storeProjects ?? [])
        .map((p: any) => ({
          id: p.id,
          label: p.name ?? p.title ?? '(unnamed)',
          sublabel: p.programmeName ?? p.scheme ?? '',
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [storeProjects],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPickers(true);
      try {
        const reportsRes = await api.governanceListReports();
        if (cancelled) return;
        const reportOpts: LinkOption[] = ((reportsRes?.items ?? []) as any[])
          .filter((r) => !r.softDeleted)
          .map((r) => ({
            id: r.id,
            label: r.title ?? '(untitled)',
            sublabel: r.scheme || r.templateLabel || '',
          }));
        setReports(reportOpts.sort((a, b) => a.label.localeCompare(b.label)));
      } catch (e: any) {
        console.error('[LinksTab] reports load failed', e);
        toast.error(e?.message ?? 'Failed to load reports.');
      } finally {
        if (!cancelled) setLoadingPickers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleReport = async (id: string) => {
    if (busy || readOnly) return;
    setBusy(true);
    try {
      const next = linkedReportIds.includes(id)
        ? linkedReportIds.filter((x) => x !== id)
        : [...linkedReportIds, id];
      const res = await api.governanceUpdateMeetingLinks(
        meetingId,
        next,
        undefined,
      );
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      onUpdate(res.item as Meeting);
    } catch (e: any) {
      console.error('[LinksTab] toggle report failed', e);
      toast.error(e?.message ?? 'Failed to update links.');
    } finally {
      setBusy(false);
    }
  };

  const toggleProject = async (id: string) => {
    if (busy || readOnly) return;
    setBusy(true);
    try {
      const next = linkedProjectIds.includes(id)
        ? linkedProjectIds.filter((x) => x !== id)
        : [...linkedProjectIds, id];
      const res = await api.governanceUpdateMeetingLinks(
        meetingId,
        undefined,
        next,
      );
      if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
      onUpdate(res.item as Meeting);
    } catch (e: any) {
      console.error('[LinksTab] toggle project failed', e);
      toast.error(e?.message ?? 'Failed to update links.');
    } finally {
      setBusy(false);
    }
  };

  const filteredReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        (r.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [reports, reportSearch]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        (p.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [projects, projectSearch]);

  if (loadingPickers) {
    return (
      <div className="space-y-2">
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Cancelled meetings can be viewed but not re-linked.
        </div>
      )}
      <LinkPickerSection
        title="Linked reports"
        icon={FileText}
        selectedIds={linkedReportIds}
        options={filteredReports}
        searchValue={reportSearch}
        onSearch={setReportSearch}
        onToggle={toggleReport}
        readOnly={readOnly}
        busy={busy}
        emptyText="No reports in your workspace yet."
      />
      <LinkPickerSection
        title="Linked projects"
        icon={FolderKanban}
        selectedIds={linkedProjectIds}
        options={filteredProjects}
        searchValue={projectSearch}
        onSearch={setProjectSearch}
        onToggle={toggleProject}
        readOnly={readOnly}
        busy={busy}
        emptyText="No projects in your workspace yet."
      />
    </div>
  );
}

function LinkPickerSection({
  title,
  icon: Icon,
  selectedIds,
  options,
  searchValue,
  onSearch,
  onToggle,
  readOnly,
  busy,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  selectedIds: string[];
  options: LinkOption[];
  searchValue: string;
  onSearch: (v: string) => void;
  onToggle: (id: string) => void;
  readOnly: boolean;
  busy: boolean;
  emptyText: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          {title}
        </p>
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
          {selectedIds.length} linked
        </span>
      </header>
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className={clsx(inputCls, 'h-8 pl-7 text-xs')}
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {options.length === 0 ? (
          <p className="px-3 py-4 text-center text-[11px] italic text-slate-400">
            {searchValue ? 'No matches.' : emptyText}
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {options.map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(opt.id)}
                    disabled={readOnly || busy}
                    className={clsx(
                      'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                      readOnly
                        ? 'cursor-default'
                        : 'hover:bg-slate-50 disabled:opacity-60',
                      isSelected && 'bg-indigo-50/40',
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white',
                      )}
                    >
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <p className="text-[10px] text-slate-500">{opt.sublabel}</p>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

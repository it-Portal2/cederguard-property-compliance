import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertCircle, Scale, Folder, User, Check, Clock, CheckCircle2, RotateCcw, ShieldAlert, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';
import { format, differenceInDays } from 'date-fns';
import { KRI_LIST, KRI_OWNERS } from '../data/riskData';
import { clsx } from 'clsx';

export function RiskAlerts() {
  const { risks, issues, acknowledgedAlerts, snoozedAlerts, ackAlert, snoozeAlert, resetAlerts, activeProjectId, activeProgrammeId, projects } = useStore();
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get('from') === 'initiation';
  const type = searchParams.get('type') || (activeProjectId ? 'project' : 'programme');

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSendAlerts = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    }, 1500);
  };

  const now = Date.now();
  const allAlerts: any[] = [];

  // Filter items by active scope
  const filteredRisks = risks.filter(r => {
    if (activeProjectId) return r.projectId === activeProjectId;
    if (activeProgrammeId) return r.programmeId === activeProgrammeId;
    return true;
  });

  const filteredIssues = issues.filter(i => {
    if (activeProjectId) return i.projectId === activeProjectId;
    if (activeProgrammeId) return i.programmeId === activeProgrammeId;
    return true;
  });

  // Rules
  filteredRisks.forEach(r => {
    if (r.grossRating >= 20 && r.status === "Open") {
      allAlerts.push({ id: `sev_open::${r.id}`, group: 'Critical', color: 'red', icon: <ShieldAlert className="w-4 h-4 text-red-500" />, label: 'Severe Risk — Open & Unmitigated', item: r, msg: `${r.id} is rated Severe (${r.grossRating}) and remains Open. Immediate action required.`, action: 'Escalate to Programme Board and assign immediate mitigation owner.' });
    }
    if (r.grossRating >= 16 && r.status === "Open" && !r.dueDate) {
      allAlerts.push({ id: `high_open::${r.id}`, group: 'Critical', color: 'red', icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: 'Major Risk — Open with No Due Date', item: r, msg: `${r.id} is Major/Severe (${r.grossRating}) with no due date set.`, action: 'Assign a due date and mitigation owner immediately.' });
    }
    if (r.dueDate && new Date(r.dueDate) < new Date() && r.status !== "Closed" && r.status !== "Mitigated") {
      allAlerts.push({ id: `overdue::${r.id}`, group: 'Critical', color: 'red', icon: <Clock className="w-4 h-4 text-red-500" />, label: 'Risk Overdue — Past Due Date', item: r, msg: `${r.id} was due ${format(new Date(r.dueDate), 'dd MMM yy')} — now ${differenceInDays(new Date(), new Date(r.dueDate))} days overdue.`, action: 'Review risk status and either update due date with justification or close.' });
    }
    if (r.escalated && r.status === "Open" && r.grossRating >= 12) {
      allAlerts.push({ id: `esc_open::${r.id}`, group: 'Critical', color: 'red', icon: <ShieldAlert className="w-4 h-4 text-red-500" />, label: 'Escalated Risk — Still Open', item: r, msg: `${r.id} has been escalated to Programme Register but remains Open (score ${r.grossRating}).`, action: 'Programme Board to review and agree action or tolerance decision.' });
    }
    if (r.category === "Legal / Regulatory" && (r.title || '').toLowerCase().includes("damp") && r.status === "Open") {
      allAlerts.push({ id: `awaabs::${r.id}`, group: 'Statutory', color: 'purple', icon: <Scale className="w-4 h-4 text-purple-600" />, label: "Awaab's Law — Statutory Response Deadline", item: r, msg: `${r.id} relates to damp & mould. Awaab's Law (Section 10A) requires 14-day investigation and 7-day works start.`, action: 'Confirm triage process is active. Escalate if any complaint exceeds 14-day investigation window.' });
    }
  });

  // KRI Breach Rules
  KRI_LIST.forEach(kri => {
    const kriRisks = filteredRisks.filter(r => r.kri === kri);
    const criticalRisks = kriRisks.filter(r => r.grossRating >= 16 && r.status === "Open");
    const overdueRisks = kriRisks.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && r.status !== "Closed");

    if (criticalRisks.length > 0) {
      allAlerts.push({
        id: `kri_crit::${kri}`,
        group: 'KRI',
        color: 'red',
        icon: <ShieldAlert className="w-4 h-4 text-red-600" />,
        label: 'KRI Breach',
        item: { project: 'Programme Level', owner: KRI_OWNERS[kri] || 'Pending Confirmation', id: kri },
        msg: `KRI "${kri}" has ${criticalRisks.length} critical risk(s). Alert sent to ${KRI_OWNERS[kri] || 'Pending Confirmation'}.`,
        action: 'Review KRI mitigation strategy and update Programme Board.'
      });
    }

    if (overdueRisks.length > 0) {
      allAlerts.push({
        id: `kri_overdue::${kri}`,
        group: 'KRI',
        color: 'amber',
        icon: <Clock className="w-4 h-4 text-amber-600" />,
        label: 'KRI Overdue',
        item: { project: 'Programme Level', owner: KRI_OWNERS[kri] || 'Pending Confirmation', id: kri },
        msg: `KRI "${kri}" has ${overdueRisks.length} overdue action(s). Alert sent to ${KRI_OWNERS[kri] || 'Pending Confirmation'}.`,
        action: 'Ensure all overdue risk actions are updated or escalated.'
      });
    }
  });

  filteredIssues.forEach(i => {
    if (i.deadline && new Date(i.deadline) < new Date() && i.status !== "4. Resolved") {
      allAlerts.push({ id: `iss_deadline::${i.id}`, group: 'Critical', color: 'red', icon: <AlertCircle className="w-4 h-4 text-red-500" />, label: 'Issue — Control Deadline Overdue', item: i, msg: `Issue ${i.id} control deadline was ${format(new Date(i.deadline), 'dd MMM yy')} — ${differenceInDays(new Date(), new Date(i.deadline))} days overdue.`, action: 'Update deadline with justification or close the issue.', isIssue: true });
    }
  });

  const activeAlerts = allAlerts.filter(a => !acknowledgedAlerts.includes(a.id) && (!snoozedAlerts[a.id] || snoozedAlerts[a.id] < now));

  const filtered = activeAlerts.filter(a => {
    if (filter !== 'All' && a.group !== filter) return false;
    if (search && !(a.msg || '').toLowerCase().includes(search.toLowerCase()) && !(a.item?.id || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const critCount = activeAlerts.filter(a => a.group === 'Critical').length;
  const kriCount = activeAlerts.filter(a => a.group === 'KRI').length;
  const statCount = activeAlerts.filter(a => a.group === 'Statutory').length;
  const ackdCount = acknowledgedAlerts.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div className="flex items-start gap-4">
          {fromInitiation && (
            <Link 
              to={type === 'programme' ? '/programmes/new' : '/initiate'}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all active:scale-95 animate-in fade-in slide-in-from-right-4 duration-700 mb-1"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Initiation Flow
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              {critCount > 0 && <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />}
              Alert Board
            </h1>
            <p className="text-sm text-slate-500 mt-1">{activeAlerts.length} active alerts · {ackdCount} acknowledged</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={resetAlerts} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset All
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div onClick={() => setFilter('All')} className={clsx("bg-white rounded-xl border p-4 cursor-pointer transition-colors border-t-4", filter === 'All' ? "border-indigo-500 shadow-md" : "border-slate-200")}>
          <div className="text-2xl font-bold text-indigo-600">{activeAlerts.length}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Active</div>
        </div>
        <div onClick={() => setFilter('Critical')} className={clsx("bg-white rounded-xl border p-4 cursor-pointer transition-colors border-t-4", filter === 'Critical' ? "border-red-500 shadow-md" : "border-slate-200")}>
          <div className="text-2xl font-bold text-red-600">{critCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Critical</div>
        </div>
        <div onClick={() => setFilter('KRI')} className={clsx("bg-white rounded-xl border p-4 cursor-pointer transition-colors border-t-4", filter === 'KRI' ? "border-amber-500 shadow-md" : "border-slate-200")}>
          <div className="text-2xl font-bold text-amber-600">{kriCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KRI Breaches</div>
        </div>
        <div onClick={() => setFilter('Statutory')} className={clsx("bg-white rounded-xl border p-4 cursor-pointer transition-colors border-t-4", filter === 'Statutory' ? "border-purple-500 shadow-md" : "border-slate-200")}>
          <div className="text-2xl font-bold text-purple-600">{statCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statutory</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 border-t-4 border-t-emerald-500">
          <div className="text-2xl font-bold text-emerald-600">{ackdCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cleared</div>
        </div>
      </div>

      {/* Web App Notification Routing */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-500" /> Dispatch Push Notifications
          </h3>
          <p className="text-xs text-slate-500 mt-1">Send secure web app notifications to all KRI Owners with active alerts.</p>
        </div>
        <button 
          onClick={handleSendAlerts}
          disabled={isSending || activeAlerts.length === 0}
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isSending ? 'Dispatching...' : sendSuccess ? 'Displatch Successful ✓' : `Push ${activeAlerts.length} Active Alerts`}
        </button>
      </div>

      <div className="flex gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <input
          type="search"
          placeholder="Search alerts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-emerald-800 mb-2">All Clear</h2>
          <p className="text-sm text-emerald-600">No active alerts match your current filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(a => (
            <div key={a.id} className={clsx("bg-white border rounded-xl p-5 shadow-sm transition-all border-l-4",
              a.color === 'red' ? 'border-l-red-500 border-slate-200' :
                a.color === 'purple' ? 'border-l-purple-500 border-slate-200' :
                  'border-l-amber-500 border-slate-200'
            )}>
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {a.icon}
                    <span className={clsx("text-[10px] font-bold uppercase tracking-wider",
                      a.color === 'red' ? 'text-red-600' :
                        a.color === 'purple' ? 'text-purple-600' :
                          'text-amber-600'
                    )}>{a.group}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">
                      {a.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-800 font-medium mb-3">{a.msg}</div>
                  <div className="text-xs text-slate-500 mb-4 flex gap-4">
                    <span className="flex items-center gap-1"><Folder className="w-3.5 h-3.5" /> {a.item.project}</span>
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {a.item.owner || "Unassigned"}</span>
                  </div>
                  <div className={clsx("p-3 rounded-lg text-xs border",
                    a.color === 'red' ? 'bg-red-50 border-red-100 text-red-800' :
                      a.color === 'purple' ? 'bg-purple-50 border-purple-100 text-purple-800' :
                        'bg-amber-50 border-amber-100 text-amber-800'
                  )}>
                    <strong>Recommended Action:</strong> {a.action}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => ackAlert(a.id)} className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2">
                    <Check className="w-4 h-4" /> Acknowledge
                  </button>
                  <button onClick={() => snoozeAlert(a.id, 7)} className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Snooze 7d
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

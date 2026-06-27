import { useStore } from '../../../store/useStore';
import { format } from 'date-fns';
import { stripMarkdown } from '../../../lib/utils';
import { getGrossScore, MAJOR_SCORE_THRESHOLD } from '../../../lib/riskMetrics';

function fGBP(v: number) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export function RiskReport() {
  const { risks: allRisks, issues: allIssues, projects, projectInfo, activeProjectId, activeProgrammeId } = useStore();

  const risks = allRisks.filter(r => {
    if (activeProjectId) return r.projectId === activeProjectId;
    if (!activeProgrammeId) return true;
    const proj = projects.find(p => p.id === r.projectId);
    return proj?.programmeId === activeProgrammeId || r.programmeId === activeProgrammeId;
  });
  const issues = allIssues.filter(i => {
    if (activeProjectId) return i.projectId === activeProjectId;
    if (!activeProgrammeId) return true;
    const proj = projects.find(p => p.id === i.projectId);
    return proj?.programmeId === activeProgrammeId || i.programmeId === activeProgrammeId;
  });

  const total = risks.length;
  const open = risks.filter(r => r.status === "Open").length;
  const high = risks.filter(r => getGrossScore(r) >= MAJOR_SCORE_THRESHOLD).length;
  const esc = risks.filter(r => r.escalated).length;
  const tGALE = risks.reduce((s, r) => s + (r.grossALE || 0), 0);
  const tRALE = risks.reduce((s, r) => s + (r.residualALE || 0), 0);
  const pctRed = tGALE > 0 ? Math.round((1 - tRALE / tGALE) * 100) : 0;

  const iOpen = issues.filter(i => i.status !== "4. Resolved").length;
  const iEsc = issues.filter(i => i.status === "2. Escalated").length;
  const lessons = issues.filter(i => i.lessonsLearnt === "Y");

  const topRisks = [...risks].filter(r => r.status === "Open").sort((a, b) => b.residualRating - a.residualRating).slice(0, 10);
  const progRisks = risks.filter(r => r.escalated);

  return (
    <div className="space-y-8 print:p-0">
      <div className="bg-slate-900 text-white rounded-lg p-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Programme Risk Report</h1>
          <p className="text-slate-400">{projectInfo.name || "Overall Programme"} — Risk & Issues Summary</p>
          <p className="text-xs text-slate-500 mt-4">Report Date: {format(new Date(), 'dd MMMM yyyy')} · Prepared by: Risk Management Office</p>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors">
          ⎙ Print Report
        </button>
      </div>

      {/* Executive Summary */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="font-mono text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-3 mb-6">1. Executive Summary</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatBox label="Total Risks" value={total} color="text-indigo-600" />
          <StatBox label="Open Risks" value={open} color="text-red-600" />
          <StatBox label="High / Severe" value={high} color="text-amber-600" />
          <StatBox label="Escalated" value={esc} color="text-purple-600" />
          <StatBox label="Gross ALE" value={fGBP(Math.round(tGALE))} color="text-red-600" />
          <StatBox label="Residual ALE" value={fGBP(Math.round(tRALE))} color="text-indigo-600" />
          <StatBox label="Risk Reduction" value={fGBP(Math.round(tGALE - tRALE))} color="text-emerald-600" />
          <StatBox label="Reduction %" value={`${pctRed}%`} color="text-emerald-600" />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
          The programme currently carries <strong className="text-slate-900">{total}</strong> registered risks. 
          Of these, <strong className="text-red-600">{open}</strong> remain open and <strong className="text-red-600">{high}</strong> are rated High or Severe. 
          <strong className="text-slate-900"> {esc}</strong> risks have been escalated to the Programme Risk Register for senior attention. 
          The gross Annual Loss Expectancy across the programme is <strong className="text-slate-900">{fGBP(Math.round(tGALE))}</strong>, which is reduced to a residual ALE of 
          <strong className="text-slate-900"> {fGBP(Math.round(tRALE))}</strong> following all controls — a risk reduction of <strong className="text-emerald-600">{pctRed}%</strong>. 
          The Issues Log carries <strong className="text-slate-900">{issues.length}</strong> issues of which <strong className="text-amber-600">{iOpen}</strong> remain open and <strong className="text-red-600">{iEsc}</strong> are escalated.
        </div>
      </section>

      {/* Top 10 Risks */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="font-mono text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-3 mb-6">2. Top 10 Open Risks by Residual Rating</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="font-mono bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 font-medium text-center">#</th>
                <th className="p-3 font-medium">Ref</th>
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium text-center">Score</th>
                <th className="p-3 font-medium text-right">Residual ALE</th>
                <th className="p-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topRisks.map((r, i) => (
                <tr key={r.id}>
                  <td className="p-3 text-center font-bold text-red-600">{i + 1}</td>
                  <td className="p-3 font-bold text-indigo-600">{r.id}</td>
                  <td className="p-3 font-medium text-slate-800">{stripMarkdown(r.title)}</td>
                  <td className="p-3 text-center font-bold">{r.residualRating}</td>
                  <td className="p-3 text-right font-medium">{fGBP(Math.round(r.residualALE))}</td>
                  <td className="p-3 text-slate-600">{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Escalated Risks */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="font-mono text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-3 mb-6">3. Escalated Risks — Programme Board Actions</h2>
        {progRisks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No risks currently escalated to programme level.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="font-mono bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Ref</th>
                  <th className="p-3 font-medium">Title</th>
                  <th className="p-3 font-medium text-center">Score</th>
                  <th className="p-3 font-medium">Further Action Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {progRisks.map(r => (
                  <tr key={r.id}>
                    <td className="p-3 font-bold text-red-600">{r.id}</td>
                    <td className="p-3 font-medium text-slate-800">{stripMarkdown(r.title)}</td>
                    <td className="p-3 text-center font-bold">{r.residualRating}</td>
                    <td className="p-3 text-slate-600">{stripMarkdown(r.furtherAction || "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lessons Learnt */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="font-mono text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-3 mb-6">4. Lessons Learnt Log</h2>
        {lessons.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No lessons learnt flagged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="font-mono bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Ref</th>
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium">Response</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lessons.map(i => (
                  <tr key={i.id}>
                    <td className="p-3 font-bold text-indigo-600">{i.id}</td>
                    <td className="p-3 font-medium text-slate-800">{stripMarkdown(i.desc)}</td>
                    <td className="p-3 text-slate-600">{stripMarkdown(i.response)}</td>
                    <td className="p-3 font-medium">{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-center text-xs text-slate-400 pt-8">
        Cedar Compliance & Risk Manager Suite · Confidential — For internal use only
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string, value: string | number, color: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

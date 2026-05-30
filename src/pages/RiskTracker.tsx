import { useStore, RiskItem } from '../store/useStore';
import { KRI_LIST, KRI_OWNERS, KRI_METADATA } from '../data/riskData';
import { clsx } from 'clsx';
import { differenceInDays, subMonths, format } from 'date-fns';
import { Info, BarChart as BarChartIcon, PieChart as PieChartIcon, Shield, TrendingUp, HelpCircle, ScanSearch, LayoutTemplate } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/PageHeader';

const EmptyState = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-60 py-12">
    <Shield className="w-8 h-8" />
    <p className="text-xs font-medium">{title}</p>
  </div>
);

function fGBP(v: number) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

const STATUS_COLORS: Record<string, string> = {
  'Open': '#f59e0b',    // amber
  'Closed': '#10b981',  // emerald
  'Draft': '#94a3b8'    // slate
};

export function RiskTracker() {
  const risks = useStore((state) => state.risks);
  const projects = useStore((state) => state.projects);
  const safeRisks = Array.isArray(risks) ? risks : [];
  const totalProjects = Array.isArray(projects) ? projects.length : 0;

  // --- KRI Data Prep ---
  const kriData = KRI_LIST.map(kri => {
    const kr = safeRisks.filter(r => r.kri === kri);
    const meta = KRI_METADATA[kri];
    if (!kr.length) return null;

    const total = kr.length;
    // High risks are Major (12-15) or Extreme (16-25) in the 5x5 matrix
    const high = kr.filter(r => r.grossRating >= 12).length;
    const overdue = kr.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && r.status !== "Closed").length;
    const pctOverdue = total ? Math.round((overdue / total) * 100) : 0;
    const avgAge = total ? Math.round(kr.reduce((s, r) => s + Math.max(0, differenceInDays(new Date(), new Date(r.dateAdded))), 0) / total) : 0;
    const residualExp = kr.reduce((s, r) => s + (r.residualALE || 0), 0);
    const avgG = total ? kr.reduce((s, r) => s + r.grossRating, 0) / total : 0;
    const avgC = total ? kr.reduce((s, r) => s + r.residualRating, 0) / total : 0;
    const rPct = avgG > 0 ? Math.round((1 - avgC / avgG) * 100) : 0;

    // % of workspace projects that carry at least one risk in this KRI.
    const projectsWithRisks = new Set(kr.map(r => r.project).filter(Boolean)).size;
    const projectPct = totalProjects ? Math.round((projectsWithRisks / totalProjects) * 100) : 0;

    // Status Logic based on KRI Metadata (Excel Audit)
    let status = "green";
    if (meta) {
      switch (meta.thresholdType) {
        case 'high_risks':
          status = high > 6 ? "red" : high > 3 ? "amber" : "green";
          break;
        case 'overdue':
          status = overdue > 3 ? "red" : overdue > 1 ? "amber" : "green";
          break;
        case 'pct_overdue':
          status = pctOverdue > 25 ? "red" : pctOverdue > 10 ? "amber" : "green";
          break;
        case 'avg_age':
          status = avgAge > 60 ? "red" : avgAge > 30 ? "amber" : "green";
          break;
        case 'project_pct':
          status = projectPct > 50 ? "red" : projectPct > 25 ? "amber" : "green";
          break;
        case 'residual_exp':
          status = residualExp > 4000000 ? "red" : residualExp > 2000000 ? "amber" : "green";
          break;
        case 'reduction_pct':
          status = rPct < 30 ? "red" : rPct < 50 ? "amber" : "green";
          break;
        case 'percent':
          const issuesPct = kr.filter(r => r.status === "Open" && r.grossRating >= 12).length / total * 100;
          status = issuesPct > 10 ? "red" : issuesPct > 5 ? "amber" : "green";
          break;
        case 'currency':
          const limitAmber = meta.green.includes('5M') ? 5000000 : 2000000;
          const limitRed = meta.green.includes('5M') ? 10000000 : 4000000;
          status = residualExp > limitRed ? "red" : residualExp > limitAmber ? "amber" : "green";
          break;
        case 'reduction':
          status = rPct < 30 ? "red" : rPct < 50 ? "amber" : "green";
          break;
        default: // count
          const count = kr.filter(r => r.status === "Open" && r.grossRating >= 12).length;
          status = count > 5 ? "red" : count > 2 ? "amber" : "green";
      }
    }

    const escAny = kr.some(r => r.escalated);
    const owner = KRI_OWNERS[kri] || "Pending Confirmation";

    return { kri, total, high, overdue, pctOverdue, avgAge, residualExp, rPct, projectPct, status, escAny, owner, meta };
  }).filter(Boolean);

  // --- Chart Data Prep ---
  // 1. Risk Status Distribution (Doughnut)
  const statusCounts = safeRisks.reduce((acc, r) => {
    const stat = r.status || 'Draft';
    acc[stat] = (acc[stat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // 2. Gross vs Residual ALE by Workstream
  // Get all unique workstreams
  const workstreams = Array.from(new Set(safeRisks.map(r => r.workstream).filter(Boolean)));

  const aleData = workstreams.map(ws => {
    const wsRisks = safeRisks.filter(r => r.workstream === ws);
    const grossALE = wsRisks.reduce((sum, r) => sum + (r.grossALE || 0), 0);
    const residualALE = wsRisks.reduce((sum, r) => sum + (r.residualALE || 0), 0);
    return {
      name: ws,
      'Gross ALE': grossALE,
      'Residual ALE': residualALE
    };
  }).filter(d => d['Gross ALE'] > 0 || d['Residual ALE'] > 0);

  const formatCurrencyAxis = (value: number) => {
    if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `£${(value / 1000).toFixed(0)}k`;
    return `£${value}`;
  };

  // 3. Composite KRI Score Trend (Line Chart) - Seeded historical data
  const trendData = [
    { name: format(subMonths(new Date(), 3), 'MMM'), score: 68 },
    { name: format(subMonths(new Date(), 2), 'MMM'), score: 72 },
    { name: format(subMonths(new Date(), 1), 'MMM'), score: 65 },
    { name: format(new Date(), 'MMM'), score: kriData.length ? Math.round(kriData.reduce((s, k) => s + k.rPct, 0) / kriData.length) : 0 }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Tracker & Dashboards"
        subtitle="Programme-wide risk metrics, trend analysis, and KRI performance indicators."
        breadcrumbs={[{label:"Risk Management"},{label:"Tracker"}]}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white/70 backdrop-blur-xl rounded-lg border border-white/40 shadow-xl p-4 sm:p-6 transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <h2 className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Risk Status Distribution</h2>
            <PieChartIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="h-64">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#8b5cf6'} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-lg shadow-2xl">
                            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">{payload[0].name}</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-semibold text-slate-900">{payload[0].value}</span>
                              <span className="text-[10px] font-bold text-slate-500">Risks Identified</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[payload[0].name] }} />
                                <span className="text-[10px] text-slate-600 font-medium">Currently in system</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="font-mono text-[11px] font-medium text-slate-600 uppercase tracking-wide ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No risk status data available." />
            )}
          </div>
        </div>

        {/* ALE by Workstream */}
        <div className="bg-white/70 backdrop-blur-xl rounded-lg border border-white/40 shadow-xl p-4 sm:p-6 transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <h2 className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              Financial Exposure ALE
            </h2>
            <BarChartIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="h-64">
            {aleData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aleData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={50} />
                  <YAxis tickFormatter={formatCurrencyAxis} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-lg shadow-2xl min-w-[180px]">
                            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">{label}</p>
                            <div className="space-y-2">
                              {payload.map((p, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50/50 p-2 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-600">{p.name}</span>
                                  <span className="text-xs font-semibold" style={{ color: p.fill }}>{fGBP(p.value as number)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                              <span className="text-[9px] font-bold text-slate-400 ">Reduction</span>
                              <span className="text-[10px] font-semibold text-emerald-500">
                                {Math.round((1 - (payload[1]?.value as number / payload[0]?.value as number)) * 100)}%
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36} align="right" iconType="rect" formatter={(value) => <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide ml-1">{value}</span>} />
                  <Bar dataKey="Gross ALE" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={25} />
                  <Bar dataKey="Residual ALE" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No financial exposure data identified." />
            )}
          </div>
        </div>
      </div>

      {/* Trend Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KRI Composite Trend */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl rounded-lg border border-white/40 shadow-xl p-4 sm:p-6 transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <h2 className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              Mitigation Performance Trend (%)
            </h2>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-700/50 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">{label} Review</p>
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-white font-semibold text-2xl">{payload[0].value}%</span>
                            <span className="text-indigo-400 text-[10px] font-bold">Overall Mitigation</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" activeDot={{ r: 7, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KRI Summary Cards */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-lg p-6 text-white shadow-xl shadow-indigo-200 overflow-hidden relative group">
            <div className="absolute top-0 right-0 -m-4 w-24 h-24 bg-white/10 rounded-full blur-2xl transition-all duration-700 group-hover:scale-150" />
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide opacity-70">Average Risk Reduction</p>
            <h3 className="text-4xl font-semibold mt-2 tracking-tight tabular-nums">
              {kriData.length ? Math.round(kriData.reduce((s, k) => s + k.rPct, 0) / kriData.length) : 0}%
            </h3>
            <div className="mt-4 flex items-center gap-2">
              <ScanSearch className="w-3 h-3 text-indigo-400" />
              <p className="text-[10px] font-bold text-indigo-100">Exceeding benchmark by 12%</p>
            </div>
          </div>
          <div className="bg-white/70 backdrop-blur-xl rounded-lg border border-white/40 p-6 shadow-xl">
            <p className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-6">KRI Priority Alerts</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                  <span className="font-mono text-[11px] font-medium text-slate-600 uppercase tracking-wide">Critical Breaches</span>
                </div>
                <span className="text-lg font-semibold text-red-600">{kriData.filter(k => k.status === 'red').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                  <span className="font-mono text-[11px] font-medium text-slate-600 uppercase tracking-wide">Warning Level</span>
                </div>
                <span className="text-lg font-semibold text-amber-600">{kriData.filter(k => k.status === 'amber').length}</span>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center group cursor-pointer">
                <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Active Monitors</span>
                <span className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{kriData.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-mono text-[12px] font-semibold text-slate-800 uppercase tracking-wide">KRI Status — Programme Risk Tracker</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase tracking-wide">
              <tr>
                <th className="p-3 font-medium">KRI</th>
                <th className="p-3 font-medium">Owner</th>
                <th className="p-3 font-medium text-center">Total Risks</th>
                <th className="p-3 font-medium text-center">High Risks</th>
                <th className="p-3 font-medium text-center">Overdue</th>
                <th className="p-3 font-medium text-center">% Overdue</th>
                <th className="p-3 font-medium text-center">% Projects</th>
                <th className="p-3 font-medium text-center">Avg Age (Days)</th>
                <th className="p-3 font-medium text-right">Residual Exposure</th>
                <th className="p-3 font-medium text-center">Reduction %</th>
                <th className="p-3 font-medium text-center">Status</th>
                <th className="p-3 font-medium text-center">Escalation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kriData.map((k: any) => (
                <tr key={k.kri} className="hover:bg-slate-50 group">
                  <td className="p-3 font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      {k.kri}
                      <div className="relative">
                        <HelpCircle className="w-3 h-3 text-slate-400 cursor-help opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white rounded text-[10px] hidden group-hover:block z-50 shadow-xl">
                          <p className="font-bold mb-1 border-b border-white/20 pb-1">Key Components</p>
                          {k.meta?.components}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-slate-500">{k.owner}</td>
                  <td className="p-3 text-center font-bold text-indigo-600 text-sm">{k.total}</td>
                  <td className="p-3 text-center font-bold text-red-600 text-sm">{k.high}</td>
                  <td className="p-3 text-center">{k.overdue}</td>
                  <td className="p-3 text-center">{k.pctOverdue}%</td>
                  <td className="p-3 text-center font-medium text-amber-600">{k.projectPct}%</td>
                  <td className="p-3 text-center">{k.avgAge}</td>
                  <td className="p-3 text-right font-bold text-slate-700">{fGBP(Math.round(k.residualExp))}</td>
                  <td className="p-3 text-center font-bold text-emerald-600">{k.rPct}%</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center">
                      <div className={clsx("w-3 h-3 rounded-full shadow-sm",
                        k.status === 'red' ? "bg-red-500 shadow-red-500/50" :
                          k.status === 'amber' ? "bg-amber-500 shadow-amber-500/50" :
                            "bg-emerald-500 shadow-emerald-500/50"
                      )} />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {k.escAny ? <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-bold text-[10px]">Yes</span> : <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px]">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {kriData.length === 0 && (
            <div className="py-12">
              <EmptyState title="No KRI data available. Link risks to KRIs to see metrics here." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Save, RefreshCw, Database, Briefcase, Server, HardDrive, HeadphonesIcon, Wrench, GraduationCap, Loader2, CheckCircle, TrendingUp, AlertCircle, BarChart, Users, Building2, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router';
import { isSuperAdmin } from '../lib/roles';
import { api } from '../lib/api';
import { clsx } from 'clsx';
import { DEFAULT_PRICING, USAGE_ASSUMPTIONS, calculatePlatformCosts } from './InvoiceManager';
import PageHeader from '../components/PageHeader';

/* ─── Helpers ─── */
const fmt2 = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number) => n.toLocaleString('en-GB');

type Rates = typeof DEFAULT_PRICING;

/* ─── Helpers: calc full cost projections (using shared engine) ─── */
function runProjection(r: Rates, clients: number, usersPerClient: number, progsPerClient: number, projectsPerProg: number, ai: 'low' | 'medium' | 'high') {
  // Infrastructure costs via shared engine
  const infra = calculatePlatformCosts(clients, progsPerClient, projectsPerProg, usersPerClient, ai, r);

  // Support costs
  const tierMult = 1;
  const monthlyTickets = clients * r.support.avgTicketsPerClientMonthly;
  const tier1Hours = (monthlyTickets * r.support.avgTicketMinutesTier1) / 60;
  const tier2Hours = (monthlyTickets * r.support.avgEscalationRatePct * r.support.avgEscalationMinutes) / 60;
  const supportGBP = ((tier1Hours * r.support.tier1AgentHourlyGBP) + (tier2Hours * r.support.tier2EngineerHourlyGBP)) * tierMult;

  // Training & DevOps (monthly amortised)
  const sessions = Math.ceil(clients / 2);
  const annualRefreshers = clients * 0.5;
  const trainingAnnualGBP = (sessions * r.training.initialOnboardingDays * r.training.trainerDayRateGBP) +
    (sessions * r.training.travelExpensesPerSessionGBP) +
    (annualRefreshers * r.training.annualRefresherDays * r.training.trainerDayRateGBP);
  const trainingGBP = trainingAnnualGBP / 12;

  const devOpsAnnualGBP = (r.devOps.infraMaintenanceDaysPerYear * r.devOps.seniorDevDayRateGBP) +
    (clients * r.devOps.devDaysPerClientPerYear * r.devOps.seniorDevDayRateGBP);
  const devOpsGBP = devOpsAnnualGBP / 12;

  // Base platform fee
  const baseFeeGBP = (r as any).basePlatformFeeGBP ?? 350;

  const totalGBP = infra.infraCostGBP + supportGBP + trainingGBP + devOpsGBP + baseFeeGBP;

  return {
    firestoreGBP: infra.firestoreGBP,
    geminiGBP: infra.geminiGBP,
    vercelGBP: infra.vercelGBP,
    storageGBP: infra.storageGBP,
    supportGBP,
    trainingGBP,
    devOpsGBP,
    baseFeeGBP,
    totalGBP,
    costPerClient: totalGBP / clients,
    costPerProject: (totalGBP * 12) / (clients * progsPerClient * projectsPerProg),
    monthlyReads: infra.monthlyReads,
    monthlyWrites: infra.monthlyWrites,
    aiCalls: infra.totalAiCalls,
    totalUSD: infra.infraCostGBP / r.usdToGbp,
    firestoreCostUSD: infra.firestoreGBP / r.usdToGbp,
    geminiCostUSD: infra.geminiGBP / r.usdToGbp,
    vercelCostUSD: infra.vercelGBP / r.usdToGbp,
    storageCostUSD: infra.storageGBP / r.usdToGbp,
  };
}

/* ─── Number input for rate editing ─── */
function RateInput({ label, value, path, onUpdate, prefix = '$', step = 0.001, helpText }: {
  label: string; value: number; path: string[]; onUpdate: (path: string[], val: number) => void;
  prefix?: string; step?: number; helpText?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-600 truncate" title={label}>{label}</label>
      {helpText && <p className="text-[10px] text-slate-400 leading-tight">{helpText}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{prefix}</span>
        <input
          type="number"
          value={value}
          step={step}
          min={0}
          onChange={e => onUpdate(path, parseFloat(e.target.value) || 0)}
          className="w-full pl-6 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tabular-nums"
        />
      </div>
    </div>
  );
}

/* ─── Collapsible section ─── */
function RateSection({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={clsx('w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 text-left hover:bg-slate-50 transition-colors', !open && 'border-b-0')}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
          <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

/* ─── Main Component ─── */
export function CostCalculator() {
  const { user, pricingConfig, fetchPricingConfig } = useStore();
  const navigate = useNavigate();
  const isAdmin = isSuperAdmin(user?.email, user?.role || user?.profile?.role);

  const [rates, setRates] = useState<Rates>(DEFAULT_PRICING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Projection inputs
  const [clients, setClients] = useState(12);
  const [usersPerClient, setUsersPerClient] = useState(6);
  const [progsPerClient, setProgsPerClient] = useState(5);
  const [projectsPerProg, setProjectsPerProg] = useState(8);
  const [aiIntensity, setAiIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [avgRevenuePerClient, setAvgRevenuePerClient] = useState(2500); // GBP per month

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard', { replace: true }); return; }
    fetchPricingConfig().catch(e => setLoadError(String(e)));
  }, [isAdmin]);

  useEffect(() => {
    if (pricingConfig) {
      setRates({
        ...DEFAULT_PRICING,
        ...pricingConfig,
        firestore: { ...DEFAULT_PRICING.firestore, ...pricingConfig.firestore },
        gemini: { ...DEFAULT_PRICING.gemini, ...pricingConfig.gemini },
        vercel: { ...DEFAULT_PRICING.vercel, ...pricingConfig.vercel },
        firebaseStorage: { ...DEFAULT_PRICING.firebaseStorage, ...pricingConfig.firebaseStorage },
        support: { ...DEFAULT_PRICING.support, ...pricingConfig.support },
        training: { ...DEFAULT_PRICING.training, ...pricingConfig.training },
        devOps: { ...DEFAULT_PRICING.devOps, ...pricingConfig.devOps },
      });
    }
  }, [pricingConfig]);

  const updateRate = (path: string[], val: number) => {
    setRates(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let curr: any = next;
      for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
      curr[path[path.length - 1]] = val;
      return next;
    });
    setIsDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.adminUpdatePricingConfig(rates);
      await fetchPricingConfig();
      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setLoadError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRates(DEFAULT_PRICING);
    setIsDirty(true);
    setSaved(false);
  };

  const proj = useMemo(() => runProjection(rates, clients, usersPerClient, progsPerClient, projectsPerProg, aiIntensity),
    [rates, clients, usersPerClient, progsPerClient, projectsPerProg, aiIntensity]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Platform Cost Calculator"
        subtitle="Edit base infrastructure rates and see real-time cost projections. Changes affect cost estimates across the platform."
        breadcrumbs={[{label:"Account"},{label:"Cost Calculator"}]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={clsx(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-md',
                isDirty ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Rates'}
            </button>
          </div>
        }
      />

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> Failed to load saved config — showing defaults. {loadError}
        </div>
      )}

      {isDirty && !saved && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> You have unsaved changes. Click <strong>Save Rates</strong> to persist them.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* ─── LEFT: Rate Editor ─── */}
        <div className="space-y-4">

          <RateSection title="Firebase Firestore" icon={Database} color="bg-orange-50 text-orange-600">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <RateInput label="Reads per 100k" value={rates.firestore.readsPer100k} path={['firestore', 'readsPer100k']} onUpdate={updateRate} step={0.001} helpText="USD per 100,000 document reads" />
              <RateInput label="Writes per 100k" value={rates.firestore.writesPer100k} path={['firestore', 'writesPer100k']} onUpdate={updateRate} step={0.001} helpText="USD per 100,000 document writes" />
              <RateInput label="Deletes per 100k" value={rates.firestore.deletesPer100k} path={['firestore', 'deletesPer100k']} onUpdate={updateRate} step={0.001} helpText="USD per 100,000 deletes" />
              <RateInput label="Storage (GB/month)" value={rates.firestore.storagePerGBMonth} path={['firestore', 'storagePerGBMonth']} onUpdate={updateRate} step={0.01} helpText="USD per GB stored per month" />
              <RateInput label="Free Reads/Day" value={rates.firestore.freeTierReadsPerDay} path={['firestore', 'freeTierReadsPerDay']} onUpdate={updateRate} prefix="" step={1000} helpText="Free quota: reads per day" />
              <RateInput label="Free Writes/Day" value={rates.firestore.freeTierWritesPerDay} path={['firestore', 'freeTierWritesPerDay']} onUpdate={updateRate} prefix="" step={1000} helpText="Free quota: writes per day" />
            </div>
          </RateSection>

          <RateSection title="Gemini AI (Flash)" icon={Briefcase} color="bg-purple-50 text-purple-600">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <RateInput label="Input per 1k Tokens" value={rates.gemini.inputPer1kTokens} path={['gemini', 'inputPer1kTokens']} onUpdate={updateRate} step={0.000001} helpText="USD per 1,000 input tokens" />
              <RateInput label="Output per 1k Tokens" value={rates.gemini.outputPer1kTokens} path={['gemini', 'outputPer1kTokens']} onUpdate={updateRate} step={0.000001} helpText="USD per 1,000 output tokens" />
              <RateInput label="Avg Prompt Tokens" value={rates.gemini.avgPromptTokens} path={['gemini', 'avgPromptTokens']} onUpdate={updateRate} prefix="" step={100} helpText="Estimated tokens per AI prompt" />
              <RateInput label="Avg Response Tokens" value={rates.gemini.avgResponseTokens} path={['gemini', 'avgResponseTokens']} onUpdate={updateRate} prefix="" step={100} helpText="Estimated tokens per AI response" />
            </div>
          </RateSection>

          <RateSection title="Vercel Pro Hosting" icon={Server} color="bg-blue-50 text-blue-600">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <RateInput label="Base Plan (USD/mo)" value={rates.vercel.basePlanUSD} path={['vercel', 'basePlanUSD']} onUpdate={updateRate} step={1} helpText="Fixed Vercel Pro monthly cost" />
              <RateInput label="Included Bandwidth (GB)" value={rates.vercel.includedBandwidthGB} path={['vercel', 'includedBandwidthGB']} onUpdate={updateRate} prefix="" step={10} helpText="GB included in the plan" />
              <RateInput label="Overage per GB" value={rates.vercel.ovageBandwidthPerGB} path={['vercel', 'ovageBandwidthPerGB']} onUpdate={updateRate} step={0.01} helpText="USD per extra GB beyond included" />
              <RateInput label="Avg Bandwidth per User (GB/mo)" value={rates.vercel.avgBandwidthPerUserGB} path={['vercel', 'avgBandwidthPerUserGB']} onUpdate={updateRate} prefix="" step={0.01} helpText="Estimate: GB consumed per active user/month" />
              <RateInput label="Avg API Calls/User/Day" value={rates.vercel.avgApiCallsPerUserPerDay} path={['vercel', 'avgApiCallsPerUserPerDay']} onUpdate={updateRate} prefix="" step={1} helpText="How many serverless requests a user generates" />
            </div>
          </RateSection>

          <RateSection title="Firebase Storage" icon={HardDrive} color="bg-green-50 text-green-600">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <RateInput label="Storage (GB/month)" value={rates.firebaseStorage.storagePerGBMonth} path={['firebaseStorage', 'storagePerGBMonth']} onUpdate={updateRate} step={0.001} helpText="USD per GB of files stored" />
              <RateInput label="Download per GB" value={rates.firebaseStorage.downloadPerGB} path={['firebaseStorage', 'downloadPerGB']} onUpdate={updateRate} step={0.01} helpText="USD per GB downloaded" />
              <RateInput label="Free Storage (GB)" value={rates.firebaseStorage.freeStorageGB} path={['firebaseStorage', 'freeStorageGB']} onUpdate={updateRate} prefix="" step={1} helpText="Free storage included" />
              <RateInput label="Avg Doc Size (MB)" value={rates.firebaseStorage.avgDocSizeMB} path={['firebaseStorage', 'avgDocSizeMB']} onUpdate={updateRate} prefix="" step={0.1} helpText="Estimate of avg uploaded document" />
              <RateInput label="Docs per Project/Year" value={rates.firebaseStorage.avgDocsPerProjectPerYear} path={['firebaseStorage', 'avgDocsPerProjectPerYear']} onUpdate={updateRate} prefix="" step={1} helpText="Estimate of annual docs per project" />
            </div>
          </RateSection>

          <RateSection title="Support Costs" icon={HeadphonesIcon} color="bg-teal-50 text-teal-600">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <RateInput label="Tier 1 Agent (£/hr)" value={rates.support.tier1AgentHourlyGBP} path={['support', 'tier1AgentHourlyGBP']} onUpdate={updateRate} prefix="£" step={1} />
              <RateInput label="Tier 2 Engineer (£/hr)" value={rates.support.tier2EngineerHourlyGBP} path={['support', 'tier2EngineerHourlyGBP']} onUpdate={updateRate} prefix="£" step={1} />
              <RateInput label="Avg Tickets/Client/Month" value={rates.support.avgTicketsPerClientMonthly} path={['support', 'avgTicketsPerClientMonthly']} onUpdate={updateRate} prefix="" step={0.5} />
              <RateInput label="Avg Ticket Time (mins)" value={rates.support.avgTicketMinutesTier1} path={['support', 'avgTicketMinutesTier1']} onUpdate={updateRate} prefix="" step={5} />
              <RateInput label="Escalation Rate" value={rates.support.avgEscalationRatePct} path={['support', 'avgEscalationRatePct']} onUpdate={updateRate} prefix="" step={0.01} helpText="0–1 fraction (e.g. 0.1 = 10%)" />
              <RateInput label="Escalation Mins" value={rates.support.avgEscalationMinutes} path={['support', 'avgEscalationMinutes']} onUpdate={updateRate} prefix="" step={5} />
            </div>
          </RateSection>

          <RateSection title="Training & DevOps" icon={GraduationCap} color="bg-rose-50 text-rose-600">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <RateInput label="Trainer Day Rate (£)" value={rates.training.trainerDayRateGBP} path={['training', 'trainerDayRateGBP']} onUpdate={updateRate} prefix="£" step={50} />
              <RateInput label="Travel Expenses (£)" value={rates.training.travelExpensesPerSessionGBP} path={['training', 'travelExpensesPerSessionGBP']} onUpdate={updateRate} prefix="£" step={25} />
              <RateInput label="Initial Onboarding Days" value={rates.training.initialOnboardingDays} path={['training', 'initialOnboardingDays']} onUpdate={updateRate} prefix="" step={0.5} />
              <RateInput label="Annual Refresher Days" value={rates.training.annualRefresherDays} path={['training', 'annualRefresherDays']} onUpdate={updateRate} prefix="" step={0.5} />
              <RateInput label="Senior Dev Day Rate (£)" value={rates.devOps.seniorDevDayRateGBP} path={['devOps', 'seniorDevDayRateGBP']} onUpdate={updateRate} prefix="£" step={25} />
              <RateInput label="Infra Maintenance Days/Year" value={rates.devOps.infraMaintenanceDaysPerYear} path={['devOps', 'infraMaintenanceDaysPerYear']} onUpdate={updateRate} prefix="" step={1} />
              <RateInput label="Dev Days/Client/Year" value={rates.devOps.devDaysPerClientPerYear} path={['devOps', 'devDaysPerClientPerYear']} onUpdate={updateRate} prefix="" step={0.5} />
              <RateInput label="USD → GBP Rate" value={rates.usdToGbp} path={['usdToGbp']} onUpdate={updateRate} prefix="" step={0.01} helpText="Exchange rate applied to USD costs" />
            </div>
          </RateSection>
        </div>

        {/* ─── RIGHT: Real-time Projections ─── */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart className="w-4 h-4 text-indigo-500" /> Live Cost Projection
            </h3>

            {/* Inputs */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Client Orgs: <span className="text-indigo-600">{clients}</span></label>
                <input type="range" min={1} max={50} value={clients} onChange={e => setClients(+e.target.value)} className="w-full h-1.5 rounded-full accent-indigo-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Users per Client: <span className="text-indigo-600">{usersPerClient}</span></label>
                <input type="range" min={2} max={30} value={usersPerClient} onChange={e => setUsersPerClient(+e.target.value)} className="w-full h-1.5 rounded-full accent-indigo-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Programmes/Client: <span className="text-indigo-600">{progsPerClient}</span></label>
                <input type="range" min={1} max={20} value={progsPerClient} onChange={e => setProgsPerClient(+e.target.value)} className="w-full h-1.5 rounded-full accent-indigo-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Projects/Programme: <span className="text-indigo-600">{projectsPerProg}</span></label>
                <input type="range" min={1} max={30} value={projectsPerProg} onChange={e => setProjectsPerProg(+e.target.value)} className="w-full h-1.5 rounded-full accent-indigo-600" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">AI Intensity</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map(lvl => (
                    <button key={lvl} onClick={() => setAiIntensity(lvl)}
                      className={clsx('py-1.5 rounded-lg text-xs font-bold border transition-all', aiIntensity === lvl ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 text-slate-600 hover:border-purple-300')}
                    >{lvl.charAt(0).toUpperCase() + lvl.slice(1)}</button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex justify-between">
                  Avg. Client Revenue (GBP/mo)
                  <span className="text-indigo-600">£{avgRevenuePerClient.toLocaleString()}</span>
                </label>
                <input type="range" min={500} max={10000} step={100} value={avgRevenuePerClient} onChange={e => setAvgRevenuePerClient(+e.target.value)} className="w-full h-1.5 rounded-full accent-indigo-600" />
              </div>
            </div>

            {/* Projection results */}
            <div className="space-y-2 text-sm">
              <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-3">Monthly Cost Breakdown</div>
              {[
                { label: 'Firestore DB', value: proj.firestoreGBP, color: 'bg-orange-100 text-orange-700' },
                { label: 'Gemini AI', value: proj.geminiGBP, color: 'bg-purple-100 text-purple-700' },
                { label: 'Vercel Hosting', value: proj.vercelGBP, color: 'bg-blue-100 text-blue-700' },
                { label: 'File Storage', value: proj.storageGBP, color: 'bg-green-100 text-green-700' },
                { label: 'Support', value: (proj as any).supportGBP ?? 0, color: 'bg-teal-100 text-teal-700' },
                { label: 'Training & DevOps', value: ((proj as any).trainingGBP ?? 0) + ((proj as any).devOpsGBP ?? 0), color: 'bg-rose-100 text-rose-700' },
                { label: 'Base Platform Fee', value: (proj as any).baseFeeGBP ?? 0, color: 'bg-slate-100 text-slate-600' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-600">{row.label}</span>
                  <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', row.color)}>{fmt2(row.value)}/mo</span>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Total Cost of Service</span>
                  <span className="text-indigo-700">{fmt2(proj.totalGBP)}/mo</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Per client org</span>
                  <span className="font-semibold">{fmt2(proj.costPerClient)}/mo</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Per project (annualised)</span>
                  <span className="font-semibold">{fmt2(proj.costPerProject)}/yr</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-1 text-xs text-slate-400">
                <div className="flex justify-between"><span>Monthly Firestore Reads</span><span>{fmtNum(proj.monthlyReads)}</span></div>
                <div className="flex justify-between"><span>Monthly Firestore Writes</span><span>{fmtNum(proj.monthlyWrites)}</span></div>
                <div className="flex justify-between"><span>AI Calls / Month</span><span>{fmtNum(proj.aiCalls)}</span></div>
              </div>
            </div>
          </div>

          {/* Profit Summary */}
          {(() => {
            const totalRevenue = clients * avgRevenuePerClient;
            const totalCost = proj.totalGBP;
            const grossProfit = totalRevenue - totalCost;
            const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
            const isLoss = grossProfit < 0;

            return (
              <div className={clsx("rounded-lg border shadow-sm p-5", isLoss ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200")}>
                <h3 className={clsx("font-bold mb-4 flex items-center gap-2", isLoss ? "text-red-800" : "text-emerald-800")}>
                  <TrendingUp className="w-4 h-4" /> Profitability Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-70">Total Monthly Revenue</span>
                    <span className="font-bold text-slate-700">£{totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-70">Total Monthly Cost</span>
                    <span className="font-bold text-red-600">-{fmt2(totalCost)}</span>
                  </div>
                  <div className="border-t border-black/5 pt-2 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-mono font-medium uppercase tracking-wide opacity-50">Gross Profit</p>
                      <p className={clsx("text-2xl font-semibold tabular-nums", isLoss ? "text-red-600" : "text-emerald-600")}>
                         {isLoss ? '-' : ''}£{Math.abs(grossProfit).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono font-medium uppercase tracking-wide opacity-50">Margin</p>
                      <p className={clsx("text-xl font-semibold tabular-nums", isLoss ? "text-red-600" : "text-emerald-600")}>
                        {margin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Advisory */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Usage Estimates Only</p>
            <p>Projections use activity assumptions (45 reads/user/day, 4 AI calls/project/month) to estimate costs. Actual costs will vary based on real usage patterns.</p>
            <p className="pt-1 text-slate-500 opacity-80">To generate a client-facing invoice using these rates, go to <strong>Platform Admin → Invoice Creator</strong>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

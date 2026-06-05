import React, { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp, Info, TrendingUp, DollarSign, Users, Building2, FolderKanban, Briefcase, Database, Server, HeadphonesIcon, GraduationCap, Shield, Download, RefreshCw, AlertCircle, CheckCircle, Target, HardDrive, Globe, BarChart, Save, Loader2, PoundSterling, ArrowRight, Layers, XCircle, Plus, FileText, X, Settings, Trash2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { api } from '../../../lib/api';
import { clsx } from 'clsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PageHeader from '../../../components/PageHeader';

/* ═══════════════════════════════════════════════════════
   REAL PRICING CONSTANTS — Cedar Guard Actual Stack
   Firebase project: cedar-risk-compliance-suite
   AI model: gemini-2.0-flash (optimized)
     = Gemini 2.0 Flash (March 2026)
   Storage: Firebase Storage (firebasestorage.app)
   Hosting: Vercel Pro (single /api serverless function)
   Firestore: https://firebase.google.com/pricing
   Gemini 2.5 Flash: https://ai.google.dev/pricing
   Vercel: https://vercel.com/pricing
   Firebase Storage: https://firebase.google.com/pricing
════════════════════════════════════════════════════════ */

export const DEFAULT_PRICING = {
  // ── Firebase Firestore (Blaze Pay-as-you-go)
  firestore: {
    readsPer100k: 0.036,      // $0.036 per 100k reads
    writesPer100k: 0.108,     // $0.108 per 100k writes
    deletesPer100k: 0.012,    // $0.012 per 100k deletes
    storagePerGBMonth: 0.18,  // $0.18/GB/month stored
    freeTierReadsPerDay: 50_000,
    freeTierWritesPerDay: 20_000,
    freeTierStorageGB: 1,
  },

  // ── Gemini 2.5 Flash (Realistic 2026 pricing)
  gemini: {
    inputPer1kTokens: 0.000075,   // $0.075 per 1M input tokens
    outputPer1kTokens: 0.000300,  // $0.30 per 1M output tokens
    avgPromptTokens: 2000,        // enterprise prompts are larger (regulation context)
    avgResponseTokens: 1500,      // detailed risk/compliance output
    thinkingTokensEstimate: 500,
  },

  // ── Vercel Pro
  vercel: {
    basePlanUSD: 20,
    includedBandwidthGB: 100,
    ovageBandwidthPerGB: 0.40,
    includedFunctionMs: 1_000_000,
    avgApiCallDurationMs: 400,
    avgApiCallsPerUserPerDay: 30,  // enterprise users hit API heavily (reports, dashboards)
    avgBandwidthPerUserGB: 0.60,  // rich UI + document downloads
  },

  firebaseStorage: {
    storagePerGBMonth: 0.026,
    downloadPerGB: 0.12,
    uploadOps100k: 0.05,
    downloadOps100k: 0.004,
    freeStorageGB: 5,
    freeDownloadGBPerDay: 10,
    avgDocSizeMB: 2.5,             // larger compliance documents, evidence photos
    avgDocsPerProjectPerYear: 40,  // active project: evidence, reports, certificates
  },

  support: {
    tier1AgentHourlyGBP: 28,
    tier2EngineerHourlyGBP: 70,
    avgTicketsPerClientMonthly: 4,
    avgTicketMinutesTier1: 20,
    avgEscalationRatePct: 0.15,
    avgEscalationMinutes: 45,
  },

  training: {
    trainerDayRateGBP: 950,
    travelExpensesPerSessionGBP: 200,
    initialOnboardingDays: 3,
    annualRefresherDays: 1,
    clientsPerCohort: 1,
  },

  devOps: {
    seniorDevDayRateGBP: 800,
    infraMaintenanceDaysPerYear: 20,
    devDaysPerClientPerYear: 4,
  },

  // Base platform infrastructure fee (fixed monthly GBP, regardless of usage)
  basePlatformFeeGBP: 350,

  usdToGbp: 0.78,
};

/* ─── Shared Usage Assumptions ─── */
export const USAGE_ASSUMPTIONS = {
  // Firestore activity per user/day (enterprise-grade assumptions)
  readsPerUserPerDay: 150,        // dashboard loads, register views, report generation
  writesPerUserPerDay: 25,        // saves, updates, sign-off actions
  // Background automated activity per project per day
  backgroundReadsPerProject: 60,  // compliance audits, AI summaries, risk aggregation
  backgroundWritesPerProject: 8,  // status updates, alert triggers, report writes
  // Storage per project (in MB)
  storagePerProjectMB: 30,        // 30MB per active project (docs, metadata, risk data)
  // AI calls per project per month (enterprise, high-frequency)
  aiBaseCallsPerProjectPerMonth: 12, // Risk ID, Discovery, Control Suggestions, Outlook
};

/* ─── Shared Cost Calculator ─── */
export function calculatePlatformCosts(
  clients: number,
  progsPerClient: number,
  projectsPerProg: number,
  usersPerClient: number,
  aiIntensity: 'low' | 'medium' | 'high',
  rates: typeof DEFAULT_PRICING
) {
  // Robust merge to handle incomplete configs
  const r = {
    ...DEFAULT_PRICING,
    ...rates,
    firestore: { ...DEFAULT_PRICING.firestore, ...(rates.firestore || {}) },
    gemini: { ...DEFAULT_PRICING.gemini, ...(rates.gemini || {}) },
    vercel: { ...DEFAULT_PRICING.vercel, ...(rates.vercel || {}) },
    firebaseStorage: { ...DEFAULT_PRICING.firebaseStorage, ...(rates.firebaseStorage || {}) },
  };

  const totalProjects = clients * progsPerClient * projectsPerProg;
  const totalUsers = clients * usersPerClient;
  const u = USAGE_ASSUMPTIONS;

  // ── Firestore
  const dailyReads = (totalUsers * u.readsPerUserPerDay) + (totalProjects * u.backgroundReadsPerProject);
  const dailyWrites = (totalUsers * u.writesPerUserPerDay) + (totalProjects * u.backgroundWritesPerProject);
  const monthlyReads = dailyReads * 30;
  const monthlyWrites = dailyWrites * 30;
  const billableReadsM = Math.max(0, monthlyReads - r.firestore.freeTierReadsPerDay * 30) / 1_000_000;
  const billableWritesM = Math.max(0, monthlyWrites - r.firestore.freeTierWritesPerDay * 30) / 1_000_000;
  const storageGB = (totalProjects * u.storagePerProjectMB) / 1024;
  const firestoreCostUSD =
    (billableReadsM * 10 * r.firestore.readsPer100k) +
    (billableWritesM * 10 * r.firestore.writesPer100k) +
    (Math.max(0, storageGB - r.firestore.freeTierStorageGB) * r.firestore.storagePerGBMonth);

  // ── Gemini AI
  const aiMult = { low: 1, medium: 2.5, high: 5 }[aiIntensity];
  const totalAiCalls = totalProjects * u.aiBaseCallsPerProjectPerMonth * aiMult;
  const geminiCostUSD =
    ((totalAiCalls * r.gemini.avgPromptTokens) / 1000) * r.gemini.inputPer1kTokens +
    ((totalAiCalls * r.gemini.avgResponseTokens) / 1000) * r.gemini.outputPer1kTokens;

  // ── Vercel
  const bandwidthGB = totalUsers * r.vercel.avgBandwidthPerUserGB;
  const vercelCostUSD =
    r.vercel.basePlanUSD +
    (Math.max(0, bandwidthGB - r.vercel.includedBandwidthGB) * r.vercel.ovageBandwidthPerGB);

  // ── Firebase Storage
  const docStorageGB = (totalProjects * r.firebaseStorage.avgDocsPerProjectPerYear * r.firebaseStorage.avgDocSizeMB) / 1024;
  const billableStorageGB = Math.max(0, docStorageGB - r.firebaseStorage.freeStorageGB);
  const storageCostUSD =
    (billableStorageGB * r.firebaseStorage.storagePerGBMonth) +
    (billableStorageGB * 0.4 * r.firebaseStorage.downloadPerGB);

  const infraCostGBP =
    (firestoreCostUSD + geminiCostUSD + vercelCostUSD + storageCostUSD) * r.usdToGbp;

  return {
    firestoreGBP: firestoreCostUSD * r.usdToGbp,
    geminiGBP: geminiCostUSD * r.usdToGbp,
    vercelGBP: vercelCostUSD * r.usdToGbp,
    storageGBP: storageCostUSD * r.usdToGbp,
    infraCostGBP,
    totalAiCalls: Math.round(totalAiCalls),
    monthlyReads: Math.round(monthlyReads),
    monthlyWrites: Math.round(monthlyWrites),
    storageUsedGB: parseFloat(storageGB.toFixed(2)),
    docStorageGB: parseFloat(docStorageGB.toFixed(2)),
    bandwidthGB: parseFloat(bandwidthGB.toFixed(2)),
  };
}


/* ─── Helpers ─── */
const usdToGbp = (usd: number, rate: number = DEFAULT_PRICING.usdToGbp) => usd * rate;
const fmt = (n: any) => {
  const val = Number(n);
  if (isNaN(val)) return '£0.00';
  return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtInt = (n: any) => {
  const val = Number(n);
  if (isNaN(val)) return '£0';
  return `£${Math.round(val).toLocaleString('en-GB')}`;
};

/* ─── Presets ─── */
const PRESETS = {
  small: { label: 'Small Council', clients: 3, progs: 3, projects: 5, users: 4, ai: 'low' as const, support: 'standard' as const },
  medium: { label: 'Medium/City Council', clients: 12, progs: 6, projects: 12, users: 8, ai: 'medium' as const, support: 'standard' as const },
  large: { label: 'Regional Authority', clients: 45, progs: 15, projects: 20, users: 20, ai: 'high' as const, support: 'priority' as const },
};

/* ─── Firestore reads/writes per month estimator (uses shared USAGE_ASSUMPTIONS) ─── */
function calcFirestore(clients: number, progsPerClient: number, projectsPerProg: number, usersPerClient: number, rates: typeof DEFAULT_PRICING) {
  const u = USAGE_ASSUMPTIONS;
  const totals = calculatePlatformCosts(clients, progsPerClient, projectsPerProg, usersPerClient, 'low', rates);
  return {
    monthlyReads: totals.monthlyReads,
    monthlyWrites: totals.monthlyWrites,
    storageGB: totals.storageUsedGB,
    costGBP: totals.firestoreGBP,
    costUSD: totals.firestoreGBP / rates.usdToGbp,
  };
}

function calcGemini(clients: number, progsPerClient: number, projectsPerProg: number, aiIntensity: 'low' | 'medium' | 'high', rates: typeof DEFAULT_PRICING) {
  const totals = calculatePlatformCosts(clients, progsPerClient, projectsPerProg, 1, aiIntensity, rates);
  const costUSD = totals.geminiGBP / rates.usdToGbp;
  const inputTokens = totals.totalAiCalls * rates.gemini.avgPromptTokens;
  const outputTokens = totals.totalAiCalls * rates.gemini.avgResponseTokens;
  return {
    totalAiCalls: totals.totalAiCalls,
    inputTokensM: parseFloat((inputTokens / 1_000_000).toFixed(3)),
    outputTokensM: parseFloat((outputTokens / 1_000_000).toFixed(3)),
    costGBP: totals.geminiGBP,
    costUSD,
  };
}

function calcVercel(clients: number, usersPerClient: number, rates: typeof DEFAULT_PRICING) {
  const totalUsers = clients * usersPerClient;
  const bandwidthGB = totalUsers * rates.vercel.avgBandwidthPerUserGB;
  const executions = totalUsers * rates.vercel.avgApiCallsPerUserPerDay * 30;
  const billableBandwidth = Math.max(0, bandwidthGB - rates.vercel.includedBandwidthGB);
  const costUSD = rates.vercel.basePlanUSD + (billableBandwidth * rates.vercel.ovageBandwidthPerGB);
  return { bandwidthGB: parseFloat(bandwidthGB.toFixed(2)), executions: Math.round(executions), costGBP: usdToGbp(costUSD, rates.usdToGbp), costUSD };
}

function calcStorage(clients: number, projectsPerProg: number, progsPerClient: number, rates: typeof DEFAULT_PRICING) {
  const totalProjects = clients * progsPerClient * projectsPerProg;
  const totalDocs = totalProjects * rates.firebaseStorage.avgDocsPerProjectPerYear;
  const storageMB = totalDocs * rates.firebaseStorage.avgDocSizeMB;
  const billableStorageGB = Math.max(0, storageMB / 1024 - rates.firebaseStorage.freeStorageGB);
  const costUSD = (billableStorageGB * rates.firebaseStorage.storagePerGBMonth) +
    (billableStorageGB * 0.4 * rates.firebaseStorage.downloadPerGB);
  return {
    storageGB: parseFloat((storageMB / 1024).toFixed(2)),
    totalDocs: Math.round(totalDocs),
    costGBP: usdToGbp(costUSD, rates.usdToGbp),
    costUSD,
  };
}

function calcSupport(clients: number, supportTier: 'standard' | 'priority' | 'enterprise', rates: typeof DEFAULT_PRICING) {
  const tierMultiplier = { standard: 1, priority: 1.6, enterprise: 2.5 }[supportTier];
  const monthlyTickets = clients * rates.support.avgTicketsPerClientMonthly;
  const tier1Hours = (monthlyTickets * rates.support.avgTicketMinutesTier1) / 60;
  const tier2Hours = (monthlyTickets * rates.support.avgEscalationRatePct * rates.support.avgEscalationMinutes) / 60;

  const costGBP = ((tier1Hours * rates.support.tier1AgentHourlyGBP) + (tier2Hours * rates.support.tier2EngineerHourlyGBP)) * tierMultiplier;
  return { monthlyTickets: Math.round(monthlyTickets), tier1Hours: parseFloat(tier1Hours.toFixed(1)), tier2Hours: parseFloat(tier2Hours.toFixed(1)), costGBP };
}

function calcTraining(clients: number, usersPerClient: number, rates: typeof DEFAULT_PRICING) {
  const sessionsNeeded = Math.ceil(clients / 2); // 2 clients per training cohort
  const annualRefreshers = clients * 0.5; // half clients need refresh each year
  const costGBP =
    (sessionsNeeded * rates.training.initialOnboardingDays * rates.training.trainerDayRateGBP) +
    (sessionsNeeded * rates.training.travelExpensesPerSessionGBP) +
    (annualRefreshers * rates.training.annualRefresherDays * rates.training.trainerDayRateGBP);
  return { sessionsNeeded, costGBP, costGBPMonthly: costGBP / 12 };
}

function calcDevOps(clients: number, rates: typeof DEFAULT_PRICING) {
  const annualCostGBP =
    (rates.devOps.infraMaintenanceDaysPerYear * rates.devOps.seniorDevDayRateGBP) +
    (clients * rates.devOps.devDaysPerClientPerYear * rates.devOps.seniorDevDayRateGBP);
  return { annualCostGBP, monthlyCostGBP: annualCostGBP / 12 };
}

/* ═══════════════════════════════════════════════════════
   UI COMPONENTS
════════════════════════════════════════════════════════ */

function SectionCard({
  icon: Icon,
  title,
  color,
  children,
  onToggle,
  isExcluded
}: {
  icon: any;
  title: string;
  color: string;
  children: React.ReactNode;
  onToggle?: (excluded: boolean) => void;
  isExcluded?: boolean;
}) {
  return (
    <div className={clsx('bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all', isExcluded && 'opacity-60 bg-slate-50 grayscale-[0.5]')}>
      <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
          <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        {onToggle && (
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-[10px] font-mono font-medium text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-wide">
              {isExcluded ? 'Excluded' : 'Included'}
            </span>
            <input
              type="checkbox"
              checked={!isExcluded}
              onChange={(e) => onToggle(!e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </label>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function CostRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-between py-2 border-b border-slate-50 last:border-0', highlight && 'bg-indigo-50 -mx-5 px-5 rounded')}>
      <div>
        <p className={clsx('text-sm font-medium', highlight ? 'text-indigo-800' : 'text-slate-700')}>{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <span className={clsx('text-sm font-bold tabular-nums', highlight ? 'text-indigo-700' : 'text-slate-800')}>{value}</span>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format, color = 'bg-slate-200 accent-indigo-600' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string; color?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-600">{label}</label>
        <span className="text-sm font-bold text-indigo-600">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={clsx("w-full h-1.5 rounded-full appearance-none cursor-pointer", color)}
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>{format ? format(min) : min}</span><span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

function PricingBadge({ label, recommended }: { label: string; recommended?: boolean }) {
  return (
    <span className={clsx('text-[10px] font-mono font-medium px-2 py-0.5 rounded-full uppercase tracking-wide', recommended ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
      {recommended ? '★ ' : ''}{label}
    </span>
  );
}

/* ─── Invoice Document (Off-screen for PDF) ─── */
function InvoiceDocument({ 
  clientName, 
  clientCompany, 
  data,
  customItems,
  rates 
}: { 
  clientName: string; 
  clientCompany: string; 
  data: any; 
  customItems: any[];
  rates: any;
}) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNo = `INV-${Math.floor(Math.random() * 90000) + 10000}`;

  return (
    <div id="invoice-capture" className="bg-white p-12 w-[800px] text-slate-900 border border-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Cedar Guard Logo" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 leading-none">CEDAR GUARD</h1>
              <p className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Risk Intelligence & Compliance</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-semibold text-slate-200 mb-2">INVOICE</h2>
          <p className="text-sm font-bold text-slate-600">{invoiceNo}</p>
          <p className="text-xs text-slate-400">{date}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div>
          <p className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Bill To</p>
          <p className="font-bold text-slate-800 text-lg">{clientName || 'Valued Client'}</p>
          <p className="text-sm text-slate-600">{clientCompany || 'Organisation'}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">From</p>
          <p className="font-bold text-slate-800">Cehpoint Ai Ltd.</p>
          <p className="text-sm text-slate-600">Innovation Center, Tech Square</p>
          <p className="text-sm text-slate-600">London, UK</p>
        </div>
      </div>

      {/* Table */}
      <table className="w-full mb-12">
        <thead>
          <tr className="font-mono border-b-2 border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-left">
            <th className="py-3">Description</th>
            <th className="py-3 text-right">Quantity / Unit</th>
            <th className="py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {data.items.map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-slate-50">
              <td className="py-4">
                <p className="font-bold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-400">{item.sub}</p>
              </td>
              <td className="py-4 text-right text-slate-600">{item.qty || 'Monthly'}</td>
              <td className="py-4 text-right font-bold text-slate-800">£{(item.amount || 0).toLocaleString()}</td>
            </tr>
          ))}
          {customItems.map((item: any) => (
            <tr key={item.id} className="border-b border-slate-50">
              <td className="py-4">
                <p className="font-bold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-400">Custom Adjustment</p>
              </td>
              <td className="py-4 text-right text-slate-600">1</td>
              <td className="py-4 text-right font-bold text-slate-800">£{(item.amount || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-bold text-slate-800">£{(data.total || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
            <span className="text-slate-500">VAT (20%)</span>
            <span className="font-bold text-slate-800">£{((data.total || 0) * 0.2).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold bg-slate-900 text-white p-4 rounded-lg mt-4">
            <span>TOTAL DUE</span>
            <span>£{((data.total || 0) * 1.2).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-24 pt-8 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 mb-2">Thank you for choosing Cedar Guard Platform.</p>
        <p className="text-[10px] text-slate-300 font-medium">VAT Reg: GB 123 4567 89 | Company Reg: 09876543</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   Renamed from QuoteGenerator to InvoiceManager
════════════════════════════════════════════════════════ */
export function InvoiceManager() {
  const { user, pricingConfig, fetchPricingConfig, addNotification } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calculator' | 'invoices'>('calculator');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    fetchPricingConfig();
  }, [fetchPricingConfig]);

  // ── Inputs ──
  const [clients, setClients] = useState(10);
  const [progsPerClient, setProgsPerClient] = useState(5);
  const [projectsPerProg, setProjectsPerProg] = useState(8);
  const [usersPerClient, setUsersPerClient] = useState(6);
  const [aiIntensity, setAiIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [supportTier, setSupportTier] = useState<'standard' | 'priority' | 'enterprise'>('standard');
  const [targetMarginPct, setTargetMarginPct] = useState(40);
  const [showBreakdown, setShowBreakdown] = useState(true);

  // ── New State features ──
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [otherMonthlyCost, setOtherMonthlyCost] = useState(0);
  const [rates, setRates] = useState(DEFAULT_PRICING);
  const [showOverrides, setShowOverrides] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [customItems, setCustomItems] = useState<{ id: string; label: string; amount: number }[]>([]);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, invRes] = await Promise.all([
          api.adminGetUsers(),
          api.adminGetInvoices()
        ]);
        
        if (usersRes.success) setUsers(usersRes.users || []);
        if (invRes.success) setInvoices(invRes.invoices || []);
      } catch (e) {
        console.error('Failed to fetch data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  React.useEffect(() => {
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

  // ── Derived totals ──
  const totalProjects = clients * progsPerClient * projectsPerProg;
  const totalProgrammes = clients * progsPerClient;
  const totalUsers = clients * usersPerClient;

  const firestore = useMemo(() => calcFirestore(clients, progsPerClient, projectsPerProg, usersPerClient, rates), [clients, progsPerClient, projectsPerProg, usersPerClient, rates]);
  const gemini = useMemo(() => calcGemini(clients, progsPerClient, projectsPerProg, aiIntensity, rates), [clients, progsPerClient, projectsPerProg, aiIntensity, rates]);
  const vercel = useMemo(() => calcVercel(clients, usersPerClient, rates), [clients, usersPerClient, rates]);
  const storage = useMemo(() => calcStorage(clients, projectsPerProg, progsPerClient, rates), [clients, projectsPerProg, progsPerClient, rates]);
  const support = useMemo(() => calcSupport(clients, supportTier, rates), [clients, supportTier, rates]);
  const training = useMemo(() => calcTraining(clients, usersPerClient, rates), [clients, usersPerClient, rates]);
  const devops = useMemo(() => calcDevOps(clients, rates), [clients, rates]);

  // Category exclusion logic
  const isExcluded = (id: string) => excludedCategories.includes(id);
  const toggleExclusion = (id: string, excluded: boolean) => {
    if (excluded) setExcludedCategories(prev => [...prev, id]);
    else setExcludedCategories(prev => prev.filter(x => x !== id));
  };

  // Monthly totals
  const totalCostMonthlyGBP = (
    (isExcluded('firestore') ? 0 : firestore.costGBP) +
    (isExcluded('gemini') ? 0 : gemini.costGBP) +
    (isExcluded('vercel') ? 0 : vercel.costGBP) +
    (isExcluded('storage') ? 0 : storage.costGBP) +
    (isExcluded('support') ? 0 : support.costGBP) +
    (isExcluded('training') ? 0 : training.costGBPMonthly) +
    (isExcluded('devops') ? 0 : devops.monthlyCostGBP) +
    otherMonthlyCost +
    customItems.reduce((acc, item) => acc + item.amount, 0)
  );

  const totalCostAnnualGBP = totalCostMonthlyGBP * 12;
  const costPerClient = totalCostMonthlyGBP / clients;
  const costPerProject = totalCostAnnualGBP / totalProjects;

  // Pricing recommendations (cost + margin)
  const marginMultiplier = 1 + targetMarginPct / 100;
  const suggestedClientMonthly = costPerClient * marginMultiplier;
  const suggestedProjectFee = costPerProject * marginMultiplier;
  const suggestedPerUserMonthly = (totalCostMonthlyGBP / totalUsers) * marginMultiplier;
  const suggestedAISurcharge = (gemini.costGBP / clients) * marginMultiplier;

  const applyPreset = (preset: typeof PRESETS[keyof typeof PRESETS]) => {
    setClients(preset.clients);
    setProgsPerClient(preset.progs);
    setProjectsPerProg(preset.projects);
    setUsersPerClient(preset.users);
    setAiIntensity(preset.ai);
    setSupportTier(preset.support);
  };

  const handleSaveInvoice = async () => {
    if (!clientCompany && !clientName) {
      addNotification({ title: 'Validation Error', body: 'Please enter a Client name or select a company.', type: 'system' });
      return;
    }
    setIsSaving(true);
    try {
      const selectedUser = users.find(u => u.uid === selectedClientId);
      const invoiceData = {
        clientId: selectedUser?.email || clientCompany.toLowerCase().replace(/\s+/g, '-'),
        clientName: clientName || 'Valued Client',
        clientEmail: selectedUser?.email || '',
        clientCompany,
        date: new Date().toISOString(),
        items: invoiceItems.map(i => ({ ...i, category: 'service' })),
        customItems,
        totalRate: totalCostMonthlyGBP,
        margin: targetMarginPct,
        profit: totalCostMonthlyGBP * (targetMarginPct / 100),
        total: totalCostMonthlyGBP * marginMultiplier, // The price charged to client
        subtotal: totalCostMonthlyGBP * marginMultiplier,
        tax: totalCostMonthlyGBP * marginMultiplier * 0.2,
        status: 'pending' as const,
        createdBy: user?.email || 'admin'
      };

      await api.adminCreateInvoice(invoiceData);
      setSaveSuccess(true);
      
      // Refresh invoices list
      const invRes = await api.adminGetInvoices();
      if (invRes.success) setInvoices(invRes.invoices || []);
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      addNotification({ title: 'Invoice Save Failed', body: 'Failed to save invoice: ' + e.message, type: 'system' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setIsGeneratingInvoice(true);
    try {
      const element = document.getElementById('invoice-capture');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CedarGuard_Invoice_${clientCompany.replace(/\s+/g, '_') || 'Draft'}.pdf`);
    } catch (e) {
      console.error('Invoice generation failed', e);
      addNotification({ title: 'PDF Generation Failed', body: 'Failed to generate PDF. Please check the console.', type: 'system' });
    } finally {
      setIsGeneratingInvoice(false);
      setShowInvoicePreview(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this saved invoice?')) {
      try {
        const res = await api.adminDeleteInvoice(id);
        if (res.success) {
          setInvoices(prev => prev.filter(inv => inv.id !== id));
          addNotification({ title: 'Invoice Deleted', body: 'The invoice has been removed from the system.', type: 'system' });
        } else {
          addNotification({ title: 'Delete Failed', body: res.error || 'Failed to delete invoice', type: 'system' });
        }
      } catch (err: any) {
        addNotification({ title: 'Error', body: err.message || 'An error occurred', type: 'system' });
      }
    }
  };

  const invoiceItems = [
    { label: 'Platform Infrastructure (Blaze)', sub: 'Cloud hosting & database services', amount: isExcluded('firestore') ? 0 : firestore.costGBP + (isExcluded('vercel') ? 0 : vercel.costGBP) + (isExcluded('storage') ? 0 : storage.costGBP) },
    { label: 'AI Cognitive Services', sub: `Gemini 1.5 Flash (${aiIntensity} intensity)`, amount: isExcluded('gemini') ? 0 : gemini.costGBP },
    { label: 'Support & Maintenance', sub: `${supportTier.toUpperCase()} Priority Support`, amount: isExcluded('support') ? 0 : support.costGBP },
    { label: 'Strategic Implementation', sub: 'Project setup & DevOps allocation', amount: (isExcluded('training') ? 0 : training.costGBPMonthly) + (isExcluded('devops') ? 0 : devops.monthlyCostGBP) },
    { label: 'Corporate Overhead', sub: 'Custom internal adjustments', amount: otherMonthlyCost }
  ].filter(i => i.amount > 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <PageHeader
            title="Platform Cost & Invoice Manager"
            subtitle="Model your real infrastructure, support, and AI costs for UK local government council clients."
            breadcrumbs={[{label:"Account"},{label:"Invoices"}]}
          />
          <div className="flex items-center gap-1 mt-6 bg-slate-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('calculator')}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'calculator' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <Calculator className="w-4 h-4" />
              Cost Calculator
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'invoices' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <Layers className="w-4 h-4" />
              Saved Invoices
              {invoices.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] rounded-full">
                  {invoices.length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {activeTab === 'calculator' && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveInvoice}
              disabled={isSaving || !clientCompany}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95",
                saveSuccess ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save to System'}
            </button>
            <button
              onClick={() => setShowInvoicePreview(true)}
              disabled={!clientCompany}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Generate PDF
            </button>
          </div>
        )}
      </div>

      {activeTab === 'calculator' ? (
        <>
          {/* ── Quick Scenarios/Presets ── */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 shrink-0">
              <Target className="w-3.5 h-3.5" /> Quick Scenarios
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              {Object.entries(PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => applyPreset(preset)}
                  className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 font-semibold text-sm transition-all whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setExcludedCategories([]);
                  setOtherMonthlyCost(0);
                  setRates(pricingConfig || DEFAULT_PRICING);
                  applyPreset(PRESETS.medium);
                }}
                className="px-4 py-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-semibold text-sm transition-all whitespace-nowrap"
              >
                Reset All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
            {/* ═══ LEFT COLUMN — Inputs ═══ */}
            <div className="space-y-4">
              <SectionCard icon={Building2} title="Scale Parameters" color="bg-indigo-50 text-indigo-600">
                <div className="space-y-5">
                  <Slider label="Client Admin Organisations" value={clients} min={1} max={50} step={1} onChange={setClients} />
                  <Slider label="Programmes per Client" value={progsPerClient} min={1} max={30} step={1} onChange={setProgsPerClient} />
                  <Slider label="Projects per Programme" value={projectsPerProg} min={1} max={30} step={1} onChange={setProjectsPerProg} />
                  <Slider label="Users per Client" value={usersPerClient} min={2} max={30} step={1} onChange={setUsersPerClient} />

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Councils', value: clients },
                      { label: 'Projects', value: totalProjects.toLocaleString() },
                      { label: 'Total Users', value: totalUsers.toLocaleString() },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-lg font-bold text-slate-900">{s.value}</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={TrendingUp} title="Target Margin" color="bg-emerald-50 text-emerald-600">
                <Slider label="Gross Margin Target" value={targetMarginPct} min={15} max={80} step={5} onChange={setTargetMarginPct} format={v => `${v}%`} />
                <p className="text-xs text-slate-400 mt-2 italic">Price = Cost × {marginMultiplier.toFixed(2)}×</p>
              </SectionCard>

              <SectionCard icon={Shield} title="Invoice Configuration" color="bg-rose-50 text-rose-600">
                <div className="space-y-4">
                  {users.length > 0 && (
                    <select
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50/50 font-medium cursor-pointer"
                      onChange={(e) => {
                        const selected = users.find(u => u.uid === e.target.value);
                        if (selected) {
                          setSelectedClientId(selected.uid);
                          setClientCompany(selected.profile?.organisation || '');
                          setClientName(selected.profile?.name || selected.email?.split('@')[0] || '');
                        }
                      }}
                    >
                      <option value="">Quick Select Client Email...</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.email} {u.profile?.name ? `(${u.profile.name})` : ''}</option>
                      ))}
                    </select>
                  )}
                  <input type="text" placeholder="Client Name" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="text" placeholder="Client Company/Council" value={clientCompany} onChange={e => setClientCompany(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Extra Costs (Monthly)</p>
                    <Slider label="Custom Overhead" value={otherMonthlyCost} min={0} max={5000} step={50} onChange={setOtherMonthlyCost} format={fmtInt} />
                  </div>
                </div>
              </SectionCard>
              
              <SectionCard icon={Settings} title="Developer Overrides" color="bg-slate-50 text-slate-500" onToggle={() => setShowOverrides(!showOverrides)}>
                {showOverrides && (
                  <div className="space-y-4 pt-2">
                    <Slider label="Senior Dev Day Rate (£)" value={rates.devOps.seniorDevDayRateGBP} min={400} max={1200} step={25} onChange={v => setRates(r => ({ ...r, devOps: { ...r.devOps, seniorDevDayRateGBP: v } }))} format={v => `£${v}`} />
                    <Slider label="Trainer Day Rate (£)" value={rates.training.trainerDayRateGBP} min={400} max={1500} step={50} onChange={v => setRates(r => ({ ...r, training: { ...r.training, trainerDayRateGBP: v } }))} format={v => `£${v}`} />
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ═══ RIGHT COLUMN — Summary & Details ═══ */}
            <div className="space-y-5">
              {/* Total Cost Summary Card */}
              <div className="rounded-lg p-6 text-white shadow-xl bg-gradient-to-br from-indigo-900 to-indigo-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono font-medium uppercase tracking-wide text-white/50">Monthly Platform Cost</p>
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px]">Infrastructure Only</span>
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-semibold tabular-nums">{fmtInt(totalCostMonthlyGBP)}</p>
                  <p className="text-white/50 text-sm mb-1">/ mo</p>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/50 mb-1 uppercase font-bold tracking-tight">Invoice Price</p>
                    <p className="text-2xl font-semibold text-emerald-400">{fmtInt(totalCostMonthlyGBP * marginMultiplier)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1 uppercase font-bold tracking-tight">Monthly Profit</p>
                    <p className="text-2xl font-semibold text-indigo-300">+{fmtInt((totalCostMonthlyGBP * marginMultiplier) - totalCostMonthlyGBP)}</p>
                  </div>
                </div>
              </div>

              {/* Individual Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard icon={Database} title="Cloud Infra" color="bg-orange-50 text-orange-600" onToggle={e => toggleExclusion('firestore', e)} isExcluded={isExcluded('firestore')}>
                  <CostRow label="Writes/Reads" value={`${((firestore.monthlyWrites + firestore.monthlyReads) / 1000).toFixed(0)}k units`} />
                  <CostRow label="Base Cost" value={fmt(firestore.costGBP)} highlight />
                </SectionCard>
                <SectionCard icon={Briefcase} title="Gemini 2.5 AI" color="bg-purple-50 text-purple-600" onToggle={e => toggleExclusion('gemini', e)} isExcluded={isExcluded('gemini')}>
                  <CostRow label="Intensity" value={aiIntensity} />
                  <CostRow label="Token Cost" value={fmt(gemini.costGBP)} highlight />
                </SectionCard>
                <SectionCard icon={Server} title="Vercel Runtime" color="bg-slate-100 text-slate-600" onToggle={e => toggleExclusion('vercel', e)} isExcluded={isExcluded('vercel')}>
                  <CostRow label="Executions" value={vercel.executions.toLocaleString()} />
                  <CostRow label="Base Cost" value={fmt(vercel.costGBP)} highlight />
                </SectionCard>
                <SectionCard icon={HeadphonesIcon} title="Service Support" color="bg-teal-50 text-teal-600" onToggle={e => toggleExclusion('support', e)} isExcluded={isExcluded('support')}>
                  <CostRow label="SLA Tier" value={supportTier} />
                  <CostRow label="Base Cost" value={fmt(support.costGBP)} highlight />
                </SectionCard>
              </div>

              {/* Comparison Matrix */}
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                  <BarChart className="w-4 h-4 text-indigo-600" /> Platform Deployment Notes
                </h3>
                <div className="space-y-3 text-[11px] text-slate-600 leading-relaxed italic">
                   <p><strong>G-Cloud 14 Compliance:</strong> Rates adjusted for senior-level public sector engagement models.</p>
                   <p><strong>Gemini 2.5 Flash:</strong> Full Vertex AI integration. Enterprise security and PII masking assumed.</p>
                   <p><strong>Dynamic Scaling:</strong> Architecture supports rapid scale-out to regional authority tier.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-pharmaceutical">Recently Generated Invoices</h2>
              <p className="text-sm text-slate-500">History of platform invoices saved to the system</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="p-3 bg-indigo-600/10 rounded-lg border border-indigo-100/50 flex items-center justify-center mx-auto mb-4 w-16 h-16">
                  <BarChart className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-800">No invoices yet</h3>
                <p className="text-sm text-slate-500 mt-1">Generate and save an invoice from the calculator tab to see it here.</p>
              </div>
            ) : (
              invoices.map((inv: any) => (
                <div key={inv.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm text-indigo-600 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{inv.clientCompany || 'Unknown Client'}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <Target className="w-3 h-3 text-amber-500" /> {inv.date}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase tracking-wide">
                          {inv.margin}% Margin
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-semibold text-slate-900 font-mono">£{Number(inv.total).toLocaleString()}</p>
                      <p className="text-[10px] font-mono font-medium text-emerald-600 mt-0.5 uppercase tracking-wide tabular-nums">Profit: £{Number(inv.profit).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 transition-all">
                      <button 
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showInvoicePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-2xl max-h-[95vh] overflow-y-auto relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowInvoicePreview(false)}
              className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-all z-10"
            >
              <X className="w-5 h-5 ml-0" />
            </button>
            
            <div className="p-4 md:p-8">
              <InvoiceDocument 
                clientName={clientName}
                clientCompany={clientCompany}
                data={{ 
                  items: invoiceItems, 
                  total: totalCostMonthlyGBP * marginMultiplier 
                }}
                customItems={customItems}
                rates={rates}
              />
              
              <div className="mt-8 flex justify-end gap-3 px-12 pb-12">
                <button
                  onClick={() => setShowInvoicePreview(false)}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadInvoice}
                  disabled={isGeneratingInvoice}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingInvoice ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  {isGeneratingInvoice ? 'Generating PDF...' : 'Download Invoice PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

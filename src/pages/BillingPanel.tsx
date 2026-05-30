import React, { useState } from 'react';
import { CreditCard, Download, Receipt, Target, CheckCircle2, ShieldCheck, AlertCircle, Calendar, ArrowUpRight, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { isSuperAdmin, isAtLeastClientAdmin } from '../lib/roles';
import { Navigate } from 'react-router';
import PageHeader from '../components/PageHeader';

// Mock Invoice Data
const INVOICES = [
  { id: 'INV-2023-08', date: '01 Aug 2023', amount: 350, status: 'Paid', pdfUrl: '#' },
  { id: 'INV-2023-07', date: '01 Jul 2023', amount: 350, status: 'Paid', pdfUrl: '#' },
  { id: 'INV-2023-06', date: '01 Jun 2023', amount: 350, status: 'Paid', pdfUrl: '#' },
];

export function BillingPanel() {
  const { user } = useStore();
  const [successMsg, setSuccessMsg] = useState('');

  // Protect route
  const role = user?.role || user?.profile?.role;
  const isAuthorized = isSuperAdmin(user?.email, role);

  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://cedar-billing-portal.example.com');
    setSuccessMsg('Portal link copied!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <PageHeader
        title="Billing & Subscriptions"
        subtitle="Manage your subscription plan, payment methods, and invoice history."
        breadcrumbs={[{label:"Account"},{label:"Billing"}]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Current Plan & Payment Method) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Current Plan Card */}
          <div className="bg-white rounded-lg p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Target className="w-48 h-48 text-indigo-600" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 text-[11px] font-mono font-medium uppercase tracking-wide rounded-lg mb-4">
                  <ShieldCheck className="w-4 h-4" /> Active Subscription
                </div>
                <h2 className="text-3xl font-semibold text-slate-900 mb-1">Cedar Professional Suite</h2>
                <div className="text-slate-500 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Next billing date: 01 Sep 2023
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-semibold text-slate-900">£350<span className="text-lg text-slate-400 font-medium">/mo</span></div>
                <button className="mt-4 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm">
                  Upgrade Plan
                </button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 grid md:grid-cols-3 gap-4">
               <div className="flex items-start gap-3">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                 <p className="text-sm text-slate-600 font-medium">Unlimited Users & Projects</p>
               </div>
               <div className="flex items-start gap-3">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                 <p className="text-sm text-slate-600 font-medium">AI Automated Intelligence</p>
               </div>
               <div className="flex items-start gap-3">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                 <p className="text-sm text-slate-600 font-medium">Full Monitoring & BI Heatmaps</p>
               </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-lg p-8 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500" /> Payment Method
            </h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-10 bg-white shadow-sm border border-slate-200 rounded-lg flex items-center justify-center font-semibold text-slate-900 text-xl">
                  VISA
                </div>
                <div>
                  <div className="font-bold text-slate-900">Visa ending in 4242</div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Expires 12/2026</div>
                </div>
              </div>
              <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Update
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 p-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p className="text-sm font-medium">To change your billing email or viewing additional portal options, please visit the Stripe customer portal.</p>
            </div>
            
            <button 
              onClick={handleCopyLink}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-all"
            >
              <Copy className="w-4 h-4" /> 
              {successMsg || 'Copy Customer Portal Link'}
            </button>

          </div>

        </div>

        {/* Right Column (Invoice History) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-500" /> Invoice History
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {INVOICES.map((inv, idx) => (
              <div key={inv.id} className={clsx("p-6 flex items-center justify-between hover:bg-slate-50 transition-colors", idx !== 0 && "border-t border-slate-100")}>
                <div>
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                    {inv.id}
                    {inv.status === 'Paid' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-mono font-medium uppercase tracking-wide">Paid</span>}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">{inv.date} &middot; £{inv.amount}</div>
                </div>
                <button title="Download PDF" className="p-2.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 rounded-lg shadow-sm transition-all hover:shadow-md">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="p-6 border-t border-slate-100">
             <button className="w-full py-3 flex items-center justify-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 rounded-lg transition-colors text-sm">
               View All Invoices <ArrowUpRight className="w-4 h-4" />
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}

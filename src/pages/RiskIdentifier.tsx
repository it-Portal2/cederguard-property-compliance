import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Search, Filter, Shield, ArrowLeft, ChevronRight, Info, CheckCircle2, Copy, ExternalLink, Target, DollarSign, Users, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RISK_LIBRARY = [
  {
    id: 'RSK-001',
    category: 'Regulatory',
    title: 'Building Safety Act 2022 Non-Compliance',
    description: 'Failure to maintain the Golden Thread of digital records for High-Rise Buildings (HRB), leading to enforcement action by the Building Safety Regulator (BSR).',
    mitigation: 'Implement a structured digital record-keeping system for all HRB assets and appoint an Accountable Person (AP) with clearly defined roles.',
    impact: 'Critical',
    probability: 'Medium',
    icon: Scale
  },
  {
    id: 'RSK-002',
    category: 'Financial',
    title: 'Subsidy / Grant Clawback (Homes England / GLA)',
    description: 'Non-compliance with grant conditions (e.g., AHP / SHDF) resulting in the requirement to repay significant sums of public funding.',
    mitigation: 'Monthly audit of grant milestone evidence and strict adherence to reporting cycles specified in the funding agreement.',
    impact: 'High',
    probability: 'Low',
    icon: DollarSign
  },
  {
    id: 'RSK-003',
    category: 'Safety',
    title: 'Fire Safety Remediation Overruns',
    description: 'Discovery of unforeseen fire safety defects during capital works leading to budget overspends and programme delays.',
    mitigation: 'Commission intrusive Type 4 surveys early in the programme and maintain a 15-20% contingency specifically for safety remediation.',
    impact: 'High',
    probability: 'High',
    icon: Shield
  },
  {
    id: 'RSK-004',
    category: 'Reputational',
    title: 'Tenant Satisfaction / Consumer Standard Breach',
    description: 'Poor communication or delivery failures during regeneration projects leading to adverse RSH inspection results or media scrutiny.',
    mitigation: 'Establish a robust Resident Engagement Strategy and maintain clear, transparent communication channels throughout the project lifecycle.',
    impact: 'Medium',
    probability: 'Medium',
    icon: Users
  },
  {
    id: 'RSK-005',
    category: 'Strategic',
    title: 'Capacity & Capability Gap',
    description: 'Lack of internal expertise (e.g., Building Safety Coordinators, Retrofit Assessors) preventing the effective delivery of complex programmes.',
    mitigation: 'Resource planning as part of initial programme setup and use of specialist frameworks to augment internal capacity where needed.',
    impact: 'High',
    probability: 'Medium',
    icon: Target
  }
];

const CATEGORIES = ['All', 'Regulatory', 'Financial', 'Safety', 'Reputational', 'Strategic'];

export function RiskIdentifier() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedRisk, setSelectedRisk] = useState<typeof RISK_LIBRARY[0] | null>(null);

  const filtered = RISK_LIBRARY.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || 
                          r.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || r.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 pt-safe">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Risk Identifier</h1>
              <p className="text-sm text-slate-500 font-medium tracking-tight">Search and explore industry-standard property risk mitigations.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search risks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-64 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                category === c 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filtered.length > 0 ? (
              filtered.map((risk) => {
                const Icon = risk.icon;
                return (
                  <motion.div
                    layout
                    key={risk.id}
                    onClick={() => setSelectedRisk(risk)}
                    className={`p-6 bg-white border-2 rounded-[24px] cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 group ${
                      selectedRisk?.id === risk.id ? 'border-indigo-500 shadow-indigo-900/5' : 'border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        selectedRisk?.id === risk.id ? 'bg-indigo-600' : 'bg-slate-50 group-hover:bg-indigo-50'
                      }`}>
                        <Icon className={`w-7 h-7 ${
                          selectedRisk?.id === risk.id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{risk.category}</span>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                             risk.impact === 'Critical' ? 'bg-red-50 text-red-600' : risk.impact === 'High' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          }`}>Impact: {risk.impact}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{risk.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{risk.description}</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 mt-1 transition-all ${
                        selectedRisk?.id === risk.id ? 'text-indigo-600 translate-x-1' : 'text-slate-300 group-hover:text-indigo-400'
                      }`} />
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="p-20 text-center bg-white border border-dashed border-slate-300 rounded-[32px]">
                <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-400">No risks found</h3>
                <p className="text-slate-400 mt-1">Try adjusting your search or category filters.</p>
              </div>
            )}
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selectedRisk ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl shadow-indigo-900/10 sticky top-10"
                >
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID: {selectedRisk.id}</span>
                    <button onClick={() => setSelectedRisk(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Close</button>
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 leading-tight mb-6">{selectedRisk.title}</h2>
                  
                  <div className="space-y-8">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">Description</p>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{selectedRisk.description}</p>
                    </div>

                    <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Statutory Mitigation Strategy</p>
                      </div>
                      <p className="text-sm text-emerald-800 leading-relaxed font-bold">{selectedRisk.mitigation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="p-4 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-center">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Impact</span>
                        <span className={`text-xs font-black ${selectedRisk.impact === 'Critical' ? 'text-red-600' : 'text-slate-700'}`}>{selectedRisk.impact}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-center">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Probability</span>
                        <span className="text-xs font-black text-slate-700">{selectedRisk.probability}</span>
                      </div>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200">
                      <Copy className="w-4 h-4" /> Copy to Register
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-indigo-50/30 border border-dashed border-indigo-200 rounded-[32px] min-h-[500px]">
                  <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center shadow-lg shadow-indigo-900/5 mb-6">
                    <AlertTriangle className="w-8 h-8 text-indigo-200" />
                  </div>
                  <h3 className="text-xl font-bold text-indigo-900/40 tracking-tight">Select a risk to view detailed mitigation strategies</h3>
                  <p className="text-indigo-900/30 text-xs mt-2 font-medium">Browse our industry-standard library developed for public sector property portfolios.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

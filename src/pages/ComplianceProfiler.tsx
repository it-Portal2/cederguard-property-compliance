import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Shield, CheckCircle2, ChevronRight, ChevronLeft, ArrowLeft, Info, AlertTriangle, FileText, Target, Home, Building2, FlameKindling, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QUESTIONS = [
  {
    id: 1,
    title: 'Asset Type & Purpose',
    text: 'What is the primary nature of this property unit or scheme?',
    options: [
      { label: 'Social Housing / General Needs', value: 'social', icon: Home },
      { label: 'High-Rise Residential (HRB)', value: 'hrb', icon: Building2 },
      { label: 'Commercial / Mixed Use', value: 'commercial', icon: Building2 },
      { label: 'Supported / Sheltered Housing', value: 'supported', icon: CheckCircle2 },
    ]
  },
  {
    id: 2,
    title: 'Building Height',
    text: 'Is the building categorized as "High-Rise" under the Building Safety Act 2022?',
    options: [
      { label: 'Yes (18m+ or 7+ storeys)', value: 'hrb_yes', icon: Building2 },
      { label: 'No (Under 18m)', value: 'hrb_no', icon: Home },
    ]
  },
  {
    id: 3,
    title: 'Leasehold Status',
    text: 'Does the property scheme include any leasehold or shared ownership units?',
    options: [
      { label: 'Yes - Leasehold / Shared Ownership', value: 'leasehold_yes', icon: FileText },
      { label: 'No - 100% Social Rented', value: 'leasehold_no', icon: CheckCircle2 },
    ]
  },
  {
    id: 4,
    title: 'Energy Context',
    text: 'Is this project part of a Decarbonisation or Retrofit programme (e.g., SHDF)?',
    options: [
      { label: 'Yes - Retrofit / SHDF', value: 'retrofit_yes', icon: Leaf },
      { label: 'No - Standard Maintenance', value: 'retrofit_no', icon: Target },
    ]
  }
];

const DOMAIN_MAP: Record<string, string[]> = {
  hrb_yes: ['BSA 2022 Gateway Regime', 'Golden Thread Records', 'Fire Safety (England) Regs 2022'],
  social: ['Safety & Quality Standard', 'Awaab\'s Law Obligations'],
  leasehold_yes: ['Section 20 Consultation', 'Transparency, Influence & Accountability'],
  retrofit_yes: ['SHDF Grant Conditions', 'PAS 2035 Compliance', 'Retrofit Design Standards'],
  supported: ['Neighbourhood & Community Standard', 'Specific H&S Obligations'],
};

export function ComplianceProfiler() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);

  const handleSelect = (value: string) => {
    setAnswers(prev => ({ ...prev, [step + 1]: value }));
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
    } else {
      setShowResult(true);
    }
  };

  const getRecommendedDomains = () => {
    const domains = new Set(['Standard Health & Safety', 'Legionella & Water Safety', 'Gas & Electrical Compliance']);
    Object.values(answers).forEach((val: string) => {
      if (val in DOMAIN_MAP) {
        DOMAIN_MAP[val].forEach(d => domains.add(d));
      }
    });
    return Array.from(domains);
  };

  const currentQuestion = QUESTIONS[step];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 pt-safe">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Compliance Profiler</h1>
            <p className="text-sm text-slate-500 font-medium">Interactive diagnostic guide for property compliance requirements.</p>
          </div>
        </div>

        {!showResult ? (
          <motion.div 
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-2xl shadow-indigo-900/5"
          >
            {/* Progress */}
            <div className="px-10 pt-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? 'bg-indigo-600 w-8' : step > i ? 'bg-indigo-200 w-3' : 'bg-slate-100 w-3'}`} />
                ))}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {step + 1} of {QUESTIONS.length}</span>
            </div>

            <div className="p-10">
              <div className="mb-10">
                <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">{currentQuestion.title}</p>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug">{currentQuestion.text}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className="group flex items-center gap-4 p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-lg transition-all">
                        <Icon className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-indigo-900">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => step > 0 && setStep(s => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 disabled:opacity-0 transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                <Info className="w-4 h-4 text-slate-300" />
                Answers help tailor your Project / Programme setup.
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-2xl shadow-indigo-900/10"
          >
            <div className="p-10 text-center border-b border-slate-100 bg-indigo-50/30">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-200 mb-6">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Diagnostic Result</h2>
              <p className="text-slate-500 font-medium">Based on your answers, the following compliance domains are required:</p>
            </div>

            <div className="p-10">
              <div className="space-y-3 mb-10">
                {getRecommendedDomains().map((domain, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-200 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="font-bold text-slate-800 tracking-tight">{domain}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/projects/new')}
                  className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Apply to New Project <ChevronRight className="w-5 h-5 stroke-[2.5px]" />
                </button>
                <button 
                  onClick={() => {
                    setStep(0);
                    setAnswers({});
                    setShowResult(false);
                  }}
                  className="flex-1 px-8 py-4 bg-white border-2 border-slate-100 text-slate-600 font-bold rounded-2xl hover:border-indigo-200 hover:text-indigo-600 transition-all"
                >
                  Restart Diagnostic
                </button>
              </div>
            </div>

            <div className="p-8 bg-amber-50/50 border-t border-amber-100 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 leading-relaxed font-medium">
                <strong>Disclaimer:</strong> This tool provides general guidance based on public sector property regulations. Always consult with your SRO or Legal/Compliance department for final confirmation of statutory obligations.
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

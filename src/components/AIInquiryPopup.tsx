import React, { useState, useEffect, useRef } from 'react';
import { X, ScanSearch, Send, MessageSquare, ShieldCheck, Loader2, ServerCog, HelpCircle, ArrowRight, AlertTriangle, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { stripMarkdown } from '../lib/utils';
import { chatWithAI } from '../services/aiService';
import { calculateMatrixScore } from '../data/riskScoringMatrix';
import { SEVERE_SCORE_THRESHOLD, getGrossScore } from '../lib/riskMetrics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIInquiryPopupProps {
  isOpen?: boolean;
  onClose?: () => void;
  context?: string;
  initialQuestion?: string;
  trigger?: React.ReactNode;
  /** Page-specific structured data (FP items / meetings / reports / framework / etc.).
   *  Only set by GlobalAIAssistant when the popup opens on a governance route.
   *  Existing per-page callers omit this and behave exactly as before. */
  pageContext?: { kind: string; payload: any } | null;
}

export function AIInquiryPopup({ isOpen: controlledIsOpen, onClose: controlledOnClose, context, initialQuestion, trigger, pageContext }: AIInquiryPopupProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  
  const handleClose = () => {
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    if (!isControlled) {
      setInternalIsOpen(true);
    }
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuestion || '');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const {
    user,
    projectInfo,
    lastAnalysisResults,
    complianceItems,
    risks,
    issues,
    activeProject,
    activeProgramme,
    activeProjectId,
    activeProgrammeId,
  } = useStore();

  const buildContextData = () => {
    const activeEntity = activeProject || activeProgramme;
    const isProject = !!activeProject;

    const ctxCompliance = (Array.isArray(complianceItems) ? complianceItems : []).filter((c) =>
      activeProjectId ? c.projectId === activeProjectId : c.programmeId === activeProgrammeId
    );
    const ctxRisks = (Array.isArray(risks) ? risks : []).filter((r) =>
      activeProjectId ? r.projectId === activeProjectId : r.programmeId === activeProgrammeId
    );
    const ctxIssues = (Array.isArray(issues) ? issues : []).filter((i) =>
      activeProjectId ? i.projectId === activeProjectId : i.programmeId === activeProgrammeId
    );

    return {
      entity: activeEntity
        ? {
            isProject,
            name: (activeEntity as any).name,
            type: (activeEntity as any).type,
            location:
              (activeEntity as any).location ||
              (activeEntity as any).geographicScope ||
              (activeEntity as any).loc,
            description:
              (activeEntity as any).description ||
              (activeEntity as any).strategicObjectives,
            complianceSetupDone: !!(activeEntity as any).complianceSetupDone,
            riskSetupDone: !!(activeEntity as any).riskSetupDone,
          }
        : null,
      compliance: {
        total: ctxCompliance.length,
        complete: ctxCompliance.filter((c) => (c as any).stage === 'Complete').length,
        inProgress: ctxCompliance.filter((c) => (c as any).stage === 'In Progress').length,
        notStarted: ctxCompliance.filter((c) => (c as any).stage === 'Not Started').length,
        highRiskOpen: ctxCompliance.filter(
          (c) => c.risk === 'High' && (c as any).stage !== 'Complete'
        ).length,
        topHighRisk: ctxCompliance
          .filter((c) => c.risk === 'High' && (c as any).stage !== 'Complete')
          .slice(0, 5)
          .map((c) => ({
            reg: (c as any).reg,
            req: (c as any).req?.substring(0, 80),
            domain: c.domain,
          })),
      },
      risks: {
        total: ctxRisks.length,
        open: ctxRisks.filter((r) => r.status === 'Open').length,
        highSeverity: ctxRisks.filter(
          (r) => getGrossScore(r) >= SEVERE_SCORE_THRESHOLD
        ).length,
        topOpen: ctxRisks
          .filter((r) => r.status === 'Open')
          .sort((a, b) => (b.grossRating ?? 0) - (a.grossRating ?? 0))
          .slice(0, 5)
          .map((r) => ({
            title: r.title,
            category: r.category,
            rating: getGrossScore(r),
            owner: r.owner,
          })),
      },
      issues: {
        total: ctxIssues.length,
        open: ctxIssues.filter((i) => i.status !== '4. Resolved').length,
        escalated: ctxIssues.filter((i) => i.status === '2. Escalated').length,
        topOpen: ctxIssues
          .filter((i) => i.status !== '4. Resolved')
          .slice(0, 5)
          .map((i) => ({
            title: (i as any).title || i.desc?.substring(0, 50),
            status: i.status,
            owner: i.owner,
          })),
      },
    };
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Guard against StrictMode double-invocation of the open effect, which
  // would otherwise fire two identical handleSend() calls for the same
  // initialQuestion → two assistant replies.
  const autoSentRef = useRef(false);

  const isRiskContext = context ? context.includes('programme_risks') : false;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMsg: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm CedarGuard AI. I have context on your current ${isRiskContext ? 'programme risk register' : projectInfo.name ? 'project profile' : 'compliance setup'}. How can I assist you with your ${isRiskContext ? 'risk escalations and posture' : 'regulatory requirements'} today?`,
        timestamp: new Date()
      };
      setMessages([welcomeMsg]);

      if (initialQuestion && !autoSentRef.current) {
        autoSentRef.current = true;
        handleSend(initialQuestion);
      }
    }
    if (!isOpen) {
      // Reset for the next open cycle
      autoSentRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Use the new chatWithAI service for dynamic, context-aware responses
      const response = await chatWithAI(text, projectInfo, context, lastAnalysisResults, user, buildContextData(), pageContext ?? null);
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error('AI Inquiry failed:', error);
      const errorMsg: Message = {
        id: 'error',
        role: 'assistant',
        content: `I'm sorry, I encountered an error processing your inquiry. Please check your connection and try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-end p-4 pointer-events-none">
      <div className="w-full max-w-lg h-[80vh] bg-white rounded-lg shadow-2xl border border-slate-100 flex flex-col pointer-events-auto animate-in slide-in-from-right-8 duration-500 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ServerCog className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-white font-mono font-semibold text-sm uppercase tracking-wide flex items-center gap-2">
                CedarGuard AI <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-2 py-0.5 rounded-full border border-indigo-500/30">Assistant</span>
              </h3>
              <p className="text-slate-400 font-mono text-[10px] uppercase font-medium tracking-wide mt-0.5">
                Context: {isRiskContext ? 'Programme Risk Intelligence' : 'Compliance Intelligence'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg) => (
            <div 
              key={msg.id}
              className={clsx(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={clsx(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm",
                msg.role === 'user' ? "bg-slate-200 text-slate-600" : "bg-indigo-600 text-white"
              )}>
                {msg.role === 'user' ? <HelpCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
              <div className={clsx(
                "p-4 rounded-lg text-[13px] leading-relaxed font-medium shadow-sm border whitespace-pre-wrap relative group/msg",
                msg.role === 'user' 
                  ? "bg-white border-slate-200 text-slate-700 rounded-tr-none" 
                  : "bg-gradient-to-br from-white to-indigo-50/30 border-indigo-100 text-slate-800 rounded-tl-none ring-4 ring-indigo-500/5"
              )}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-indigo-100/50">
                    <span className="font-mono text-[9px] font-medium text-indigo-500 uppercase tracking-wide flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Intelligence Output
                    </span>
                    <button 
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="p-1 hover:bg-indigo-100/50 rounded-md transition-colors text-indigo-400 opacity-0 group-hover/msg:opacity-100"
                      title="Copy to clipboard"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 mr-auto max-w-[85%]">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 bg-indigo-600 text-white shadow-sm">
                <ShieldCheck className="w-4 h-4 animate-pulse" />
              </div>
              <div className="p-4 rounded-lg bg-white border border-indigo-100 text-slate-400 flex items-center gap-2 rounded-tl-none font-medium text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing requirements...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 bg-white border-t border-slate-100 shrink-0">
          <div className="relative group">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your regulatory requirements..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg pl-6 pr-14 py-4 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
            <button 
              onClick={() => handleSend()}
              disabled={isTyping || !input.trim()}
              className="absolute right-2 top-2 bottom-2 px-4 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {isRiskContext ? (
              <>
                <button 
                  onClick={() => handleSend("What are our highest priority ESCALATED risks?")}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg font-mono text-[10px] font-medium uppercase hover:bg-rose-100 transition-colors border border-rose-100"
                >
                  Highest Priority?
                </button>
                <button 
                  onClick={() => handleSend("Summarize the risk reduction across the programme")}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-mono text-[10px] font-medium uppercase hover:bg-amber-100 transition-colors border border-amber-100"
                >
                  Risk Reduction
                </button>
                <button 
                  onClick={() => handleSend("Suggest mitigations for commercial risks")}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-mono text-[10px] font-medium uppercase hover:bg-indigo-100 transition-colors border border-indigo-100"
                >
                  Mitigations
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => handleSend("What are the key HRB risks?")}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-mono text-[10px] font-medium uppercase hover:bg-indigo-100 transition-colors border border-indigo-100"
                >
                  HRB Risks?
                </button>
                <button 
                  onClick={() => handleSend("BSA Gateway 2 requirements")}
                  className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg font-mono text-[10px] font-medium uppercase hover:bg-violet-100 transition-colors border border-violet-100"
                >
                  BSA Gateway 2
                </button>
                <button 
                  onClick={() => handleSend("Golden Thread standards")}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-mono text-[10px] font-medium uppercase hover:bg-emerald-100 transition-colors border border-emerald-100"
                >
                  Golden Thread
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {trigger && <div onClick={handleOpen} className="contents">{trigger}</div>}
    </div>
  );
}

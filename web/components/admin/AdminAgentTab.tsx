import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  LifeBuoy,
  Briefcase,
  ChevronRight,
  RotateCcw,
  UserCheck,
  Cpu,
  Layers,
  HelpCircle,
  TrendingUp,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { StatsCard } from '../common/StatsCard';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface ProposedAction {
  id: string;
  actionType: string;
  title: string;
  description: string;
  params: Record<string, any>;
  dangerLevel: 'low' | 'medium' | 'high';
  impactSummary: string;
  status?: 'pending' | 'executing' | 'executed' | 'rejected';
  executionResult?: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  proposedAction?: ProposedAction;
  modelUsed?: string;
}

const QUICK_PROMPTS = [
  {
    label: 'Daily usage & active user hours',
    prompt: 'How many users are active today, what activities are they performing, and what is their estimated daily usage in hours?',
  },
  {
    label: 'Support ticket root cause analysis',
    prompt: 'Perform a root-cause diagnostic on all open support tickets. What recurring problems are client admins and PMs reporting?',
  },
  {
    label: 'Audit unassigned users & supervisors',
    prompt: 'Audit the user database. Are there any project managers missing client organization links or supervisors?',
  },
  {
    label: 'Review pending access requests',
    prompt: 'Summarize all pending access requests. If any are eligible for promotion, propose the administrative action.',
  },
];

export function AdminAgentTab({ isAdmin }: { isAdmin: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load initial telemetry and greeting
  const loadInitialState = async () => {
    setLoadingTelemetry(true);
    try {
      const res: any = await api.adminAgentQuery(
        'Provide a 2-sentence executive greeting summarizing the current platform health, active users, and open tickets.'
      );
      if (res?.success) {
        setTelemetry(res.telemetry || null);
        setMessages([
          {
            id: 'init-msg',
            role: 'assistant',
            content:
              res.answer ||
              'Good day Super Administrator. I am your CedarGuard Executive AI Employee with full read visibility and CRUD action capabilities across the platform database. How may I assist you with platform governance today?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: res.modelUsed,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Failed to initialize Admin AI Employee:', err);
      toast.error('Could not connect to Admin AI Employee: ' + (err.message || 'Error'));
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadInitialState();
    }
  }, [isAdmin]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!promptToSend) setInputPrompt('');
    setLoading(true);

    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res: any = await api.adminAgentQuery(text, history);

      if (res?.success) {
        if (res.telemetry) setTelemetry(res.telemetry);

        const assistantMessage: ChatMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          proposedAction: res.proposedAction
            ? { ...res.proposedAction, status: 'pending' }
            : undefined,
          modelUsed: res.modelUsed,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        toast.error(res?.error || 'AI Employee failed to process query.');
      }
    } catch (err: any) {
      toast.error('AI Query failed: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (msgId: string, action: ProposedAction) => {
    setExecutingActionId(action.id);
    try {
      const res: any = await api.adminAgentExecuteAction(action.actionType, action.params);
      if (res?.success) {
        toast.success(res.message || 'Administrative action executed successfully!');
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId && m.proposedAction) {
              return {
                ...m,
                proposedAction: {
                  ...m.proposedAction,
                  status: 'executed',
                  executionResult: res.message || 'Executed successfully.',
                },
              };
            }
            return m;
          })
        );
      } else {
        toast.error(res?.error || 'Failed to execute administrative action.');
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId && m.proposedAction) {
              return {
                ...m,
                proposedAction: {
                  ...m.proposedAction,
                  error: res?.error || 'Execution failed',
                },
              };
            }
            return m;
          })
        );
      }
    } catch (err: any) {
      toast.error('Action execution error: ' + (err.message || 'Error'));
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleRejectAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.proposedAction) {
          return {
            ...m,
            proposedAction: {
              ...m.proposedAction,
              status: 'rejected',
            },
          };
        }
        return m;
      })
    );
    toast('Action proposal dismissed.', { icon: 'ℹ️' });
  };

  const totalUsers = telemetry?.userMetrics?.totalUsers ?? 0;
  const active24h = telemetry?.userMetrics?.activeUsers24h ?? 0;
  const totalHours = telemetry?.userMetrics?.totalUsageHoursLogged ?? 0;
  const unresolvedTicketsCount = telemetry?.supportTicketsMetrics?.unresolvedCount ?? 0;
  const pendingRequests = telemetry?.governanceMetrics?.pendingAccessRequestsCount ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Top Telemetry Strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Platform Users"
          value={totalUsers}
          description={`${active24h} active in last 24h`}
          icon={Users}
          iconClassName="text-indigo-600"
          iconBgClassName="bg-indigo-50"
          info="Total registered user accounts across all tenant organizations."
        />
        <StatsCard
          title="Daily Active Usage"
          value={`${totalHours}h`}
          description="Aggregated user session hours"
          icon={Clock}
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-50"
          info="Estimated active platform hours computed from user action clusters."
        />
        <StatsCard
          title="Unresolved Tickets"
          value={unresolvedTicketsCount}
          description={
            telemetry?.supportTicketsMetrics?.severityCounts?.critical
              ? `${telemetry.supportTicketsMetrics.severityCounts.critical} critical`
              : 'Support backlog'
          }
          icon={LifeBuoy}
          iconClassName={clsx(
            unresolvedTicketsCount > 0 ? 'text-amber-600' : 'text-slate-500'
          )}
          iconBgClassName={clsx(
            unresolvedTicketsCount > 0 ? 'bg-amber-50' : 'bg-slate-50'
          )}
          info="Open, in-progress, or client-waiting support issues requiring root cause resolution."
        />
        <StatsCard
          title="Pending Requests"
          value={pendingRequests}
          description="Role elevation requests"
          icon={UserCheck}
          iconClassName="text-violet-600"
          iconBgClassName="bg-violet-50"
          info="Pending access and promotion requests awaiting Super Admin signoff."
        />
      </div>

      {/* ── Main Agent Console ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  CedarGuard Platform AI Employee
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                  <ShieldCheck className="w-3 h-3 mr-1 text-purple-600" />
                  Super Admin Agent
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Autonomous Telemetry & Diagnostic Operations</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-indigo-600">CRUD with Approval</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadInitialState}
              disabled={loadingTelemetry}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh telemetry"
            >
              <RotateCcw className={clsx('w-3.5 h-3.5', loadingTelemetry && 'animate-spin')} />
              Sync DB
            </button>
            <button
              onClick={() => {
                setMessages([]);
                loadInitialState();
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-6 py-2.5 bg-slate-50/40 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider font-mono font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" /> Prompt:
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={loading}
              className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-full text-slate-700 transition-all shrink-0 text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              {qp.label}
              <ChevronRight className="w-3 h-3 opacity-50" />
            </button>
          ))}
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/20">
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={clsx('flex gap-3.5 max-w-3xl', !isAssistant && 'ml-auto flex-row-reverse')}
              >
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {isAssistant ? (
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shadow-xs font-semibold text-xs">
                      SA
                    </div>
                  )}
                </div>

                {/* Message Body */}
                <div className="space-y-3 flex-1">
                  <div
                    className={clsx(
                      'p-4 rounded-xl text-sm leading-relaxed whitespace-pre-line shadow-2xs',
                      isAssistant
                        ? 'bg-white border border-slate-200 text-slate-800'
                        : 'bg-indigo-600 text-white ml-auto'
                    )}
                  >
                    {msg.content}

                    {msg.modelUsed && isAssistant && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Model: {msg.modelUsed}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                    )}
                  </div>

                  {/* Proposed Action Approval Card */}
                  {msg.proposedAction && (
                    <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="font-semibold text-xs text-amber-900 tracking-wide uppercase font-mono">
                            Administrative Action Proposal
                          </span>
                        </div>
                        <span
                          className={clsx(
                            'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full',
                            msg.proposedAction.dangerLevel === 'high'
                              ? 'bg-red-100 text-red-800'
                              : msg.proposedAction.dangerLevel === 'medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          )}
                        >
                          {msg.proposedAction.dangerLevel} Impact
                        </span>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">
                          {msg.proposedAction.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">
                          {msg.proposedAction.description}
                        </p>
                      </div>

                      {/* Parameters Summary */}
                      <div className="bg-white/80 rounded-lg p-2.5 border border-amber-200 text-xs space-y-1 font-mono text-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Parameters</p>
                        {Object.entries(msg.proposedAction.params || {}).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 overflow-hidden">
                            <span className="text-slate-500 truncate">{k}:</span>
                            <span className="font-medium text-slate-900 truncate">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {msg.proposedAction.impactSummary && (
                        <p className="text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded border border-amber-200/50">
                          <strong>Note:</strong> {msg.proposedAction.impactSummary}
                        </p>
                      )}

                      {/* Execution Status / Action Buttons */}
                      {msg.proposedAction.status === 'executed' ? (
                        <div className="flex items-center gap-2 p-2 bg-emerald-100/80 text-emerald-800 rounded-lg text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Action executed successfully by Super Admin.</span>
                        </div>
                      ) : msg.proposedAction.status === 'rejected' ? (
                        <div className="flex items-center gap-2 p-2 bg-slate-100 text-slate-600 rounded-lg text-xs">
                          <X className="w-4 h-4 text-slate-400" />
                          <span>Action proposal declined.</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => handleRejectAction(msg.id)}
                            disabled={executingActionId === msg.proposedAction.id}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleExecuteAction(msg.id, msg.proposedAction!)}
                            disabled={executingActionId === msg.proposedAction.id}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {executingActionId === msg.proposedAction.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Executing...
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Approve & Execute
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-xl">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm flex items-center gap-3 text-slate-600 shadow-2xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>AI Employee is querying telemetry and synthesizing diagnosis...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask your AI Employee (e.g., 'Analyze daily usage hours', 'Why did client X report issue Y?', 'Promote user@example.com to client_admin')..."
                rows={2}
                className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 leading-relaxed shadow-2xs"
              />
              <span className="absolute right-3 bottom-2 text-[10px] text-slate-400 font-mono">
                Enter to send • Shift+Enter for newline
              </span>
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || loading}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0 h-[46px] cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

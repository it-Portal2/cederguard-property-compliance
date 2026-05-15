import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquareDashed,
  FolderKanban,
  Layers,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Activity,
} from "lucide-react";
import { clsx } from "clsx";
import { useStore } from "../store/useStore";
import { useChatStream } from "../hooks/useChatStream";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatComposer } from "../components/chat/ChatComposer";
import type { ScopeContext } from "../lib/chatTransport";

// Example prompts tailored to different roles
const EXAMPLE_PROMPTS = [
  {
    icon: AlertTriangle,
    colour: "text-orange-500",
    bg: "bg-orange-50 border-orange-100",
    text: "What are the highest-scoring open risks across all my projects?",
  },
  {
    icon: CheckSquare,
    colour: "text-emerald-500",
    bg: "bg-emerald-50 border-emerald-100",
    text: "Which compliance items are currently non-compliant or overdue?",
  },
  {
    icon: Activity,
    colour: "text-amber-500",
    bg: "bg-amber-50 border-amber-100",
    text: "Show me any KRIs that have breached their thresholds.",
  },
  {
    icon: FolderKanban,
    colour: "text-indigo-500",
    bg: "bg-indigo-50 border-indigo-100",
    text: "Give me a summary of the current status of all my active projects.",
  },
];

export function ChatPage() {
  const { activeProject, activeProgramme } = useStore();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build scope context from active project/programme
  const scopeContext: ScopeContext | null =
    activeProject || activeProgramme
      ? {
          projectId: activeProject?.id ?? null,
          projectName: activeProject?.name ?? activeProject?.projectName ?? null,
          programmeId: activeProgramme?.id ?? null,
          programmeName: activeProgramme?.name ?? null,
        }
      : null;

  const { messages, isStreaming, toolIndicators, rateLimit, sendMessage, stopStream, clearMessages } =
    useChatStream(scopeContext);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleExampleClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5.5rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Cedar AI Chat</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ask questions about your projects, risks, compliance items, and more.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope indicator */}
          {scopeContext && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-[11px] font-semibold text-indigo-700">
              {scopeContext.projectId ? (
                <>
                  <FolderKanban className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">
                    {scopeContext.projectName ?? "Active Project"}
                  </span>
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">
                    {scopeContext.programmeName ?? "Active Programme"}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Clear button — only show when there are messages */}
          {!isEmpty && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {isEmpty ? (
          // Empty state with example prompts
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <MessageSquareDashed className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-lg font-black text-slate-900">
                How can I help today?
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                I have access to your projects, risks, compliance items, and governance data.
                Ask me anything.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(p.text)}
                  disabled={rateLimit.isLimited}
                  className={clsx(
                    "flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all hover:scale-[1.01] hover:shadow-sm",
                    p.bg,
                    rateLimit.isLimited && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <p.icon className={clsx("w-4 h-4 flex-shrink-0 mt-0.5", p.colour)} />
                  <span className="text-sm text-slate-700 font-medium leading-snug">
                    {p.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                activeToolIndicators={
                  msg.isStreaming && idx === messages.length - 1
                    ? toolIndicators
                    : []
                }
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="pt-4 border-t border-slate-200">
        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onStop={stopStream}
          isStreaming={isStreaming}
          rateLimit={rateLimit}
        />
      </div>
    </div>
  );
}

export default ChatPage;

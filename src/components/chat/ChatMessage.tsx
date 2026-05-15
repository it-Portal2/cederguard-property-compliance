import React, { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check, AlertCircle, Loader2, Search } from "lucide-react";
import { clsx } from "clsx";
import { CitationChip } from "./CitationChip";
import type { DisplayMessage, ToolIndicator } from "../../hooks/useChatStream";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  listAccessibleProjects: "searching projects",
  getProjectDetails: "loading project details",
  listAccessibleProgrammes: "searching programmes",
  getProgrammeDetails: "loading programme details",
  searchRisks: "searching risks",
  searchIssues: "searching issues",
  searchComplianceItems: "searching compliance items",
  getKRIs: "loading KRIs",
  searchForwardPlanItems: "searching forward plan",
  searchMeetings: "searching meetings",
  searchReports: "searching reports",
  searchTacEnquiries: "searching enquiries",
  searchRfis: "searching RFIs",
  getMyTasks: "loading tasks",
  getMonthlyHistoricalSnapshot: "loading historical data",
  crossTenantListClients: "listing clients",
  setQueryClientContext: "switching client context",
};

interface ChatMessageProps {
  message: DisplayMessage;
  activeToolIndicators?: ToolIndicator[];
}

function ToolIndicatorPill({
  tool,
}: {
  tool: { name: string; status: "running" | "done"; resultCount?: number };
}) {
  const label = TOOL_DISPLAY_NAMES[tool.name] ?? tool.name;
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border",
        tool.status === "running"
          ? "text-indigo-600 bg-indigo-50 border-indigo-200 animate-pulse"
          : "text-slate-500 bg-slate-50 border-slate-200",
      )}
    >
      {tool.status === "running" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Search className="w-3 h-3" />
      )}
      <span>
        {label}
        {tool.status === "done" && tool.resultCount != null
          ? ` (${tool.resultCount} found)`
          : tool.status === "running"
          ? "…"
          : ""}
      </span>
    </div>
  );
}

// Render plain text with basic markdown: **bold**, *italic*, bullet lists, numbered lists
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      result.push(<br key={i} />);
      i++;
      continue;
    }

    // Numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^(\d+)\.\s+(.+)/)) {
        const m = lines[i].match(/^(\d+)\.\s+(.+)/)!;
        items.push(
          <li key={i} className="ml-4">
            {renderInline(m[2])}
          </li>,
        );
        i++;
      }
      result.push(
        <ol key={`ol-${i}`} className="list-decimal space-y-0.5 my-1">
          {items}
        </ol>,
      );
      continue;
    }

    // Bullet list item
    if (line.match(/^[-*•]\s+/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s+/)) {
        const content = lines[i].replace(/^[-*•]\s+/, "");
        items.push(
          <li key={i} className="ml-4">
            {renderInline(content)}
          </li>,
        );
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} className="list-disc space-y-0.5 my-1">
          {items}
        </ul>,
      );
      continue;
    }

    // Heading ### or ##
    if (line.startsWith("### ")) {
      result.push(
        <p key={i} className="font-bold text-slate-800 mt-2">
          {renderInline(line.slice(4))}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      result.push(
        <p key={i} className="font-black text-slate-900 mt-2">
          {renderInline(line.slice(3))}
        </p>,
      );
      i++;
      continue;
    }

    // Regular paragraph
    result.push(<p key={i}>{renderInline(line)}</p>);
    i++;
  }

  return result;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const boldSplit = text.split(/\*\*(.+?)\*\*/);
  if (boldSplit.length > 1) {
    return boldSplit.map((part, idx) =>
      idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part,
    );
  }
  return text;
}

export function ChatMessage({
  message,
  activeToolIndicators = [],
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const showTools =
    !isUser &&
    (activeToolIndicators.length > 0 || (message.toolActivity?.length ?? 0) > 0);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-[10px] font-black">AI</span>
        </div>
      )}

      <div className={clsx("max-w-[80%] space-y-2", isUser ? "items-end" : "items-start")}>
        {/* Tool activity pills */}
        {showTools && (
          <div className="flex flex-wrap gap-1.5">
            {(message.isStreaming && activeToolIndicators.length > 0
              ? activeToolIndicators
              : message.toolActivity ?? []
            ).map((tool) => (
              <ToolIndicatorPill key={tool.name} tool={tool} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={clsx(
            "relative group rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm",
          )}
          aria-live={!isUser && message.isStreaming ? "polite" : undefined}
        >
          {message.text ? (
            <div className="space-y-1 whitespace-pre-wrap">
              {isUser ? message.text : renderMarkdown(message.text)}
            </div>
          ) : message.isStreaming ? (
            <span className="flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking…
            </span>
          ) : null}

          {/* Error state */}
          {message.error && (
            <div className="mt-2 flex items-start gap-2 text-red-600 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{message.error}</span>
            </div>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.text && (
            <span className="inline-block w-[2px] h-[14px] bg-indigo-400 ml-0.5 animate-pulse align-text-bottom" />
          )}

          {/* Copy button for assistant messages */}
          {!isUser && !message.isStreaming && message.text && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Citation chips */}
        {!isUser && (message.citations?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.citations!.map((c) => (
              <CitationChip key={`${c.kind}-${c.id}`} citation={c} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-slate-600 text-[10px] font-black">You</span>
        </div>
      )}
    </motion.div>
  );
}

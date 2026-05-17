import React, { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check, AlertCircle, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { CitationChip } from "./CitationChip";
import { AiActivityTimeline } from "./AiActivityTimeline";
import type { DisplayMessage } from "../../hooks/useChatStream";

interface ChatMessageProps {
  message: DisplayMessage;
}

// ── Lightweight markdown renderer ──────────────────────────────────────────
// Handles: **bold**, *italic*, `inline code`, ```code blocks```,
// ## headings, bullet lists, numbered lists, line breaks.

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 text-sm">
      {lang && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <span className="text-[10px] text-slate-400 font-mono">{lang}</span>
          <button
            onClick={handleCopy}
            className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            {copied ? (
              <><Check className="w-3 h-3" /> Copied</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy</>
            )}
          </button>
        </div>
      )}
      <pre className="p-3 overflow-x-auto">
        <code className="text-slate-100 font-mono text-xs leading-relaxed whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*, `code` inline
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1]);
      parts.push(<strong key={key++}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }
    // Italic *text* (not **)
    const italicMatch = remaining.match(/^(.*?)(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(italicMatch[1]);
      parts.push(<em key={key++}>{italicMatch[2]}</em>);
      remaining = italicMatch[4];
      continue;
    }
    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(codeMatch[1]);
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-mono border border-slate-200"
        >
          {codeMatch[2]}
        </code>,
      );
      remaining = codeMatch[3];
      continue;
    }
    parts.push(remaining);
    break;
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // Split on fenced code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockKey = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(...renderInlineSection(text.slice(lastIndex, match.index), blockKey++));
    }
    result.push(
      <CodeBlock key={`cb-${blockKey++}`} code={match[2].trimEnd()} lang={match[1] || undefined} />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(...renderInlineSection(text.slice(lastIndex), blockKey));
  }

  return result;
}

function renderInlineSection(text: string, baseKey: number): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      if (i > 0 && result.length > 0) result.push(<br key={`br-${baseKey}-${i}`} />);
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(
          <li key={i}>{renderInline(lines[i].replace(/^\d+\.\s+/, ""))}</li>,
        );
        i++;
      }
      result.push(
        <ol key={`ol-${baseKey}-${i}`} className="list-decimal ml-5 space-y-0.5 my-1">
          {items}
        </ol>,
      );
      continue;
    }

    // Bullet list
    if (/^[-*•]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        items.push(
          <li key={i}>{renderInline(lines[i].replace(/^[-*•]\s+/, ""))}</li>,
        );
        i++;
      }
      result.push(
        <ul key={`ul-${baseKey}-${i}`} className="list-disc ml-5 space-y-0.5 my-1">
          {items}
        </ul>,
      );
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      result.push(
        <p key={`h3-${i}`} className="font-bold text-slate-800 mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      result.push(
        <p key={`h2-${i}`} className="font-black text-slate-900 mt-2 mb-0.5 text-base">
          {renderInline(line.slice(3))}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      result.push(
        <p key={`h1-${i}`} className="font-black text-slate-900 mt-2 mb-1 text-lg">
          {renderInline(line.slice(2))}
        </p>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      result.push(<hr key={`hr-${i}`} className="my-2 border-slate-200" />);
      i++;
      continue;
    }

    // Regular paragraph
    result.push(
      <p key={`p-${baseKey}-${i}`} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return result;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const showTimeline = !isUser && (message.steps?.length ?? 0) > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={clsx("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
          aria-hidden
        >
          <span className="text-white text-[9px] font-black tracking-tight">AI</span>
        </div>
      )}

      <div
        className={clsx(
          "flex flex-col gap-2 min-w-0",
          isUser ? "items-end max-w-[80%]" : "items-start max-w-[85%] md:max-w-[80%]",
        )}
      >
        {/* Animated AI activity timeline (replaces the old pill row) */}
        {showTimeline && (
          <div className="w-full">
            <AiActivityTimeline
              steps={message.steps!}
              isStreaming={!!message.isStreaming}
            />
          </div>
        )}

        {/* Message bubble */}
        <div
          className={clsx(
            "relative group rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm",
          )}
          role={isUser ? undefined : "article"}
          aria-label={isUser ? "Your message" : "Cedar AI response"}
        >
          {/* Message content */}
          {message.text ? (
            <div className={clsx("space-y-0.5", isUser ? "whitespace-pre-wrap" : "")}>
              {isUser ? message.text : renderMarkdown(message.text)}
            </div>
          ) : message.isStreaming && !showTimeline ? (
            <span className="flex items-center gap-2 text-slate-400 text-xs py-0.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking…
            </span>
          ) : null}

          {/* Error state */}
          {message.error && (
            <div
              className={clsx(
                "mt-2 flex items-start gap-2 text-xs",
                message.text ? "pt-2 border-t border-red-100" : "",
                isUser ? "text-red-200" : "text-red-600",
              )}
              role="alert"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{message.error}</span>
            </div>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.text && (
            <span
              className="inline-block w-[2px] h-[14px] bg-indigo-400 ml-0.5 rounded-full animate-pulse align-text-bottom"
              aria-hidden
            />
          )}

          {/* Copy button — assistant only, hover-revealed */}
          {!isUser && !message.isStreaming && message.text && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title="Copy message"
              aria-label="Copy message to clipboard"
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
          <div
            className="flex flex-wrap gap-1.5 pt-0.5"
            aria-label="Source citations"
          >
            {message.citations!.map((c) => (
              <CitationChip key={`${c.kind}-${c.id}`} citation={c} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div
          className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5"
          aria-hidden
        >
          <span className="text-slate-600 text-[9px] font-black">You</span>
        </div>
      )}
    </motion.div>
  );
}

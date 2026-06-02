// Unified source list for the Fact-Check feature. Renders ValidationCitation[]
// — web sources as external links, in-app record sources as router deep-links.
// Shared by FactCheckPanel (and reusable anywhere a citation list is shown).

import { Link } from "react-router";
import { ExternalLink, FileText } from "lucide-react";
import { clsx } from "clsx";
import type { ValidationCitation } from "../../lib/validation";

const CHIP =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all hover:shadow-sm";

export default function SourceList({
  citations,
  className,
}: {
  citations: ValidationCitation[] | undefined;
  className?: string;
}) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className={clsx("flex flex-wrap gap-1.5", className)}>
      {citations.map((c, i) => {
        const label = c.title || c.label || c.url || c.route || "Source";
        if (c.kind === "web" && c.url) {
          return (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              title={c.snippet || c.url}
              className={clsx(
                CHIP,
                "text-sky-700 bg-sky-50 border-sky-200 hover:scale-105",
              )}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[220px]">{label}</span>
            </a>
          );
        }
        if (c.route) {
          return (
            <Link
              key={i}
              to={c.route}
              title={label}
              className={clsx(
                CHIP,
                "text-indigo-700 bg-indigo-50 border-indigo-200 hover:scale-105",
              )}
            >
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[220px]">{label}</span>
            </Link>
          );
        }
        return (
          <span
            key={i}
            title={label}
            className={clsx(CHIP, "text-slate-600 bg-slate-50 border-slate-200")}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[220px]">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

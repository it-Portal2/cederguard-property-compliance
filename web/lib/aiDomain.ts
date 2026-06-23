// Single source of truth for resolving the ACTIVE ROUTE → the AI DOMAIN a
// per-page AI surface must stay within. Pure + framework-agnostic (no React,
// no store) — mirrors aiScope.ts so pages and the floating assistant share it.
//
// Why this exists: the floating AI assistant + insight panels must be locked to
// the page's own domain — a risk page's AI must never surface compliance, and a
// compliance page's AI must never surface risk. General/report pages and the
// dedicated /chat page stay cross-domain.

export type AiDomain = "risk" | "compliance" | "general";

/**
 * Resolve a route pathname to the AI domain that page's AI surfaces are scoped
 * to. `/risk/*` + risk monitoring + the AI control (mitigation) tool → "risk";
 * `/compliance/*` + the regulations library + the AI compliance outlook →
 * "compliance"; everything else (dashboard, reports, governance, /chat) →
 * "general".
 */
export function resolveAiDomain(pathname: string): AiDomain {
  const p = (pathname || "").toLowerCase();

  // Ambiguous /ai/* sub-tools must be classified explicitly, before prefixes.
  if (p.startsWith("/ai/controls")) return "risk"; // AI Control Suggestions = risk mitigation
  if (p.startsWith("/ai/compliance")) return "compliance"; // AI Compliance Outlook

  // Learning surfaces that live under a domain prefix but are not domain queries.
  if (p === "/regulations/cpd" || p.startsWith("/training")) return "general";

  if (p.startsWith("/risk/") || p.startsWith("/monitoring/")) return "risk";
  if (p.startsWith("/compliance/") || p.startsWith("/regulations")) return "compliance";

  return "general";
}

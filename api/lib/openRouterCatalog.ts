// Live model catalog from OpenRouter.
//
// Calls the public, unauthenticated https://openrouter.ai/api/v1/models
// endpoint, normalises the response to a small shape suitable for the
// admin UI's "Add model" picker, and caches the result in-process for
// 60 minutes. The admin tab can pass `?force=true` to bypass the cache
// when the operator suspects a stale list (or after OpenRouter has just
// added a new model upstream).
//
// Cache lives per Vercel-Function-instance. Fluid Compute reuses instances
// across concurrent requests, so a single cold-fill amortises over many
// admin opens. Instance teardown drops the cache, which is fine — the
// next request just refills.

export interface CatalogEntry {
  id: string;                    // OpenRouter id, e.g. "openai/gpt-oss-20b:free"
  name: string;                  // Human label
  provider: string;              // First path segment ("openai", "anthropic"...)
  contextLength: number;         // Tokens
  promptCostUsdPer1M: number;    // USD per 1M input tokens
  completionCostUsdPer1M: number;// USD per 1M output tokens
  isFree: boolean;               // Both prices === 0
}

const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const TTL_MS = 60 * 60 * 1000; // 60 minutes

interface CacheSlot {
  fetchedAt: number;
  entries: CatalogEntry[];
}

let cache: CacheSlot | null = null;

export interface FetchCatalogOptions {
  force?: boolean;
}

export interface FetchCatalogResult {
  entries: CatalogEntry[];
  cached: boolean;
  fetchedAt: number;
}

export async function fetchOpenRouterCatalog(
  opts: FetchCatalogOptions = {},
): Promise<FetchCatalogResult> {
  const now = Date.now();
  if (!opts.force && cache && now - cache.fetchedAt < TTL_MS) {
    return { entries: cache.entries, cached: true, fetchedAt: cache.fetchedAt };
  }

  const res = await fetch(CATALOG_URL, { method: "GET" });
  if (!res.ok) {
    throw new Error(`OpenRouter catalog fetch failed: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as { data?: unknown };
  if (!raw || !Array.isArray(raw.data)) {
    throw new Error("OpenRouter catalog response shape unexpected");
  }

  const entries: CatalogEntry[] = [];
  for (const m of raw.data) {
    const normalised = normaliseEntry(m);
    if (normalised) entries.push(normalised);
  }

  cache = { fetchedAt: now, entries };
  return { entries, cached: false, fetchedAt: now };
}

function normaliseEntry(m: unknown): CatalogEntry | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, any>;
  if (typeof o.id !== "string" || !o.id) return null;

  // OpenRouter prices come as decimal strings in USD per token. Multiply
  // by 1M for the per-1M-tokens display the admin UI shows. A missing /
  // unparseable price is treated as 0 (which then renders as FREE — be
  // conservative when in doubt; admin can correct via the UI).
  const promptPerToken = toFiniteNumber(o.pricing?.prompt);
  const completionPerToken = toFiniteNumber(o.pricing?.completion);
  const ctxLen = toFiniteNumber(o.context_length);

  const provider = o.id.includes("/") ? o.id.split("/")[0] : "unknown";
  return {
    id: o.id,
    name: typeof o.name === "string" && o.name ? o.name : o.id,
    provider,
    contextLength: ctxLen,
    promptCostUsdPer1M: promptPerToken * 1_000_000,
    completionCostUsdPer1M: completionPerToken * 1_000_000,
    isFree: promptPerToken === 0 && completionPerToken === 0,
  };
}

function toFiniteNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Test-only helper to drop the cache between cases. Never call from
// production code paths.
export function _resetCatalogCacheForTests(): void {
  cache = null;
}

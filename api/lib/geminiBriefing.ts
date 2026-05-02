// Phase 12 — Gemini briefing helper.
//
// Wraps the rule-based-stub lines with a Gemini-rewritten briefing
// paragraph.  Response shape stays `{ lines, source }` (lesson #107)
// so the UI doesn't change between modes.
//
// Critically: this DOES NOT reinvent the Gemini call — it routes
// through the existing `aiRoutes.geminiPrompt` handler so we inherit
// the canonical fallback chain (system key → user backup key, primary
// model → backup model, retry on 503/overload, structured quota /
// timeout errors).  Only the prompt changes.
//
// Falls back silently to the stub when the route returns a non-2xx
// status, when the result is empty, or on any thrown error.

import type { ApiContext } from './context.js';
import { aiRoutes } from '../routes/ai.js';

export interface BriefingResult {
  lines: string[];
  source: 'rule-based-stub' | 'gemini';
}

interface CapturedResponse {
  status: number;
  payload: any;
}

function captureRes(): { res: any; captured: CapturedResponse } {
  const captured: CapturedResponse = { status: 200, payload: null };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: any) {
      captured.payload = payload;
      return this;
    },
  };
  return { res, captured };
}

export async function generateBriefing(args: {
  role: 'pgm' | 'pm';
  greetingName: string;
  stubLines: string[];
  ctx: ApiContext;
}): Promise<BriefingResult> {
  const stubFallback: BriefingResult = {
    lines: args.stubLines,
    source: 'rule-based-stub',
  };

  // No-op cases — skip the call so we don't pay for it.
  if (!args.stubLines.length) return stubFallback;
  if (args.stubLines.length <= 1) return stubFallback;
  // The route itself handles "no key" gracefully (returns 500 with
  // "No API key configured"); we still short-circuit when both keys
  // are obviously absent to avoid a wasted dispatch.
  const systemKey = process.env.GEMINI_API_KEY;
  const userBackup = (args.ctx.userData?.geminiBackupKey || '').trim();
  if (!systemKey && !userBackup) return stubFallback;

  const factsBlock = args.stubLines.join(' ');
  const persona =
    args.role === 'pgm'
      ? 'a UK council Programme Manager dashboard'
      : 'a UK council Project Manager dashboard';

  const prompt = `You are writing the morning briefing on ${persona}. Rewrite the facts below into 2-4 short, friendly sentences in British English. Keep every NUMBER and ENTITY exactly as given — do not invent any new facts. Do not add greetings; the first sentence already greets the user. Address the reader as "you". Keep it under 60 words. Output plain text, no markdown.

Facts:
${factsBlock}`;

  try {
    const { res, captured } = captureRes();
    const fakeReq = {
      body: {
        prompt,
        action: 'governanceBriefing',
        config: {
          temperature: 0.4,
          maxOutputTokens: 256,
          responseMimeType: 'text/plain',
        },
      },
    };
    await aiRoutes.geminiPrompt(fakeReq, res, args.ctx);
    if (captured.status !== 200 || !captured.payload?.success) {
      return stubFallback;
    }
    const raw = captured.payload.result;
    const cleaned = typeof raw === 'string' ? raw.trim() : '';
    if (!cleaned || cleaned.length < 10) return stubFallback;
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (!sentences.length) return stubFallback;
    return { lines: sentences, source: 'gemini' };
  } catch (err) {
    console.error('[geminiBriefing] failed; using stub', err);
    return stubFallback;
  }
}

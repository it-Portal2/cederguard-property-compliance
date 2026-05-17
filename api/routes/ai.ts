import type { ApiContext } from "../lib/context.js";
import { parseAIResponse } from "../lib/context.js";
import { generateCompletion } from "../lib/aiClient.js";

export const aiRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  geminiPrompt: async (req, res, ctx) => {
    const { userData } = ctx;
    const { prompt, config, action, inlineParts } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt text" });

    // Optional multimodal payload — array of { mimeType, data (base64) }
    const safeInlineParts: Array<{ mimeType: string; data: string }> =
      Array.isArray(inlineParts)
        ? inlineParts
            .filter(
              (p: any) =>
                p &&
                typeof p.mimeType === "string" &&
                typeof p.data === "string" &&
                p.data.length > 0,
            )
            .slice(0, 8)
        : [];

    const isJsonAction = [
      "analyzeCompliance",
      "analyzeRisks",
      "analyzeControls",
    ].includes(action);

    const defaultMaxTokens =
      action === "analyzeCompliance" || action === "analyzeRisks" ? 16384 : 8192;

    // User-supplied fallback keys (from profile settings)
    const userOpenRouterKey = (userData?.openrouterApiKey ?? "").trim();
    const userOpenAiKey = (userData?.openaiApiKey ?? "").trim();

    // For JSON actions, the prompt must contain the word "JSON" for json_object mode
    // to work correctly on all providers. The prompts from aiService.ts already include
    // JSON instructions, but we add a guard here just in case.
    const effectivePrompt =
      isJsonAction && !/\bjson\b/i.test(prompt)
        ? `${prompt}\n\nRespond with valid JSON only.`
        : prompt;

    try {
      const text = await generateCompletion({
        systemPrompt:
          "You are Cedar AI, an expert compliance and risk management assistant for the UK built environment sector. You produce precise, professional analysis in UK English.",
        userPrompt: effectivePrompt,
        inlineParts: safeInlineParts,
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxOutputTokens ?? defaultMaxTokens,
        jsonMode: isJsonAction,
        userOpenRouterKey,
        userOpenAiKey,
      });

      let result: any = text;
      if (isJsonAction || config?.responseMimeType === "application/json") {
        result = parseAIResponse(text, action === "analyzeCompliance" ? {} : []);
      }

      return res.status(200).json({ success: true, result });
    } catch (err: any) {
      console.error("[ai] error:", { action, message: err?.message, status: err?.status });
      return handleError(res, err);
    }
  },

  analyzeCompliance: async (req, res, ctx) => {
    req.body.action = "analyzeCompliance";
    return aiRoutes.geminiPrompt(req, res, ctx);
  },
  analyzeRisks: async (req, res, ctx) => {
    req.body.action = "analyzeRisks";
    return aiRoutes.geminiPrompt(req, res, ctx);
  },
  analyzeControls: async (req, res, ctx) => {
    req.body.action = "analyzeControls";
    return aiRoutes.geminiPrompt(req, res, ctx);
  },
  chatWithAI: async (req, res, ctx) => {
    req.body.action = "chatWithAI";
    return aiRoutes.geminiPrompt(req, res, ctx);
  },
};

function handleError(res: any, err: any) {
  const msg = err?.message ?? "";
  const status = err?.status ?? 500;

  if (status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
    return res.status(429).json({
      error:
        "AI quota exceeded. Please wait a moment and try again, or add your own OpenRouter/OpenAI API key in Profile Settings.",
      retryAfter: 60,
    });
  }
  if (status === 408 || msg.includes("timeout") || msg.includes("deadline")) {
    return res.status(408).json({
      error: "AI engine timed out. The analysis is complex — please try again.",
      retryAfter: null,
    });
  }
  if (msg.includes("AI_NOT_CONFIGURED")) {
    return res.status(503).json({
      error:
        "AI service not configured. Please ask your administrator to set OPENROUTER_API_KEY or OPENAI_API_KEY.",
      retryAfter: null,
    });
  }
  if (status === 503 || msg.includes("overloaded") || msg.includes("unavailable")) {
    return res.status(503).json({
      error: "AI service is temporarily unavailable. Please try again shortly.",
      retryAfter: 30,
    });
  }
  return res.status(500).json({
    error: "AI engine encountered an error. Please try again.",
    retryAfter: null,
  });
}

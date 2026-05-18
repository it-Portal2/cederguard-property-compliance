import { ApiContext } from "../lib/context.js";
import { parseAIResponse } from "../lib/context.js";
import { runAIOperation } from "../lib/aiOperationRouter.js";

export const aiRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  geminiPrompt: async (req, res, ctx) => {
    const {
      db,
      uid,
      email,
      userData,
      isAdmin,
      isClientAdmin,
      SYSTEM_ADMIN_EMAILS,
    } = ctx;
    const { prompt, config, action, inlineParts } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt text" });

    // Optional multimodal payload — array of { mimeType, data (base64) } that
    // get appended after the text prompt. Used by TAC drawing
    // overlay (sends the source PDF inline so Gemini can read it visually
    // and return per-annotation x/y coordinates).
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
            .slice(0, 8) // cap to 8 parts so a runaway client can't OOM the function
        : [];

    const userPersonalKey = (userData?.geminiBackupKey || "").trim();

    const isJsonAction = [
      "analyzeCompliance",
      "analyzeRisks",
      "analyzeControls",
    ].includes(action);

    // Compliance analysis classifies 113+ items with detailed reasons —
    // it needs significantly more output tokens than other actions.
    // The old default of 8192 caused the model to compress its output on
    // Vercel, silently flipping the applicable/excluded ratio.
    const defaultMaxTokens = action === "analyzeCompliance" ? 16384
      : action === "analyzeRisks" ? 16384
      : 8192;

    // Generation config preserved verbatim from the previous Gemini-direct
    // path — only the transport (runAIOperation) changes. responseSchema
    // remains a Gemini-only feature; OpenRouter entries silently ignore it
    // and emit best-effort JSON which parseAIResponse below heals.
    const routerConfig = {
      temperature: config?.temperature || 0.7,
      topP: config?.topP || 0.95,
      topK: config?.topK || 40,
      maxOutputTokens: config?.maxOutputTokens || defaultMaxTokens,
      responseMimeType: isJsonAction
        ? "application/json"
        : config?.responseMimeType || "text/plain",
      responseSchema: isJsonAction ? config?.responseSchema : undefined,
    };

    try {
      const routed = await runAIOperation({
        ctx,
        prompt,
        inlineParts: safeInlineParts,
        config: routerConfig,
        action,
      });
      let val: any = routed.text;
      if (isJsonAction || config?.responseMimeType === "application/json") {
        val = parseAIResponse(
          val || "",
          action === "analyzeCompliance" ? {} : [],
        );
      }
      return res.status(200).json({ success: true, result: val });
    } catch (routerError: any) {
      console.error("AI OPERATION FAILED:", {
        status: routerError?.status,
        message: routerError?.message,
        source: userPersonalKey ? "user" : "system",
        action,
      });
      return handleError(routerError, userPersonalKey ? "user" : "system");
    }

    function handleError(err: any, source: "user" | "system") {
      const isQuotaError =
        err?.status === 429 ||
        err?.message?.includes("429") ||
        err?.message?.includes("quota");
      const isTimeout =
        err?.status === 408 ||
        err?.message?.includes("deadline") ||
        err?.message?.includes("timeout");

      let errorMsg = "AI engine encountered an error.";
      if (isQuotaError) {
        errorMsg =
          source === "user"
            ? "Your personal Gemini API quota exceeded. Please wait at least 60 seconds. Check AI Studio billing."
            : "System AI quota exceeded. Provide your own Gemini API key in Profile Settings for higher limits.";
      } else if (isTimeout) {
        errorMsg =
          "AI engine timed out. The analysis is complex; please try again in a moment.";
      } else if (err?.message?.includes("overloaded")) {
        errorMsg =
          "Gemini server is overloaded. Please try again or switch to a different model in settings.";
      }

      return res.status(isQuotaError ? 429 : isTimeout ? 408 : 500).json({
        error: errorMsg,
        retryAfter: isQuotaError ? 60 : null,
      });
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

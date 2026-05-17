import { ApiContext } from "../lib/context.js";
import { parseAIResponse } from "../lib/context.js";
import { GoogleGenAI } from "@google/genai";

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

    const PRIMARY_MODEL = "gemini-2.5-flash";
    const BACKUP_MODEL = "gemini-2.5-flash-lite";

    const systemKey = process.env.GEMINI_API_KEY;

    // Logic: Use system key first, fallback to user's personal key if configured
    const userPersonalKey = (userData?.geminiBackupKey || "").trim();
    const primaryKey = systemKey || userPersonalKey;
    const backupKey = primaryKey === systemKey ? userPersonalKey : null; // Only use user key as backup if system was primary

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

    const generationConfig = {
      temperature: config?.temperature || 0.7,
      topP: config?.topP || 0.95,
      topK: config?.topK || 40,
      maxOutputTokens: config?.maxOutputTokens || defaultMaxTokens,
      responseMimeType: isJsonAction
        ? "application/json"
        : config?.responseMimeType || "text/plain",
      responseSchema: isJsonAction ? config?.responseSchema : undefined,
    };

    const TIMEOUT_MS = 90000;

    const tryGenerate = async (
      ai: GoogleGenAI,
      modelName: string,
      maxRetries = 1,
    ) => {
      let attempts = 0;
      while (attempts <= maxRetries) {
        try {
          const parts: any[] = [{ text: prompt }];
          for (const p of safeInlineParts) {
            parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
          }
          const generatePromise = ai.models.generateContent({
            model: modelName,
            contents: [{ parts }],
            config: generationConfig,
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("AI request timed out after 55 seconds")), TIMEOUT_MS)
          );
          const result: any = await Promise.race([generatePromise, timeoutPromise]);
          let val = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (isJsonAction || config?.responseMimeType === "application/json") {
            val = parseAIResponse(
              val || "",
              action === "analyzeCompliance" ? {} : [],
            );
          }
          return val;
        } catch (err: any) {
          attempts++;
          const isRetryable =
            err.message?.includes("AI_PARSE_CRITICAL_FAILURE") ||
            err?.status === 503 ||
            err.message?.includes("overloaded") ||
            err.message?.includes("503");
          if (isRetryable && attempts <= maxRetries) {
            console.warn(
              `[AI Retry Interceptor] Retryable failure. Retrying... (Attempt ${attempts} of ${maxRetries})`,
            );
            if (err?.status === 503 || err.message?.includes("overloaded")) {
              await new Promise(r => setTimeout(r, 5000));
            }
            continue;
          }
          throw err;
        }
      }
    };

    try {
      if (!primaryKey) throw new Error("No API key configured");
      const primaryAI = new GoogleGenAI({ apiKey: primaryKey });
      const result = await tryGenerate(primaryAI, PRIMARY_MODEL);
      return res.status(200).json({ success: true, result });
    } catch (initialError: any) {
      console.error("PRIMARY AI ATTEMPT FAILED:", {
        status: initialError?.status,
        message: initialError?.message,
        source: userPersonalKey ? "user" : "system",
        action,
      });

      if (backupKey && backupKey !== primaryKey) {
        try {
          console.log("Attempting fallback to backup key...");
          const backupAI = new GoogleGenAI({ apiKey: backupKey });
          const result = await tryGenerate(backupAI, BACKUP_MODEL);
          return res.status(200).json({ success: true, result });
        } catch (backupError: any) {
          console.error("BACKUP AI ATTEMPT FAILED:", {
            status: backupError?.status,
            message: backupError?.message,
            action,
          });
          return handleError(backupError, "system");
        }
      }
      return handleError(initialError, userPersonalKey ? "user" : "system");
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

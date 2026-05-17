// Common contract for any AI provider used by the chat stream loop.
// Both OpenRouter (OpenAI-compatible) and direct Gemini implement this.

import type OpenAI from "openai";

// History flows through the loop in OpenAI shape — it's the richest of the
// two providers' formats and the Gemini adapter handles its own translation.
export type ChatMessageParam = OpenAI.ChatCompletionMessageParam;

export interface NormalisedToolCall {
  id: string;          // unique per call within a round
  name: string;        // canonical tool name from chatTools.ts
  argsJson: string;    // raw JSON string; downstream parses
}

export interface ToolRoundResult {
  /** OpenAI-shape assistant message, ready to append back to history. */
  assistantMessage: ChatMessageParam;
  /** Function-call requests (empty when the model decided to answer directly). */
  toolCalls: NormalisedToolCall[];
  /** Plain-text content if the model emitted any in this round. */
  contentText: string;
}

export interface ChatBackend {
  /** Best-effort label for logs / error events. */
  readonly displayName: string;
  /**
   * Run one tool-detection round (non-streaming so tool_calls are reliably
   * present in the response). Returns either a final text answer (toolCalls
   * empty) or one-or-more tool calls to execute.
   */
  runToolRound(
    history: ChatMessageParam[],
    toolDeclarations: OpenAI.ChatCompletionTool[],
  ): Promise<ToolRoundResult>;
  /**
   * Stream the final assistant answer (no tools allowed at this point —
   * the loop already decided we're past the tool-calling phase).
   */
  runFinalStream(
    history: ChatMessageParam[],
    onDelta: (delta: string) => void,
    isAborted: () => boolean,
  ): Promise<void>;
}

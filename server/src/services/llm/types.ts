/**
 * External LLM contract — AI System 2 (the investigator copilot).
 *
 * The LLM explains, drafts and answers questions **about data the platform
 * already computed**. It never scores risk, never predicts routes, and never
 * queries a chain: those belong to AI System 1 and the graph engine. Keeping the
 * two behind separate interfaces is what makes the boundary enforceable.
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletion {
  content: string;
  model: string;
  provider: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface LlmProvider {
  readonly id: "openai" | "gemini" | "anthropic";
  readonly model: string;
  complete(messages: LlmMessage[], options: { maxTokens: number; timeoutMs: number }): Promise<LlmCompletion>;
}

/** What the copilot was asked to do. Each mode has its own instruction block. */
export type CopilotMode = "answer" | "explain-route" | "draft-summary" | "next-steps";

export interface CopilotAnswer {
  mode: CopilotMode;
  /** Markdown answer, grounded in the supplied context. */
  content: string;
  /** True when the copilot is disabled or unreachable and this is a local fallback. */
  fallback: boolean;
  /** Present when a fallback was served. */
  fallbackReason?: string;
  provider: string;
  model: string;
  /** Egress policy applied to the context that was sent. */
  dataPolicy: string;
  usage?: LlmCompletion["usage"];
  /** Every fact the answer was allowed to use, for audit. */
  groundingKeys: string[];
}

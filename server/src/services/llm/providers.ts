/**
 * LLM provider adapters.
 *
 * Three vendors, one interface. The gateway above never learns which vendor
 * answered, so switching provider is an environment change. Each adapter is a
 * plain `fetch` call with an explicit timeout — no vendor SDKs, so the server
 * bundle stays small and dependency-free.
 */
import { env } from "../../config/env";
import type { LlmCompletion, LlmMessage, LlmProvider } from "./types";

const DEFAULT_MODELS: Record<"openai" | "gemini" | "anthropic", string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-sonnet-latest",
};

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function splitSystem(messages: LlmMessage[]): { system: string; rest: LlmMessage[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  return { system, rest: messages.filter((m) => m.role !== "system") };
}

function createOpenAiProvider(apiKey: string, model: string): LlmProvider {
  const base = (env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    id: "openai",
    model,
    async complete(messages, { maxTokens, timeoutMs }) {
      return withTimeout(timeoutMs, async (signal) => {
        const response = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          // Low temperature: forensic drafting, not creative writing.
          body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: maxTokens }),
          signal,
        });
        if (!response.ok) throw new Error(`OpenAI responded ${response.status}`);
        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error("OpenAI returned an empty completion");
        return {
          content,
          model,
          provider: "openai",
          usage: {
            ...(data.usage?.prompt_tokens !== undefined ? { promptTokens: data.usage.prompt_tokens } : {}),
            ...(data.usage?.completion_tokens !== undefined
              ? { completionTokens: data.usage.completion_tokens }
              : {}),
            ...(data.usage?.total_tokens !== undefined ? { totalTokens: data.usage.total_tokens } : {}),
          },
        } satisfies LlmCompletion;
      });
    },
  };
}

function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  const base = (env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(
    /\/+$/,
    "",
  );
  return {
    id: "gemini",
    model,
    async complete(messages, { maxTokens, timeoutMs }) {
      const { system, rest } = splitSystem(messages);
      return withTimeout(timeoutMs, async (signal) => {
        const response = await fetch(`${base}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents: rest.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
          }),
          signal,
        });
        if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };
        const content = (data.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!content) throw new Error("Gemini returned an empty completion");
        return {
          content,
          model,
          provider: "gemini",
          usage: {
            ...(data.usageMetadata?.promptTokenCount !== undefined
              ? { promptTokens: data.usageMetadata.promptTokenCount }
              : {}),
            ...(data.usageMetadata?.candidatesTokenCount !== undefined
              ? { completionTokens: data.usageMetadata.candidatesTokenCount }
              : {}),
            ...(data.usageMetadata?.totalTokenCount !== undefined
              ? { totalTokens: data.usageMetadata.totalTokenCount }
              : {}),
          },
        } satisfies LlmCompletion;
      });
    },
  };
}

function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  const base = (env.LLM_BASE_URL ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
  return {
    id: "anthropic",
    model,
    async complete(messages, { maxTokens, timeoutMs }) {
      const { system, rest } = splitSystem(messages);
      return withTimeout(timeoutMs, async (signal) => {
        const response = await fetch(`${base}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.1,
            ...(system ? { system } : {}),
            messages: rest.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
          }),
          signal,
        });
        if (!response.ok) throw new Error(`Anthropic responded ${response.status}`);
        const data = (await response.json()) as {
          content?: { text?: string }[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const content = (data.content ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!content) throw new Error("Anthropic returned an empty completion");
        return {
          content,
          model,
          provider: "anthropic",
          usage: {
            ...(data.usage?.input_tokens !== undefined ? { promptTokens: data.usage.input_tokens } : {}),
            ...(data.usage?.output_tokens !== undefined
              ? { completionTokens: data.usage.output_tokens }
              : {}),
          },
        } satisfies LlmCompletion;
      });
    },
  };
}

/** Resolve the configured provider, or `null` when the copilot is disabled. */
export function createLlmProvider(): LlmProvider | null {
  if (env.LLM_PROVIDER === "none" || env.LLM_DATA_POLICY === "DISABLED") return null;
  if (!env.LLM_API_KEY) return null;
  const model = env.LLM_MODEL ?? DEFAULT_MODELS[env.LLM_PROVIDER];
  if (env.LLM_PROVIDER === "openai") return createOpenAiProvider(env.LLM_API_KEY, model);
  if (env.LLM_PROVIDER === "gemini") return createGeminiProvider(env.LLM_API_KEY, model);
  return createAnthropicProvider(env.LLM_API_KEY, model);
}

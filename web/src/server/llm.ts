import Anthropic from "@anthropic-ai/sdk";
import { getAgent, getCurrentConfig } from "@/server/agent-core";

// Accepts any Drizzle instance (neon at runtime, pglite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface LLMClient {
  complete(input: { system: string; messages: ChatMessage[] }): Promise<string>;
}

/**
 * Deterministic stand-in for the real LLM. Echoes the system prompt (persona)
 * and the last user message so tests can assert the persona influenced the call
 * without an API key.
 */
export class FakeLLM implements LLMClient {
  async complete(input: { system: string; messages: ChatMessage[] }): Promise<string> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
    return `[persona:${input.system}] ${lastUser?.content ?? ""}`;
  }
}

/** Wraps the Anthropic SDK. Constructed only when an API key is available. */
export class AnthropicLLM implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor({ apiKey, model }: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(input: { system: string; messages: ChatMessage[] }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: input.system,
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

/**
 * Talks to any OpenAI-compatible chat endpoint — i.e. a self-hosted model
 * (Ollama, vLLM, LM Studio, text-generation-webui) reachable over a tunnel
 * (ngrok/cloudflare). baseUrl is the server root ending in /v1.
 */
export class OpenAICompatibleLLM implements LLMClient {
  private url: string;
  private apiKey?: string;
  private model: string;

  constructor({ baseUrl, apiKey, model }: { baseUrl: string; apiKey?: string; model: string }) {
    this.url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(input: { system: string; messages: ChatMessage[] }): Promise<string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: input.system }, ...input.messages],
      }),
    });
    if (!res.ok) throw new Error(`LLM endpoint returned ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }
}

/** Returns a real LLM client if ANTHROPIC_API_KEY is set, else null. */
export function getLLM(): LLMClient | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  return new AnthropicLLM({ apiKey, model });
}

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

/**
 * Builds the LLM client an agent should use from its stored bring-your-own
 * connection (Anthropic key or an OpenAI-compatible tunnel). Falls back to the
 * platform's env-configured client, and returns null if nothing is configured.
 */
export async function resolveAgentLLM(db: Db, agentId: string): Promise<LLMClient | null> {
  const agent = await getAgent(db, agentId);
  if (agent?.llmProvider === "openai-compatible" && agent.llmBaseUrl) {
    return new OpenAICompatibleLLM({
      baseUrl: agent.llmBaseUrl,
      apiKey: agent.llmApiKey ?? undefined,
      model: agent.llmModel ?? "default",
    });
  }
  if (agent?.llmProvider === "anthropic" && agent.llmApiKey) {
    return new AnthropicLLM({
      apiKey: agent.llmApiKey,
      model: agent.llmModel ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    });
  }
  return getLLM();
}

/**
 * Loads the agent's current config and calls the LLM with the config persona as
 * the system prompt. Throws if the agent or its current config is not found.
 */
export async function chat(
  db: Db,
  agentId: string,
  messages: ChatMessage[],
  llm: LLMClient,
): Promise<{ reply: string; persona: string }> {
  const config = await getCurrentConfig(db, agentId);
  if (!config) throw new Error("agent or current config not found");
  const persona = config.persona;
  const reply = await llm.complete({ system: persona, messages });
  return { reply, persona };
}

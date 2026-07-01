// @vitest-environment node
// These modules run server-side; the Anthropic SDK refuses to construct under jsdom.
import { makeTestDb } from "@/test/pglite-db";
import { AnthropicLLM, OpenAICompatibleLLM, resolveAgentLLM } from "./llm";
import { createAgentDraft, getCurrentConfig } from "./agent-core";

type Call = { url: string; init: RequestInit };

function stubFetch(reply: unknown, status = 200): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(typeof reply === "string" ? reply : JSON.stringify(reply), { status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

test("posts system+messages to <baseUrl>/chat/completions and returns the content", async () => {
  const calls = stubFetch({ choices: [{ message: { role: "assistant", content: "hello back" } }] });
  const llm = new OpenAICompatibleLLM({ baseUrl: "https://abc.ngrok.app/v1", apiKey: "key123", model: "llama-3.1" });

  const reply = await llm.complete({ system: "be terse", messages: [{ role: "user", content: "hi" }] });

  expect(reply).toBe("hello back");
  expect(calls[0].url).toBe("https://abc.ngrok.app/v1/chat/completions");
  const body = JSON.parse(calls[0].init.body as string);
  expect(body.model).toBe("llama-3.1");
  expect(body.messages[0]).toEqual({ role: "system", content: "be terse" });
  expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer key123");
});

test("trims a trailing slash from baseUrl and omits Authorization when no key", async () => {
  const calls = stubFetch({ choices: [{ message: { content: "ok" } }] });
  const llm = new OpenAICompatibleLLM({ baseUrl: "https://x/v1/", model: "m" });

  await llm.complete({ system: "s", messages: [{ role: "user", content: "u" }] });

  expect(calls[0].url).toBe("https://x/v1/chat/completions");
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
});

test("throws on a non-2xx response", async () => {
  stubFetch("upstream error", 500);
  const llm = new OpenAICompatibleLLM({ baseUrl: "https://x", model: "m" });
  await expect(llm.complete({ system: "s", messages: [{ role: "user", content: "u" }] })).rejects.toThrow();
});

const SKILL = ["---", "name: oracle", "description: snarky analyst", "---", "", "You are the Oracle."].join("\n");

test("createAgentDraft parses a skill file into persona + skill metadata", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", skillFile: SKILL, avatarRef: "/avatars/fox.glb" });
  const config = await getCurrentConfig(db, agent.id);
  expect(config?.persona).toBe("You are the Oracle.");
  expect(config?.skillName).toBe("oracle");
  expect(config?.skillDescription).toBe("snarky analyst");
});

test("createAgentDraft stores a bring-your-own LLM connection on the agent", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, {
    name: "Mine",
    skillFile: SKILL,
    avatarRef: "/avatars/fox.glb",
    llm: { provider: "openai-compatible", baseUrl: "https://abc.ngrok.app/v1", model: "llama-3.1", apiKey: "k" },
  });
  expect(agent.llmProvider).toBe("openai-compatible");
  expect(agent.llmBaseUrl).toBe("https://abc.ngrok.app/v1");
  expect(agent.llmModel).toBe("llama-3.1");
  expect(agent.llmApiKey).toBe("k");
});

test("resolveAgentLLM builds an OpenAI-compatible client from the agent's connection", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, {
    name: "Mine",
    skillFile: SKILL,
    avatarRef: "/avatars/fox.glb",
    llm: { provider: "openai-compatible", baseUrl: "https://abc.ngrok.app/v1", model: "llama-3.1" },
  });
  const llm = await resolveAgentLLM(db, agent.id);
  expect(llm).toBeInstanceOf(OpenAICompatibleLLM);
});

test("resolveAgentLLM builds an Anthropic client when the agent uses an Anthropic key", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, {
    name: "Claude",
    skillFile: SKILL,
    avatarRef: "/avatars/fox.glb",
    llm: { provider: "anthropic", apiKey: "sk-ant-x", model: "claude-opus-4-8" },
  });
  const llm = await resolveAgentLLM(db, agent.id);
  expect(llm).toBeInstanceOf(AnthropicLLM);
});

test("resolveAgentLLM returns null when the agent has no connection and no env key", async () => {
  const db = await makeTestDb();
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const { agent } = await createAgentDraft(db, { name: "Bare", persona: "hi", avatarRef: "/avatars/fox.glb" });
  expect(await resolveAgentLLM(db, agent.id)).toBeNull();
  if (prev) process.env.ANTHROPIC_API_KEY = prev;
});

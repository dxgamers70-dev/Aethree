import { chat, type ChatMessage, type LLMClient } from "@/server/llm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function isValidMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  );
}

export async function chatHandler(
  db: Db,
  agentId: string,
  body: { messages?: unknown },
  llm: LLMClient | null,
) {
  if (!llm) {
    return {
      status: 503,
      body: { error: "chat not configured: this agent has no LLM connection (add an API key or tunnel)" },
    };
  }
  if (!isValidMessages(body?.messages)) {
    return { status: 400, body: { error: "messages must be a non-empty array of {role, content}" } };
  }
  try {
    const { reply, persona } = await chat(db, agentId, body.messages, llm);
    return { status: 200, body: { reply, persona } };
  } catch {
    return { status: 404, body: { error: "agent not found" } };
  }
}

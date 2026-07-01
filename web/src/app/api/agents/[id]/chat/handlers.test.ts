import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "@/server/agent-core";
import { FakeLLM } from "@/server/llm";
import { chatHandler } from "./handlers";

test("chatHandler returns 503 when llm is null", async () => {
  const db = await makeTestDb();
  const res = await chatHandler(db, "any", { messages: [{ role: "user", content: "hi" }] }, null);
  expect(res.status).toBe(503);
  expect(res.body.error).toMatch(/LLM connection/i);
});

test("chatHandler returns 400 when messages is missing or empty", async () => {
  const db = await makeTestDb();
  const llm = new FakeLLM();
  expect((await chatHandler(db, "any", {}, llm)).status).toBe(400);
  expect((await chatHandler(db, "any", { messages: [] }, llm)).status).toBe(400);
  expect((await chatHandler(db, "any", { messages: "nope" }, llm)).status).toBe(400);
});

test("chatHandler returns 200 with reply and persona", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, {
    name: "Oracle",
    persona: "gm, I call tops",
    avatarRef: "av-cyber",
  });
  const llm = new FakeLLM();
  const res = await chatHandler(
    db,
    agent.id,
    { messages: [{ role: "user", content: "wen moon" }] },
    llm,
  );
  expect(res.status).toBe(200);
  expect(res.body.persona).toBe("gm, I call tops");
  expect(res.body.reply).toContain("wen moon");
});

test("chatHandler returns 404 for unknown agent", async () => {
  const db = await makeTestDb();
  const llm = new FakeLLM();
  const res = await chatHandler(
    db,
    "00000000-0000-0000-0000-000000000000",
    { messages: [{ role: "user", content: "hi" }] },
    llm,
  );
  expect(res.status).toBe(404);
});

import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "./agent-core";
import { FakeLLM, chat } from "./llm";

test("FakeLLM echoes the system prompt and last user message", async () => {
  const llm = new FakeLLM();
  const reply = await llm.complete({
    system: "you are a degen oracle who calls tops",
    messages: [
      { role: "user", content: "first" },
      { role: "assistant", content: "gm" },
      { role: "user", content: "wen moon" },
    ],
  });
  expect(reply).toContain("you are a degen oracle"); // persona evidence
  expect(reply).toContain("wen moon"); // last user message
});

test("chat loads current config persona and uses it as system prompt", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, {
    name: "Degen Oracle",
    persona: "gm, I call tops",
    avatarRef: "av-cyber",
  });

  const llm = new FakeLLM();
  const { reply, persona } = await chat(
    db,
    agent.id,
    [{ role: "user", content: "wen moon" }],
    llm,
  );

  expect(persona).toBe("gm, I call tops");
  expect(reply).toContain("gm, I call tops"); // persona influenced the system prompt
  expect(reply).toContain("wen moon");
});

test("chat throws for an unknown agent id", async () => {
  const db = await makeTestDb();
  const llm = new FakeLLM();
  await expect(
    chat(db, "00000000-0000-0000-0000-000000000000", [{ role: "user", content: "hi" }], llm),
  ).rejects.toThrow();
});

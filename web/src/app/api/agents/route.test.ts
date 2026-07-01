import { makeTestDb } from "@/test/pglite-db";
import { createAgentHandler, listAgentsHandler } from "./handlers";

test("createAgentHandler validates and returns 201 with agent + config", async () => {
  const db = await makeTestDb();
  const res = await createAgentHandler(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });
  expect(res.status).toBe(201);
  expect(res.body.agent.name).toBe("Oracle");
  expect(res.body.config.hash).toMatch(/^0x[0-9a-f]{64}$/);
});

test("createAgentHandler returns 400 on empty persona", async () => {
  const db = await makeTestDb();
  const res = await createAgentHandler(db, { name: "Oracle", persona: "", avatarRef: "av-cyber" });
  expect(res.status).toBe(400);
});

test("createAgentHandler accepts a skill file + BYO llm and returns 201", async () => {
  const db = await makeTestDb();
  const skillFile = ["---", "name: oracle", "---", "You are the Oracle."].join("\n");
  const res = await createAgentHandler(db, {
    name: "Oracle",
    skillFile,
    avatarRef: "/avatars/fox.glb",
    llm: { provider: "openai-compatible", baseUrl: "https://x/v1", model: "m" },
  });
  expect(res.status).toBe(201);
  expect(res.body.agent.llmProvider).toBe("openai-compatible");
  expect(res.body.config.persona).toBe("You are the Oracle.");
});

test("createAgentHandler returns 400 when neither persona nor skillFile is provided", async () => {
  const db = await makeTestDb();
  const res = await createAgentHandler(db, { name: "X", avatarRef: "/avatars/fox.glb" });
  expect(res.status).toBe(400);
});

test("listAgentsHandler returns array", async () => {
  const db = await makeTestDb();
  await createAgentHandler(db, { name: "A", persona: "a", avatarRef: "av-cyber" });
  const res = await listAgentsHandler(db);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(1);
});

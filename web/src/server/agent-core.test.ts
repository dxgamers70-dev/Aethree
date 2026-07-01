import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft, getAgent, listAgents, getCurrentConfig } from "./agent-core";

test("createAgentDraft writes agent + v1 config and links currentConfigId", async () => {
  const db = await makeTestDb();
  const { agent, config } = await createAgentDraft(db, {
    name: "Degen Oracle",
    persona: "gm, I call tops",
    avatarRef: "av-cyber",
  });

  expect(agent.status).toBe("draft");
  expect(agent.currentConfigId).toBe(config.id);
  expect(config.version).toBe(1);
  expect(config.hash).toMatch(/^0x[0-9a-f]{64}$/);

  const fetched = await getAgent(db, agent.id);
  expect(fetched?.name).toBe("Degen Oracle");

  const current = await getCurrentConfig(db, agent.id);
  expect(current?.persona).toBe("gm, I call tops");
});

test("listAgents returns created agents newest-first", async () => {
  const db = await makeTestDb();
  await createAgentDraft(db, { name: "A", persona: "a", avatarRef: "av-cyber" });
  await createAgentDraft(db, { name: "B", persona: "b", avatarRef: "av-neon" });
  const all = await listAgents(db);
  expect(all.map((a) => a.name)).toContain("A");
  expect(all.length).toBe(2);
});

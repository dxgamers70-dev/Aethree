import { eq } from "drizzle-orm";
import { agents } from "@/db/schema";
import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "@/server/agent-core";
import { createProposalHandler, listProposalsHandler } from "./handlers";

const TOKEN = "0x000000000000000000000000000000000000dEaD";

async function setupAgent(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const { agent } = await createAgentDraft(db, { name: "Gov", persona: "p", avatarRef: "av-cyber" });
  await db.update(agents).set({ tokenAddress: TOKEN }).where(eq(agents.id, agent.id));
  return agent;
}

test("createProposalHandler returns 201 with the proposal", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const res = await createProposalHandler(db, agent.id, {
    persona: "fresh persona",
    createdBy: "0xabc",
    snapshotBlock: "42",
  });
  expect(res.status).toBe(201);
  expect(res.body.payload).toEqual({ persona: "fresh persona" });
  expect(res.body.snapshotBlock).toBe("42");
});

test("createProposalHandler defaults deadline to ~now+1day", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const res = await createProposalHandler(db, agent.id, { persona: "x", createdBy: "0xabc" });
  expect(res.status).toBe(201);
  const delta = new Date(res.body.deadline).getTime() - Date.now();
  expect(delta).toBeGreaterThan(23 * 3600 * 1000);
  expect(delta).toBeLessThan(25 * 3600 * 1000);
});

test("createProposalHandler returns 400 on empty persona", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const res = await createProposalHandler(db, agent.id, { persona: "  ", createdBy: "0xabc" });
  expect(res.status).toBe(400);
});

test("listProposalsHandler returns 200 with an array", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  await createProposalHandler(db, agent.id, { persona: "x", createdBy: "0xabc" });
  const res = await listProposalsHandler(db, agent.id);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBe(1);
});

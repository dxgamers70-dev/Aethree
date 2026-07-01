import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "@/server/agent-core";
import { launchHandler } from "./handlers";

const body = { tokenAddress: "0xToken", saleAddress: "0xSale", onChainAgentId: 7 };

test("launchHandler returns 200 with the launched agent", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });
  const res = await launchHandler(db, agent.id, body);
  expect(res.status).toBe(200);
  expect(res.body.tokenAddress).toBe("0xToken");
  expect(res.body.saleAddress).toBe("0xSale");
  expect(res.body.avatarTokenId).toBe(7);
  expect(res.body.status).toBe("launched");
});

test("launchHandler returns 400 when fields are missing", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });
  const res = await launchHandler(db, agent.id, { tokenAddress: "0xT", saleAddress: "0xS" });
  expect(res.status).toBe(400);
});

test("launchHandler returns 404 when the agent does not exist", async () => {
  const db = await makeTestDb();
  const res = await launchHandler(db, "00000000-0000-0000-0000-000000000000", body);
  expect(res.status).toBe(404);
});

test("launchHandler returns 409 when the agent is already launched", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });
  await launchHandler(db, agent.id, body);
  const res = await launchHandler(db, agent.id, body);
  expect(res.status).toBe(409);
});

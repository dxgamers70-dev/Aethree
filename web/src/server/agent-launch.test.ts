import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "@/server/agent-core";
import { recordLaunch } from "@/server/agent-launch";

test("recordLaunch records on-chain addresses and sets status=launched", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });

  const updated = await recordLaunch(db, agent.id, {
    tokenAddress: "0xToken",
    saleAddress: "0xSale",
    onChainAgentId: 42,
  });

  expect(updated.tokenAddress).toBe("0xToken");
  expect(updated.saleAddress).toBe("0xSale");
  expect(updated.avatarTokenId).toBe(42);
  expect(updated.status).toBe("launched");
  expect(updated.launchVenue).toBe("aetherd");
});

test("recordLaunch on Clanker records the token only, with null sale/avatar", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });

  const updated = await recordLaunch(db, agent.id, {
    tokenAddress: "0xClankerToken",
    venue: "clanker",
  });

  expect(updated.tokenAddress).toBe("0xClankerToken");
  expect(updated.launchVenue).toBe("clanker");
  expect(updated.saleAddress).toBeNull();
  expect(updated.avatarTokenId).toBeNull();
  expect(updated.status).toBe("launched");
});

test("recordLaunch throws when the agent is already launched", async () => {
  const db = await makeTestDb();
  const { agent } = await createAgentDraft(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });
  await recordLaunch(db, agent.id, { tokenAddress: "0xT", saleAddress: "0xS", onChainAgentId: 1 });

  await expect(
    recordLaunch(db, agent.id, { tokenAddress: "0xT2", saleAddress: "0xS2", onChainAgentId: 2 }),
  ).rejects.toThrow();
});

test("recordLaunch throws when the agent does not exist", async () => {
  const db = await makeTestDb();
  await expect(
    recordLaunch(db, "00000000-0000-0000-0000-000000000000", {
      tokenAddress: "0xT",
      saleAddress: "0xS",
      onChainAgentId: 1,
    }),
  ).rejects.toThrow();
});

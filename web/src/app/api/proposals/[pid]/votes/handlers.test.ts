import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { agents } from "@/db/schema";
import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "@/server/agent-core";
import { createProposal } from "@/server/governance";
import { voteTypedData } from "@/lib/eip712";
import { castVoteHandler } from "./handlers";

const CHAIN_ID = 31337;
const TOKEN = "0x000000000000000000000000000000000000dEaD";
const PK0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const acct0 = privateKeyToAccount(PK0);

async function setup(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const { agent } = await createAgentDraft(db, { name: "Gov", persona: "p", avatarRef: "av-cyber" });
  await db.update(agents).set({ tokenAddress: TOKEN }).where(eq(agents.id, agent.id));
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: new Date(Date.now() + 60_000),
  });
  return p;
}

async function sig(proposalId: string, choice: string) {
  return acct0.signTypedData(
    voteTypedData({ proposalId, choice, voter: acct0.address, chainId: CHAIN_ID }),
  );
}

test("castVoteHandler returns 201 on a valid vote", async () => {
  const db = await makeTestDb();
  const p = await setup(db);
  const res = await castVoteHandler(
    db,
    p.id,
    { voter: acct0.address, choice: "for", signature: await sig(p.id, "for"), chainId: CHAIN_ID },
    async () => 100n,
  );
  expect(res.status).toBe(201);
  expect(res.body.choice).toBe("for");
  expect(res.body.weight).toBe("100");
});

test("castVoteHandler returns 400 on missing fields", async () => {
  const db = await makeTestDb();
  const p = await setup(db);
  const res = await castVoteHandler(db, p.id, { voter: acct0.address }, async () => 100n);
  expect(res.status).toBe(400);
});

test("castVoteHandler returns 409 on duplicate vote", async () => {
  const db = await makeTestDb();
  const p = await setup(db);
  const body = {
    voter: acct0.address,
    choice: "for" as const,
    signature: await sig(p.id, "for"),
    chainId: CHAIN_ID,
  };
  await castVoteHandler(db, p.id, body, async () => 100n);
  const res = await castVoteHandler(db, p.id, body, async () => 100n);
  expect(res.status).toBe(409);
});

test("castVoteHandler returns 400 on tampered signature", async () => {
  const db = await makeTestDb();
  const p = await setup(db);
  const res = await castVoteHandler(
    db,
    p.id,
    { voter: acct0.address, choice: "against", signature: await sig(p.id, "for"), chainId: CHAIN_ID },
    async () => 100n,
  );
  expect(res.status).toBe(400);
});

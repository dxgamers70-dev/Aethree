import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { agents } from "@/db/schema";
import { makeTestDb } from "@/test/pglite-db";
import { voteTypedData } from "@/lib/eip712";
import { createAgentDraft } from "./agent-core";
import { createProposal, castVote, tally, listProposals, getProposal } from "./governance";

const CHAIN_ID = 31337;
const TOKEN = "0x000000000000000000000000000000000000dEaD";

// Anvil keys
const PK0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PK1 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const acct0 = privateKeyToAccount(PK0);
const acct1 = privateKeyToAccount(PK1);

async function setupAgent(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const { agent } = await createAgentDraft(db, { name: "Gov", persona: "p", avatarRef: "av-cyber" });
  await db.update(agents).set({ tokenAddress: TOKEN }).where(eq(agents.id, agent.id));
  return agent;
}

function futureDeadline() {
  return new Date(Date.now() + 60_000);
}
function pastDeadline() {
  return new Date(Date.now() - 60_000);
}

async function signVote(account: typeof acct0, proposalId: string, choice: string) {
  return account.signTypedData(
    voteTypedData({ proposalId, choice, voter: account.address, chainId: CHAIN_ID }),
  );
}

test("createProposal inserts an active edit_persona proposal with zero weights", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "new persona",
    createdBy: acct0.address,
    snapshotBlock: 100n,
    deadline: futureDeadline(),
  });
  expect(p.type).toBe("edit_persona");
  expect(p.status).toBe("active");
  expect(p.payload).toEqual({ persona: "new persona" });
  expect(p.forWeight).toBe("0");
  expect(p.againstWeight).toBe("0");
  expect(p.snapshotBlock).toBe(100n);
});

test("createProposal rejects empty persona", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  await expect(
    createProposal(db, {
      agentId: agent.id,
      persona: "  ",
      createdBy: acct0.address,
      snapshotBlock: 1n,
      deadline: futureDeadline(),
    }),
  ).rejects.toThrow();
});

test("castVote tallies for/against with injected getPastVotes", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: futureDeadline(),
  });

  const getPastVotes = async ({ voter }: { token: string; voter: string; block: bigint }) =>
    voter.toLowerCase() === acct0.address.toLowerCase() ? 700n : 300n;

  await castVote(db, {
    proposalId: p.id,
    voter: acct0.address,
    choice: "for",
    signature: await signVote(acct0, p.id, "for"),
    chainId: CHAIN_ID,
    getPastVotes,
  });
  await castVote(db, {
    proposalId: p.id,
    voter: acct1.address,
    choice: "against",
    signature: await signVote(acct1, p.id, "against"),
    chainId: CHAIN_ID,
    getPastVotes,
  });

  const fresh = await getProposal(db, p.id);
  expect(fresh!.forWeight).toBe("700");
  expect(fresh!.againstWeight).toBe("300");
});

test("castVote rejects duplicate votes", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: futureDeadline(),
  });
  const getPastVotes = async () => 100n;
  await castVote(db, {
    proposalId: p.id,
    voter: acct0.address,
    choice: "for",
    signature: await signVote(acct0, p.id, "for"),
    chainId: CHAIN_ID,
    getPastVotes,
  });
  await expect(
    castVote(db, {
      proposalId: p.id,
      voter: acct0.address,
      choice: "for",
      signature: await signVote(acct0, p.id, "for"),
      chainId: CHAIN_ID,
      getPastVotes,
    }),
  ).rejects.toThrow(/already voted/i);
});

test("castVote rejects zero-weight voters", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: futureDeadline(),
  });
  await expect(
    castVote(db, {
      proposalId: p.id,
      voter: acct0.address,
      choice: "for",
      signature: await signVote(acct0, p.id, "for"),
      chainId: CHAIN_ID,
      getPastVotes: async () => 0n,
    }),
  ).rejects.toThrow();
});

test("castVote rejects a tampered signature", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: futureDeadline(),
  });
  // signature is for "for" but we cast "against"
  await expect(
    castVote(db, {
      proposalId: p.id,
      voter: acct0.address,
      choice: "against",
      signature: await signVote(acct0, p.id, "for"),
      chainId: CHAIN_ID,
      getPastVotes: async () => 100n,
    }),
  ).rejects.toThrow(/signature/i);
});

test("castVote rejects when proposal deadline has passed", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: pastDeadline(),
  });
  await expect(
    castVote(db, {
      proposalId: p.id,
      voter: acct0.address,
      choice: "for",
      signature: await signVote(acct0, p.id, "for"),
      chainId: CHAIN_ID,
      getPastVotes: async () => 100n,
    }),
  ).rejects.toThrow();
});

test("tally marks proposal passed when quorum + majority met", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: pastDeadline(),
  });
  // manually set weights (deadline passed, can't cast)
  await db
    .update((await import("@/db/schema")).proposals)
    .set({ forWeight: "700", againstWeight: "100" })
    .where(eq((await import("@/db/schema")).proposals.id, p.id));

  const res = await tally(db, { proposalId: p.id, quorumBps: 1000, totalSupply: 1000n });
  expect(res.quorumMet).toBe(true); // 800 >= 100
  expect(res.majorityMet).toBe(true);
  expect(res.status).toBe("passed");
  const fresh = await getProposal(db, p.id);
  expect(fresh!.status).toBe("passed");
});

test("tally marks proposal failed when quorum not met", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  const p = await createProposal(db, {
    agentId: agent.id,
    persona: "x",
    createdBy: acct0.address,
    snapshotBlock: 5n,
    deadline: pastDeadline(),
  });
  await db
    .update((await import("@/db/schema")).proposals)
    .set({ forWeight: "5", againstWeight: "1" })
    .where(eq((await import("@/db/schema")).proposals.id, p.id));

  const res = await tally(db, { proposalId: p.id, quorumBps: 1000, totalSupply: 1000n });
  expect(res.quorumMet).toBe(false); // 6 < 100
  expect(res.status).toBe("failed");
});

test("listProposals returns proposals for an agent", async () => {
  const db = await makeTestDb();
  const agent = await setupAgent(db);
  await createProposal(db, {
    agentId: agent.id,
    persona: "a",
    createdBy: acct0.address,
    snapshotBlock: 1n,
    deadline: futureDeadline(),
  });
  const list = await listProposals(db, agent.id);
  expect(list.length).toBe(1);
});

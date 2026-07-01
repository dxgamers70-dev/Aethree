import { eq } from "drizzle-orm";
import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "./agent-core";
import { createProposal } from "./governance";
import { buildNextConfig, executeProposal, runExecutor } from "./executor";
import { agents, agentConfigs, proposals } from "@/db/schema";

const DUMMY_TX = "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd" as const;

async function seed(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const { agent } = await createAgentDraft(db, {
    name: "Governed",
    persona: "v1 persona",
    avatarRef: "av-cyber",
  });
  // Mirror a launched agent with an on-chain agentId stored as avatarTokenId.
  await db
    .update(agents)
    .set({ status: "launched", tokenAddress: "0x000000000000000000000000000000000000dEaD", avatarTokenId: 7 })
    .where(eq(agents.id, agent.id));

  const proposal = await createProposal(db, {
    agentId: agent.id,
    persona: "v2 persona",
    createdBy: "0x0000000000000000000000000000000000000001",
    snapshotBlock: 1n,
    deadline: new Date(Date.now() + 60_000),
  });
  // Move the proposal to a passed state (executor acts on passed && !executed).
  await db.update(proposals).set({ status: "passed" }).where(eq(proposals.id, proposal.id));

  return { agentId: agent.id, proposalId: proposal.id };
}

test("buildNextConfig applies persona, bumps version and hash", async () => {
  const db = await makeTestDb();
  const { agentId } = await seed(db);

  const v2 = await buildNextConfig(db, agentId, { persona: "v2 persona" });
  expect(v2.version).toBe(2);
  expect(v2.persona).toBe("v2 persona");

  const [v1] = await db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.agentId, agentId))
    .orderBy(agentConfigs.version);
  expect(v2.hash).not.toBe(v1.hash);
  expect(v2.hash).toMatch(/^0x[0-9a-f]{64}$/);
});

test("executeProposal builds v2, anchors, flips currentConfig and marks executed", async () => {
  const db = await makeTestDb();
  const { agentId, proposalId } = await seed(db);

  const calls: { onChainAgentId: bigint; newHash: string }[] = [];
  const anchor = async (args: { onChainAgentId: bigint; newHash: `0x${string}` }) => {
    calls.push(args);
    return DUMMY_TX;
  };

  const { config, tx } = await executeProposal(db, proposalId, { anchor });

  expect(config.version).toBe(2);
  expect(config.persona).toBe("v2 persona");
  expect(tx).toBe(DUMMY_TX);
  expect(calls).toHaveLength(1);
  expect(calls[0].onChainAgentId).toBe(7n);
  expect(calls[0].newHash).toBe(config.hash);

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  expect(agent.currentConfigId).toBe(config.id);

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  expect(proposal.status).toBe("executed");
  expect(proposal.executedConfigId).toBe(config.id);
  expect(proposal.executedTx).toBe(DUMMY_TX);

  const [cfg] = await db.select().from(agentConfigs).where(eq(agentConfigs.id, config.id));
  expect(cfg.anchoredTx).toBe(DUMMY_TX);
});

test("executeProposal is idempotent: re-running does not anchor or build again", async () => {
  const db = await makeTestDb();
  const { proposalId } = await seed(db);

  let count = 0;
  const anchor = async () => {
    count += 1;
    return DUMMY_TX;
  };

  await executeProposal(db, proposalId, { anchor });
  const again = await executeProposal(db, proposalId, { anchor });

  expect(count).toBe(1);
  expect(again.tx).toBe(DUMMY_TX);

  const allConfigs = await db.select().from(agentConfigs);
  // v1 + v2 only, no third config from the second run.
  expect(allConfigs.length).toBe(2);
});

test("executeProposal leaves proposal 'passed' when anchor throws", async () => {
  const db = await makeTestDb();
  const { agentId, proposalId } = await seed(db);

  const anchor = async () => {
    throw new Error("chain unreachable");
  };

  await expect(executeProposal(db, proposalId, { anchor })).rejects.toThrow(/chain unreachable/);

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  expect(proposal.status).toBe("passed");
  expect(proposal.executedTx).toBeNull();

  // currentConfig must NOT have flipped to v2.
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  const [current] = await db.select().from(agentConfigs).where(eq(agentConfigs.id, agent.currentConfigId!));
  expect(current.version).toBe(1);
});

test("runExecutor processes all passed proposals", async () => {
  const db = await makeTestDb();
  const { proposalId } = await seed(db);

  const anchor = async () => DUMMY_TX;
  const results = await runExecutor(db, { anchor });

  expect(results).toHaveLength(1);
  expect(results[0].proposalId).toBe(proposalId);
  expect(results[0].config?.version).toBe(2);
});

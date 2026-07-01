// @vitest-environment node
import { eq } from "drizzle-orm";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { abis, deployment } from "@/lib/contracts";
import { buildInitialConfig } from "@/lib/agent-config";
import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft } from "@/server/agent-core";
import { runExecutor } from "@/server/executor";
import { makeAnchor } from "@/server/executor-chain";
import { agents, agentConfigs } from "@/db/schema";

const RPC = "http://127.0.0.1:8545";
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const EXECUTOR_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

describe.skipIf(!process.env.RUN_INTEGRATION)("full loop", () => {
  test("create -> launch -> buy -> delegate -> propose -> execute -> anchor", async () => {
    const deployer = privateKeyToAccount(DEPLOYER_KEY);

    const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
    const deployerWallet = createWalletClient({ account: deployer, chain: foundry, transport: http(RPC) });

    const dep = deployment(foundry.id);
    const persona = "v1 persona";
    const avatarRef = "ipfs://avatar/full-loop";
    const v1 = buildInitialConfig({ persona, avatarRef });

    // (a) Launch on-chain: simulate to capture [agentId, token, sale], then write.
    const { request, result } = await pub.simulateContract({
      account: deployer,
      address: dep.AgentTokenFactory as `0x${string}`,
      abi: abis.AgentTokenFactory,
      functionName: "createAgent",
      args: ["Full Loop Agent", "LOOP", avatarRef, v1.hash],
    });
    const [agentId, token, sale] = result as [bigint, `0x${string}`, `0x${string}`];

    const createTx = await deployerWallet.writeContract(request);
    const createReceipt = await pub.waitForTransactionReceipt({ hash: createTx });

    // Cross-check the returned values against the emitted event.
    const events = parseEventLogs({ abi: abis.AgentTokenFactory, logs: createReceipt.logs, eventName: "AgentCreated" });
    const ev = events[0]?.args as { agentId: bigint; token: `0x${string}`; sale: `0x${string}` };
    expect(ev.agentId).toBe(agentId);
    expect(ev.token.toLowerCase()).toBe(token.toLowerCase());
    expect(ev.sale.toLowerCase()).toBe(sale.toLowerCase());

    // (b) Seed a pglite db mirroring the launch (same v1 inputs => same hash).
    const db = await makeTestDb();
    const { agent } = await createAgentDraft(db, { name: "Full Loop Agent", persona, avatarRef });
    await db
      .update(agents)
      .set({
        status: "launched",
        tokenAddress: token,
        saleAddress: sale,
        avatarTokenId: Number(agentId),
      })
      .where(eq(agents.id, agent.id));

    const [seededV1] = await db.select().from(agentConfigs).where(eq(agentConfigs.agentId, agent.id));
    expect(seededV1.hash).toBe(v1.hash);

    // (c) Buy tokens, then delegate to self; mine a block so getPastVotes has history.
    // The bonding curve prices per token base unit (P0 + SLOPE*sold), so a small base-unit
    // amount keeps the cost within the funded Anvil account's balance.
    const buyAmount = 1_000n;
    const cost = (await pub.readContract({
      address: sale,
      abi: abis.BondingCurveSale,
      functionName: "costToBuy",
      args: [buyAmount],
    })) as bigint;

    const buyTx = await deployerWallet.writeContract({
      address: sale,
      abi: abis.BondingCurveSale,
      functionName: "buy",
      args: [buyAmount],
      value: cost,
    });
    await pub.waitForTransactionReceipt({ hash: buyTx });

    const delegateTx = await deployerWallet.writeContract({
      address: token,
      abi: abis.AgentToken,
      functionName: "delegate",
      args: [deployer.address],
    });
    await pub.waitForTransactionReceipt({ hash: delegateTx });

    // Advance a block so the delegation snapshot is in the past.
    const tickTx = await deployerWallet.sendTransaction({ to: deployer.address, value: 0n });
    await pub.waitForTransactionReceipt({ hash: tickTx });
    const snapshotBlock = await pub.getBlockNumber();

    // (d) Seed a 'passed' proposal directly (governance unit tests cover the vote path).
    const newPersona = "GOVERNED PERSONA";
    const { proposals } = await import("@/db/schema");
    const [proposal] = await db
      .insert(proposals)
      .values({
        agentId: agent.id,
        type: "edit_persona",
        payload: { persona: newPersona },
        snapshotBlock,
        deadline: new Date(Date.now() + 60_000),
        status: "passed",
        createdBy: deployer.address,
        forWeight: buyAmount.toString(),
        againstWeight: "0",
      })
      .returning();

    // (e) Run the executor with a REAL anchor built from account[1] (EXECUTOR_ROLE).
    process.env.EXECUTOR_PRIVATE_KEY = EXECUTOR_KEY;
    process.env.RPC_URL = RPC;
    const results = await runExecutor(db, { anchor: makeAnchor() });
    expect(results).toHaveLength(1);
    expect(results[0].proposalId).toBe(proposal.id);
    const v2Config = results[0].config!;
    expect(v2Config.version).toBe(2);
    expect(v2Config.persona).toBe(newPersona);

    // (f) ASSERT: on-chain configHash == v2 hash, and db currentConfig is v2/GOVERNED.
    const onChain = (await pub.readContract({
      address: dep.AgentRegistry as `0x${string}`,
      abi: abis.AgentRegistry,
      functionName: "agents",
      args: [agentId],
    })) as readonly [`0x${string}`, `0x${string}`, `0x${string}`, bigint, `0x${string}`];
    const onChainConfigHash = onChain[4];
    expect(onChainConfigHash.toLowerCase()).toBe(v2Config.hash.toLowerCase());

    const [updatedAgent] = await db.select().from(agents).where(eq(agents.id, agent.id));
    const [current] = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.id, updatedAgent.currentConfigId!));
    expect(current.version).toBe(2);
    expect(current.persona).toBe(newPersona);

    // Surface the decoded launch addresses for the run report.
    console.log("[full-loop] launch:", {
      agentId: agentId.toString(),
      token,
      sale,
      v1Hash: v1.hash,
      v2Hash: v2Config.hash,
      onChainConfigHash,
    });
  });
});

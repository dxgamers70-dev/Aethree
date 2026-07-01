import { eq } from "drizzle-orm";
import { agents, agentConfigs, proposals } from "@/db/schema";
import { getAgent, getCurrentConfig, type AgentConfigRow } from "./agent-core";
import { hashConfig } from "@/lib/config-hash";
import type { AgentConfigCore } from "@/lib/agent-config";

// Accepts any Drizzle instance (neon at runtime, pglite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Anchors a new config hash on-chain and returns the tx hash. Injected for testability. */
export type Anchor = (args: {
  onChainAgentId: bigint;
  newHash: `0x${string}`;
}) => Promise<`0x${string}`>;

export type ExecuteResult = {
  proposalId: string;
  config: AgentConfigRow | null;
  tx: `0x${string}` | null;
  noop?: boolean;
};

/**
 * Build config v(n+1) by applying an `edit_persona` mutation over the current core.
 * Pure DB + hashing — does not touch the chain.
 */
export async function buildNextConfig(
  db: Db,
  agentId: string,
  payload: { persona?: string },
): Promise<AgentConfigRow> {
  const current = await getCurrentConfig(db, agentId);
  if (!current) throw new Error("agent has no current config");

  const core: AgentConfigCore = {
    persona: payload.persona ?? current.persona,
    skills: (current.skills as string[]) ?? [],
    policy: (current.policy as Record<string, never>) ?? {},
    voice: current.voice,
    avatarRef: current.avatarRef,
  };

  const version = current.version + 1;
  const hash = hashConfig(core);

  const [row] = await db
    .insert(agentConfigs)
    .values({
      agentId,
      version,
      hash,
      persona: core.persona,
      skills: core.skills,
      policy: core.policy,
      voice: core.voice,
      avatarRef: core.avatarRef,
    })
    .returning();
  return row;
}

/**
 * Execute a single proposal: build v2, anchor on-chain, then flip currentConfig + mark executed.
 * Idempotent: only acts on `passed` proposals; `executed` returns a noop. If anchoring throws,
 * the proposal stays `passed` so it can be retried.
 */
export async function executeProposal(
  db: Db,
  proposalId: string,
  deps: { anchor: Anchor },
): Promise<ExecuteResult> {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) throw new Error("proposal not found");

  // Idempotency: never apply a mutation twice.
  if (proposal.status === "executed") {
    return {
      proposalId,
      config: proposal.executedConfigId
        ? (await db.select().from(agentConfigs).where(eq(agentConfigs.id, proposal.executedConfigId)).limit(1))[0] ??
          null
        : null,
      tx: (proposal.executedTx as `0x${string}` | null) ?? null,
      noop: true,
    };
  }
  if (proposal.status !== "passed") {
    throw new Error(`proposal is not passed (status=${proposal.status})`);
  }

  const agent = await getAgent(db, proposal.agentId);
  if (!agent) throw new Error("agent not found");
  if (agent.avatarTokenId === null || agent.avatarTokenId === undefined) {
    throw new Error("agent has no on-chain agentId (avatarTokenId)");
  }

  const payload = (proposal.payload ?? {}) as { persona?: string };
  const v2 = await buildNextConfig(db, proposal.agentId, payload);

  // Anchor first; if this throws we leave the proposal `passed` (retryable) and abort.
  const tx = await deps.anchor({
    onChainAgentId: BigInt(agent.avatarTokenId),
    newHash: v2.hash as `0x${string}`,
  });

  // On-chain success → record the anchoring tx, flip currentConfig, mark executed.
  await db.update(agentConfigs).set({ anchoredTx: tx }).where(eq(agentConfigs.id, v2.id));
  await db.update(agents).set({ currentConfigId: v2.id }).where(eq(agents.id, proposal.agentId));
  await db
    .update(proposals)
    .set({ status: "executed", executedConfigId: v2.id, executedTx: tx })
    .where(eq(proposals.id, proposalId));

  return { proposalId, config: v2, tx };
}

/** Find all `passed` proposals and execute each. Returns the per-proposal results. */
export async function runExecutor(db: Db, deps: { anchor: Anchor }): Promise<ExecuteResult[]> {
  const rows = await db.select().from(proposals).where(eq(proposals.status, "passed"));
  const results: ExecuteResult[] = [];
  for (const row of rows) {
    results.push(await executeProposal(db, row.id, deps));
  }
  return results;
}

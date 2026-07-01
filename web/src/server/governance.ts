import { and, desc, eq } from "drizzle-orm";
import { agents, proposals, votes } from "@/db/schema";
import { verifyVoteSignature } from "@/lib/eip712";

// Accepts any Drizzle instance (neon at runtime, pglite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ProposalRow = typeof proposals.$inferSelect;
export type VoteRow = typeof votes.$inferSelect;

export const DEFAULT_QUORUM_BPS = 1000; // 10%

export async function createProposal(
  db: Db,
  input: {
    agentId: string;
    persona: string;
    createdBy: string;
    snapshotBlock: bigint;
    deadline: Date;
  },
): Promise<ProposalRow> {
  const persona = input.persona?.trim();
  if (!persona) throw new Error("persona must not be empty");

  const [row] = await db
    .insert(proposals)
    .values({
      agentId: input.agentId,
      type: "edit_persona",
      payload: { persona },
      snapshotBlock: input.snapshotBlock,
      deadline: input.deadline,
      status: "active",
      createdBy: input.createdBy,
      forWeight: "0",
      againstWeight: "0",
    })
    .returning();
  return row;
}

export async function getProposal(db: Db, proposalId: string): Promise<ProposalRow | null> {
  const [row] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  return row ?? null;
}

export async function listProposals(db: Db, agentId: string): Promise<ProposalRow[]> {
  return db
    .select()
    .from(proposals)
    .where(eq(proposals.agentId, agentId))
    .orderBy(desc(proposals.createdAt));
}

export async function castVote(
  db: Db,
  input: {
    proposalId: string;
    voter: `0x${string}`;
    choice: "for" | "against";
    signature: `0x${string}`;
    chainId: number;
    getPastVotes: (args: { token: string; voter: string; block: bigint }) => Promise<bigint>;
  },
): Promise<VoteRow> {
  const proposal = await getProposal(db, input.proposalId);
  if (!proposal) throw new Error("proposal not found");
  if (proposal.status !== "active") throw new Error("proposal is not active");
  if (new Date(proposal.deadline).getTime() <= Date.now()) {
    throw new Error("voting deadline has passed");
  }
  if (input.choice !== "for" && input.choice !== "against") {
    throw new Error("choice must be 'for' or 'against'");
  }

  const ok = await verifyVoteSignature({
    proposalId: input.proposalId,
    choice: input.choice,
    voter: input.voter,
    chainId: input.chainId,
    signature: input.signature,
  });
  if (!ok) throw new Error("invalid vote signature");

  const [agent] = await db.select().from(agents).where(eq(agents.id, proposal.agentId)).limit(1);
  if (!agent?.tokenAddress) throw new Error("agent has no token; launch the token first");

  const weight = await input.getPastVotes({
    token: agent.tokenAddress,
    voter: input.voter,
    block: proposal.snapshotBlock,
  });
  if (weight === 0n) throw new Error("voter has no voting weight at the snapshot block");

  let vote: VoteRow;
  try {
    [vote] = await db
      .insert(votes)
      .values({
        proposalId: input.proposalId,
        voterAddr: input.voter,
        weight: weight.toString(),
        choice: input.choice,
        signature: input.signature,
      })
      .returning();
  } catch (e) {
    const err = e as { message?: string; code?: string; cause?: { message?: string; code?: string } };
    const haystack = [err.message, err.code, err.cause?.message, err.cause?.code]
      .filter(Boolean)
      .join(" ");
    if (/unique|duplicate|votes_proposal_voter|23505/i.test(haystack)) {
      throw new Error("this address has already voted");
    }
    throw e;
  }

  // Read-modify-write of the running tally (decimal strings + BigInt math).
  const col = input.choice === "for" ? "forWeight" : "againstWeight";
  const current = BigInt(input.choice === "for" ? proposal.forWeight : proposal.againstWeight);
  const next = (current + weight).toString();
  await db
    .update(proposals)
    .set({ [col]: next })
    .where(eq(proposals.id, input.proposalId));

  return vote;
}

export async function tally(
  db: Db,
  input: { proposalId: string; quorumBps?: number; totalSupply: bigint },
): Promise<{
  status: "passed" | "failed";
  forWeight: string;
  againstWeight: string;
  quorumMet: boolean;
  majorityMet: boolean;
}> {
  const proposal = await getProposal(db, input.proposalId);
  if (!proposal) throw new Error("proposal not found");

  const quorumBps = BigInt(input.quorumBps ?? DEFAULT_QUORUM_BPS);
  const forWeight = BigInt(proposal.forWeight);
  const againstWeight = BigInt(proposal.againstWeight);
  const turnout = forWeight + againstWeight;

  const quorumThreshold = (input.totalSupply * quorumBps) / 10000n;
  const quorumMet = turnout >= quorumThreshold;
  const majorityMet = forWeight > againstWeight;
  const status: "passed" | "failed" = quorumMet && majorityMet ? "passed" : "failed";

  // Only transition from 'active' (idempotent w.r.t. executed proposals).
  if (proposal.status === "active") {
    await db.update(proposals).set({ status }).where(eq(proposals.id, input.proposalId));
  }

  return {
    status,
    forWeight: proposal.forWeight,
    againstWeight: proposal.againstWeight,
    quorumMet,
    majorityMet,
  };
}

// Re-exported so callers can filter active proposals consistently.
export async function listActiveProposals(db: Db, agentId: string): Promise<ProposalRow[]> {
  return db
    .select()
    .from(proposals)
    .where(and(eq(proposals.agentId, agentId), eq(proposals.status, "active")))
    .orderBy(desc(proposals.createdAt));
}

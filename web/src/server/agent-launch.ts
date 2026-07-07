import { eq } from "drizzle-orm";
import { agents } from "@/db/schema";
import { getAgent, type AgentRow } from "@/server/agent-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type LaunchVenue = "aetherd" | "clanker";

/**
 * Records the result of an on-chain agent launch. The agent must currently be a
 * draft; once launched its token address (and, for the Aetherd venue, its sale
 * address + avatar token id) are pinned and its status flips to "launched".
 *
 * Aetherd launches deploy an ERC20Votes token + bonding-curve sale + avatar NFT, so
 * they carry `saleAddress`/`onChainAgentId`. Clanker launches deploy a plain ERC20 +
 * Uniswap pool with none of those, so those fields stay null.
 */
export async function recordLaunch(
  db: Db,
  agentId: string,
  input: {
    tokenAddress: string;
    saleAddress?: string;
    onChainAgentId?: number;
    venue?: LaunchVenue;
  },
): Promise<AgentRow> {
  const agent = await getAgent(db, agentId);
  if (!agent) throw new Error("agent not found");
  if (agent.status !== "draft") throw new Error("agent is not a draft");

  const [updated] = await db
    .update(agents)
    .set({
      launchVenue: input.venue ?? "aetherd",
      tokenAddress: input.tokenAddress,
      saleAddress: input.saleAddress ?? null,
      avatarTokenId: input.onChainAgentId ?? null,
      status: "launched",
    })
    .where(eq(agents.id, agentId))
    .returning();

  return updated;
}

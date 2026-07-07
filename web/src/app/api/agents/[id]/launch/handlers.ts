import { getAgent } from "@/server/agent-core";
import { recordLaunch, type LaunchVenue } from "@/server/agent-launch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function launchHandler(
  db: Db,
  agentId: string,
  body: { tokenAddress?: string; saleAddress?: string; onChainAgentId?: number; venue?: string },
) {
  // Default to the Aetherd venue so existing callers (which omit `venue`) keep working.
  const venue: LaunchVenue = body?.venue === "clanker" ? "clanker" : "aetherd";

  if (!body?.tokenAddress) {
    return { status: 400, body: { error: "tokenAddress is required" } };
  }
  // Aetherd deploys a bonding-curve sale + avatar NFT, so it must report both; Clanker
  // deploys neither, so a token address alone is enough.
  if (venue === "aetherd" && (!body?.saleAddress || body?.onChainAgentId == null)) {
    return { status: 400, body: { error: "tokenAddress, saleAddress and onChainAgentId are required" } };
  }

  const agent = await getAgent(db, agentId);
  if (!agent) return { status: 404, body: { error: "agent not found" } };
  if (agent.status !== "draft") return { status: 409, body: { error: "agent is already launched" } };

  const updated = await recordLaunch(db, agentId, {
    venue,
    tokenAddress: body.tokenAddress,
    saleAddress: body.saleAddress,
    onChainAgentId: body.onChainAgentId == null ? undefined : Number(body.onChainAgentId),
  });
  return { status: 200, body: updated };
}

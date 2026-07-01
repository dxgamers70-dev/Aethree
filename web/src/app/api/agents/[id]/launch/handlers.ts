import { getAgent } from "@/server/agent-core";
import { recordLaunch } from "@/server/agent-launch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function launchHandler(
  db: Db,
  agentId: string,
  body: { tokenAddress?: string; saleAddress?: string; onChainAgentId?: number },
) {
  if (!body?.tokenAddress || !body?.saleAddress || body?.onChainAgentId == null) {
    return { status: 400, body: { error: "tokenAddress, saleAddress and onChainAgentId are required" } };
  }

  const agent = await getAgent(db, agentId);
  if (!agent) return { status: 404, body: { error: "agent not found" } };
  if (agent.status !== "draft") return { status: 409, body: { error: "agent is already launched" } };

  const updated = await recordLaunch(db, agentId, {
    tokenAddress: body.tokenAddress,
    saleAddress: body.saleAddress,
    onChainAgentId: Number(body.onChainAgentId),
  });
  return { status: 200, body: updated };
}

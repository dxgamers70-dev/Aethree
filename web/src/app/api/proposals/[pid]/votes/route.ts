import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { abis, activeChainId, publicClient } from "@/lib/contracts";
import { castVoteHandler, type GetPastVotes } from "./handlers";

type Ctx = { params: Promise<{ pid: string }> };

/** Reads ERC20Votes.getPastVotes(voter, block) on the agent's token at the snapshot block. */
const getPastVotes: GetPastVotes = async ({ token, voter, block }) => {
  return (await publicClient().readContract({
    address: token as `0x${string}`,
    abi: abis.AgentToken,
    functionName: "getPastVotes",
    args: [voter as `0x${string}`, block],
  })) as bigint;
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const { pid } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, body: payload } = await castVoteHandler(
    getDb(),
    pid,
    { ...body, chainId: body.chainId ?? activeChainId() },
    getPastVotes,
  );
  return NextResponse.json(payload, { status });
}

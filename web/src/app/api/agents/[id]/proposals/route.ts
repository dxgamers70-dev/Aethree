import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { publicClient } from "@/lib/contracts";
import { createProposalHandler, listProposalsHandler } from "./handlers";

type Ctx = { params: Promise<{ id: string }> };

async function currentBlock(): Promise<bigint> {
  try {
    return await publicClient().getBlockNumber();
  } catch {
    return 0n;
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  // Snapshot the current block server-side unless the caller supplied one.
  const snapshotBlock = (body.snapshotBlock ?? (await currentBlock())).toString();
  const { status, body: payload } = await createProposalHandler(getDb(), id, {
    ...body,
    snapshotBlock,
  });
  return NextResponse.json(payload, { status });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { status, body } = await listProposalsHandler(getDb(), id);
  return NextResponse.json(body, { status });
}

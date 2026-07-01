import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAgent, getCurrentConfig } from "@/server/agent-core";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(getDb(), id);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  const config = await getCurrentConfig(getDb(), id);
  return NextResponse.json({ agent, config });
}

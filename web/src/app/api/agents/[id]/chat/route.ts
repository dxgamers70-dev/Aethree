import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { resolveAgentLLM } from "@/server/llm";
import { chatHandler } from "./handlers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json().catch(() => ({}));
  // Use the agent's own bring-your-own LLM connection (key or tunnel), falling
  // back to the platform default inside resolveAgentLLM.
  const { status, body: payload } = await chatHandler(db, id, body, await resolveAgentLLM(db, id));
  return NextResponse.json(payload, { status });
}

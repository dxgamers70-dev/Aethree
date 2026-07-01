import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createAgentHandler, listAgentsHandler } from "./handlers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, body: payload } = await createAgentHandler(getDb(), body);
  return NextResponse.json(payload, { status });
}

export async function GET() {
  const { status, body } = await listAgentsHandler(getDb());
  return NextResponse.json(body, { status });
}

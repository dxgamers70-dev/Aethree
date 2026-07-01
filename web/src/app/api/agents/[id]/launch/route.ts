import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { launchHandler } from "./handlers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { status, body: payload } = await launchHandler(getDb(), id, body);
  return NextResponse.json(payload, { status });
}

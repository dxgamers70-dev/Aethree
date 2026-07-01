import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { runExecutor } from "@/server/executor";
import { makeAnchor } from "@/server/executor-chain";

export async function POST(req: NextRequest) {
  const secret = process.env.EXECUTOR_CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await runExecutor(getDb(), { anchor: makeAnchor() });
  return NextResponse.json({ count: results.length, results });
}

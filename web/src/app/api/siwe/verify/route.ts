import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { verifyHandler } from "./handlers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, body: payload } = await verifyHandler(getDb(), body);
  return NextResponse.json(payload, { status });
}

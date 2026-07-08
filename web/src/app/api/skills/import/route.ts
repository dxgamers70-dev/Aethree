import { NextRequest, NextResponse } from "next/server";
import { importSkillHandler } from "./handlers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, body: payload } = await importSkillHandler(body);
  return NextResponse.json(payload, { status });
}

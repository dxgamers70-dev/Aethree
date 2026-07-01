import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { issueNonce } from "@/server/siwe";

export async function GET() {
  const { nonce } = await issueNonce(getDb());
  return NextResponse.json({ nonce });
}

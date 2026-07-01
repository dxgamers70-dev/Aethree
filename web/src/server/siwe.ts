import { eq } from "drizzle-orm";
import { getAddress, verifyMessage } from "viem";
import { generateSiweNonce, parseSiweMessage } from "viem/siwe";
import { sessions } from "@/db/schema";

// Accepts any Drizzle instance (neon at runtime, pglite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type SessionRow = typeof sessions.$inferSelect;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function issueNonce(db: Db): Promise<{ nonce: string }> {
  const nonce = generateSiweNonce();
  await db.insert(sessions).values({ nonce });
  return { nonce };
}

export async function getSession(db: Db, nonce: string): Promise<SessionRow | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.nonce, nonce)).limit(1);
  return row ?? null;
}

export async function verifySiwe(
  db: Db,
  { message, signature }: { message: string; signature: `0x${string}` },
): Promise<{ address: string }> {
  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.nonce) {
    throw new Error("invalid SIWE message: missing address or nonce");
  }

  const row = await getSession(db, parsed.nonce);
  if (!row) throw new Error("unknown nonce");
  if (row.address) throw new Error("nonce already used");
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    throw new Error("nonce expired");
  }

  const valid = await verifyMessage({
    address: parsed.address,
    message,
    signature,
  });
  if (!valid) throw new Error("invalid signature");

  const address = getAddress(parsed.address);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({ address, expiresAt })
    .where(eq(sessions.nonce, parsed.nonce));

  return { address };
}

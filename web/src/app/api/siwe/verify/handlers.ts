import { verifySiwe } from "@/server/siwe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function verifyHandler(
  db: Db,
  body: { message?: string; signature?: string },
) {
  if (!body?.message || !body?.signature) {
    return { status: 400, body: { error: "message and signature are required" } };
  }
  try {
    const { address } = await verifySiwe(db, {
      message: body.message,
      signature: body.signature as `0x${string}`,
    });
    return { status: 200, body: { address } };
  } catch (e) {
    return { status: 401, body: { error: (e as Error).message } };
  }
}

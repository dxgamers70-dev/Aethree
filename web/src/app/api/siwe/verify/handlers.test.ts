import { makeTestDb } from "@/test/pglite-db";
import { createSiweMessage } from "viem/siwe";
import { privateKeyToAccount } from "viem/accounts";
import { issueNonce } from "@/server/siwe";
import { verifyHandler } from "./handlers";

const account = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

async function signFor(nonce: string) {
  const message = createSiweMessage({
    domain: "aetherd.test",
    address: account.address,
    statement: "Sign in to AeThree",
    uri: "https://aetherd.test",
    version: "1",
    chainId: 8453,
    nonce,
  });
  const signature = await account.signMessage({ message });
  return { message, signature };
}

test("verifyHandler returns 400 when message or signature missing", async () => {
  const db = await makeTestDb();
  expect((await verifyHandler(db, {})).status).toBe(400);
  expect((await verifyHandler(db, { message: "x" })).status).toBe(400);
  expect((await verifyHandler(db, { signature: "0x1" })).status).toBe(400);
});

test("verifyHandler returns 200 with checksummed address on success", async () => {
  const db = await makeTestDb();
  const { nonce } = await issueNonce(db);
  const { message, signature } = await signFor(nonce);

  const res = await verifyHandler(db, { message, signature });
  expect(res.status).toBe(200);
  expect(res.body.address).toBe(account.address);
});

test("verifyHandler returns 401 on verification failure (unknown nonce)", async () => {
  const db = await makeTestDb();
  const { message, signature } = await signFor("neverissuednonce");
  const res = await verifyHandler(db, { message, signature });
  expect(res.status).toBe(401);
});

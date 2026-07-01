import { makeTestDb } from "@/test/pglite-db";
import { createSiweMessage } from "viem/siwe";
import { privateKeyToAccount } from "viem/accounts";
import { issueNonce, verifySiwe, getSession } from "./siwe";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const account = privateKeyToAccount(PK);

const DOMAIN = "aetherd.test";
const URI = "https://aetherd.test";
const CHAIN_ID = 8453;

async function signedMessageForNonce(nonce: string, overrides: Partial<{ nonce: string }> = {}) {
  const message = createSiweMessage({
    domain: DOMAIN,
    address: account.address,
    statement: "Sign in to AeThree",
    uri: URI,
    version: "1",
    chainId: CHAIN_ID,
    nonce: overrides.nonce ?? nonce,
  });
  const signature = await account.signMessage({ message });
  return { message, signature };
}

test("issueNonce inserts an unconsumed session row and returns the nonce", async () => {
  const db = await makeTestDb();
  const { nonce } = await issueNonce(db);
  expect(nonce).toBeTruthy();

  const row = await getSession(db, nonce);
  expect(row?.nonce).toBe(nonce);
  expect(row?.address).toBeNull();
  expect(row?.expiresAt).toBeNull();
});

test("verifySiwe verifies a real signed message and binds the address", async () => {
  const db = await makeTestDb();
  const { nonce } = await issueNonce(db);
  const { message, signature } = await signedMessageForNonce(nonce);

  const { address } = await verifySiwe(db, { message, signature });
  expect(address).toBe(account.address); // checksummed

  const row = await getSession(db, nonce);
  expect(row?.address).toBe(account.address);
  expect(row?.expiresAt).toBeInstanceOf(Date);
  expect(row!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
});

test("verifySiwe rejects a tampered signature", async () => {
  const db = await makeTestDb();
  const { nonce } = await issueNonce(db);
  const { message, signature } = await signedMessageForNonce(nonce);
  // Flip a hex digit inside the `r` component so it recovers a different address.
  const c = signature[10];
  const flipped = c === "a" ? "b" : "a";
  const tampered = (signature.slice(0, 10) + flipped + signature.slice(11)) as `0x${string}`;

  await expect(verifySiwe(db, { message, signature: tampered })).rejects.toThrow();
});

test("verifySiwe rejects an unknown nonce", async () => {
  const db = await makeTestDb();
  // never issued
  const { message, signature } = await signedMessageForNonce("deadbeefdeadbeef");
  await expect(verifySiwe(db, { message, signature })).rejects.toThrow();
});

test("verifySiwe rejects a replay of an already-consumed nonce", async () => {
  const db = await makeTestDb();
  const { nonce } = await issueNonce(db);
  const { message, signature } = await signedMessageForNonce(nonce);

  await verifySiwe(db, { message, signature });
  // second attempt with same nonce must fail
  await expect(verifySiwe(db, { message, signature })).rejects.toThrow();
});

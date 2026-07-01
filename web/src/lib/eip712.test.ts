import { privateKeyToAccount } from "viem/accounts";
import { voteTypedData, verifyVoteSignature } from "./eip712";

// Anvil test key #0
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(PK);

const chainId = 31337;
const proposalId = "11111111-1111-1111-1111-111111111111";

async function sign(choice: string, voter: `0x${string}`) {
  return account.signTypedData(voteTypedData({ proposalId, choice, voter, chainId }));
}

test("voteTypedData has the agreed domain and types", () => {
  const td = voteTypedData({ proposalId, choice: "for", voter: account.address, chainId });
  expect(td.domain).toEqual({ name: "AeThree", version: "1", chainId });
  expect(td.primaryType).toBe("Vote");
  expect(td.types.Vote).toEqual([
    { name: "proposalId", type: "string" },
    { name: "choice", type: "string" },
    { name: "voter", type: "address" },
  ]);
  expect(td.message).toEqual({ proposalId, choice: "for", voter: account.address });
});

test("verifyVoteSignature returns true for the correct voter", async () => {
  const signature = await sign("for", account.address);
  const ok = await verifyVoteSignature({
    proposalId,
    choice: "for",
    voter: account.address,
    chainId,
    signature,
  });
  expect(ok).toBe(true);
});

test("verifyVoteSignature returns false when choice is tampered", async () => {
  const signature = await sign("for", account.address);
  const ok = await verifyVoteSignature({
    proposalId,
    choice: "against",
    voter: account.address,
    chainId,
    signature,
  });
  expect(ok).toBe(false);
});

test("verifyVoteSignature returns false for the wrong voter", async () => {
  const signature = await sign("for", account.address);
  const wrong = "0x0000000000000000000000000000000000000001" as const;
  const ok = await verifyVoteSignature({
    proposalId,
    choice: "for",
    voter: wrong,
    chainId,
    signature,
  });
  expect(ok).toBe(false);
});

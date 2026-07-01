import { verifyTypedData } from "viem";

/**
 * EIP-712 typed data for an off-chain, gasless governance vote.
 *
 * Domain: { name: "AeThree", version: "1", chainId } — no verifyingContract,
 * since votes are tallied off-chain against an ERC20Votes snapshot.
 */
export const VOTE_TYPES = {
  Vote: [
    { name: "proposalId", type: "string" },
    { name: "choice", type: "string" },
    { name: "voter", type: "address" },
  ],
} as const;

export type VoteMessage = {
  proposalId: string;
  choice: string;
  voter: `0x${string}`;
};

export function voteTypedData(args: {
  proposalId: string;
  choice: string;
  voter: `0x${string}`;
  chainId: number;
}) {
  return {
    domain: { name: "AeThree", version: "1", chainId: args.chainId },
    types: VOTE_TYPES,
    primaryType: "Vote" as const,
    message: {
      proposalId: args.proposalId,
      choice: args.choice,
      voter: args.voter,
    } satisfies VoteMessage,
  };
}

export async function verifyVoteSignature(args: {
  proposalId: string;
  choice: string;
  voter: `0x${string}`;
  chainId: number;
  signature: `0x${string}`;
}): Promise<boolean> {
  const td = voteTypedData(args);
  try {
    return await verifyTypedData({
      address: args.voter,
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message,
      signature: args.signature,
    });
  } catch {
    return false;
  }
}

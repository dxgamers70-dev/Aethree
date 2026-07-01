import { castVote } from "@/server/governance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type GetPastVotes = (args: { token: string; voter: string; block: bigint }) => Promise<bigint>;

export async function castVoteHandler(
  db: Db,
  proposalId: string,
  body: { voter?: string; choice?: string; signature?: string; chainId?: number },
  getPastVotes: GetPastVotes,
) {
  if (
    !body?.voter ||
    (body.choice !== "for" && body.choice !== "against") ||
    !body.signature ||
    !body.chainId
  ) {
    return { status: 400, body: { error: "voter, choice (for|against), signature and chainId are required" } };
  }

  try {
    const vote = await castVote(db, {
      proposalId,
      voter: body.voter as `0x${string}`,
      choice: body.choice,
      signature: body.signature as `0x${string}`,
      chainId: body.chainId,
      getPastVotes,
    });
    return { status: 201, body: vote };
  } catch (e) {
    const msg = (e as Error).message ?? "vote failed";
    if (/already voted/i.test(msg)) return { status: 409, body: { error: msg } };
    return { status: 400, body: { error: msg } };
  }
}

import { createProposal, listProposals, type ProposalRow } from "@/server/governance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** bigint columns are not JSON-serializable; emit snapshotBlock as a decimal string. */
function serialize(p: ProposalRow) {
  return { ...p, snapshotBlock: p.snapshotBlock.toString() };
}

export async function createProposalHandler(
  db: Db,
  agentId: string,
  body: { persona?: string; createdBy?: string; snapshotBlock?: string | number | bigint; deadline?: string },
) {
  if (!body?.persona?.trim()) {
    return { status: 400, body: { error: "persona is required" } };
  }
  try {
    const snapshotBlock = BigInt(body.snapshotBlock ?? 0);
    const deadline = body.deadline ? new Date(body.deadline) : new Date(Date.now() + ONE_DAY_MS);
    const proposal = await createProposal(db, {
      agentId,
      persona: body.persona,
      createdBy: body.createdBy ?? "",
      snapshotBlock,
      deadline,
    });
    return { status: 201, body: serialize(proposal) };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export async function listProposalsHandler(db: Db, agentId: string) {
  const rows = await listProposals(db, agentId);
  return { status: 200, body: rows.map(serialize) };
}

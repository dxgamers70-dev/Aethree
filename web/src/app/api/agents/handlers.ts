import { createAgentDraft, listAgents, type LlmConnection } from "@/server/agent-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function createAgentHandler(
  db: Db,
  body: {
    name?: string;
    persona?: string;
    skillFile?: string;
    avatarRef?: string;
    creatorAddr?: string;
    llm?: LlmConnection;
  },
) {
  const hasBehavior = !!body?.persona?.trim() || !!body?.skillFile?.trim();
  if (!body?.name?.trim() || !hasBehavior || !body?.avatarRef?.trim()) {
    return { status: 400, body: { error: "name, avatarRef, and a persona or skill file are required" } };
  }
  try {
    const result = await createAgentDraft(db, {
      name: body.name,
      persona: body.persona,
      skillFile: body.skillFile,
      avatarRef: body.avatarRef,
      creatorAddr: body.creatorAddr,
      llm: body.llm,
    });
    return { status: 201, body: result };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export async function listAgentsHandler(db: Db) {
  return { status: 200, body: await listAgents(db) };
}

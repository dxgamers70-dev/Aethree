import { desc, eq } from "drizzle-orm";
import { agents, agentConfigs } from "@/db/schema";
import { buildInitialConfig } from "@/lib/agent-config";
import { parseSkillFile } from "@/lib/skill-file";

export type LlmConnection = {
  provider: string; // "anthropic" | "openai-compatible"
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

// Accepts any Drizzle instance that exposes the query builder we use (neon at runtime, pglite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type AgentRow = typeof agents.$inferSelect;
export type AgentConfigRow = typeof agentConfigs.$inferSelect;

export async function createAgentDraft(
  db: Db,
  input: {
    name: string;
    persona?: string;
    skillFile?: string;
    avatarRef: string;
    creatorAddr?: string;
    llm?: LlmConnection;
  },
): Promise<{ agent: AgentRow; config: AgentConfigRow }> {
  const name = input.name.trim();
  if (!name) throw new Error("name must not be empty");

  // A skill file (if provided) defines behavior: its instructions body becomes
  // the persona/system prompt, with name/description kept as display metadata.
  let persona = input.persona ?? "";
  let skillName: string | null = null;
  let skillDescription: string | null = null;
  if (input.skillFile && input.skillFile.trim()) {
    const parsed = parseSkillFile(input.skillFile);
    persona = parsed.instructions;
    skillName = parsed.name || null;
    skillDescription = parsed.description || null;
  }

  const { core, version, hash } = buildInitialConfig({ persona, avatarRef: input.avatarRef });

  const [agent] = await db
    .insert(agents)
    .values({
      name,
      creatorAddr: input.creatorAddr ?? null,
      status: "draft",
      llmProvider: input.llm?.provider ?? null,
      llmBaseUrl: input.llm?.baseUrl ?? null,
      llmModel: input.llm?.model ?? null,
      llmApiKey: input.llm?.apiKey ?? null,
    })
    .returning();

  const [config] = await db
    .insert(agentConfigs)
    .values({
      agentId: agent.id,
      version,
      hash,
      persona: core.persona,
      skills: core.skills,
      policy: core.policy,
      voice: core.voice,
      avatarRef: core.avatarRef,
      skillName,
      skillDescription,
    })
    .returning();

  const [updated] = await db
    .update(agents)
    .set({ currentConfigId: config.id })
    .where(eq(agents.id, agent.id))
    .returning();

  return { agent: updated, config };
}

export async function getAgent(db: Db, id: string): Promise<AgentRow | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ?? null;
}

export async function listAgents(db: Db): Promise<AgentRow[]> {
  return db.select().from(agents).orderBy(desc(agents.createdAt));
}

export type ShowcaseAgent = {
  id: string;
  name: string;
  status: string;
  avatarRef: string | null;
  tokenAddress: string | null;
  saleAddress: string | null;
  createdAt: Date;
};

/** Agents joined to their current config so callers get the avatar GLB path in one query.
 * Powers the Playground (3D world) and Launchpad (token discovery). */
export async function listAgentShowcase(db: Db): Promise<ShowcaseAgent[]> {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      status: agents.status,
      tokenAddress: agents.tokenAddress,
      saleAddress: agents.saleAddress,
      createdAt: agents.createdAt,
      avatarRef: agentConfigs.avatarRef,
    })
    .from(agents)
    .leftJoin(agentConfigs, eq(agents.currentConfigId, agentConfigs.id))
    .orderBy(desc(agents.createdAt));
}

export async function getCurrentConfig(db: Db, agentId: string): Promise<AgentConfigRow | null> {
  const agent = await getAgent(db, agentId);
  if (!agent?.currentConfigId) return null;
  const [row] = await db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.id, agent.currentConfigId))
    .limit(1);
  return row ?? null;
}

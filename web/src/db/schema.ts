import { pgTable, uuid, text, integer, jsonb, timestamp, bigint, numeric, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  creatorAddr: text("creator_addr"),
  status: text("status").notNull().default("draft"),
  currentConfigId: uuid("current_config_id"),
  // Where the token was launched: "aetherd" (our bonding-curve launchpad) or "clanker".
  // Null while the agent is still a draft.
  launchVenue: text("launch_venue"),
  tokenAddress: text("token_address"),
  // Only set for the Aetherd venue; Clanker launches leave sale/avatar null.
  saleAddress: text("sale_address"),
  avatarTokenId: bigint("avatar_token_id", { mode: "number" }),
  // Bring-your-own LLM connection. Kept OFF the content-addressed config (never
  // hashed or anchored on-chain) because it carries a secret + infra detail.
  // provider: "anthropic" | "openai-compatible".
  llmProvider: text("llm_provider"),
  llmBaseUrl: text("llm_base_url"),
  llmModel: text("llm_model"),
  llmApiKey: text("llm_api_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentConfigs = pgTable("agent_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  version: integer("version").notNull(),
  hash: text("hash").notNull(),
  persona: text("persona").notNull(),
  skills: jsonb("skills").notNull().default([]),
  policy: jsonb("policy").notNull().default({}),
  voice: text("voice").notNull().default("default"),
  avatarRef: text("avatar_ref").notNull(),
  // Skill-file frontmatter (display metadata; the instructions body lives in `persona`).
  skillName: text("skill_name"),
  skillDescription: text("skill_description"),
  anchoredTx: text("anchored_tx"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// SIWE nonces / sessions. A nonce is issued, then consumed when a signature verifies,
// at which point address + expiry are set.
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  nonce: text("nonce").notNull().unique(),
  address: text("address"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// Governance proposals. Only `edit_persona` exists in this slice.
// Weights are token units (1e18-scaled) stored as exact numeric strings to avoid bigint overflow.
export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  type: text("type").notNull().default("edit_persona"),
  payload: jsonb("payload").notNull().default({}),
  snapshotBlock: bigint("snapshot_block", { mode: "bigint" }).notNull(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"), // active | passed | failed | executed
  createdBy: text("created_by").notNull(),
  forWeight: numeric("for_weight").notNull().default("0"),
  againstWeight: numeric("against_weight").notNull().default("0"),
  executedConfigId: uuid("executed_config_id"),
  executedTx: text("executed_tx"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id),
    voterAddr: text("voter_addr").notNull(),
    weight: numeric("weight").notNull(),
    choice: text("choice").notNull(), // for | against
    signature: text("signature").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("votes_proposal_voter_unique").on(t.proposalId, t.voterAddr)],
);

# AeTherD App Foundation + Agent Core (Plan 2 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the AeTherD web app — a degen-themed Next.js front end with a content-addressed Agent Core (config hashing + Neon/Drizzle persistence) and a working create-agent flow (gallery + wizard), with NO wallet/on-chain yet.

**Architecture:** Next.js App Router app in `web/`. Pure logic (canonical config hashing, config building) is framework-free and unit-tested with Vitest. Persistence uses Drizzle ORM over Neon Postgres at runtime and an in-memory `pglite` database in tests (the `agent-core` service takes a `db` handle, so the same code runs against both). The UI is a small reusable "degen" component kit (dark, neon, monospace numerics, ticker) driving a gallery (`/`) and a create wizard (`/create`) that writes a draft agent + its v1 config hash.

**Tech Stack:** Next.js (App Router) + React 19 + TypeScript + Tailwind CSS v4, pnpm; Drizzle ORM, `@neondatabase/serverless`, `@electric-sql/pglite`; viem (`keccak256`); Vitest + Testing Library.

---

## Conventions

- Package manager: **pnpm**. All commands run from `web/` unless stated.
- Path alias `@/*` → `web/src/*`.
- A draft agent has `status = 'draft'`, `tokenAddress = null`, `avatarTokenId = null`. Plan 3 flips these on launch.
- A config is **content-addressed**: `hash = keccak256(utf8Bytes(canonicalJSON(configCore)))` where `configCore` excludes db ids/timestamps.
- `agent-core` functions are pure-ish: they accept a Drizzle `db` instance as their first argument (dependency injection) so tests inject a pglite db.

## File structure

```
web/
  package.json, tsconfig.json, next.config.ts, postcss.config.mjs
  drizzle.config.ts
  vitest.config.ts
  .env.example
  src/
    app/
      layout.tsx                 # root layout, dark degen shell
      globals.css                # Tailwind v4 + degen theme tokens
      page.tsx                   # gallery "/"
      create/page.tsx            # create wizard
      agent/[id]/page.tsx        # agent detail shell (viewer/chat/trade come later)
      api/agents/route.ts        # POST create draft, GET list
      api/agents/[id]/route.ts   # GET one
    db/
      schema.ts                  # drizzle tables: agents, agentConfigs
      client.ts                  # runtime neon-http drizzle instance
    server/
      agent-core.ts              # createAgentDraft, listAgents, getAgent, getCurrentConfig
    lib/
      config-hash.ts             # canonicalJSON + hashConfig
      agent-config.ts            # AgentConfigCore type + buildInitialConfig
      avatars.ts                 # curated avatar set
    ui/
      Button.tsx, Panel.tsx, MonoNum.tsx, Ticker.tsx
    test/
      pglite-db.ts               # test helper: pglite + drizzle + apply migrations
  drizzle/                       # generated migration SQL (drizzle-kit generate)
```

Plan 3 adds wallet/SIWE, the launch tx (reading `contracts/out/aetherd-abis/`), and the three.js avatar viewer.

---

### Task 0: Scaffold the Next.js app + tooling

**Files:**
- Create: the `web/` project, `web/vitest.config.ts`, `web/.env.example`; modify `web/package.json` scripts.

- [ ] **Step 1: Scaffold with create-next-app (non-interactive)**

Run from repo root `/Users/samshow/Projects/aetherd`:
```bash
pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir --use-pnpm --import-alias "@/*" --turbopack
```
Expected: `web/` created, `pnpm install` runs, no prompts.

- [ ] **Step 2: Add runtime + dev dependencies**

```bash
cd web
pnpm add drizzle-orm @neondatabase/serverless viem
pnpm add -D drizzle-kit @electric-sql/pglite vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```
Expected: installs succeed.

- [ ] **Step 3: Write `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 4: Add scripts to `web/package.json`**

Merge into the `"scripts"` object:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate"
}
```

- [ ] **Step 5: Write `web/.env.example`**

```
# Neon Postgres connection string (runtime). Tests use in-memory pglite and do not need this.
DATABASE_URL=
```

- [ ] **Step 6: Verify the app builds and the (empty) test runner works**

```bash
cd web
pnpm build
pnpm test
```
Expected: `pnpm build` succeeds; `pnpm test` exits 0 ("No test files found" is OK at this point).

- [ ] **Step 7: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web
git commit -m "chore(web): scaffold Next.js app + Drizzle/Vitest/pglite tooling"
```

---

### Task 1: Degen design system (theme + base components)

**Files:**
- Modify: `web/src/app/globals.css`, `web/src/app/layout.tsx`
- Create: `web/src/ui/Button.tsx`, `web/src/ui/Panel.tsx`, `web/src/ui/MonoNum.tsx`, `web/src/ui/Ticker.tsx`
- Test: `web/src/ui/Button.test.tsx`

- [ ] **Step 1: Write the failing component test**

`web/src/ui/Button.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

test("renders label and applies neon variant class", () => {
  render(<Button>APE IN</Button>);
  const btn = screen.getByRole("button", { name: "APE IN" });
  expect(btn).toBeInTheDocument();
  expect(btn.className).toMatch(/bg-acid/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd web && pnpm test src/ui/Button.test.tsx`
Expected: FAIL — cannot find `./Button`.

- [ ] **Step 3: Write the degen theme tokens**

Replace `web/src/app/globals.css` with:
```css
@import "tailwindcss";

@theme {
  --color-void: #07080d;
  --color-panel: #0e1018;
  --color-acid: #b6ff2e;       /* acid green */
  --color-volt: #8a5cff;       /* electric purple */
  --color-ink: #e7e9ee;
  --color-muted: #8b90a0;
  --font-mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", monospace;
}

html, body {
  background: var(--color-void);
  color: var(--color-ink);
}

.glow-acid { box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-acid) 60%, transparent), 0 0 24px -4px var(--color-acid); }
.glow-volt { box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-volt) 60%, transparent), 0 0 24px -4px var(--color-volt); }
```

- [ ] **Step 4: Write the base components**

`web/src/ui/Button.tsx`:
```tsx
import { ButtonHTMLAttributes } from "react";

type Variant = "acid" | "volt" | "ghost";
const styles: Record<Variant, string> = {
  acid: "bg-acid text-void glow-acid hover:brightness-110",
  volt: "bg-volt text-ink glow-volt hover:brightness-110",
  ghost: "bg-transparent text-ink border border-muted/40 hover:border-acid",
};

export function Button({
  variant = "acid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wide text-sm transition ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
```

`web/src/ui/Panel.tsx`:
```tsx
import { HTMLAttributes } from "react";

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-panel border border-muted/15 rounded-2xl p-5 ${className}`}
      {...props}
    />
  );
}
```

`web/src/ui/MonoNum.tsx`:
```tsx
export function MonoNum({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono tabular-nums text-acid ${className}`}>{children}</span>;
}
```

`web/src/ui/Ticker.tsx`:
```tsx
export function Ticker({ items }: { items: string[] }) {
  const row = items.length ? items : ["no launches yet — be the first to deploy an agent"];
  return (
    <div className="overflow-hidden border-y border-muted/15 bg-panel/60">
      <div className="flex gap-8 whitespace-nowrap py-2 animate-[scroll_30s_linear_infinite] font-mono text-xs text-muted">
        {row.concat(row).map((t, i) => (
          <span key={i} className="uppercase tracking-wider">▸ {t}</span>
        ))}
      </div>
    </div>
  );
}
```

Append the keyframes to `web/src/app/globals.css`:
```css
@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd web && pnpm test src/ui/Button.test.tsx`
Expected: PASS.

- [ ] **Step 6: Set the dark degen root layout**

Replace `web/src/app/layout.tsx` body with a minimal dark shell (keep the generated font setup if present):
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeTherD — own the agent",
  description: "Launch an AI agent, give it a 3D face, and let holders govern it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web/src
git commit -m "feat(web): degen design system (theme tokens + base components)"
```

---

### Task 2: Content-addressed config hashing

**Files:**
- Create: `web/src/lib/config-hash.ts`
- Test: `web/src/lib/config-hash.test.ts`

- [ ] **Step 1: Write the failing test**

`web/src/lib/config-hash.test.ts`:
```ts
import { canonicalJSON, hashConfig } from "./config-hash";

test("canonicalJSON sorts keys deeply and is order-independent", () => {
  const a = canonicalJSON({ b: 1, a: { d: 4, c: 3 } });
  const b = canonicalJSON({ a: { c: 3, d: 4 }, b: 1 });
  expect(a).toBe(b);
  expect(a).toBe('{"a":{"c":3,"d":4},"b":1}');
});

test("hashConfig is deterministic and 0x-prefixed keccak256", () => {
  const h1 = hashConfig({ persona: "gm", skills: [], policy: {}, voice: "default", avatarRef: "av1" });
  const h2 = hashConfig({ avatarRef: "av1", voice: "default", policy: {}, skills: [], persona: "gm" });
  expect(h1).toBe(h2);
  expect(h1).toMatch(/^0x[0-9a-f]{64}$/);
});

test("different persona => different hash", () => {
  const base = { persona: "gm", skills: [], policy: {}, voice: "default", avatarRef: "av1" };
  expect(hashConfig(base)).not.toBe(hashConfig({ ...base, persona: "wagmi" }));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd web && pnpm test src/lib/config-hash.test.ts`
Expected: FAIL — cannot find `./config-hash`.

- [ ] **Step 3: Write the implementation**

`web/src/lib/config-hash.ts`:
```ts
import { keccak256, toBytes } from "viem";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export function canonicalJSON(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(",")}}`;
}

export function hashConfig(configCore: Record<string, Json>): `0x${string}` {
  return keccak256(toBytes(canonicalJSON(configCore)));
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd web && pnpm test src/lib/config-hash.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web/src/lib/config-hash.ts web/src/lib/config-hash.test.ts
git commit -m "feat(web): deterministic content-addressed config hashing"
```

---

### Task 3: Agent config builder

**Files:**
- Create: `web/src/lib/agent-config.ts`
- Test: `web/src/lib/agent-config.test.ts`

- [ ] **Step 1: Write the failing test**

`web/src/lib/agent-config.test.ts`:
```ts
import { buildInitialConfig } from "./agent-config";
import { hashConfig } from "./config-hash";

test("buildInitialConfig produces v1 core with defaults and a matching hash", () => {
  const { core, version, hash } = buildInitialConfig({ persona: "gm fren", avatarRef: "av-cyber" });
  expect(version).toBe(1);
  expect(core).toEqual({
    persona: "gm fren",
    skills: [],
    policy: {},
    voice: "default",
    avatarRef: "av-cyber",
  });
  expect(hash).toBe(hashConfig(core));
});

test("trims persona and rejects empty", () => {
  expect(() => buildInitialConfig({ persona: "   ", avatarRef: "av-cyber" })).toThrow(/persona/i);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd web && pnpm test src/lib/agent-config.test.ts`
Expected: FAIL — cannot find `./agent-config`.

- [ ] **Step 3: Write the implementation**

`web/src/lib/agent-config.ts`:
```ts
import { hashConfig } from "./config-hash";

export type AgentConfigCore = {
  persona: string;
  skills: string[];
  policy: Record<string, never>;
  voice: string;
  avatarRef: string;
};

export function buildInitialConfig(input: { persona: string; avatarRef: string }): {
  core: AgentConfigCore;
  version: number;
  hash: `0x${string}`;
} {
  const persona = input.persona.trim();
  if (!persona) throw new Error("persona must not be empty");
  const core: AgentConfigCore = {
    persona,
    skills: [],
    policy: {},
    voice: "default",
    avatarRef: input.avatarRef,
  };
  return { core, version: 1, hash: hashConfig(core) };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd web && pnpm test src/lib/agent-config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web/src/lib/agent-config.ts web/src/lib/agent-config.test.ts
git commit -m "feat(web): initial agent config builder (v1)"
```

---

### Task 4: Drizzle schema + Agent Core service (pglite-tested)

**Files:**
- Create: `web/src/db/schema.ts`, `web/src/db/client.ts`, `web/drizzle.config.ts`, `web/src/test/pglite-db.ts`, `web/src/server/agent-core.ts`
- Test: `web/src/server/agent-core.test.ts`
- Generated: `web/drizzle/0000_*.sql`

- [ ] **Step 1: Write the Drizzle schema**

`web/src/db/schema.ts`:
```ts
import { pgTable, uuid, text, integer, jsonb, timestamp, bigint } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  creatorAddr: text("creator_addr"),
  status: text("status").notNull().default("draft"),
  currentConfigId: uuid("current_config_id"),
  tokenAddress: text("token_address"),
  saleAddress: text("sale_address"),
  avatarTokenId: bigint("avatar_token_id", { mode: "number" }),
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
  anchoredTx: text("anchored_tx"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Write `web/drizzle.config.ts` and generate the migration**

`web/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
```

Run: `cd web && pnpm db:generate`
Expected: creates `web/drizzle/0000_*.sql` with `CREATE TABLE` statements for both tables.

- [ ] **Step 3: Write the pglite test harness**

`web/src/test/pglite-db.ts`:
```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "@/db/schema";

export async function makeTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8").replace(/--> statement-breakpoint/g, "");
    await client.exec(sql);
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof makeTestDb>>;
```

- [ ] **Step 4: Write the failing agent-core test**

`web/src/server/agent-core.test.ts`:
```ts
import { makeTestDb } from "@/test/pglite-db";
import { createAgentDraft, getAgent, listAgents, getCurrentConfig } from "./agent-core";

test("createAgentDraft writes agent + v1 config and links currentConfigId", async () => {
  const db = await makeTestDb();
  const { agent, config } = await createAgentDraft(db, {
    name: "Degen Oracle",
    persona: "gm, I call tops",
    avatarRef: "av-cyber",
  });

  expect(agent.status).toBe("draft");
  expect(agent.currentConfigId).toBe(config.id);
  expect(config.version).toBe(1);
  expect(config.hash).toMatch(/^0x[0-9a-f]{64}$/);

  const fetched = await getAgent(db, agent.id);
  expect(fetched?.name).toBe("Degen Oracle");

  const current = await getCurrentConfig(db, agent.id);
  expect(current?.persona).toBe("gm, I call tops");
});

test("listAgents returns created agents newest-first", async () => {
  const db = await makeTestDb();
  await createAgentDraft(db, { name: "A", persona: "a", avatarRef: "av-cyber" });
  await createAgentDraft(db, { name: "B", persona: "b", avatarRef: "av-neon" });
  const all = await listAgents(db);
  expect(all.map((a) => a.name)).toContain("A");
  expect(all.length).toBe(2);
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `cd web && pnpm test src/server/agent-core.test.ts`
Expected: FAIL — cannot find `./agent-core`.

- [ ] **Step 6: Write the agent-core service**

`web/src/server/agent-core.ts`:
```ts
import { desc, eq } from "drizzle-orm";
import { agents, agentConfigs } from "@/db/schema";
import { buildInitialConfig } from "@/lib/agent-config";

// Accepts any Drizzle instance that exposes the query builder we use (neon at runtime, pglite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function createAgentDraft(
  db: Db,
  input: { name: string; persona: string; avatarRef: string; creatorAddr?: string },
) {
  const name = input.name.trim();
  if (!name) throw new Error("name must not be empty");
  const { core, version, hash } = buildInitialConfig({ persona: input.persona, avatarRef: input.avatarRef });

  const [agent] = await db
    .insert(agents)
    .values({ name, creatorAddr: input.creatorAddr ?? null, status: "draft" })
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
    })
    .returning();

  const [updated] = await db
    .update(agents)
    .set({ currentConfigId: config.id })
    .where(eq(agents.id, agent.id))
    .returning();

  return { agent: updated, config };
}

export async function getAgent(db: Db, id: string) {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ?? null;
}

export async function listAgents(db: Db) {
  return db.select().from(agents).orderBy(desc(agents.createdAt));
}

export async function getCurrentConfig(db: Db, agentId: string) {
  const agent = await getAgent(db, agentId);
  if (!agent?.currentConfigId) return null;
  const [row] = await db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.id, agent.currentConfigId))
    .limit(1);
  return row ?? null;
}
```

- [ ] **Step 7: Write the runtime db client**

`web/src/db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _db = drizzle(neon(url), { schema });
  return _db;
}
```

- [ ] **Step 8: Run the test to confirm it passes**

Run: `cd web && pnpm test src/server/agent-core.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web/src/db web/src/server web/src/test web/drizzle web/drizzle.config.ts
git commit -m "feat(web): Drizzle schema + content-addressed Agent Core (pglite-tested)"
```

---

### Task 5: API routes for agents

**Files:**
- Create: `web/src/app/api/agents/route.ts`, `web/src/app/api/agents/[id]/route.ts`
- Test: `web/src/app/api/agents/route.test.ts`

- [ ] **Step 1: Write the failing test (handler-level, with an injected pglite db)**

Refactor note: the routes call `getDb()`, but to test without Neon we expose the handler logic as a pure function. Create the test first.

`web/src/app/api/agents/route.test.ts`:
```ts
import { makeTestDb } from "@/test/pglite-db";
import { createAgentHandler, listAgentsHandler } from "./handlers";

test("createAgentHandler validates and returns 201 with agent + config", async () => {
  const db = await makeTestDb();
  const res = await createAgentHandler(db, { name: "Oracle", persona: "gm", avatarRef: "av-cyber" });
  expect(res.status).toBe(201);
  expect(res.body.agent.name).toBe("Oracle");
  expect(res.body.config.hash).toMatch(/^0x[0-9a-f]{64}$/);
});

test("createAgentHandler returns 400 on empty persona", async () => {
  const db = await makeTestDb();
  const res = await createAgentHandler(db, { name: "Oracle", persona: "", avatarRef: "av-cyber" });
  expect(res.status).toBe(400);
});

test("listAgentsHandler returns array", async () => {
  const db = await makeTestDb();
  await createAgentHandler(db, { name: "A", persona: "a", avatarRef: "av-cyber" });
  const res = await listAgentsHandler(db);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(1);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd web && pnpm test src/app/api/agents/route.test.ts`
Expected: FAIL — cannot find `./handlers`.

- [ ] **Step 3: Write the handler logic (db-injectable, framework-free)**

`web/src/app/api/agents/handlers.ts`:
```ts
import { createAgentDraft, listAgents } from "@/server/agent-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function createAgentHandler(
  db: Db,
  body: { name?: string; persona?: string; avatarRef?: string; creatorAddr?: string },
) {
  if (!body?.name?.trim() || !body?.persona?.trim() || !body?.avatarRef?.trim()) {
    return { status: 400, body: { error: "name, persona and avatarRef are required" } };
  }
  try {
    const result = await createAgentDraft(db, {
      name: body.name,
      persona: body.persona,
      avatarRef: body.avatarRef,
      creatorAddr: body.creatorAddr,
    });
    return { status: 201, body: result };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export async function listAgentsHandler(db: Db) {
  return { status: 200, body: await listAgents(db) };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd web && pnpm test src/app/api/agents/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the Next route handlers to the runtime db**

`web/src/app/api/agents/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createAgentHandler, listAgentsHandler } from "./handlers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, body: payload } = await createAgentHandler(getDb(), body);
  return NextResponse.json(payload, { status });
}

export async function GET() {
  const { status, body } = await listAgentsHandler(getDb());
  return NextResponse.json(body, { status });
}
```

`web/src/app/api/agents/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAgent, getCurrentConfig } from "@/server/agent-core";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(getDb(), id);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  const config = await getCurrentConfig(getDb(), id);
  return NextResponse.json({ agent, config });
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web/src/app/api
git commit -m "feat(web): agent API routes (create draft, list, get) with injectable handlers"
```

---

### Task 6: Curated avatars + gallery + create wizard + agent shell

**Files:**
- Create: `web/src/lib/avatars.ts`
- Modify: `web/src/app/page.tsx`
- Create: `web/src/app/create/page.tsx`, `web/src/app/agent/[id]/page.tsx`
- Test: `web/src/lib/avatars.test.ts`

- [ ] **Step 1: Write the failing avatars test**

`web/src/lib/avatars.test.ts`:
```ts
import { AVATARS, getAvatar } from "./avatars";

test("curated avatar set is non-empty and ids are unique", () => {
  expect(AVATARS.length).toBeGreaterThanOrEqual(3);
  const ids = AVATARS.map((a) => a.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("getAvatar resolves by id and falls back to first", () => {
  expect(getAvatar(AVATARS[1].id).id).toBe(AVATARS[1].id);
  expect(getAvatar("nope").id).toBe(AVATARS[0].id);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd web && pnpm test src/lib/avatars.test.ts`
Expected: FAIL — cannot find `./avatars`.

- [ ] **Step 3: Write the curated avatar set**

`web/src/lib/avatars.ts`:
```ts
export type Avatar = { id: string; name: string; accent: "acid" | "volt"; emoji: string };

// Placeholder visuals for Plan 2 (emoji + accent). Plan 3 swaps in real rigged GLB refs.
export const AVATARS: Avatar[] = [
  { id: "av-cyber", name: "Cyber", accent: "acid", emoji: "🤖" },
  { id: "av-neon", name: "Neon", accent: "volt", emoji: "👾" },
  { id: "av-oracle", name: "Oracle", accent: "acid", emoji: "🔮" },
  { id: "av-degen", name: "Degen", accent: "volt", emoji: "🐸" },
];

export function getAvatar(id: string): Avatar {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd web && pnpm test src/lib/avatars.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the gallery page**

`web/src/app/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { Ticker } from "@/ui/Ticker";
import { getDb } from "@/db/client";
import { listAgents } from "@/server/agent-core";
import { getAvatar } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export default async function Gallery() {
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  try {
    agents = await listAgents(getDb());
  } catch {
    agents = []; // DATABASE_URL not set yet — render the empty degen state
  }

  return (
    <main className="max-w-5xl mx-auto px-5 pb-20">
      <header className="flex items-center justify-between py-6">
        <h1 className="text-2xl font-black tracking-tight">
          AeTher<span className="text-acid">D</span>
        </h1>
        <Link href="/create"><Button>+ Deploy agent</Button></Link>
      </header>

      <Ticker items={agents.map((a) => `${a.name} — ${a.status}`)} />

      <section className="grid gap-4 sm:grid-cols-2 mt-8">
        {agents.length === 0 && (
          <Panel className="sm:col-span-2 text-center text-muted">
            No agents yet. <Link href="/create" className="text-acid underline">Deploy the first one →</Link>
          </Panel>
        )}
        {agents.map((a) => {
          const av = getAvatar("av-cyber");
          return (
            <Link key={a.id} href={`/agent/${a.id}`}>
              <Panel className="hover:border-acid/60 transition">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{av.emoji}</div>
                  <div>
                    <div className="font-bold">{a.name}</div>
                    <div className="text-xs font-mono uppercase text-muted">{a.status}</div>
                  </div>
                </div>
              </Panel>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Write the create wizard**

`web/src/app/create/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { AVATARS } from "@/lib/avatars";

export default function Create() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [avatarRef, setAvatarRef] = useState(AVATARS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, persona, avatarRef }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "failed");
      setBusy(false);
      return;
    }
    const { agent } = await res.json();
    router.push(`/agent/${agent.id}`);
  }

  return (
    <main className="max-w-xl mx-auto px-5 py-10">
      <h1 className="text-2xl font-black mb-6">Deploy an <span className="text-acid">agent</span></h1>
      <Panel className="space-y-5">
        <label className="block">
          <span className="text-xs uppercase font-mono text-muted">Name</span>
          <input className="mt-1 w-full bg-void border border-muted/30 rounded-xl px-3 py-2"
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Degen Oracle" />
        </label>
        <label className="block">
          <span className="text-xs uppercase font-mono text-muted">Persona (system prompt)</span>
          <textarea className="mt-1 w-full bg-void border border-muted/30 rounded-xl px-3 py-2 h-28"
            value={persona} onChange={(e) => setPersona(e.target.value)}
            placeholder="You are a chaotic-good crypto oracle who..." />
        </label>
        <div>
          <span className="text-xs uppercase font-mono text-muted">Avatar</span>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {AVATARS.map((a) => (
              <button key={a.id} onClick={() => setAvatarRef(a.id)}
                className={`rounded-xl py-3 text-2xl border ${avatarRef === a.id ? "border-acid glow-acid" : "border-muted/20"}`}>
                {a.emoji}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? "deploying…" : "Deploy agent"}
        </Button>
      </Panel>
    </main>
  );
}
```

- [ ] **Step 7: Write the agent detail shell**

`web/src/app/agent/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/ui/Panel";
import { MonoNum } from "@/ui/MonoNum";
import { getDb } from "@/db/client";
import { getAgent, getCurrentConfig } from "@/server/agent-core";
import { getAvatar } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(getDb(), id).catch(() => null);
  if (!agent) notFound();
  const config = await getCurrentConfig(getDb(), id);
  const av = getAvatar(config?.avatarRef ?? "av-cyber");

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <Link href="/" className="text-xs font-mono text-muted">← all agents</Link>
      <div className="flex items-center gap-4 mt-4">
        <div className="text-6xl">{av.emoji}</div>
        <div>
          <h1 className="text-2xl font-black">{agent.name}</h1>
          <div className="text-xs font-mono uppercase text-muted">{agent.status}</div>
        </div>
      </div>

      <Panel className="mt-6">
        <div className="text-xs uppercase font-mono text-muted mb-1">Persona</div>
        <p className="whitespace-pre-wrap">{config?.persona}</p>
      </Panel>

      <Panel className="mt-4">
        <div className="text-xs uppercase font-mono text-muted mb-1">Config hash (v{config?.version})</div>
        <MonoNum className="break-all text-xs">{config?.hash}</MonoNum>
        <p className="text-xs text-muted mt-3">
          3D avatar, token launch, and governance land in the next slice. This hash is what a passing
          governance vote will re-anchor on-chain.
        </p>
      </Panel>
    </main>
  );
}
```

- [ ] **Step 8: Run the full test suite + build**

Run: `cd web && pnpm test && pnpm build`
Expected: all Vitest tests pass; `pnpm build` succeeds (pages compile). Note: build does not require DATABASE_URL because pages catch the missing-db error and render empty/degen states.

- [ ] **Step 9: Commit**

```bash
cd /Users/samshow/Projects/aetherd
git add web/src
git commit -m "feat(web): curated avatars + gallery, create wizard, agent shell"
```

---

## Self-Review

**Spec coverage (design spec §3 Frontend/Backend/Storage, §4 data model, plus the degen direction):**
- Next.js App Router on Vercel, pages `/`, `/create`, `/agent/[id]` → Tasks 1, 6. ✔
- Agent Core: content-addressed config versioning, "current config" by agentId → Tasks 2, 3, 4. ✔
- Neon Postgres `agents` + `agent_configs` matching the spec columns → Task 4 schema (`current_config_id`, `token_address`, `sale_address`, `avatar_token_id`, `anchored_tx`, content-addressed `hash`). ✔
- Backend route handlers (create/list/get) → Task 5. ✔
- Degen visual direction (dark, neon acid/volt, monospace numerics, ticker, chunky buttons, Tailwind kit) → Task 1 + used throughout 6. ✔
- Deferred to Plan 3 (per spec slice ordering), called out in the agent shell copy: wallet/SIWE, on-chain launch (token_address/avatar_token_id stay null), three.js viewer, chat runtime, trade panel. ✔
- Proposals/votes tables: deferred to Plan 4 (governance) — not in this plan's scope. ✔

**Placeholder scan:** Avatars use emoji placeholders **intentionally and labeled** (Plan 3 swaps real GLB refs). The empty `DATABASE_URL` in `.env.example` is intentional (provided at deploy or via Neon provisioning during execution). No "TODO/handle later" code steps; every step shows complete source.

**Type consistency:** `buildInitialConfig({persona, avatarRef}) → {core, version, hash}` is identical in `agent-config.ts`, its test, and `agent-core.ts`. `AgentConfigCore` fields (`persona/skills/policy/voice/avatarRef`) match the `agentConfigs` table columns and the `hashConfig` input. `createAgentDraft(db, {name, persona, avatarRef, creatorAddr?}) → {agent, config}` matches between service, its test, the handler, and the route. `createAgentHandler`/`listAgentsHandler` signatures match between `handlers.ts`, the route test, and `route.ts`. The injected-`db` pattern (service + handlers take `db`) is consistent so pglite (tests) and neon (runtime) both work.

> Execution note: `pnpm db:generate` (Task 4 Step 2) must run before the agent-core test, because the pglite harness applies the generated SQL. If `create-next-app` flag names have drifted in the installed version, adjust Task 0 Step 1 flags to the nearest equivalents (TypeScript, Tailwind, App Router, src dir, pnpm, `@/*` alias) — the rest of the plan is unaffected.

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

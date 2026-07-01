import { getDb } from "@/db/client";
import { listAgentShowcase } from "@/server/agent-core";
import { LaunchpadClient } from "@/ui/LaunchpadClient";

export const dynamic = "force-dynamic";

export default async function LaunchpadPage() {
  let agents = [] as Awaited<ReturnType<typeof listAgentShowcase>>;
  try {
    agents = await listAgentShowcase(getDb());
  } catch {
    agents = [];
  }
  return <LaunchpadClient agents={agents} />;
}

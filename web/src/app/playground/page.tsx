import { getDb } from "@/db/client";
import { listAgentShowcase } from "@/server/agent-core";
import { resolveAvatarUrl } from "@/lib/avatars";
import PlaygroundViewer from "@/ui/PlaygroundViewer";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  let rows: Awaited<ReturnType<typeof listAgentShowcase>> = [];
  try {
    rows = await listAgentShowcase(getDb());
  } catch {
    rows = [];
  }

  const agents = rows.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    // Legacy/curated refs (e.g. "av-oracle") aren't GLB paths — fall back to a real model.
    avatar: resolveAvatarUrl(a.avatarRef),
  }));

  return <PlaygroundViewer agents={agents} />;
}

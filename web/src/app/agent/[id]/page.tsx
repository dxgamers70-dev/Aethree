import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/ui/Panel";
import { MonoNum } from "@/ui/MonoNum";
import AvatarViewer from "@/ui/AvatarViewer";
import { LaunchPanel } from "@/ui/LaunchPanel";
import { TradePanel } from "@/ui/TradePanel";
import { ClankerTokenPanel } from "@/ui/ClankerTokenPanel";
import { ChatBox } from "@/ui/ChatBox";
import { GovernancePanel } from "@/ui/GovernancePanel";
import { getDb } from "@/db/client";
import { getAgent, getCurrentConfig } from "@/server/agent-core";
import { resolveAvatarUrl, getModel } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(getDb(), id).catch(() => null);
  if (!agent) notFound();
  const config = await getCurrentConfig(getDb(), id);
  const avatarUrl = resolveAvatarUrl(config?.avatarRef);

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <Link href="/" className="text-xs font-mono text-muted">← all agents</Link>

      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <Panel className="p-0 overflow-hidden glow-acid">
          <AvatarViewer url={avatarUrl} className="h-[460px] w-full" />
          <div className="px-5 py-3 border-t border-muted/15 font-mono text-xs uppercase text-muted">
            {getModel(avatarUrl)?.name ?? "avatar"} · drag to orbit
          </div>
        </Panel>

        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-black">{agent.name}</h1>
            <div className="text-xs font-mono uppercase text-muted mt-1">{agent.status}</div>
          </div>

          {(config?.skillName || config?.skillDescription) && (
            <Panel>
              <div className="text-xs uppercase font-mono text-muted mb-1">Skill</div>
              <div className="text-sm font-bold">{config?.skillName || "unnamed skill"}</div>
              {config?.skillDescription && (
                <p className="text-sm text-muted mt-0.5">{config.skillDescription}</p>
              )}
            </Panel>
          )}

          <Panel>
            <div className="text-xs uppercase font-mono text-muted mb-1">Persona</div>
            <p className="whitespace-pre-wrap text-sm">{config?.persona}</p>
          </Panel>

          <Panel>
            <div className="text-xs uppercase font-mono text-muted mb-1">Config hash · v{config?.version}</div>
            <MonoNum className="break-all text-xs">{config?.hash}</MonoNum>
          </Panel>

          <LaunchPanel
            agentId={agent.id}
            name={agent.name}
            configHash={config?.hash ?? "0x"}
            status={agent.status}
            avatarUrl={avatarUrl}
          />

          {/* Aetherd launches trade on the in-app bonding curve; Clanker launches link out. */}
          {agent.status === "launched" && agent.saleAddress && agent.tokenAddress && (
            <TradePanel saleAddress={agent.saleAddress} tokenAddress={agent.tokenAddress} />
          )}
          {agent.launchVenue === "clanker" && agent.tokenAddress && (
            <ClankerTokenPanel tokenAddress={agent.tokenAddress} />
          )}

          {/* Governance is token-weighted on the ERC20Votes token; Clanker tokens don't have it. */}
          {agent.launchVenue !== "clanker" && (
            <GovernancePanel agentId={agent.id} tokenAddress={agent.tokenAddress} />
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase font-mono text-muted mb-2">Chat with {agent.name}</div>
        <ChatBox agentId={agent.id} />
      </div>
    </main>
  );
}

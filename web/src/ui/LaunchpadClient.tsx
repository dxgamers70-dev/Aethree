"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { abis } from "@/lib/contracts";
import { MODELS } from "@/lib/avatars";
import type { ShowcaseAgent } from "@/server/agent-core";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { MonoNum } from "@/ui/MonoNum";
import { deriveSymbol } from "@/ui/LaunchPanel";

/** Pick an emoji for an agent from its avatar GLB path; fall back to a coin. */
function emojiFor(avatarRef: string | null): string {
  return MODELS.find((m) => m.url === avatarRef)?.emoji ?? "🪙";
}

function TokenCard({
  id,
  name,
  saleAddress,
  emoji,
}: {
  id: string;
  name: string;
  saleAddress: string;
  emoji: string;
}) {
  const sale = saleAddress as `0x${string}`;

  const { data: price } = useReadContract({
    address: sale,
    abi: abis.BondingCurveSale,
    functionName: "costToBuy",
    args: [1n],
    query: { enabled: !!saleAddress },
  });

  const { data: sold } = useReadContract({
    address: sale,
    abi: abis.BondingCurveSale,
    functionName: "sold",
    query: { enabled: !!saleAddress },
  });

  return (
    <Panel className="flex flex-col gap-4 transition hover:border-acid/40">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-ink truncate">{name}</h3>
          <div className="text-xs font-mono uppercase tracking-wider text-acid">
            {deriveSymbol(name)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted uppercase font-mono">Price</div>
          <MonoNum>{price != null ? formatEther(price as bigint) : "—"}</MonoNum>
          <span className="text-muted font-mono"> ETH</span>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Sold</div>
          <MonoNum>{sold != null ? formatEther(sold as bigint) : "—"}</MonoNum>
        </div>
      </div>

      <Link href={`/agent/${id}`} className="mt-auto">
        <Button className="w-full">Trade →</Button>
      </Link>
    </Panel>
  );
}

export function LaunchpadClient({ agents }: { agents: ShowcaseAgent[] }) {
  const launched = agents.filter(
    (a) => a.status === "launched" && a.saleAddress && a.tokenAddress,
  );
  const drafts = agents.filter((a) => a.status !== "launched");

  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <Link href="/" className="text-xs font-mono uppercase tracking-wider text-muted hover:text-acid">
        ← AeThree
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">Launchpad</h1>
          <p className="max-w-xl text-sm text-muted">
            Launch and trade agent governance tokens on a bonding curve. Every agent ships an
            ERC20Votes token whose price rises as supply sells — buy early, delegate, and govern.
          </p>
        </div>
        <Link href="/create">
          <Button>+ Launch a token</Button>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Panel className="text-center">
          <div className="text-2xl font-bold text-ink">
            <MonoNum className="text-ink">{agents.length}</MonoNum>
          </div>
          <div className="mt-1 text-xs uppercase font-mono text-muted">Agents</div>
        </Panel>
        <Panel className="text-center">
          <div className="text-2xl font-bold">
            <MonoNum>{launched.length}</MonoNum>
          </div>
          <div className="mt-1 text-xs uppercase font-mono text-muted">Launched</div>
        </Panel>
        <Panel className="text-center">
          <div className="text-2xl font-bold">
            <MonoNum className="text-volt">{drafts.length}</MonoNum>
          </div>
          <div className="mt-1 text-xs uppercase font-mono text-muted">Drafts</div>
        </Panel>
      </div>

      {agents.length === 0 ? (
        <Panel className="mt-10 text-center">
          <p className="text-sm text-muted">No agents yet. Create one to launch its token.</p>
          <Link href="/create" className="mt-4 inline-block">
            <Button>+ Create an agent</Button>
          </Link>
        </Panel>
      ) : (
        <>
          <section className="mt-12">
            <h2 className="text-lg font-bold uppercase tracking-wide text-ink">Live tokens</h2>
            {launched.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No tokens launched yet.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {launched.map((a) => (
                  <TokenCard
                    key={a.id}
                    id={a.id}
                    name={a.name}
                    saleAddress={a.saleAddress as string}
                    emoji={emojiFor(a.avatarRef)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold uppercase tracking-wide text-muted">Awaiting launch</h2>
            {drafts.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Everything here is already live.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((a) => (
                  <Panel key={a.id} className="flex flex-col gap-4 opacity-90">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" aria-hidden>
                        {emojiFor(a.avatarRef)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-ink truncate">{a.name}</h3>
                        <span className="inline-block mt-1 rounded-md border border-volt/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-volt">
                          Draft
                        </span>
                      </div>
                    </div>
                    <Link href={`/agent/${a.id}`} className="mt-auto">
                      <Button variant="ghost" className="w-full">
                        Launch →
                      </Button>
                    </Link>
                  </Panel>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

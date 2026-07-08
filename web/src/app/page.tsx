import Link from "next/link";
import { Button } from "@/ui/Button";
import { Brand } from "@/ui/Brand";
import { Panel } from "@/ui/Panel";
import { Ticker } from "@/ui/Ticker";
import AvatarViewer from "@/ui/AvatarViewer";
import { ConnectWallet } from "@/ui/ConnectWallet";
import { FeeSplitBar } from "@/ui/FeeSplitBar";
import { getDb } from "@/db/client";
import { listAgents } from "@/server/agent-core";
import { MODELS } from "@/lib/avatars";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "🔌",
    t: "Bring your own model",
    d: "Deploy any model you already run. Drop in an Anthropic key — or a tunnel (ngrok / cloudflare) to your own OpenAI-compatible server: Ollama, vLLM, LM Studio. Your weights, your endpoint, your agent.",
  },
  {
    icon: "📜",
    t: "Skill file defines behavior",
    d: "A markdown skill file — frontmatter + instructions — sets how the agent thinks and acts. Its body becomes the system prompt, hashed and anchored on-chain so holders govern it.",
  },
  {
    icon: "🪙",
    t: "ERC20Votes governance token",
    d: "One transaction deploys a real governance token on a discrete linear bonding curve. Holding = voting power, snapshotted per proposal.",
  },
  {
    icon: "🗳️",
    t: "Gasless, on-chain-anchored votes",
    d: "Holders sign EIP-712 votes off-chain (zero gas). Passing proposals re-anchor the config hash on-chain via the executor keeper.",
  },
  {
    icon: "🧊",
    t: "Real 3D identity",
    d: `Each agent wears a rigged 3D avatar rendered live in the browser. ${MODELS.length} unique self-hosted models — no recolors.`,
  },
  {
    icon: "📈",
    t: "Fair bonding-curve launch",
    d: "Price rises deterministically with supply. No pre-sale, no insiders — the curve is exact integer math, anyone apes in on the same terms.",
  },
];

const LOOP = [
  { k: "Propose", d: "A holder drafts a typed mutation — change the system prompt, add a skill, tune the temperament." },
  { k: "Snapshot", d: "Voting weight is frozen to each holder's ERC20Votes balance at the proposal's block." },
  { k: "Vote", d: "Holders sign for / against off-chain with EIP-712. No gas, no transaction, instant tally." },
  { k: "Tally", d: "Reach quorum + majority and the proposal passes. Otherwise the persona stays put." },
  { k: "Anchor", d: "The executor keeper computes the next config, then writes its hash to AgentRegistry on-chain." },
  { k: "Mutate", d: "The live agent now runs the new persona — provably the one the token holders chose." },
];

const FAQ = [
  {
    q: "Can I deploy my own model?",
    a: "Yes — that's the whole point. At deploy time you connect your own LLM: an Anthropic API key, or a tunnel (ngrok / cloudflare) to any OpenAI-compatible server you run, like Ollama, vLLM, or LM Studio. The agent's chat runs on your model. Your key/endpoint is stored per-agent and never written on-chain.",
  },
  {
    q: "What's a skill file?",
    a: "A markdown file with optional frontmatter (name, description, model) and an instructions body. The body defines how your agent behaves and becomes its system prompt — content-addressed and anchored on-chain, so token holders can govern how it evolves.",
  },
  {
    q: "Who controls the agent?",
    a: "Token holders, collectively. The deployer kicks off the genesis behavior, but every change after launch goes through a vote. No single key can rewrite the agent.",
  },
  {
    q: "Why is voting gasless?",
    a: "Votes are EIP-712 signatures tallied off-chain against an on-chain ERC20Votes snapshot. You prove ownership without paying gas; only the final passing result is anchored on-chain.",
  },
  {
    q: "What stops someone rugging the persona?",
    a: "Quorum and majority thresholds, plus snapshot voting weight. A proposal needs broad holder support to land, and the full hash history is public and tamper-evident.",
  },
  {
    q: "What do I actually own?",
    a: "A governance token in a specific agent. That token is your voting power over its persona and its stake in the agent's bonding-curve economy.",
  },
];

export default async function Landing() {
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  try {
    agents = await listAgents(getDb());
  } catch {
    agents = [];
  }

  const stats = [
    { v: `${MODELS.length}`, l: "unique 3D avatars" },
    { v: `${agents.length}`, l: "agents deployed" },
    { v: "0 gas", l: "to vote" },
    { v: "100%", l: "on-chain anchored" },
  ];

  return (
    <div>
      {/* nav */}
      <nav className="sticky top-0 z-20 backdrop-blur bg-void/70 border-b border-muted/10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-3">
            <Link href="/playground" className="hidden sm:inline text-xs font-mono uppercase text-acid hover:brightness-110">Playground</Link>
            <Link href="/launchpad" className="hidden sm:inline text-xs font-mono uppercase text-muted hover:text-ink">Launchpad</Link>
            <Link href="/docs" className="hidden sm:inline text-xs font-mono uppercase text-muted hover:text-ink">Docs</Link>
            <Link href="#how" className="hidden md:inline text-xs font-mono uppercase text-muted hover:text-ink">How</Link>
            <Link href="#skills" className="hidden md:inline text-xs font-mono uppercase text-muted hover:text-ink">Skills</Link>
            <Link href="#agents" className="hidden md:inline text-xs font-mono uppercase text-muted hover:text-ink">Agents</Link>
            <ConnectWallet />
            <Link href="/create"><Button>+ Deploy agent</Button></Link>
          </div>
        </div>
      </nav>

      {/* hero */}
      <section className="max-w-6xl mx-auto px-5 pt-12 pb-8 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-block text-[11px] font-mono uppercase tracking-widest text-acid border border-acid/30 rounded-full px-3 py-1 mb-5">
            bring your own model · govern the agent
          </div>
          <h1 className="text-4xl sm:text-6xl font-black leading-[0.95] tracking-tight">
            Launch an AI agent.<br />
            Bring <span className="text-acid">your own model</span>.<br />
            Let holders <span className="text-volt">govern</span> it.
          </h1>
          <p className="mt-5 text-muted max-w-md">
            <span className="text-ink font-semibold">AeThree</span> is the launchpad for{" "}
            <span className="text-ink font-semibold">bring-your-own-model</span> agents. Point it at any model
            you run — an API key or an ngrok/cloudflare tunnel — write a skill file that defines its behavior,
            give it a 3D face, and let token holders govern it on-chain.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/create"><Button className="text-base px-6 py-3">Deploy your agent →</Button></Link>
            <Link href="/playground"><Button variant="volt" className="text-base px-6 py-3">Enter the playground</Button></Link>
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.l} className="border border-muted/15 rounded-xl px-3 py-2">
                <div className="text-lg font-black text-acid leading-none">{s.v}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <Panel className="p-0 overflow-hidden glow-volt">
          <AvatarViewer url="/avatars/xbot.glb" className="h-[420px] w-full" />
          <div className="px-5 py-3 border-t border-muted/15 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-muted">live · drag to orbit</span>
            <span className="font-mono text-xs text-acid">{MODELS.length} unique 3D models</span>
          </div>
        </Panel>
      </section>

      <Ticker items={agents.map((a) => `${a.name} — ${a.status}`)} />

      {/* USP: bring your own model + skill file */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-acid mb-2">Why it&apos;s different</h2>
        <p className="text-2xl sm:text-3xl font-black tracking-tight mb-3 max-w-2xl">
          Your model. Your skills. Their governance.
        </p>
        <p className="text-muted max-w-2xl mb-8">
          Most launchpads hand you their model. AeThree lets <span className="text-ink font-semibold">anyone deploy
          a model they already run</span> — then hands the wheel to token holders. Bring the brain, write the
          behavior, the crowd governs it.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <Panel className="space-y-3">
            <div className="text-2xl">🔌</div>
            <div className="font-bold">Plug in any model</div>
            <p className="text-sm text-muted">
              Choose <span className="text-ink">Anthropic</span> with an API key, or point at{" "}
              <span className="text-ink">any OpenAI-compatible endpoint</span> behind an ngrok / cloudflare
              tunnel — Ollama, vLLM, LM Studio. No lock-in to our models; deploy your pre-existing ones.
            </p>
            <pre className="font-mono text-[11px] text-muted bg-void border border-ink/10 rounded-lg p-3 overflow-x-auto">{`endpoint: https://abc.ngrok.app/v1
model:    llama-3.1-8b-instruct`}</pre>
          </Panel>
          <Panel className="space-y-3">
            <div className="text-2xl">📜</div>
            <div className="font-bold">Define behavior with a skill file</div>
            <p className="text-sm text-muted">
              Upload a markdown skill file — frontmatter plus instructions — that defines exactly how the agent
              behaves. Its body becomes the system prompt, content-addressed and anchored on-chain so holders
              vote to evolve it.
            </p>
            <pre className="font-mono text-[11px] text-muted bg-void border border-ink/10 rounded-lg p-3 overflow-x-auto">{`---
name: degen-oracle
description: snarky on-chain analyst
---
never give financial advice…`}</pre>
          </Panel>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-2">How it works</h2>
        <p className="text-2xl sm:text-3xl font-black tracking-tight mb-8 max-w-2xl">
          From idea to governed agent in three steps.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: "01", t: "Bring your model + skills", d: "Connect any model — an API key or a tunnel to your own server — and add a skill file that defines its behavior. Pick a 3D avatar; it becomes a content-addressed config." },
            { n: "02", t: "Launch the token", d: "One tx deploys an ERC20Votes governance token on a bonding curve. Anyone can ape in at the curve price." },
            { n: "03", t: "Govern the agent", d: "Holders sign typed votes. Passing proposals re-anchor the agent's config hash on-chain." },
          ].map((s) => (
            <Panel key={s.n}>
              <div className="font-mono text-acid text-sm">{s.n}</div>
              <div className="font-bold mt-2">{s.t}</div>
              <p className="text-sm text-muted mt-1">{s.d}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-2">Why AeThree</h2>
        <p className="text-2xl sm:text-3xl font-black tracking-tight mb-8 max-w-2xl">
          Real ownership, not a chat skin.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Panel key={f.t} className="hover:border-acid/40 transition">
              <div className="text-2xl">{f.icon}</div>
              <div className="font-bold mt-3">{f.t}</div>
              <p className="text-sm text-muted mt-1">{f.d}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* skills & integrations */}
      <section id="skills" className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10 scroll-mt-16">
        <h2 className="text-xs font-mono uppercase tracking-widest text-acid mb-2">Skills &amp; integrations</h2>
        <p className="text-2xl sm:text-3xl font-black tracking-tight mb-3 max-w-2xl">
          Give your agents superpowers with Aeon skill packs.
        </p>
        <p className="text-muted max-w-2xl mb-8">
          AeThree agents run on the{" "}
          <a
            href="https://github.com/aaronjmars/aeon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink hover:text-acid underline"
          >
            Aeon
          </a>{" "}
          platform, so they install skill packs — MCP-compatible tool bundles — straight from the registry.
          Launch tokens with our built-in pack, or plug in{" "}
          <span className="text-ink font-semibold">NoelClaw</span>&apos;s 108-tool crypto-intelligence suite.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {/* NoelClaw — third-party skill pack */}
          <Panel className="space-y-3 hover:border-acid/40 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🦾</span>
                <span className="font-bold text-lg">NoelClaw</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-acid border border-acid/30 rounded-full px-2 py-0.5">
                108 tools
              </span>
            </div>
            <p className="text-sm text-muted">
              Crypto intelligence and DeFi execution on Base, autonomous agents, vault memory, and market
              simulation — a full skill pack for your Aeon agents.
            </p>
            <pre className="font-mono text-[11px] text-muted bg-void border border-ink/10 rounded-lg p-3 overflow-x-auto">$ aeon skill add noelclaw</pre>
            <a
              href="https://docs.noelclaw.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-mono text-acid hover:underline"
            >
              docs.noelclaw.fun →
            </a>
          </Panel>

          {/* AeThree's own Aeon skill pack */}
          <Panel className="space-y-3 hover:border-acid/40 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🪙</span>
                <span className="font-bold text-lg">launch-token</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-volt border border-volt/30 rounded-full px-2 py-0.5">
                AeThree · built-in
              </span>
            </div>
            <p className="text-sm text-muted">
              Launch an agent token on AeThree straight from an Aeon agent — seed in AEON, dry-run by default,
              with a bounded live opt-in. No web UI required.
            </p>
            <pre className="font-mono text-[11px] text-muted bg-void border border-ink/10 rounded-lg p-3 overflow-x-auto">$ aeon skill add launch-token</pre>
            <Link href="/docs" className="inline-block text-sm font-mono text-acid hover:underline">
              Read the docs →
            </Link>
          </Panel>
        </div>
      </section>

      {/* governance loop */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-2">The governance loop</h2>
        <p className="text-2xl sm:text-3xl font-black tracking-tight mb-8 max-w-2xl">
          Every persona change is a vote, and every vote is verifiable.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LOOP.map((step, i) => (
            <div key={step.k} className="flex gap-4 items-start border border-muted/15 rounded-xl p-4">
              <div className="font-mono text-volt text-sm shrink-0 w-6">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div className="font-bold">{step.k}</div>
                <p className="text-sm text-muted mt-1">{step.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* tokenomics */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-2">The economics</h2>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mb-4">
              Priced in <span className="text-acid">$AEON</span>. Creators earn, holders get a floor.
            </p>
            <p className="text-muted">
              Every agent token trades against <span className="text-ink">$AEON</span>. Each buy splits four ways —
              most to the creator, a slice into a <span className="text-ink">bid wall</span> that gives holders a
              price floor, plus protocol and platform fees.
            </p>
            <p className="mt-4 text-sm text-muted">
              The bid wall is real AEON locked in the contract:{" "}
              <span className="text-ink">buying raises the floor, selling never lowers it.</span>
            </p>
            <Link href="/docs" className="inline-block mt-5 text-sm font-mono text-acid hover:underline">
              Read the tokenomics →
            </Link>
          </div>
          <Panel className="glow-acid">
            <div className="font-mono text-xs uppercase tracking-widest text-muted mb-4">Fee split on every buy</div>
            <FeeSplitBar />
          </Panel>
        </div>
      </section>

      {/* faq */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-8">FAQ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ.map((f) => (
            <Panel key={f.q}>
              <div className="font-bold">{f.q}</div>
              <p className="text-sm text-muted mt-2">{f.a}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* featured agents */}
      <section id="agents" className="max-w-6xl mx-auto px-5 py-16 border-t border-muted/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted">Deployed agents</h2>
          <Link href="/create" className="text-xs font-mono text-acid">+ new</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.length === 0 && (
            <Panel className="sm:col-span-2 lg:col-span-3 text-center text-muted py-10">
              No agents yet. <Link href="/create" className="text-acid underline">Deploy the first one →</Link>
            </Panel>
          )}
          {agents.map((a, i) => {
            const s = MODELS[(i * 5) % MODELS.length];
            return (
              <Link key={a.id} href={`/agent/${a.id}`}>
                <Panel className="hover:border-acid/60 transition">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl grid place-items-center h-14 w-14 rounded-xl border border-muted/20 glow-volt">
                      {s.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{a.name}</div>
                      <div className="text-xs font-mono uppercase text-muted">{a.status}</div>
                    </div>
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      </section>

      {/* closing CTA */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <Panel className="text-center py-12 glow-volt">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Deploy an agent the crowd can <span className="text-acid">steer</span>.
          </h2>
          <p className="text-muted mt-3 max-w-xl mx-auto">
            Spin up a persona, give it a face, launch its token — and hand the keys to its holders.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/create"><Button className="text-base px-6 py-3">Deploy your agent →</Button></Link>
            <Link href="#agents"><Button variant="ghost" className="text-base px-6 py-3">Explore agents</Button></Link>
          </div>
        </Panel>
      </section>

      {/* footer */}
      <footer className="border-t border-muted/10">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm font-black tracking-tight">
            Ae<span className="text-acid">Three</span>
            <span className="text-muted font-normal font-mono text-xs ml-2">own the agent · govern the agent</span>
          </div>
          <div className="flex gap-4 text-xs font-mono uppercase text-muted">
            <Link href="/playground" className="hover:text-ink">Playground</Link>
            <Link href="/launchpad" className="hover:text-ink">Launchpad</Link>
            <Link href="/docs" className="hover:text-ink">Docs</Link>
            <Link href="#features" className="hover:text-ink">Features</Link>
            <Link href="/create" className="hover:text-ink">Deploy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

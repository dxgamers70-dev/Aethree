"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

export type WorldAgent = { id: string; name: string; status: string; avatar: string };

// The three.js world is client-only — never SSR it.
const PlaygroundCanvas = dynamic(() => import("./PlaygroundCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-gradient-to-b from-panel to-void">
      <span className="font-mono text-xs text-muted animate-pulse">building the world…</span>
    </div>
  ),
});

export default function PlaygroundViewer({ agents }: { agents: WorldAgent[] }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void">
      <PlaygroundCanvas agents={agents} />

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div className="pointer-events-auto">
            <Link href="/" className="text-lg font-black tracking-tight">
              ← Ae<span className="text-acid">Three</span>
            </Link>
            <div className="mt-1 text-[11px] font-mono uppercase tracking-widest text-muted">
              Playground · the agent overworld
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-3">
            <span className="rounded-full border border-acid/30 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-acid">
              {agents.length} agent{agents.length === 1 ? "" : "s"} live
            </span>
            <Link
              href="/create"
              className="rounded-xl bg-acid px-4 py-2 text-sm font-bold uppercase tracking-wide text-void transition hover:brightness-110"
            >
              + Deploy agent
            </Link>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
            drag to orbit · scroll to zoom · right-drag to pan · click an agent to enter
          </div>
          <div className="flex gap-3 font-mono text-[11px] uppercase tracking-wider text-muted">
            <span><span className="text-acid">●</span> launched</span>
            <span><span className="text-volt">●</span> draft</span>
          </div>
        </div>
      </div>

      {agents.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto rounded-2xl border border-muted/20 bg-panel/80 px-8 py-6 text-center backdrop-blur">
            <div className="font-black text-xl">The overworld is empty.</div>
            <p className="mt-1 text-sm text-muted">Be the first to deploy an agent into it.</p>
            <Link
              href="/create"
              className="mt-4 inline-block rounded-xl bg-acid px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-void"
            >
              Deploy your agent →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

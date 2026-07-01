"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useSignTypedData } from "wagmi";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { MonoNum } from "@/ui/MonoNum";
import { voteTypedData } from "@/lib/eip712";

type Proposal = {
  id: string;
  type: string;
  payload: { persona?: string };
  status: "active" | "passed" | "failed" | "executed";
  deadline: string;
  forWeight: string;
  againstWeight: string;
};

export function GovernancePanel({
  agentId,
  tokenAddress,
}: {
  agentId: string;
  tokenAddress?: string | null;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [persona, setPersona] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/agents/${agentId}/proposals`);
    if (res.ok) setProposals(await res.json());
  }, [agentId]);

  useEffect(() => {
    // Fetch-on-mount: setState happens only after the awaited fetch resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const create = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!persona.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/agents/${agentId}/proposals`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ persona, createdBy: address ?? "" }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "failed to create proposal");
        setPersona("");
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [persona, agentId, address, load],
  );

  const vote = useCallback(
    async (proposalId: string, choice: "for" | "against") => {
      if (!address) {
        setError("connect a wallet to vote");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const td = voteTypedData({ proposalId, choice, voter: address, chainId });
        const signature = await signTypedDataAsync({
          domain: td.domain,
          types: td.types,
          primaryType: td.primaryType,
          message: td.message,
        });
        const res = await fetch(`/api/proposals/${proposalId}/votes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ voter: address, choice, signature, chainId }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "vote failed");
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [address, chainId, signTypedDataAsync, load],
  );

  const canVote = Boolean(tokenAddress);

  return (
    <Panel className="space-y-4">
      <div className="text-xs uppercase font-mono text-muted">Governance</div>

      {!canVote && (
        <p className="text-xs text-muted">
          No governance token yet — launch the token first to open proposals and voting.
        </p>
      )}

      {canVote && (
        <form onSubmit={create} className="space-y-2">
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="New persona to propose…"
            className="w-full bg-void border border-muted/30 rounded-xl p-3 text-sm font-mono min-h-24"
          />
          <Button type="submit" disabled={busy || !persona.trim()}>
            Propose
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

      <ul className="space-y-3">
        {proposals.map((p) => {
          const active = p.status === "active";
          return (
            <li key={p.id} className="border border-muted/15 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-muted">{p.type}</span>
                <span className="text-xs font-mono uppercase">{p.status}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{p.payload?.persona}</p>
              <div className="flex gap-3 text-xs font-mono">
                <span>for <MonoNum>{p.forWeight}</MonoNum></span>
                <span>against <MonoNum>{p.againstWeight}</MonoNum></span>
              </div>
              {active && canVote && (
                <div className="flex gap-2">
                  <Button
                    variant="acid"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => vote(p.id, "for")}
                  >
                    Vote For
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => vote(p.id, "against")}
                  >
                    Vote Against
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

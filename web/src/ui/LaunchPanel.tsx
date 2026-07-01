"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { abis, activeChainId, deployment } from "@/lib/contracts";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { MonoNum } from "@/ui/MonoNum";

/** Symbol = first 4 uppercased alphanumeric chars of the name. */
export function deriveSymbol(name: string): string {
  return (name.match(/[a-zA-Z0-9]/g) ?? []).join("").slice(0, 4).toUpperCase();
}

/** Returns true when `a` is the EVM zero address (case-insensitive). */
export function isZeroAddress(a: string): boolean {
  return /^0x0{40}$/i.test(a);
}

export function LaunchPanel({
  agentId,
  name,
  configHash,
  status,
}: {
  agentId: string;
  name: string;
  configHash: string;
  status: string;
}) {
  const { address, isConnected } = useAccount();
  // Pin every on-chain interaction to the chain the app targets (e.g. Base Sepolia),
  // not the wallet's ambient current chain. Without a chainId, usePublicClient() falls
  // back to the first configured chain (Anvil/foundry → http://127.0.0.1:8545), which
  // doesn't exist in prod and produces "Failed to fetch" during simulate.
  const targetChainId = activeChainId();
  const publicClient = usePublicClient({ chainId: targetChainId });
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Captured from simulateContract before the write so we can record the new addresses.
  const [pending, setPending] = useState<{ token: string; sale: string; onChainAgentId: bigint } | null>(
    null,
  );
  const [done, setDone] = useState(false);

  const [seed, setSeed] = useState("100000");
  const factoryAddr = deployment().AgentTokenFactory as `0x${string}`;
  const aeon = deployment().AEON as `0x${string}`;
  const launchUnavailable = isZeroAddress(factoryAddr);
  const { data: minSeed } = useReadContract({
    address: factoryAddr, abi: abis.AgentTokenFactory, functionName: "MIN_SEED",
  });
  const seedWei = useMemo(() => {
    try { return parseEther(seed || "0"); } catch { return 0n; }
  }, [seed]);
  const seedTooLow = minSeed != null && seedWei < (minSeed as bigint);

  const launch = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // The simulate uses the chain-pinned public client, but the wallet may still be on a
      // different network — switch it so the writes land on the chain we just simulated against.
      if (walletChainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      if (!address) throw new Error("Connect your wallet to launch.");

      const factory = factoryAddr;
      const args = [name, deriveSymbol(name), "ipfs://" + agentId, configHash as `0x${string}`, seedWei] as const;

      // The factory pulls the seed AEON from the creator via transferFrom, so approve first.
      // createAgent also mints the avatar to msg.sender, so the simulate must run AS the
      // connected account — without `account` viem simulates from 0x0 and the mint reverts
      // (ERC721InvalidReceiver), and without the allowance below it reverts on transferFrom.
      const approveHash = await writeContractAsync({
        chainId: targetChainId,
        address: aeon, abi: erc20Abi, functionName: "approve", args: [factory, seedWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });

      const sim = await publicClient!.simulateContract({
        account: address,
        address: factory,
        abi: abis.AgentTokenFactory,
        functionName: "createAgent",
        args,
      });
      const [onChainAgentId, token, sale] = sim.result as [bigint, string, string];
      setPending({ token, sale, onChainAgentId });

      await writeContractAsync({
        chainId: targetChainId,
        address: factory,
        abi: abis.AgentTokenFactory,
        functionName: "createAgent",
        args,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [agentId, name, configHash, publicClient, writeContractAsync, factoryAddr, aeon, seedWei, walletChainId, targetChainId, switchChainAsync, address]);

  // Once the tx confirms, persist the launch server-side.
  useEffect(() => {
    if (!confirmed || !pending || done) return;
    (async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/launch`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tokenAddress: pending.token,
            saleAddress: pending.sale,
            onChainAgentId: Number(pending.onChainAgentId),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "failed to record launch");
        setDone(true);
        location.reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }, [confirmed, pending, done, agentId]);

  if (status !== "draft") {
    return (
      <Panel className="space-y-3">
        <div className="text-xs uppercase font-mono text-muted">Governance token</div>
        <div className="text-sm font-bold text-acid uppercase tracking-wide">Launched</div>
        <p className="text-xs text-muted">
          This agent&apos;s ERC20Votes token and bonding-curve sale are live on-chain.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-3">
      <div className="text-xs uppercase font-mono text-muted">Governance token</div>
      {isConnected ? (
        <>
          {launchUnavailable ? (
            <p className="text-xs text-muted">Launching isn&apos;t available on this network yet.</p>
          ) : (
            <label className="block text-xs">
              <span className="text-muted uppercase font-mono">Seed floor (AEON)</span>
              <input
                aria-label="seed amount (AEON)"
                type="number"
                min="0"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="mt-1 w-full bg-void border border-muted/30 rounded-lg px-3 py-2 font-mono"
              />
              <span className="text-muted">
                Your AEON seeds the bid-wall floor. Minimum 100,000 AEON.
              </span>
            </label>
          )}
          <Button className="w-full" disabled={busy || confirming || seedTooLow || launchUnavailable} onClick={launch}>
            {busy || confirming ? "Launching…" : "Launch token"}
          </Button>
          <p className="text-xs text-muted">
            Deploys an ERC20Votes token + bonding-curve sale. Symbol{" "}
            <MonoNum>{deriveSymbol(name)}</MonoNum>.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">Connect a wallet to launch this token.</p>
      )}
      {error && <p className="text-xs text-red-400 break-all">{error}</p>}
    </Panel>
  );
}

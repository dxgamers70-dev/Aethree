"use client";

import { useCallback, useMemo, useState } from "react";
import { erc20Abi, formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { abis, deployment } from "@/lib/contracts";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { MonoNum } from "@/ui/MonoNum";

const WAD = 1_000_000_000_000_000_000n;
// Mirrors BondingCurveSale BPS constants.
const SPLIT = { creator: 7000n, wall: 1800n, treasury: 1000n, platform: 200n };
const BPS = 10_000n;

function fmt(v: bigint | undefined): string {
  return v != null ? formatEther(v) : "—";
}

export function TradePanel({
  saleAddress,
  tokenAddress,
}: {
  saleAddress: string;
  tokenAddress: string;
}) {
  const { address, isConnected } = useAccount();
  const sale = saleAddress as `0x${string}`;
  const token = tokenAddress as `0x${string}`;
  const aeon = deployment().AEON as `0x${string}`;

  const [amount, setAmount] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amountUnits = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? BigInt(Math.floor(n)) : 0n;
  }, [amount]);
  const amountWei = amountUnits * WAD;

  const { data: sold } = useReadContract({ address: sale, abi: abis.BondingCurveSale, functionName: "sold" });
  const { data: wall } = useReadContract({ address: sale, abi: abis.BondingCurveSale, functionName: "wall" });
  const { data: cost } = useReadContract({
    address: sale, abi: abis.BondingCurveSale, functionName: "costToBuy", args: [amountUnits],
  });
  const { data: sellQuote } = useReadContract({
    address: sale, abi: abis.BondingCurveSale, functionName: "quoteSell", args: [amountUnits],
  });
  const { data: tokenBal } = useReadContract({
    address: token, abi: abis.AgentToken, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const { data: aeonBal } = useReadContract({
    address: aeon, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const { data: aeonAllowance } = useReadContract({
    address: aeon, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, sale] : undefined, query: { enabled: !!address },
  });

  const costWei = (cost as bigint) ?? 0n;
  const fees = {
    creator: (costWei * SPLIT.creator) / BPS,
    wall: (costWei * SPLIT.wall) / BPS,
    treasury: (costWei * SPLIT.treasury) / BPS,
    platform: (costWei * SPLIT.platform) / BPS,
  };

  const { writeContractAsync, data: txHash } = useWriteContract();
  useWaitForTransactionReceipt({ hash: txHash });

  const buy = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Approve AEON for the sale if the current allowance is short, then buy.
      if (((aeonAllowance as bigint) ?? 0n) < costWei) {
        await writeContractAsync({
          address: aeon, abi: erc20Abi, functionName: "approve", args: [sale, costWei],
        });
      }
      await writeContractAsync({
        address: sale, abi: abis.BondingCurveSale, functionName: "buy", args: [amountUnits],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [writeContractAsync, aeon, sale, amountUnits, costWei, aeonAllowance]);

  const sell = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await writeContractAsync({
        address: token, abi: abis.AgentToken, functionName: "approve", args: [sale, amountWei],
      });
      await writeContractAsync({
        address: sale, abi: abis.BondingCurveSale, functionName: "sell", args: [amountUnits],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [writeContractAsync, token, sale, amountUnits, amountWei]);

  const delegate = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await writeContractAsync({
        address: token, abi: abis.AgentToken, functionName: "delegate", args: [address],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [writeContractAsync, token, address]);

  if (!isConnected) {
    return (
      <Panel className="space-y-2">
        <div className="text-xs uppercase font-mono text-muted">Trade</div>
        <p className="text-xs text-muted">Connect a wallet to trade this token in AEON.</p>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <div className="text-xs uppercase font-mono text-muted">Trade · AEON</div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted uppercase font-mono">Sold</div>
          <MonoNum>{sold != null ? formatEther((sold as bigint) * WAD) : "—"}</MonoNum>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Bid wall (AEON)</div>
          <MonoNum>{fmt(wall as bigint)}</MonoNum>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Your tokens</div>
          <MonoNum>{fmt(tokenBal as bigint)}</MonoNum>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Your AEON</div>
          <MonoNum>{fmt(aeonBal as bigint)}</MonoNum>
        </div>
      </div>

      <label className="block text-xs">
        <span className="text-muted uppercase font-mono">Amount (tokens)</span>
        <input
          aria-label="amount"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full bg-void border border-muted/30 rounded-lg px-3 py-2 font-mono"
        />
      </label>

      <div className="text-xs">
        <span className="text-muted uppercase font-mono">Cost </span>
        <MonoNum>
          <span data-testid="cost">{fmt(cost as bigint)}</span> AEON
        </MonoNum>
      </div>

      <div className="border border-muted/15 rounded-lg p-2 space-y-1 text-xs">
        <div className="text-muted uppercase font-mono">Fee split on buy</div>
        <div className="flex justify-between"><span>Creator 70%</span><MonoNum><span data-testid="fee-creator">{fmt(fees.creator)}</span></MonoNum></div>
        <div className="flex justify-between"><span>Bid wall 18%</span><MonoNum><span data-testid="fee-wall">{fmt(fees.wall)}</span></MonoNum></div>
        <div className="flex justify-between"><span>Treasury 10%</span><MonoNum><span data-testid="fee-treasury">{fmt(fees.treasury)}</span></MonoNum></div>
        <div className="flex justify-between"><span>Platform 2%</span><MonoNum><span data-testid="fee-platform">{fmt(fees.platform)}</span></MonoNum></div>
      </div>

      <div className="text-xs">
        <span className="text-muted uppercase font-mono">Sell at floor </span>
        <MonoNum>
          <span data-testid="sell-quote">{fmt(sellQuote as bigint)}</span> AEON
        </MonoNum>
      </div>

      <div className="flex gap-3">
        <Button
          className="flex-1"
          disabled={busy || amountUnits === 0n || (aeonBal != null && costWei > (aeonBal as bigint))}
          onClick={buy}
        >
          Buy
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          disabled={
            busy ||
            amountUnits === 0n ||
            (sold != null && amountUnits > (sold as bigint)) ||
            (tokenBal != null && amountWei > (tokenBal as bigint))
          }
          onClick={sell}
        >
          Sell
        </Button>
      </div>
      {aeonBal != null && costWei > (aeonBal as bigint) && amountUnits > 0n && (
        <p className="text-xs text-muted">Insufficient AEON</p>
      )}
      {tokenBal != null && amountWei > (tokenBal as bigint) && amountUnits > 0n && (
        <p className="text-xs text-muted">Insufficient balance</p>
      )}

      <div className="border-t border-muted/15 pt-3 space-y-2">
        <Button variant="volt" className="w-full" disabled={busy} onClick={delegate}>Delegate to self</Button>
        <p className="text-xs text-muted">
          ERC20Votes voting power stays at zero until you delegate — delegate to yourself to activate it.
        </p>
      </div>

      {error && <p className="text-xs text-red-400 break-all">{error}</p>}
    </Panel>
  );
}

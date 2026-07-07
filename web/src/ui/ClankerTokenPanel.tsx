import { Panel } from "@/ui/Panel";
import { MonoNum } from "@/ui/MonoNum";

/**
 * Shown for agents launched on Clanker. Their token is a plain ERC20 with a Uniswap pool
 * (no AEON bonding-curve sale), so trading and rewards live on Clanker / Uniswap rather than
 * in the in-app TradePanel.
 */
export function ClankerTokenPanel({ tokenAddress }: { tokenAddress: string }) {
  const clankerUrl = `https://www.clanker.world/clanker/${tokenAddress}`;
  const basescanUrl = `https://basescan.org/token/${tokenAddress}`;

  return (
    <Panel className="space-y-3">
      <div className="text-xs uppercase font-mono text-muted">Token · Clanker</div>
      <p className="text-xs text-muted">
        Launched on Clanker as a standard ERC20 with a Uniswap pool. Trade it and claim creator
        rewards on Clanker.
      </p>
      <div>
        <div className="text-muted uppercase font-mono text-xs">Token address</div>
        <MonoNum className="break-all text-xs">{tokenAddress}</MonoNum>
      </div>
      <div className="flex gap-3 text-xs">
        <a href={clankerUrl} target="_blank" rel="noreferrer" className="text-acid hover:underline">
          Trade on Clanker ↗
        </a>
        <a href={basescanUrl} target="_blank" rel="noreferrer" className="text-muted hover:underline">
          Basescan ↗
        </a>
      </div>
    </Panel>
  );
}

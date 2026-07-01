"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Button } from "@/ui/Button";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return (
      <Button onClick={() => connect({ connector: injected() })}>Connect Wallet</Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono text-acid">{truncate(address)}</span>
      <Button variant="ghost" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}

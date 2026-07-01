import { createConfig, http } from "wagmi";
import { foundry, baseSepolia, base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { activeChainId } from "@/lib/contracts";

const rpc = process.env.NEXT_PUBLIC_RPC_URL;

/**
 * wagmi config for the browser. We register the local Anvil chain, Base Sepolia, and Base
 * mainnet; the app targets whichever `activeChainId()` resolves to (default: Anvil 31337).
 */
export const wagmiConfig = createConfig({
  chains: [foundry, baseSepolia, base],
  connectors: [injected()],
  transports: {
    [foundry.id]: http(activeChainId() === foundry.id ? rpc : undefined),
    [baseSepolia.id]: http(activeChainId() === baseSepolia.id ? rpc : undefined),
    [base.id]: http(activeChainId() === base.id ? rpc : undefined),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

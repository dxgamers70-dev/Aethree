import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abis, activeChain, deployment, publicClient, rpcUrl } from "@/lib/contracts";
import type { Anchor } from "./executor";

/**
 * Build the real on-chain `anchor` fn. Uses the EXECUTOR private key (account[1], which holds
 * EXECUTOR_ROLE on the AgentRegistry) to call `setConfigHash`, then waits for the receipt.
 */
export function makeAnchor(): Anchor {
  return async ({ onChainAgentId, newHash }) => {
    const key = process.env.EXECUTOR_PRIVATE_KEY;
    if (!key) throw new Error("EXECUTOR_PRIVATE_KEY is not set");
    const account = privateKeyToAccount(key as `0x${string}`);

    const wallet = createWalletClient({
      account,
      chain: activeChain(),
      transport: http(rpcUrl()),
    });

    const tx = await wallet.writeContract({
      address: deployment().AgentRegistry as `0x${string}`,
      abi: abis.AgentRegistry,
      functionName: "setConfigHash",
      args: [onChainAgentId, newHash],
    });

    await publicClient().waitForTransactionReceipt({ hash: tx });
    return tx;
  };
}

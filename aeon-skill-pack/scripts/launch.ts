import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { parseInputs } from "./lib/inputs";
import { getDeployment } from "./lib/contracts";
import { runLaunch } from "./lib/run-launch";

function chainFor(chainId: number) {
  if (chainId === 8453) return base;
  if (chainId === 84532) return baseSepolia;
  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });
}

function jsonReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

async function main() {
  const pk = process.env.AETHREE_LAUNCHER_PRIVATE_KEY;
  if (!pk) throw new Error("AETHREE_LAUNCH_ERROR — AETHREE_LAUNCHER_PRIVATE_KEY not set");

  const inputs = parseInputs({
    var: process.argv.slice(2).join(" ") || process.env.AETHREE_VAR || "",
    env: process.env,
  });
  const deployment = getDeployment(inputs.chainId);

  const account = privateKeyToAccount(
    pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`),
  );
  const chain = chainFor(inputs.chainId);
  const rpcUrl = process.env.BASE_RPC_URL || (inputs.chainId === 8453 ? "https://mainnet.base.org" : undefined);
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const result = await runLaunch({
    clients: {
      publicClient: publicClient as any,
      walletClient: walletClient as any,
      account: { address: account.address },
    },
    deployment,
    inputs,
  });

  const basescan = inputs.chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  const out = {
    ...result,
    links: result.result
      ? {
          token: `${basescan}/token/${result.result.token}`,
          sale: `${basescan}/address/${result.result.sale}`,
          tx: `${basescan}/tx/${result.launchTx}`,
        }
      : undefined,
  };
  console.log(JSON.stringify(out, jsonReplacer, 2));
  console.log(
    result.mode === "dry-run"
      ? "AETHREE_LAUNCH_OK — dry-run only; re-run with 'execute:' to launch"
      : `AETHREE_LAUNCH_OK — launched ${result.result?.token}`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg.startsWith("AETHREE_LAUNCH_ERROR") ? msg : `AETHREE_LAUNCH_ERROR — ${msg}`);
  process.exit(1);
});

import { createPublicClient, http, type Abi } from "viem";
import { foundry, baseSepolia, base } from "viem/chains";

import AgentRegistryAbi from "./abis/AgentRegistry.json";
import AgentTokenFactoryAbi from "./abis/AgentTokenFactory.json";
import AgentTokenAbi from "./abis/AgentToken.json";
import BondingCurveSaleAbi from "./abis/BondingCurveSale.json";
import AvatarNFTAbi from "./abis/AvatarNFT.json";
import addressesLocal from "./abis/addresses.local.json";
import addressesSepolia from "./abis/addresses.base-sepolia.json";
import addressesMainnet from "./abis/addresses.base-mainnet.json";

export const abis = {
  AgentRegistry: AgentRegistryAbi as Abi,
  AgentTokenFactory: AgentTokenFactoryAbi as Abi,
  AgentToken: AgentTokenAbi as Abi,
  BondingCurveSale: BondingCurveSaleAbi as Abi,
  AvatarNFT: AvatarNFTAbi as Abi,
} as const;

export type Deployment = {
  chainId: number;
  AEON: string;
  AgentRegistry: string;
  AvatarNFT: string;
  AgentTokenFactory: string;
};

const DEPLOYMENTS: Record<number, Deployment> = {
  [foundry.id]: addressesLocal as Deployment,
  [baseSepolia.id]: addressesSepolia as Deployment,
  [base.id]: addressesMainnet as Deployment,
};

/** Chain ids the app is wired for: Anvil (local), Base Sepolia, Base mainnet. */
export type SupportedChainId = typeof foundry.id | typeof baseSepolia.id | typeof base.id;

/**
 * Active chain id. Defaults to local Anvil (31337); set NEXT_PUBLIC_CHAIN_ID=84532 for
 * Base Sepolia or 8453 for Base mainnet.
 */
export function activeChainId(): SupportedChainId {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  return raw ? (Number(raw) as SupportedChainId) : foundry.id;
}

export function activeChain() {
  const id = activeChainId();
  if (id === base.id) return base;
  if (id === baseSepolia.id) return baseSepolia;
  return foundry;
}

export function deployment(chainId: number = activeChainId()): Deployment {
  const d = DEPLOYMENTS[chainId];
  if (!d || !d.AgentRegistry) {
    throw new Error(`No contract deployment for chainId ${chainId}. Deploy contracts and update the addresses manifest.`);
  }
  return d;
}

/** RPC URL override. Server reads RPC_URL; client falls back to the chain default. */
export function rpcUrl(): string | undefined {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  if (process.env.NEXT_PUBLIC_RPC_URL) return process.env.NEXT_PUBLIC_RPC_URL;
  return undefined; // viem uses the chain's default RPC
}

/** A read-only viem client for the active chain (used by server reads + the executor). */
export function publicClient(chainId: number = activeChainId()) {
  const chain = chainId === base.id ? base : chainId === baseSepolia.id ? baseSepolia : foundry;
  return createPublicClient({ chain, transport: http(rpcUrl()) });
}

import type { Abi } from "viem";

// Vendored from web/src/lib/contracts/abis/AgentTokenFactory.json — keep in sync if the
// factory ABI changes. Only the entries the skill needs are included.
export const FACTORY_ABI: Abi = [
  {
    type: "function",
    name: "createAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "avatarURI", type: "string" },
      { name: "configHash", type: "bytes32" },
      { name: "seed", type: "uint256" },
    ],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "sale", type: "address" },
    ],
  },
  {
    type: "event",
    name: "AgentCreated",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "sale", type: "address", indexed: false },
      { name: "seed", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "MIN_SEED",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
];

export const ERC20_ABI: Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
];

export const V = 1_000_000n;
export const MIN_SEED_WEI = 100_000n * 10n ** 18n;

export type Deployment = {
  chainId: number;
  AEON: `0x${string}`;
  AgentTokenFactory: `0x${string}`;
  AgentRegistry: `0x${string}`;
  AvatarNFT: `0x${string}`;
};

// Base mainnet — web/src/lib/contracts/abis/addresses.base-mainnet.json
const MAINNET: Deployment = {
  chainId: 8453,
  AEON: "0xBf8E8f0e8866a7052F948C16508644347c57aba3",
  AgentTokenFactory: "0x758c73C9e22639F4fe54301D039e155Dc7380B8c",
  AgentRegistry: "0x7fd3Fe93504664DA43a82B9a6A70E292Bd2c00eB",
  AvatarNFT: "0xf5F498eA77C0bd95f933a76212063BB5814C90e1",
};

// Base Sepolia — web/src/lib/contracts/abis/addresses.base-sepolia.json.
// Note: AEON is the zero address on Sepolia (no AEON deployed there), so a real
// Sepolia launch isn't wired; integration tests use a local anvil fork instead.
const SEPOLIA: Deployment = {
  chainId: 84532,
  AEON: "0x0000000000000000000000000000000000000000",
  AgentTokenFactory: "0x4db7e4d1e6E4a8c3EF9a1741dBa4Af8701d70fa2",
  AgentRegistry: "0x4a25D6aCfD3C44334bE327dcAA91aC9D3c368d09",
  AvatarNFT: "0x832b5ab3A1148AAfF55cF27F96725301620AAc63",
};

const DEPLOYMENTS: Record<number, Deployment> = {
  [MAINNET.chainId]: MAINNET,
  [SEPOLIA.chainId]: SEPOLIA,
};

export function getDeployment(chainId: number): Deployment {
  const d = DEPLOYMENTS[chainId];
  if (!d) throw new Error(`AETHREE_LAUNCH_ERROR — unsupported chain ${chainId}`);
  return d;
}

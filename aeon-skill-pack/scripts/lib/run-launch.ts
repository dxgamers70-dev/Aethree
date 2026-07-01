import { buildLaunchArgs, parseAgentCreated, type AgentCreated, type LaunchArgs } from "./launch-core";
import { FACTORY_ABI, ERC20_ABI, type Deployment } from "./contracts";
import type { LaunchInputs, Mode } from "./inputs";

interface PublicLike {
  readContract(args: any): Promise<any>;
  simulateContract(args: any): Promise<{ result: any; request: any }>;
  waitForTransactionReceipt(args: any): Promise<{ logs: any[] }>;
}
interface WalletLike {
  writeContract(args: any): Promise<`0x${string}`>;
}

export interface LaunchClients {
  publicClient: PublicLike;
  walletClient: WalletLike;
  account: { address: `0x${string}` };
}

export interface LaunchResult {
  mode: Mode;
  launcher: `0x${string}`;
  args: LaunchArgs;
  predicted: AgentCreated;
  approveTx?: `0x${string}`;
  launchTx?: `0x${string}`;
  result?: AgentCreated;
}

export async function runLaunch(opts: {
  clients: LaunchClients;
  deployment: Deployment;
  inputs: LaunchInputs;
}): Promise<LaunchResult> {
  const { clients, deployment, inputs } = opts;
  const { publicClient, walletClient, account } = clients;
  const launcher = account.address;
  const args = buildLaunchArgs(inputs);

  const balance: bigint = await publicClient.readContract({
    address: deployment.AEON, abi: ERC20_ABI, functionName: "balanceOf", args: [launcher],
  });
  if (balance < args.seedWei) {
    throw new Error(`AETHREE_LAUNCH_ERROR — insufficient AEON: have ${balance}, need ${args.seedWei}`);
  }

  const sim = await publicClient.simulateContract({
    account: launcher,
    address: deployment.AgentTokenFactory,
    abi: FACTORY_ABI,
    functionName: "createAgent",
    args: [args.name, args.symbol, args.avatarURI, args.configHash, args.seedWei],
  });
  const [agentId, token, sale] = sim.result as [bigint, `0x${string}`, `0x${string}`];
  const predicted: AgentCreated = { agentId, token, sale };

  if (inputs.mode === "dry-run") {
    return { mode: inputs.mode, launcher, args, predicted };
  }

  let approveTx: `0x${string}` | undefined;
  const allowance: bigint = await publicClient.readContract({
    address: deployment.AEON, abi: ERC20_ABI, functionName: "allowance",
    args: [launcher, deployment.AgentTokenFactory],
  });
  if (allowance < args.seedWei) {
    approveTx = await walletClient.writeContract({
      address: deployment.AEON, abi: ERC20_ABI, functionName: "approve",
      args: [deployment.AgentTokenFactory, args.seedWei],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  const launchTx = await walletClient.writeContract(sim.request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: launchTx });
  const result = parseAgentCreated(receipt.logs);

  return { mode: inputs.mode, launcher, args, predicted, approveTx, launchTx, result };
}

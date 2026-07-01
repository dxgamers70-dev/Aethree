import { describe, it, expect, vi } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseAbiParameters, getAddress } from "viem";
import { runLaunch } from "./run-launch";
import { FACTORY_ABI, type Deployment } from "./contracts";
import type { LaunchInputs } from "./inputs";

const launcher = getAddress("0x3333333333333333333333333333333333333333");
const token = getAddress("0x1111111111111111111111111111111111111111");
const sale = getAddress("0x2222222222222222222222222222222222222222");

const deployment: Deployment = {
  chainId: 8453,
  AEON: getAddress("0xBf8E8f0e8866a7052F948C16508644347c57aba3"),
  AgentTokenFactory: getAddress("0x758c73C9e22639F4fe54301D039e155Dc7380B8c"),
  AgentRegistry: launcher, AvatarNFT: launcher,
};

const baseInputs: LaunchInputs = {
  name: "A", symbol: "AAAA", seedAeon: 100_000n, seedWei: 100_000n * 10n ** 18n,
  mode: "dry-run", force: false, avatarURI: "ipfs://x",
  config: { persona: "", voice: "", policy: {}, skills: [], avatarRef: "ipfs://x" }, chainId: 8453,
};

function receiptWithEvent() {
  const topics = encodeEventTopics({ abi: FACTORY_ABI, eventName: "AgentCreated", args: { agentId: 1n, creator: launcher } });
  const data = encodeAbiParameters(parseAbiParameters("address token, address sale, uint256 seed"), [token, sale, baseInputs.seedWei]);
  return { logs: [{ address: deployment.AgentTokenFactory, topics, data }] };
}

function makeClients(opts: { balance: bigint; allowance: bigint }) {
  const writeContract = vi.fn(async () => "0xwrite");
  const publicClient = {
    readContract: vi.fn(async ({ functionName }: any) =>
      functionName === "balanceOf" ? opts.balance : opts.allowance),
    simulateContract: vi.fn(async () => ({ result: [1n, token, sale], request: { __req: true } })),
    waitForTransactionReceipt: vi.fn(async () => receiptWithEvent()),
  };
  const walletClient = { writeContract };
  return { clients: { publicClient, walletClient, account: { address: launcher } } as any, writeContract, publicClient };
}

describe("runLaunch", () => {
  it("dry-run simulates and sends NOTHING", async () => {
    const { clients, writeContract } = makeClients({ balance: 200_000n * 10n ** 18n, allowance: 0n });
    const r = await runLaunch({ clients, deployment, inputs: baseInputs });
    expect(r.mode).toBe("dry-run");
    expect(r.predicted).toEqual({ agentId: 1n, token, sale });
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("execute with sufficient allowance skips approve, sends createAgent once", async () => {
    const { clients, writeContract } = makeClients({ balance: 200_000n * 10n ** 18n, allowance: 999_999n * 10n ** 18n });
    const r = await runLaunch({ clients, deployment, inputs: { ...baseInputs, mode: "execute" } });
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(r.approveTx).toBeUndefined();
    expect(r.result).toEqual({ agentId: 1n, token, sale });
  });

  it("execute with low allowance approves then launches (2 writes)", async () => {
    const { clients, writeContract } = makeClients({ balance: 200_000n * 10n ** 18n, allowance: 0n });
    await runLaunch({ clients, deployment, inputs: { ...baseInputs, mode: "execute" } });
    expect(writeContract).toHaveBeenCalledTimes(2);
    expect(writeContract.mock.calls[0][0]).toMatchObject({ functionName: "approve" });
  });

  it("throws on insufficient AEON and sends nothing", async () => {
    const { clients, writeContract } = makeClients({ balance: 1n, allowance: 0n });
    await expect(runLaunch({ clients, deployment, inputs: { ...baseInputs, mode: "execute" } }))
      .rejects.toThrow(/insufficient AEON/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});

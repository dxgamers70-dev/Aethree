import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseAbiParameters, getAddress } from "viem";
import { buildLaunchArgs, parseAgentCreated } from "./launch-core";
import { hashConfig } from "./config-hash";
import { FACTORY_ABI } from "./contracts";
import type { LaunchInputs } from "./inputs";

const inputs: LaunchInputs = {
  name: "My Agent", symbol: "MYAG", seedAeon: 100_000n, seedWei: 100_000n * 10n ** 18n,
  mode: "dry-run", force: false, avatarURI: "ipfs://x",
  config: { persona: "p", voice: "", policy: {}, skills: [], avatarRef: "ipfs://x" }, chainId: 8453,
};

describe("buildLaunchArgs", () => {
  it("builds args with the canonical config hash", () => {
    const a = buildLaunchArgs(inputs);
    expect(a).toMatchObject({ name: "My Agent", symbol: "MYAG", avatarURI: "ipfs://x", seedWei: inputs.seedWei });
    expect(a.configHash).toBe(hashConfig(inputs.config));
  });
});

describe("parseAgentCreated", () => {
  it("decodes the AgentCreated log", () => {
    const token = getAddress("0x1111111111111111111111111111111111111111");
    const sale = getAddress("0x2222222222222222222222222222222222222222");
    const creator = getAddress("0x3333333333333333333333333333333333333333");
    const topics = encodeEventTopics({
      abi: FACTORY_ABI, eventName: "AgentCreated", args: { agentId: 7n, creator },
    });
    const data = encodeAbiParameters(parseAbiParameters("address token, address sale, uint256 seed"), [
      token, sale, 100_000n * 10n ** 18n,
    ]);
    const out = parseAgentCreated([
      { address: "0x758c73C9e22639F4fe54301D039e155Dc7380B8c", topics, data },
    ]);
    expect(out).toEqual({ agentId: 7n, token, sale });
  });

  it("throws when no AgentCreated log present", () => {
    expect(() => parseAgentCreated([])).toThrow(/AgentCreated not found/);
  });
});

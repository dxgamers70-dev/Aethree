import { describe, it, expect } from "vitest";
import { FACTORY_ABI, ERC20_ABI, getDeployment, MIN_SEED_WEI, V } from "./contracts";

describe("contracts", () => {
  it("exposes Base mainnet deployment", () => {
    const d = getDeployment(8453);
    expect(d.AEON.toLowerCase()).toBe("0xbf8e8f0e8866a7052f948c16508644347c57aba3");
    expect(d.AgentTokenFactory.toLowerCase()).toBe("0x758c73c9e22639f4fe54301d039e155dc7380b8c");
  });

  it("throws on unsupported chain", () => {
    expect(() => getDeployment(1)).toThrow(/unsupported chain/);
  });

  it("FACTORY_ABI includes createAgent and AgentCreated", () => {
    const names = FACTORY_ABI.map((e: any) => e.name);
    expect(names).toContain("createAgent");
    expect(names).toContain("AgentCreated");
  });

  it("ERC20_ABI includes approve and allowance", () => {
    const names = ERC20_ABI.map((e: any) => e.name);
    expect(names).toEqual(expect.arrayContaining(["approve", "allowance", "balanceOf", "decimals"]));
  });

  it("constants are correct", () => {
    expect(V).toBe(1_000_000n);
    expect(MIN_SEED_WEI).toBe(100_000n * 10n ** 18n);
  });
});

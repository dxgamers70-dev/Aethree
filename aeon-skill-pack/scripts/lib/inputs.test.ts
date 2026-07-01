import { describe, it, expect } from "vitest";
import { parseInputs, deriveSymbol } from "./inputs";

const env = (over: Record<string, string> = {}) => ({ ...over });

describe("deriveSymbol", () => {
  it("uppercases alphanumerics, caps at 6", () => {
    expect(deriveSymbol("Ethereum Oracle")).toBe("ETHERE");
    expect(deriveSymbol("a.b-c")).toBe("ABC");
  });
});

describe("parseInputs", () => {
  it("parses delimited var, derives symbol, defaults to dry-run", () => {
    const i = parseInputs({ var: "My Agent | | 100000", env: env() });
    expect(i.name).toBe("My Agent");
    expect(i.symbol).toBe("MYAGEN");
    expect(i.seedAeon).toBe(100_000n);
    expect(i.seedWei).toBe(100_000n * 10n ** 18n);
    expect(i.mode).toBe("dry-run");
    expect(i.chainId).toBe(8453);
  });

  it("honors explicit symbol and execute opt-in", () => {
    const i = parseInputs({ var: "execute: My Agent | MYAG | 120000", env: env() });
    expect(i.symbol).toBe("MYAG");
    expect(i.mode).toBe("execute");
  });

  it("rejects seed below MIN_SEED", () => {
    expect(() => parseInputs({ var: "X | | 99999", env: env() })).toThrow(/AETHREE_LAUNCH_ERROR.*seed/i);
  });

  it("rejects seed above max without force", () => {
    expect(() => parseInputs({ var: "X | | 300000", env: env() })).toThrow(/AETHREE_LAUNCH_ERROR.*max/i);
  });

  it("allows seed above max with force token", () => {
    const i = parseInputs({ var: "force: X | | 300000", env: env() });
    expect(i.seedAeon).toBe(300_000n);
    expect(i.force).toBe(true);
  });

  it("respects AETHREE_MAX_SEED and CHAIN_ID and AETHREE_AVATAR_URI env", () => {
    const i = parseInputs({
      var: "X | | 400000",
      env: env({ AETHREE_MAX_SEED: "500000", CHAIN_ID: "84532", AETHREE_AVATAR_URI: "ipfs://abc" }),
    });
    expect(i.seedAeon).toBe(400_000n);
    expect(i.chainId).toBe(84532);
    expect(i.avatarURI).toBe("ipfs://abc");
  });

  it("rejects missing name", () => {
    expect(() => parseInputs({ var: " | SYM | 100000", env: env() })).toThrow(/AETHREE_LAUNCH_ERROR.*name/i);
  });

  it("builds a config object that feeds the hash", () => {
    const i = parseInputs({ var: "Hi | | 100000", env: env({ AETHREE_PERSONA: "helpful" }) });
    expect(i.config).toMatchObject({ persona: "helpful", avatarRef: i.avatarURI });
  });
});

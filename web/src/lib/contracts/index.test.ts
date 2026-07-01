// web/src/lib/contracts/index.test.ts
import { test, expect } from "vitest";
import { deployment } from "./index";

test("base mainnet deployment exposes the real AEON address", () => {
  const d = deployment(8453);
  expect(d.AEON.toLowerCase()).toBe("0xbf8e8f0e8866a7052f948c16508644347c57aba3");
  expect(d.chainId).toBe(8453);
});

test("base sepolia deployment exposes an AEON address", () => {
  const d = deployment(84532);
  expect(d.AEON).toMatch(/^0x[0-9a-fA-F]{40}$/);
});

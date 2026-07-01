import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";

// Gated anvil integration test. Run with: RUN_INTEGRATION=1 npm run -s test:integration
//
// This mirrors the anvil + deploy approach in web/src/test/integration/full-loop.test.ts.
// To make it a real end-to-end assertion, the implementer wires (model on the web harness):
//   1. spawn `anvil` (chain 31337) — done below.
//   2. deploy the stack (AgentRegistry, AvatarNFT, MockAEON, AgentTokenFactory) and capture
//      addresses into a local Deployment (chainId 31337).
//   3. MockAEON.mint(launcher, 200_000e18) so the launcher can seed.
//   4. build viem public/wallet clients against http://127.0.0.1:8545 with anvil[0]'s key,
//      then: const result = await runLaunch({ clients, deployment, inputs });
//      const code = await publicClient.getBytecode({ address: result.result!.token });
//      expect(code && code.length > 2).toBe(true);
//
// Until the deploy harness is wired, this verifies anvil boots so the gate is exercised in CI.

let anvil: ChildProcess | undefined;

beforeAll(async () => {
  anvil = spawn("anvil", ["--silent"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
}, 20_000);

afterAll(() => {
  anvil?.kill();
});

describe.runIf(process.env.RUN_INTEGRATION)("launch integration (anvil)", () => {
  it("anvil is reachable (deploy + runLaunch assertions wired by implementer)", async () => {
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const body = (await res.json()) as { result?: string };
    expect(BigInt(body.result ?? "0x0")).toBe(31337n);
  });
});

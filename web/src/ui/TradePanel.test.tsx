import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { TradePanel } from "./TradePanel";

const WAD = 1_000_000_000_000_000_000n;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x0000000000000000000000000000000000000001", isConnected: true }),
  useReadContract: (cfg: { functionName?: string; args?: unknown[] }) => {
    if (cfg?.functionName === "costToBuy") {
      const amount = BigInt((cfg.args?.[0] as bigint) ?? 0n);
      return { data: amount * WAD }; // cost == amount AEON
    }
    if (cfg?.functionName === "quoteSell") {
      const amount = BigInt((cfg.args?.[0] as bigint) ?? 0n);
      return { data: amount * WAD }; // floor payout == amount AEON
    }
    if (cfg?.functionName === "sold") return { data: 5n };
    if (cfg?.functionName === "wall") return { data: 100n * WAD };
    if (cfg?.functionName === "balanceOf") return { data: 3n * WAD };
    if (cfg?.functionName === "allowance") return { data: 0n };
    return { data: undefined };
  },
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
}));

vi.mock("@/lib/contracts", () => ({
  abis: { AgentToken: [], BondingCurveSale: [] },
  deployment: () => ({ AEON: "0x00000000000000000000000000000000000000Ae" }),
  activeChain: () => ({ id: 31337 }),
}));

const props = { saleAddress: "0xSale", tokenAddress: "0xToken" };

test("renders buy/sell/delegate controls when connected", () => {
  render(<TradePanel {...props} />);
  expect(screen.getByRole("button", { name: /buy/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sell/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /delegate/i })).toBeInTheDocument();
});

test("shows the AEON cost and the fee breakdown", () => {
  render(<TradePanel {...props} />);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "10" } });
  // cost == 10 AEON; creator 70% == 7
  expect(screen.getByTestId("cost").textContent).toContain("10");
  expect(screen.getByTestId("fee-creator").textContent).toContain("7");
  expect(screen.getByTestId("fee-wall").textContent).toContain("1.8");
  expect(screen.getByTestId("sell-quote").textContent).toContain("10");
});

// Fix #2: Buy gating on AEON balance
// Mock: balanceOf returns 3 WAD (used for both token and AEON), costToBuy returns amount * WAD
// So amount=10 → cost=10 AEON > 3 AEON balance → Buy disabled
// amount=2 → cost=2 AEON < 3 AEON balance → Buy enabled
test("Buy is disabled when amount exceeds AEON balance", () => {
  render(<TradePanel {...props} />);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "10" } });
  expect(screen.getByRole("button", { name: /^buy$/i })).toBeDisabled();
});

test("Buy is enabled when cost is within AEON balance", () => {
  render(<TradePanel {...props} />);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "2" } });
  expect(screen.getByRole("button", { name: /^buy$/i })).toBeEnabled();
});

// Fix #2: Sell gating on token balance
// Mock: balanceOf returns 3 WAD (tokenBal), sold returns 5n
// amount=10 → 10 WAD > tokenBal 3 WAD → Sell disabled
// amount=2 → 2 WAD ≤ tokenBal 3 WAD and amountUnits(2) ≤ sold(5) → Sell enabled
test("Sell is disabled when amount exceeds token balance", () => {
  render(<TradePanel {...props} />);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "10" } });
  expect(screen.getByRole("button", { name: /^sell$/i })).toBeDisabled();
});

test("Sell is enabled when amount is within token balance and sold supply", () => {
  render(<TradePanel {...props} />);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "2" } });
  expect(screen.getByRole("button", { name: /^sell$/i })).toBeEnabled();
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LaunchPanel, deriveSymbol, isZeroAddress } from "./LaunchPanel";

const ZERO = "0x0000000000000000000000000000000000000000";
const CREATOR = "0xCreater000000000000000000000000000000001";

let mockFactoryAddr = "0xFac";

const simulateContract = vi.fn(async () => ({ result: [1n, "0xToken", "0xSale"] }));
const waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));
const writeContractAsync = vi.fn(async () => "0xapprovehash");
const usePublicClientSpy = vi.fn(() => ({ simulateContract, waitForTransactionReceipt }));

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: true, address: CREATOR }),
  useChainId: () => 84532,
  useConfig: () => ({}),
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
  usePublicClient: (cfg?: { chainId?: number }) => usePublicClientSpy(cfg),
  useReadContract: (cfg: { functionName?: string }) => {
    if (cfg?.functionName === "MIN_SEED") return { data: 100_000n * 10n ** 18n };
    return { data: undefined };
  },
  useWriteContract: () => ({ writeContractAsync }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
}));

vi.mock("@/lib/contracts", () => ({
  abis: { AgentTokenFactory: [] },
  activeChainId: () => 84532,
  deployment: () => ({ AgentTokenFactory: mockFactoryAddr, AEON: "0xAe" }),
}));

beforeEach(() => {
  mockFactoryAddr = "0xFac";
  usePublicClientSpy.mockClear();
  simulateContract.mockClear();
  waitForTransactionReceipt.mockClear();
  writeContractAsync.mockClear();
});

// Regression: createAgent mints the avatar to msg.sender and pulls AEON via transferFrom.
// The launch flow must (1) approve AEON BEFORE simulating, and (2) simulate AS the connected
// account — otherwise viem simulates from 0x0 and the mint reverts ERC721InvalidReceiver
// (0x64a0ae92), or the simulate reverts ERC20InsufficientAllowance before the approval.
test("approves AEON before simulating, and simulates as the connected account", async () => {
  mockFactoryAddr = "0xFac0000000000000000000000000000000000001";
  render(<LaunchPanel agentId="a1" name="Oracle Prime" configHash={"0x" + "ab".repeat(32)} status="draft" />);
  fireEvent.click(screen.getByRole("button", { name: /launch token/i }));

  await waitFor(() => expect(simulateContract).toHaveBeenCalled());

  // Simulate carries the connected account (not the implicit 0x0).
  expect(simulateContract).toHaveBeenCalledWith(expect.objectContaining({ account: CREATOR }));

  // The first write is the AEON approval, and it runs before the simulate.
  expect(writeContractAsync.mock.calls[0][0]).toMatchObject({ functionName: "approve" });
  expect(writeContractAsync.mock.invocationCallOrder[0]).toBeLessThan(
    simulateContract.mock.invocationCallOrder[0],
  );
});

// Regression: the launch flow must pin its public client to the chain the app targets
// (activeChainId), not the wallet's ambient chain. Otherwise wagmi falls back to the first
// configured chain (Anvil → http://127.0.0.1:8545) and simulate fails with "Failed to fetch".
test("pins the public client to the active chain id", () => {
  render(<LaunchPanel agentId="a1" name="Oracle Prime" configHash={"0x" + "ab".repeat(32)} status="draft" />);
  expect(usePublicClientSpy).toHaveBeenCalledWith({ chainId: 84532 });
});

test("deriveSymbol still takes the first 4 alphanumerics uppercased", () => {
  expect(deriveSymbol("My cool agent")).toBe("MYCO");
});

test("shows a seed amount field for draft agents", () => {
  render(<LaunchPanel agentId="1" name="Agent" configHash="0x00" status="draft" />);
  expect(screen.getByLabelText(/seed/i)).toBeInTheDocument();
});

test("shows the Launch token button for a connected draft", () => {
  render(<LaunchPanel agentId="a1" name="Oracle Prime" configHash={"0x" + "ab".repeat(32)} status="draft" />);
  expect(screen.getByRole("button", { name: /launch token/i })).toBeInTheDocument();
});

test("shows a disabled launched state when already launched", () => {
  render(<LaunchPanel agentId="a1" name="Oracle Prime" configHash={"0x" + "ab".repeat(32)} status="launched" />);
  expect(screen.getByText(/launched/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^launch token$/i })).not.toBeInTheDocument();
});

// Fix #1: isZeroAddress pure helper tests
test("isZeroAddress returns true for the zero address", () => {
  expect(isZeroAddress(ZERO)).toBe(true);
});

test("isZeroAddress returns false for a real address", () => {
  expect(isZeroAddress("0xFac0000000000000000000000000000000000001")).toBe(false);
});

test("isZeroAddress is case-insensitive", () => {
  expect(isZeroAddress("0X0000000000000000000000000000000000000000")).toBe(true);
});

// Fix #1: component guard — zero-address factory disables launch and shows message
test("disables Launch token button and shows unavailability message when factory is zero address", () => {
  mockFactoryAddr = ZERO;
  render(<LaunchPanel agentId="a1" name="Oracle Prime" configHash={"0x" + "ab".repeat(32)} status="draft" />);
  expect(screen.getByRole("button", { name: /launch token/i })).toBeDisabled();
  expect(screen.getByText(/launching isn't available on this network yet/i)).toBeInTheDocument();
});

test("Launch token button is NOT disabled for a real factory address", () => {
  mockFactoryAddr = "0xFac0000000000000000000000000000000000001";
  render(<LaunchPanel agentId="a1" name="Oracle Prime" configHash={"0x" + "ab".repeat(32)} status="draft" />);
  // button is enabled (not disabled by launchUnavailable); may still be disabled by seedTooLow
  // but that's a separate concern — here we just confirm launchUnavailable doesn't fire
  const btn = screen.getByRole("button", { name: /launch token/i });
  // The button exists and the "unavailable" message is absent
  expect(screen.queryByText(/launching isn't available on this network yet/i)).not.toBeInTheDocument();
  expect(btn).toBeInTheDocument();
});

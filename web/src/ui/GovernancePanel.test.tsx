import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { GovernancePanel } from "./GovernancePanel";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x0000000000000000000000000000000000000001" }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn().mockResolvedValue("0xsig") }),
  useChainId: () => 31337,
}));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders the create-proposal form when token exists", async () => {
  render(<GovernancePanel agentId="a1" tokenAddress="0xToken" />);
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/new persona/i)).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: /propose/i })).toBeInTheDocument();
});

test("shows launch-token notice and no form when token is missing", async () => {
  render(<GovernancePanel agentId="a1" tokenAddress={null} />);
  await waitFor(() => {
    expect(screen.getByText(/launch the token first/i)).toBeInTheDocument();
  });
  expect(screen.queryByPlaceholderText(/new persona/i)).not.toBeInTheDocument();
});

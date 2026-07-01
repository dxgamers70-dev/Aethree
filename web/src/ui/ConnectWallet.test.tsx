import { render, screen } from "@testing-library/react";

const mocks = {
  useAccount: vi.fn(),
  useConnect: vi.fn(),
  useDisconnect: vi.fn(),
};

vi.mock("wagmi", () => ({
  useAccount: () => mocks.useAccount(),
  useConnect: () => mocks.useConnect(),
  useDisconnect: () => mocks.useDisconnect(),
}));

vi.mock("wagmi/connectors", () => ({
  injected: () => ({ id: "injected" }),
}));

import { ConnectWallet } from "./ConnectWallet";

const ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.useConnect.mockReturnValue({ connect: vi.fn(), connectors: [{ id: "injected" }] });
  mocks.useDisconnect.mockReturnValue({ disconnect: vi.fn() });
});

test("shows Connect Wallet when disconnected", () => {
  mocks.useAccount.mockReturnValue({ address: undefined, isConnected: false, chainId: 8453 });
  render(<ConnectWallet />);
  expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
});

test("shows truncated address and Disconnect when connected", () => {
  mocks.useAccount.mockReturnValue({ address: ADDR, isConnected: true, chainId: 8453 });
  render(<ConnectWallet />);
  expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  // truncated address 0x7099…79C8
  expect(screen.getByText(/0x7099/i)).toBeInTheDocument();
  // no second sign-in step anymore
  expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
});

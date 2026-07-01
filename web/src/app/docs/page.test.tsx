import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TokenomicsDocs from "./page";

test("renders the tokenomics section headings", () => {
  render(<TokenomicsDocs />);
  expect(screen.getByText("Trade in $AEON")).toBeInTheDocument();
  expect(screen.getByText("Where your money goes")).toBeInTheDocument();
  expect(screen.getByText("The floor (bid wall)")).toBeInTheDocument();
  expect(screen.getByText("Launch seed")).toBeInTheDocument();
});

test("shows the AEON reference address", () => {
  render(<TokenomicsDocs />);
  expect(
    screen.getByText("0xBf8E8f0e8866a7052F948C16508644347c57aba3"),
  ).toBeInTheDocument();
});

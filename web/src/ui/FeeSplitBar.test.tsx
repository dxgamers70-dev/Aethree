import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeeSplitBar } from "./FeeSplitBar";

test("renders all four cuts with their labels", () => {
  render(<FeeSplitBar />);
  expect(screen.getByText("Creator")).toBeInTheDocument();
  expect(screen.getByText("Bid wall")).toBeInTheDocument();
  expect(screen.getByText("Protocol treasury")).toBeInTheDocument();
  expect(screen.getByText("Platform fee")).toBeInTheDocument();
});

test("renders each cut's percentage in the legend", () => {
  render(<FeeSplitBar />);
  expect(screen.getByText(/· 70%/)).toBeInTheDocument();
  expect(screen.getByText(/· 18%/)).toBeInTheDocument();
  expect(screen.getByText(/· 10%/)).toBeInTheDocument();
  expect(screen.getByText(/· 2%/)).toBeInTheDocument();
});

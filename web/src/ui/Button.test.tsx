import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

test("renders label and applies neon variant class", () => {
  render(<Button>APE IN</Button>);
  const btn = screen.getByRole("button", { name: "APE IN" });
  expect(btn).toBeInTheDocument();
  expect(btn.className).toMatch(/bg-acid/);
});

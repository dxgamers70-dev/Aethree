import { test, expect } from "vitest";
import { FEE_SPLIT, FEE_TOTAL } from "./tokenomics";

test("fee split sums to 100%", () => {
  expect(FEE_TOTAL).toBe(100);
});

test("fee split has exactly the four expected cuts", () => {
  expect(FEE_SPLIT.map((c) => c.key).sort()).toEqual([
    "creator",
    "platform",
    "treasury",
    "wall",
  ]);
});

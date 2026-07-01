import { describe, it, expect } from "vitest";
import { canonicalJSON, hashConfig } from "./config-hash";

describe("canonicalJSON", () => {
  it("sorts object keys deterministically regardless of insertion order", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJSON({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("recurses into arrays and nested objects", () => {
    expect(canonicalJSON({ x: [3, { z: 1, y: 2 }] })).toBe('{"x":[3,{"y":2,"z":1}]}');
  });
});

describe("hashConfig", () => {
  it("is a 32-byte keccak hash, stable across key order", () => {
    const a = hashConfig({ persona: "p", voice: "v" });
    const b = hashConfig({ voice: "v", persona: "p" });
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("matches the known keccak256 of the canonical bytes", () => {
    // keccak256(utf8 '{"persona":"hello"}')
    expect(hashConfig({ persona: "hello" })).toBe(
      "0x3ff56304dedd93837199f7450cd3fc48e6dd9a3fe8e2a4ec7f18e64c60df8078",
    );
  });
});

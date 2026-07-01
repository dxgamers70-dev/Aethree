import { canonicalJSON, hashConfig } from "./config-hash";

test("canonicalJSON sorts keys deeply and is order-independent", () => {
  const a = canonicalJSON({ b: 1, a: { d: 4, c: 3 } });
  const b = canonicalJSON({ a: { c: 3, d: 4 }, b: 1 });
  expect(a).toBe(b);
  expect(a).toBe('{"a":{"c":3,"d":4},"b":1}');
});

test("hashConfig is deterministic and 0x-prefixed keccak256", () => {
  const h1 = hashConfig({ persona: "gm", skills: [], policy: {}, voice: "default", avatarRef: "av1" });
  const h2 = hashConfig({ avatarRef: "av1", voice: "default", policy: {}, skills: [], persona: "gm" });
  expect(h1).toBe(h2);
  expect(h1).toMatch(/^0x[0-9a-f]{64}$/);
});

test("different persona => different hash", () => {
  const base = { persona: "gm", skills: [], policy: {}, voice: "default", avatarRef: "av1" };
  expect(hashConfig(base)).not.toBe(hashConfig({ ...base, persona: "wagmi" }));
});

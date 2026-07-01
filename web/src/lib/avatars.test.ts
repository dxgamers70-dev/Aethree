import { MODELS, CATEGORIES, getModel, resolveAvatarUrl, DEFAULT_AVATAR } from "./avatars";

test("model catalog is non-trivial, unique, and well-formed", () => {
  expect(MODELS.length).toBeGreaterThanOrEqual(25);
  const urls = MODELS.map((m) => m.url);
  expect(new Set(urls).size).toBe(urls.length);
  for (const mo of MODELS) {
    expect(mo.url).toMatch(/^\/avatars\/.+\.glb$/);
    expect(CATEGORIES).toContain(mo.category);
    expect(mo.name.length).toBeGreaterThan(0);
  }
});

test("getModel resolves a known url and returns undefined otherwise", () => {
  expect(getModel(MODELS[3].url)?.url).toBe(MODELS[3].url);
  expect(getModel("/avatars/nope.glb")).toBeUndefined();
});

test("resolveAvatarUrl passes through paths/urls and falls back for legacy ids", () => {
  expect(resolveAvatarUrl("/avatars/fox.glb")).toBe("/avatars/fox.glb");
  expect(resolveAvatarUrl("https://x/y.glb")).toBe("https://x/y.glb");
  expect(resolveAvatarUrl(undefined)).toBe(DEFAULT_AVATAR);
  expect(resolveAvatarUrl("av-oracle")).toBe(DEFAULT_AVATAR);
});

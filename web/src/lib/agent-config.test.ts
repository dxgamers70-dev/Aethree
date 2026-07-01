import { buildInitialConfig } from "./agent-config";
import { hashConfig } from "./config-hash";

test("buildInitialConfig produces v1 core with defaults and a matching hash", () => {
  const { core, version, hash } = buildInitialConfig({ persona: "gm fren", avatarRef: "av-cyber" });
  expect(version).toBe(1);
  expect(core).toEqual({
    persona: "gm fren",
    skills: [],
    policy: {},
    voice: "default",
    avatarRef: "av-cyber",
  });
  expect(hash).toBe(hashConfig(core));
});

test("trims persona and rejects empty", () => {
  expect(() => buildInitialConfig({ persona: "   ", avatarRef: "av-cyber" })).toThrow(/persona/i);
});

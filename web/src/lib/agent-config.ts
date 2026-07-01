import { hashConfig } from "./config-hash";

export type AgentConfigCore = {
  persona: string;
  skills: string[];
  policy: Record<string, never>;
  voice: string;
  avatarRef: string;
};

export function buildInitialConfig(input: { persona: string; avatarRef: string }): {
  core: AgentConfigCore;
  version: number;
  hash: `0x${string}`;
} {
  const persona = input.persona.trim();
  if (!persona) throw new Error("persona must not be empty");
  const core: AgentConfigCore = {
    persona,
    skills: [],
    policy: {},
    voice: "default",
    avatarRef: input.avatarRef,
  };
  return { core, version: 1, hash: hashConfig(core) };
}

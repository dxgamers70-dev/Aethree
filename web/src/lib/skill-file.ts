export type ParsedSkill = {
  name: string;
  description: string;
  model: string;
  instructions: string;
};

const FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

/**
 * Parses an agent "skill file": optional `--- key: value ---` frontmatter
 * (name, description, model) followed by a Markdown instructions body.
 * The instructions body becomes the agent's system prompt, so it must be present.
 */
export function parseSkillFile(raw: string): ParsedSkill {
  const meta: Record<string, string> = {};
  let body = raw;

  const m = raw.match(FRONTMATTER);
  if (m) {
    for (const line of m[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key) meta[key] = value;
    }
    body = raw.slice(m[0].length);
  }

  const instructions = body.trim();
  if (!instructions) throw new Error("skill file must contain instructions");

  return {
    name: meta.name ?? "",
    description: meta.description ?? "",
    model: meta.model ?? "",
    instructions,
  };
}

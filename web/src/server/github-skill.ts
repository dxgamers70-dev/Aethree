import { resolveSkillCandidates } from "@/lib/github-skill";
import { parseSkillFile, type ParsedSkill } from "@/lib/skill-file";

// Bankr caps individual skill files at 100 KB; we mirror that.
const MAX_BYTES = 100 * 1024;

export type ImportedSkill = ParsedSkill & { raw: string; sourceUrl: string };

/**
 * Fetches a `SKILL.md` from a GitHub (or direct) URL and parses it into the
 * agent skill-file shape. Runs server-side so the browser never hits GitHub
 * directly (avoids CORS). Repo-root URLs try `main` then `master`.
 */
export async function importSkillFromGithub(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ImportedSkill> {
  const candidates = resolveSkillCandidates(input);
  let lastError = "not found";

  for (const url of candidates) {
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: { accept: "text/plain, text/markdown, */*" } });
    } catch {
      lastError = `could not reach ${url}`;
      continue;
    }
    if (!res.ok) {
      lastError = `${res.status} fetching ${url}`;
      continue;
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      throw new Error(`skill file is too large (max ${MAX_BYTES / 1024} KB)`);
    }

    const raw = await res.text();
    if (raw.length > MAX_BYTES) {
      throw new Error(`skill file is too large (max ${MAX_BYTES / 1024} KB)`);
    }

    // Throws if the file has no instructions body — surface that to the user.
    const parsed = parseSkillFile(raw);
    return { ...parsed, raw, sourceUrl: url };
  }

  throw new Error(`could not load SKILL.md — ${lastError}`);
}

/**
 * Resolves a user-supplied GitHub (or direct) URL into an ordered list of raw
 * candidate URLs to fetch a skill's `SKILL.md` from. More than one candidate is
 * returned only when the branch is unknown (repo-root links), so the caller can
 * try each in order.
 *
 * Accepted forms mirror Bankr's "install a skill from GitHub":
 *  - https://github.com/owner/repo/tree/<branch>/<path>          → <path>/SKILL.md
 *  - https://github.com/owner/repo/blob/<branch>/<path>/SKILL.md → that file (raw)
 *  - https://github.com/owner/repo                               → main, then master /SKILL.md
 *  - https://raw.githubusercontent.com/... or any *.md link      → used as-is
 */
export function resolveSkillCandidates(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("skill URL is required");

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("invalid skill URL");
  }

  const host = url.hostname.toLowerCase();
  const isMd = url.pathname.toLowerCase().endsWith(".md");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "github.com" || host === "www.github.com") {
    const [owner, repo, kind, branch, ...rest] = segments;
    if (!owner || !repo) throw new Error("GitHub URL must include an owner and repo");

    // /tree/<branch>/<path> (folder) or /blob/<branch>/<path> (file) → raw host.
    if ((kind === "tree" || kind === "blob") && branch) {
      const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`
        .replace(/\/+$/, "");
      return isMd ? [base] : [`${base}/SKILL.md`];
    }

    // Repo root: branch unknown, so try the two common defaults.
    if (!kind) {
      return ["main", "master"].map(
        (b) => `https://raw.githubusercontent.com/${owner}/${repo}/${b}/SKILL.md`,
      );
    }

    throw new Error(
      "unsupported GitHub URL; link to a folder (…/tree/<branch>/<path>) or a SKILL.md file",
    );
  }

  const normalized = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  // A direct markdown link on any host is used verbatim.
  if (isMd) return [normalized];

  // A raw.githubusercontent folder link: append SKILL.md.
  if (host === "raw.githubusercontent.com") {
    return [`${normalized.replace(/\/+$/, "")}/SKILL.md`];
  }

  throw new Error("unrecognized skill URL; provide a GitHub folder/file or a direct .md link");
}

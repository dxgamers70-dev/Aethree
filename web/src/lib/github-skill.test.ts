import { describe, it, expect } from "vitest";
import { resolveSkillCandidates } from "./github-skill";

describe("resolveSkillCandidates", () => {
  it("resolves a /tree folder URL to <path>/SKILL.md on the raw host", () => {
    expect(resolveSkillCandidates("https://github.com/owner/repo/tree/main/path/to/skill")).toEqual([
      "https://raw.githubusercontent.com/owner/repo/main/path/to/skill/SKILL.md",
    ]);
  });

  it("resolves a /blob file URL directly to raw", () => {
    expect(
      resolveSkillCandidates("https://github.com/owner/repo/blob/dev/skills/x/SKILL.md"),
    ).toEqual(["https://raw.githubusercontent.com/owner/repo/dev/skills/x/SKILL.md"]);
  });

  it("tries main then master for a repo-root URL", () => {
    expect(resolveSkillCandidates("https://github.com/owner/repo")).toEqual([
      "https://raw.githubusercontent.com/owner/repo/main/SKILL.md",
      "https://raw.githubusercontent.com/owner/repo/master/SKILL.md",
    ]);
  });

  it("passes a direct raw .md link through unchanged", () => {
    const raw = "https://raw.githubusercontent.com/owner/repo/main/SKILL.md";
    expect(resolveSkillCandidates(raw)).toEqual([raw]);
  });

  it("appends SKILL.md to a raw folder link", () => {
    expect(resolveSkillCandidates("https://raw.githubusercontent.com/owner/repo/main/dir")).toEqual([
      "https://raw.githubusercontent.com/owner/repo/main/dir/SKILL.md",
    ]);
  });

  it("adds a scheme when the input omits one", () => {
    expect(resolveSkillCandidates("github.com/owner/repo/tree/main/s")).toEqual([
      "https://raw.githubusercontent.com/owner/repo/main/s/SKILL.md",
    ]);
  });

  it("rejects empty input", () => {
    expect(() => resolveSkillCandidates("  ")).toThrow(/required/);
  });

  it("rejects a GitHub URL with no owner/repo", () => {
    expect(() => resolveSkillCandidates("https://github.com/owner")).toThrow(/owner and repo/);
  });
});

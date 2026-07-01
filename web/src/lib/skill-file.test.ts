import { parseSkillFile } from "./skill-file";

test("parses frontmatter name/description/model and the instructions body", () => {
  const raw = [
    "---",
    "name: degen-oracle",
    "description: Snarky on-chain analyst",
    "model: any",
    "---",
    "",
    "You are the Degen Oracle.",
    "- never give financial advice",
  ].join("\n");

  const s = parseSkillFile(raw);
  expect(s.name).toBe("degen-oracle");
  expect(s.description).toBe("Snarky on-chain analyst");
  expect(s.model).toBe("any");
  expect(s.instructions).toBe("You are the Degen Oracle.\n- never give financial advice");
});

test("treats a file with no frontmatter as pure instructions", () => {
  const s = parseSkillFile("You are a helpful agent.");
  expect(s.instructions).toBe("You are a helpful agent.");
  expect(s.name).toBe("");
  expect(s.description).toBe("");
  expect(s.model).toBe("");
});

test("trims values and ignores unknown frontmatter keys", () => {
  const raw = ["---", "name:  Bot ", "foo: bar", "---", "Do things."].join("\n");
  const s = parseSkillFile(raw);
  expect(s.name).toBe("Bot");
  expect(s.instructions).toBe("Do things.");
});

test("throws when the instructions body is empty", () => {
  const raw = ["---", "name: x", "description: y", "---", "", "   "].join("\n");
  expect(() => parseSkillFile(raw)).toThrow(/instructions/i);
});

test("throws on empty input", () => {
  expect(() => parseSkillFile("")).toThrow(/instructions/i);
});

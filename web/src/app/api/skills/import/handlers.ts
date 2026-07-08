import { importSkillFromGithub } from "@/server/github-skill";

export async function importSkillHandler(body: { url?: string }) {
  if (!body?.url?.trim()) {
    return { status: 400, body: { error: "url is required" } };
  }
  try {
    const skill = await importSkillFromGithub(body.url.trim());
    return {
      status: 200,
      body: {
        skillFile: skill.raw,
        name: skill.name,
        description: skill.description,
        sourceUrl: skill.sourceUrl,
      },
    };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

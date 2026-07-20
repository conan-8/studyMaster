import { prisma } from "@/lib/prisma";

export type Prompt = { content: string; version: number };

export const FALLBACK_PROMPTS: Record<string, Prompt> = {
  "frq-saq-grader": {
    version: 1,
    content: "TODO: write the FRQ/SAQ grading prompt",
  },
};

export async function getPrompt(name: string): Promise<Prompt> {
  const row = await prisma.promptRegistry.findFirst({
    where: { name },
    orderBy: { version: "desc" },
  });

  if (row) {
    return { content: row.content, version: row.version };
  }

  if (FALLBACK_PROMPTS[name]) {
    return FALLBACK_PROMPTS[name];
  }

  throw new Error(`Unknown prompt: ${name}`);
}

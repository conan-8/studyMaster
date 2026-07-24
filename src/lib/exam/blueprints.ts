/**
 * Blueprint seam (part-core).
 *
 * Single source of truth for the two seeded APCSA ExamBlueprint names and the
 * lookups that resolve them to ids. The seed (prisma/seed.ts) creates exactly
 * one MOCK and one PRACTICE blueprint using these exact names; these helpers
 * resolve them by {subjectId, name} (ExamBlueprint has no natural unique key —
 * only `id`), so there are NO hardcoded blueprint ids anywhere.
 */
import { prisma } from "@/lib/prisma";

/** Exact name of the seeded shared Quick Practice blueprint (R2/R7/R42). */
export const PRACTICE_BLUEPRINT_NAME = "APCSA Quick Practice";

/** Exact name of the seeded AP Computer Science A mock blueprint (R5). */
export const MOCK_BLUEPRINT_NAME = "AP Computer Science A Mock Exam";

/** APCSA subject code; the subject is always resolved by code, never by id (R4). */
export const APCSA_SUBJECT_CODE = "APCSA";

async function getBlueprintIdByName(name: string): Promise<string> {
  const subject = await prisma.subject.findUnique({
    where: { code: APCSA_SUBJECT_CODE },
  });
  if (!subject) {
    throw new Error(`Subject not found for code "${APCSA_SUBJECT_CODE}" — run the seed first`);
  }
  const blueprint = await prisma.examBlueprint.findFirst({
    where: { subjectId: subject.id, name },
  });
  if (!blueprint) {
    throw new Error(
      `ExamBlueprint "${name}" not found for subject "${APCSA_SUBJECT_CODE}" — run the seed first`,
    );
  }
  return blueprint.id;
}

/** Resolve the seeded APCSA MOCK blueprint id by name (throws if missing). */
export async function getMockBlueprintId(): Promise<string> {
  return getBlueprintIdByName(MOCK_BLUEPRINT_NAME);
}

/** Resolve the seeded APCSA PRACTICE ("APCSA Quick Practice") blueprint id (throws if missing). */
export async function getPracticeBlueprintId(): Promise<string> {
  return getBlueprintIdByName(PRACTICE_BLUEPRINT_NAME);
}

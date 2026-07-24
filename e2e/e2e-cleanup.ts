/**
 * GIGGA part-e2e — data isolation / cleanup (R52).
 *
 * Run under `tsx` from the project root by `e2e/setup.ts` during the smoke
 * test's `test.afterAll`. Removes everything the smoke test created so it does
 * NOT corrupt dev state relied on by other tests:
 *
 *   - all Question rows whose sourceTag starts with `gigga-e2e:` (the active
 *     MCQ fixture), and
 *   - the dedicated e2e user's ExamSession + Response rows (created when the
 *     test clicked "Start Mock Exam").
 *
 * The dedicated e2e Supabase/app User is intentionally KEPT so it can be reused
 * deterministically on the next run (no signup / email-confirm dependency).
 *
 * Best-effort: logs problems but exits 0 so cleanup never masks the test result.
 */
import { config } from "dotenv";
import * as path from "node:path";

config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";

const EMAIL = "gigga-e2e@studymate.test";
const SOURCE_TAG_PREFIX = "gigga-e2e:";

async function main() {
  const prisma = new PrismaClient();
  try {
    const deletedQuestions = await prisma.question.deleteMany({
      where: { sourceTag: { startsWith: SOURCE_TAG_PREFIX } },
    });
    console.log(
      `[e2e-cleanup] deleted ${deletedQuestions.count} gigga-e2e question(s)`,
    );

    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (user) {
      const deletedResponses = await prisma.response.deleteMany({
        where: { userId: user.id },
      });
      const deletedSessions = await prisma.examSession.deleteMany({
        where: { userId: user.id },
      });
      console.log(
        `[e2e-cleanup] deleted ${deletedSessions.count} session(s) and ${deletedResponses.count} response(s) for e2e user`,
      );
    }
    console.log("[e2e-cleanup] CLEANUP_OK");
  } catch (e) {
    // Best-effort: do not fail the run because of cleanup.
    console.error("[e2e-cleanup] warning:", e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}

void main();

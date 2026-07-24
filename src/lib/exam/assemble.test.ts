// @vitest-environment node
/**
 * part-core supplementary unit tests — DB-integration (self-isolating).
 *
 * Mirrors the locked tests' isolation strategy but uses a DISTINCT sourceTag
 * prefix ("gigga-core:") and user-email prefix ("gigga-core-") so it can never
 * collide with the locked tests ("gigga-test:") or corrupt dev data:
 *   - beforeAll self-heals any gigga-core leftovers, runs the seed, deactivates
 *     any pre-existing ACTIVE APCSA MCQ (restored in afterAll), builds a controlled
 *     20-per-unit gigga-core MCQ bank, and creates one gigga-core user;
 *   - afterAll deletes all gigga-core rows and restores the pre-existing state.
 *
 * Covers (R56): seed idempotency (R1/R2/R3/R14); practice blueprint sectionsJson
 * = single MCQ section count 10 (R7); assembleExam weighted distribution +
 * distinct users + shortfall + empty FRQ (R18/R20/R21/R22/R23/R27); and
 * assembleQuickPractice null-on-empty + min-fill (R40/R43/R44).
 *
 * If no database is reachable the whole suite is SKIPPED (not failed) so a plain
 * `vitest run` in a DB-less environment still passes; the pure logic is covered
 * unconditionally by sampling.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "@/lib/prisma";
import { QuestionType, SessionMode, SessionStatus } from "@/generated/prisma";
import { assembleExam, assembleQuickPractice } from "@/lib/exam/assemble";
import { getMockBlueprintId, getPracticeBlueprintId } from "@/lib/exam/blueprints";

const TAG = "gigga-core:"; // sourceTag prefix for all rows THIS file creates
const USER_EMAIL = "gigga-core-user@example.com";
const SUBJECT_CODE = "APCSA";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", ".."); // src/lib/exam -> root
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");
const SEED = path.join(ROOT, "prisma", "seed.ts");

// --- DB availability probe (skip gracefully when there is no database) -------
async function checkDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("db check timeout")), 5000);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const dbAvailable = await checkDb();

function runSeed(): void {
  execSync(`"${TSX}" "${SEED}"`, { cwd: ROOT, stdio: "pipe", timeout: 180000, env: process.env });
}

// --- shared state -------------------------------------------------------------
let apcsaSubjectId = "";
const units: Array<{ unitNumber: number; id: string }> = [];
const topicByUnit: Record<number, string> = {};
const bankByUnit: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
const idToUnit: Record<string, number> = {};
let testUserId = "";
let restoredActiveIds: string[] = [];

function unitId(n: number): string {
  const u = units.find((x) => x.unitNumber === n);
  if (!u) throw new Error(`unit ${n} not found`);
  return u.id;
}

async function setPool(byUnit: Record<number, number>): Promise<void> {
  await prisma.question.updateMany({
    where: { sourceTag: { startsWith: TAG } },
    data: { isActive: false },
  });
  for (const n of [1, 2, 3, 4]) {
    const ids = (bankByUnit[n] ?? []).slice(0, byUnit[n] ?? 0);
    if (ids.length > 0) {
      await prisma.question.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
    }
  }
}

function sectionIds(answersJson: unknown, sectionId: string): string[] {
  const arr = answersJson as Array<{ sectionId: string; questionIds: string[] }>;
  const found = arr.find((s) => s.sectionId === sectionId);
  return found ? found.questionIds : [];
}

function allIds(answersJson: unknown): string[] {
  return (answersJson as Array<{ questionIds: string[] }>).flatMap((s) => s.questionIds);
}

describe.skipIf(!dbAvailable)("part-core: DB integration (supplementary)", () => {
  beforeAll(async () => {
    // Self-heal any leftovers from a previous failed run.
    await prisma.question.deleteMany({ where: { sourceTag: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: USER_EMAIL } });

    // Ensure subject/units/blueprints exist (the seed is idempotent).
    runSeed();

    const subject = await prisma.subject.findUnique({ where: { code: SUBJECT_CODE } });
    if (!subject) throw new Error("APCSA subject not found after seed");
    apcsaSubjectId = subject.id;

    const us = await prisma.unit.findMany({
      where: { subjectId: apcsaSubjectId },
      orderBy: { unitNumber: "asc" },
    });
    for (const u of us) units.push({ unitNumber: u.unitNumber, id: u.id });

    for (const n of [1, 2, 3, 4]) {
      const t = await prisma.topic.findFirst({ where: { unitId: unitId(n) } });
      if (!t) throw new Error(`APCSA unit ${n} has no topic`);
      topicByUnit[n] = t.id;
    }

    // Safety net: deactivate pre-existing active APCSA MCQ that are not ours.
    const preExisting = await prisma.question.findMany({
      where: {
        subjectId: apcsaSubjectId,
        type: QuestionType.MCQ,
        isActive: true,
        sourceTag: { not: { startsWith: TAG } },
      },
      select: { id: true },
    });
    restoredActiveIds = preExisting.map((q) => q.id);
    if (restoredActiveIds.length > 0) {
      await prisma.question.updateMany({
        where: { id: { in: restoredActiveIds } },
        data: { isActive: false },
      });
    }

    // Controlled bank: 20 MCQ per unit (80 total), all inactive.
    const data = [] as Array<{
      id: string;
      subjectId: string;
      topicId: string;
      type: QuestionType;
      difficulty: number;
      stem: string;
      explanation: string;
      misconceptionTags: string[];
      sourceTag: string;
      isActive: boolean;
    }>;
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < 20; i++) {
        const id = `${TAG}q-u${n}-${String(i).padStart(2, "0")}`;
        data.push({
          id,
          subjectId: apcsaSubjectId,
          topicId: topicByUnit[n],
          type: QuestionType.MCQ,
          difficulty: 1,
          stem: `gigga-core MCQ unit ${n} #${i}`,
          explanation: "supplementary test fixture",
          misconceptionTags: [],
          sourceTag: `${TAG}bank`,
          isActive: false,
        });
        bankByUnit[n].push(id);
        idToUnit[id] = n;
      }
    }
    await prisma.question.createMany({ data });

    const user = await prisma.user.create({ data: { email: USER_EMAIL } });
    testUserId = user.id;
  }, 240000);

  afterAll(async () => {
    try {
      await prisma.question.deleteMany({ where: { sourceTag: { startsWith: TAG } } });
    } catch {
      /* best effort */
    }
    try {
      if (restoredActiveIds.length > 0) {
        await prisma.question.updateMany({
          where: { id: { in: restoredActiveIds } },
          data: { isActive: true },
        });
      }
    } catch {
      /* best effort */
    }
    try {
      await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
    } catch {
      /* best effort */
    }
    await prisma.$disconnect().catch(() => undefined);
  }, 120000);

  it("R1/R2/R3/R14: running the seed twice still yields exactly one MOCK + one PRACTICE APCSA blueprint", async () => {
    runSeed();
    runSeed();
    const total = await prisma.examBlueprint.count({ where: { subjectId: apcsaSubjectId } });
    expect(total).toBe(2);
    const practiceCount = await prisma.examBlueprint.count({
      where: { subjectId: apcsaSubjectId, name: "APCSA Quick Practice" },
    });
    expect(practiceCount).toBe(1);
    expect(total - practiceCount).toBe(1);
  }, 240000);

  it("R7: the practice blueprint sectionsJson is a single MCQ section of count 10", async () => {
    const practiceId = await getPracticeBlueprintId();
    const bp = await prisma.examBlueprint.findUnique({ where: { id: practiceId } });
    expect(bp).not.toBeNull();
    const sections = bp!.sectionsJson as Array<{ type: string; questionCount: number }>;
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBe(1);
    expect(sections[0].type).toBe("MCQ");
    expect(sections[0].questionCount).toBe(10);
  });

  it("R20/R18/R24: assembleExam distributes Section I 8/12/6/14, leaves FRQ Section II empty, returns one IN_PROGRESS session id", async () => {
    await setPool({ 1: 20, 2: 20, 3: 20, 4: 20 });
    const mockId = await getMockBlueprintId();
    const before = await prisma.examSession.count({ where: { userId: testUserId } });
    const sessionId = await assembleExam(testUserId, mockId, SessionMode.EXAM);
    const after = await prisma.examSession.count({ where: { userId: testUserId } });
    expect(typeof sessionId).toBe("string");
    expect(after - before).toBe(1);

    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    expect(session).not.toBeNull();
    expect(session!.mode).toBe(SessionMode.EXAM);
    expect(session!.status).toBe(SessionStatus.IN_PROGRESS);
    expect(session!.currentSectionIndex).toBe(0);

    const secI = sectionIds(session!.answersJson, "I");
    const secII = sectionIds(session!.answersJson, "II");
    expect(secI.length).toBe(40);
    expect(new Set(secI).size).toBe(40);
    expect(secII.length).toBe(0); // FRQ section recorded as an empty list

    const perUnit: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const qid of secI) perUnit[idToUnit[qid]] += 1;
    expect(perUnit[1]).toBe(8);
    expect(perUnit[2]).toBe(12);
    expect(perUnit[3]).toBe(6);
    expect(perUnit[4]).toBe(14);
  }, 120000);

  it("R23/R27: with < 40 active MCQ, assembleExam fills what it can and records the shortfall without throwing", async () => {
    await setPool({ 1: 2, 2: 2, 3: 1, 4: 0 }); // 5 active total
    const mockId = await getMockBlueprintId();
    const sessionId = await assembleExam(testUserId, mockId, SessionMode.EXAM);
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    expect(session).not.toBeNull();
    const secI = sectionIds(session!.answersJson, "I");
    expect(secI.length).toBe(5);
    expect(secI.length).toBeLessThan(40);
    expect(sectionIds(session!.answersJson, "II").length).toBe(0);
  }, 120000);

  it("R40/R42: assembleQuickPractice draws exactly 10 from the chosen unit and references the shared practice blueprint", async () => {
    await setPool({ 1: 12, 2: 0, 3: 0, 4: 0 });
    const practiceId = await getPracticeBlueprintId();
    const result = await assembleQuickPractice(testUserId, unitId(1));
    expect(typeof result).toBe("string");
    const session = await prisma.examSession.findUnique({ where: { id: result as string } });
    expect(session).not.toBeNull();
    expect(session!.mode).toBe(SessionMode.PRACTICE);
    expect(session!.blueprintId).toBe(practiceId);
    const ids = allIds(session!.answersJson);
    expect(ids.length).toBe(10);
    for (const qid of ids) expect(idToUnit[qid]).toBe(1);
  }, 120000);

  it("R43: a unit with zero active MCQ returns null and creates NO session row", async () => {
    await setPool({ 1: 0, 2: 0, 3: 0, 4: 0 });
    const before = await prisma.examSession.count({ where: { userId: testUserId } });
    const result = await assembleQuickPractice(testUserId, unitId(4));
    const after = await prisma.examSession.count({ where: { userId: testUserId } });
    expect(result == null).toBe(true);
    expect(after - before).toBe(0);
  }, 120000);

  it("R44: a unit with 1-9 active MCQ assembles min(available,10) without crashing", async () => {
    await setPool({ 1: 0, 2: 3, 3: 0, 4: 0 });
    const result = await assembleQuickPractice(testUserId, unitId(2));
    expect(typeof result).toBe("string");
    const session = await prisma.examSession.findUnique({ where: { id: result as string } });
    expect(session).not.toBeNull();
    const ids = allIds(session!.answersJson);
    expect(ids.length).toBe(3);
    for (const qid of ids) expect(idToUnit[qid]).toBe(2);
  }, 120000);
});

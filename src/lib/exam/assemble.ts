/**
 * Server-side exam assembly (part-core).
 *
 *   assembleExam(userId, blueprintId, mode)        -> Promise<string>  (session id)
 *   assembleQuickPractice(userId, unitId)          -> Promise<string | null>
 *
 * assembleExam loads a blueprint, reads its sectionsJson, and for each section
 * samples ONLY active questions whose type matches the section type, resolving
 * each question's unit via Question.topic.unitId. The 40-MCQ Section I is split
 * across the four APCSA units by Unit.examWeight using the Hamilton method
 * (8/12/6/14). The FRQ Section II has no QuestionType enum value and no FRQ
 * questions, so it is recorded as an EMPTY list rather than erroring. Exactly
 * one IN_PROGRESS ExamSession is created and its id returned.
 *
 * answersJson canonical shape (A5):
 *   Array<{ sectionId: string; questionIds: string[] }>  in section order,
 *   e.g. [{ sectionId: "I", questionIds: [...] }, { sectionId: "II", questionIds: [] }]
 */
import { prisma } from "@/lib/prisma";
import { QuestionType, SessionMode, SessionStatus } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";
import { getPracticeBlueprintId } from "@/lib/exam/blueprints";
import {
  makeCallSeed,
  makeRng,
  sampleWeightedSection,
  sectionTypeToQuestionType,
  shuffle,
  type UnitPool,
} from "@/lib/exam/sampling";

/** One assembled section in ExamSession.answersJson (canonical A5 shape). */
export interface SectionAnswer {
  sectionId: string;
  questionIds: string[];
}

/** A parsed blueprint section (the subset of fields assembly cares about). */
interface BlueprintSection {
  id: string;
  type: string;
  questionCount: number;
}

/**
 * Parse a blueprint's sectionsJson into an ordered section list. Tolerates a
 * bare array (what the seed writes) or a `{ sections: [...] }` wrapper.
 */
export function parseSections(sectionsJson: unknown): BlueprintSection[] {
  if (Array.isArray(sectionsJson)) {
    return sectionsJson as BlueprintSection[];
  }
  if (
    sectionsJson &&
    typeof sectionsJson === "object" &&
    Array.isArray((sectionsJson as { sections?: unknown }).sections)
  ) {
    return (sectionsJson as { sections: BlueprintSection[] }).sections;
  }
  throw new Error("Cannot parse blueprint sectionsJson: " + JSON.stringify(sectionsJson));
}

/**
 * Assemble an exam session for `userId` from the blueprint `blueprintId`.
 *
 * Creates exactly one ExamSession (status IN_PROGRESS, currentSectionIndex 0)
 * whose answersJson records the assembled question ids grouped per section (an
 * empty list for any unfillable section, e.g. the FRQ Section II), and returns
 * the new session id (R15-R27).
 */
export async function assembleExam(
  userId: string,
  blueprintId: string,
  mode: SessionMode,
): Promise<string> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: blueprintId } });
  if (!blueprint) {
    throw new Error(`ExamBlueprint not found: ${blueprintId}`);
  }
  const sections = parseSections(blueprint.sectionsJson);

  // The subject's units, ordered by ascending unit number (R19/R20 precondition).
  const units = await prisma.unit.findMany({
    where: { subjectId: blueprint.subjectId },
    orderBy: { unitNumber: "asc" },
  });
  const weights = units.map((u) => u.examWeight);

  // All active questions for the subject, with their unit (via topic). One query.
  const active = await prisma.question.findMany({
    where: { subjectId: blueprint.subjectId, isActive: true },
    select: { id: true, type: true, topic: { select: { unitId: true } } },
  });

  // Group active question ids by type -> unitId.
  const idsByTypeUnit = new Map<string, Map<string, string[]>>();
  for (const q of active) {
    let byUnit = idsByTypeUnit.get(q.type);
    if (!byUnit) {
      byUnit = new Map<string, string[]>();
      idsByTypeUnit.set(q.type, byUnit);
    }
    const unitId = q.topic.unitId;
    let arr = byUnit.get(unitId);
    if (!arr) {
      arr = [];
      byUnit.set(unitId, arr);
    }
    arr.push(q.id);
  }

  // Per-user, per-call PRNG (R21): seed = userId + a fresh nonce.
  const rng = makeRng(makeCallSeed(userId));

  const answersJson: SectionAnswer[] = [];
  for (const section of sections) {
    const questionType = sectionTypeToQuestionType(section.type);
    if (questionType === null) {
      // e.g. FRQ Section II: no enum value, no questions -> empty selection (R18).
      answersJson.push({ sectionId: section.id, questionIds: [] });
      continue;
    }

    const byUnit = idsByTypeUnit.get(questionType);
    const poolsByUnit: UnitPool[] = units.map((u) => ({
      unitId: u.id,
      ids: byUnit?.get(u.id) ?? [],
    }));

    // Weighted Hamilton split for the section count; best-effort fill when a
    // unit/the pool is short (R23/R27). For Section I (40) this is 8/12/6/14.
    const questionIds = sampleWeightedSection(poolsByUnit, weights, section.questionCount, rng);
    answersJson.push({ sectionId: section.id, questionIds });
  }

  const session = await prisma.examSession.create({
    data: {
      userId,
      blueprintId,
      mode,
      status: SessionStatus.IN_PROGRESS,
      currentSectionIndex: 0,
      answersJson: answersJson as unknown as Prisma.InputJsonValue,
    },
  });
  return session.id;
}

/**
 * Assemble a 10-question Quick Practice session for one APCSA unit (R40-R44).
 *
 * Draws active MCQ from the chosen unit (Question.topic.unitId === unitId),
 * references the shared persisted "APCSA Quick Practice" blueprint (NO
 * per-session blueprint row), creates a PRACTICE ExamSession, and returns its id.
 *
 * Returns null and creates NO session row when the unit has zero active MCQ
 * (R43). For 1-9 active questions it assembles min(available, 10) without
 * crashing (R44).
 */
export async function assembleQuickPractice(
  userId: string,
  unitId: string,
): Promise<string | null> {
  const active = await prisma.question.findMany({
    where: { topic: { unitId }, isActive: true, type: QuestionType.MCQ },
    select: { id: true },
  });

  // Zero active questions in this unit -> no session row (R43).
  if (active.length === 0) {
    return null;
  }

  const practiceBlueprintId = await getPracticeBlueprintId();

  // Read the practice section id/count from the shared blueprint (single MCQ
  // section of count 10 — R7). Fall back to sane defaults if unreadable.
  let sectionId = "I";
  let target = 10;
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: practiceBlueprintId } });
  if (blueprint) {
    const sections = parseSections(blueprint.sectionsJson);
    if (sections.length > 0) {
      sectionId = sections[0].id;
      target = sections[0].questionCount;
    }
  }

  const rng = makeRng(makeCallSeed(userId));
  const shuffled = shuffle(
    active.map((q) => q.id),
    rng,
  );
  const questionIds = shuffled.slice(0, Math.min(target, shuffled.length));

  const answersJson: SectionAnswer[] = [{ sectionId, questionIds }];

  const session = await prisma.examSession.create({
    data: {
      userId,
      blueprintId: practiceBlueprintId,
      mode: SessionMode.PRACTICE,
      status: SessionStatus.IN_PROGRESS,
      currentSectionIndex: 0,
      answersJson: answersJson as unknown as Prisma.InputJsonValue,
    },
  });
  return session.id;
}

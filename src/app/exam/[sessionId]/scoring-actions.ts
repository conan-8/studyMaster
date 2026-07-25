"use server";

import { Prisma, QuestionType, SessionStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  scoreExam,
  type CapturedAnswer,
  type CapturedAnswerMap,
  type ScoreJson,
  type ScoreQuestionInput,
} from "@/lib/exam/score";

/**
 * Owner-scoped persistence actions for the answer-capture exam shell.
 *
 * These mirror the existing `finishSession` guard in ./actions (resolve the
 * Supabase user via createClient(), load the ExamSession, reject when
 * `session.userId !== user.id`) and add the MCQ scoring + Response persistence
 * required by the frozen spec:
 *
 *  - IDK         -> Response.answer = "" and Response.isIDK = true. The isIDK
 *                   flag is the single source of truth for IDK-ness.
 *  - unanswered  -> NO Response row is created.
 *  - idempotent  -> per (userId, questionId, examSessionId) within a transaction.
 *                   Response has NO unique constraint on that triple, so we
 *                   deleteMany-then-create inside the transaction: re-checking a
 *                   PRACTICE question or re-submitting EXAM answers replaces
 *                   rather than duplicates.
 *  - MCQ only    -> FRQ Section II carries an empty questionIds list and
 *                   contributes nothing; only MCQ questions are scored/persisted.
 *  - scoreJson   -> the ScoreJson subset { overall, sections, units } is written
 *                   to ExamSession.scoreJson; EXAM submit also sets
 *                   status = COMPLETED and completedAt = now.
 */

// ---------------------------------------------------------------------------
// Serializable shapes returned to the client (no Prisma types leak across)
// ---------------------------------------------------------------------------

/** A single assembled MCQ question, ready for the answer-capture shell. */
export type ScoringQuestion = {
  id: string;
  sectionId: string;
  stem: string;
  stimulus: string | null;
  choicesJson: Array<{ id: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  misconceptionTags: string[];
  unit: { unitId: string; unitNumber: number; title: string };
};

export type GetExamSessionForScoringResult =
  | { ok: true; mode: string; questions: ScoringQuestion[] }
  | { ok: false; error: string };

export type SubmitExamAnswersResult =
  | { ok: true; score: ScoreJson }
  | { ok: false; error: string };

export type CheckPracticeAnswerResult =
  | {
      ok: true;
      isIDK: boolean;
      isCorrect: boolean;
      correctAnswer: string;
      explanation: string;
      misconceptionTagsToShow: string[];
    }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Parsing helpers (normalize already-assembled data; assembly lives elsewhere)
// ---------------------------------------------------------------------------

type AssembledSection = { sectionId: string; questionIds: string[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * ExamSession.answersJson -> ordered `[{ sectionId, questionIds }]`. Mirrors the
 * tolerant parsing in ./sections (canonical shape plus a few fallbacks). The
 * sectionId for each assembled question is derived from this list.
 */
function parseAssembledSections(answersJson: unknown): AssembledSection[] {
  let list: unknown = answersJson;
  const wrapper = asRecord(answersJson);
  if (wrapper && Array.isArray(wrapper.sections)) {
    list = wrapper.sections;
  }
  if (!Array.isArray(list)) {
    return [];
  }

  const result: AssembledSection[] = [];
  for (const entry of list) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    const sectionId = record.sectionId ?? record.id ?? record.section;
    if (typeof sectionId !== "string") {
      continue;
    }
    const ids = record.questionIds ?? record.ids ?? record.questions ?? record.answers;
    const questionIds = Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
    result.push({ sectionId, questionIds });
  }
  return result;
}

type Choice = { id: string; text: string };

/** Question.choicesJson (Array<{ id, text }>) -> plain serializable choices. */
function parseChoices(choicesJson: unknown): Choice[] {
  if (!Array.isArray(choicesJson)) {
    return [];
  }
  const choices: Choice[] = [];
  for (const entry of choicesJson) {
    const record = asRecord(entry);
    if (!record || typeof record.id !== "string") {
      continue;
    }
    choices.push({
      id: record.id,
      text: typeof record.text === "string" ? record.text : "",
    });
  }
  return choices;
}

/**
 * Build the ordered (questionId -> sectionId) map plus the ordered question-id
 * list from answersJson, preserving section order and intra-section order.
 */
function deriveSectionMap(answersJson: unknown): {
  sectionByQuestion: Map<string, string>;
  orderedIds: string[];
} {
  const sectionByQuestion = new Map<string, string>();
  const orderedIds: string[] = [];
  for (const { sectionId, questionIds } of parseAssembledSections(answersJson)) {
    for (const questionId of questionIds) {
      if (!sectionByQuestion.has(questionId)) {
        sectionByQuestion.set(questionId, sectionId);
        orderedIds.push(questionId);
      }
    }
  }
  return { sectionByQuestion, orderedIds };
}

/** Map a loaded Question (with topic.unit) to a pure ScoreQuestionInput. */
function toScoreInput(
  question: {
    id: string;
    correctAnswer: string | null;
    misconceptionTags: string[];
    topic: { unit: { id: string; unitNumber: number; title: string } };
  },
  sectionId: string,
): ScoreQuestionInput {
  return {
    id: question.id,
    sectionId,
    correctAnswer: question.correctAnswer ?? "",
    misconceptionTags: question.misconceptionTags,
    unit: {
      unitId: question.topic.unit.id,
      unitNumber: question.topic.unit.unitNumber,
      title: question.topic.unit.title,
    },
  };
}

// ---------------------------------------------------------------------------
// Auth / ownership (mirrors the finishSession guard)
// ---------------------------------------------------------------------------

/** Resolve the current Supabase user id (null when unauthenticated). */
async function resolveUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// (a) getExamSessionForScoring — owner-scoped READ for the capture shell
// ---------------------------------------------------------------------------

export async function getExamSessionForScoring(
  sessionId: string,
): Promise<GetExamSessionForScoringResult> {
  const userId = await resolveUserId();
  if (!userId) {
    return { ok: false, error: "unauthenticated" };
  }

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, mode: true, answersJson: true },
    });

    // Owner-scoped guard: reject missing sessions and non-owners alike.
    if (!session || session.userId !== userId) {
      return { ok: false, error: "not-found" };
    }

    const { sectionByQuestion, orderedIds } = deriveSectionMap(session.answersJson);

    if (orderedIds.length === 0) {
      return { ok: true, mode: String(session.mode), questions: [] };
    }

    // MCQ only — FRQ/empty Section II ids never resolve to MCQ rows here.
    const questions = await prisma.question.findMany({
      where: { id: { in: orderedIds }, type: QuestionType.MCQ },
      select: {
        id: true,
        stem: true,
        stimulus: true,
        choicesJson: true,
        correctAnswer: true,
        explanation: true,
        misconceptionTags: true,
        topic: { select: { unit: { select: { id: true, unitNumber: true, title: true } } } },
      },
    });

    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((question): question is NonNullable<typeof question> => question !== undefined);

    const result: ScoringQuestion[] = ordered.map((question) => ({
      id: question.id,
      sectionId: sectionByQuestion.get(question.id) ?? "",
      stem: question.stem,
      stimulus: question.stimulus,
      choicesJson: parseChoices(question.choicesJson),
      correctAnswer: question.correctAnswer ?? "",
      explanation: question.explanation,
      misconceptionTags: question.misconceptionTags,
      unit: {
        unitId: question.topic.unit.id,
        unitNumber: question.topic.unit.unitNumber,
        title: question.topic.unit.title,
      },
    }));

    return { ok: true, mode: String(session.mode), questions: result };
  } catch (err) {
    console.error("[getExamSessionForScoring] failed", err);
    return { ok: false, error: "server-error" };
  }
}

// ---------------------------------------------------------------------------
// (b) submitExamAnswers — EXAM bulk submit (whole session at once)
// ---------------------------------------------------------------------------

export async function submitExamAnswers(
  sessionId: string,
  answers: CapturedAnswerMap,
): Promise<SubmitExamAnswersResult> {
  const userId = await resolveUserId();
  if (!userId) {
    return { ok: false, error: "unauthenticated" };
  }

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, answersJson: true },
    });

    if (!session || session.userId !== userId) {
      return { ok: false, error: "not-found" };
    }

    const { sectionByQuestion, orderedIds } = deriveSectionMap(session.answersJson);

    const questions =
      orderedIds.length === 0
        ? []
        : await prisma.question.findMany({
            where: { id: { in: orderedIds }, type: QuestionType.MCQ },
            select: {
              id: true,
              correctAnswer: true,
              misconceptionTags: true,
              topic: { select: { unit: { select: { id: true, unitNumber: true, title: true } } } },
            },
          });

    const byId = new Map(questions.map((question) => [question.id, question]));
    const scoreInputs: ScoreQuestionInput[] = orderedIds
      .map((id) => byId.get(id))
      .filter((question): question is NonNullable<typeof question> => question !== undefined)
      .map((question) => toScoreInput(question, sectionByQuestion.get(question.id) ?? ""));

    const result = scoreExam(scoreInputs, answers);

    // One Response row per question that HAS a captured answer (real OR IDK).
    // Unanswered questions (absent from the map) get NO row.
    const responseData: Array<{
      userId: string;
      questionId: string;
      examSessionId: string;
      answer: string;
      isIDK: boolean;
      isCorrect: boolean;
      misconceptionTags: string[];
    }> = [];

    for (const questionResult of result.questions) {
      const captured = answers[questionResult.questionId];
      if (!captured) {
        // Unanswered -> no Response row.
        continue;
      }
      responseData.push({
        userId,
        questionId: questionResult.questionId,
        examSessionId: sessionId,
        // IDK -> answer "" (the isIDK flag is the single source of truth).
        answer: captured.isIDK ? "" : captured.answer,
        isIDK: captured.isIDK,
        isCorrect: questionResult.isCorrect,
        misconceptionTags: questionResult.misconceptionTagsToShow,
      });
    }

    // The persisted subset (rule 15 / rule 28): exactly { overall, sections, units }.
    const scoreJson: ScoreJson = {
      overall: result.overall,
      sections: result.sections,
      units: result.units,
    };

    await prisma.$transaction(async (tx) => {
      // Idempotent: Response has no unique constraint on
      // (userId, questionId, examSessionId), so clear this session's rows for
      // the user and recreate them. Re-submit replaces, never duplicates.
      await tx.response.deleteMany({
        where: { userId, examSessionId: sessionId },
      });
      if (responseData.length > 0) {
        await tx.response.createMany({ data: responseData });
      }
      await tx.examSession.update({
        where: { id: sessionId },
        data: {
          scoreJson: scoreJson as unknown as Prisma.InputJsonValue,
          status: SessionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });

    return { ok: true, score: scoreJson };
  } catch (err) {
    console.error("[submitExamAnswers] failed", err);
    return { ok: false, error: "server-error" };
  }
}

// ---------------------------------------------------------------------------
// (c) checkPracticeAnswer — PRACTICE per-question check (inline reveal)
// ---------------------------------------------------------------------------

export async function checkPracticeAnswer(
  sessionId: string,
  questionId: string,
  answer: CapturedAnswer,
): Promise<CheckPracticeAnswerResult> {
  const userId = await resolveUserId();
  if (!userId) {
    return { ok: false, error: "unauthenticated" };
  }

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, answersJson: true },
    });

    if (!session || session.userId !== userId) {
      return { ok: false, error: "not-found" };
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        type: true,
        correctAnswer: true,
        explanation: true,
        misconceptionTags: true,
        topic: { select: { unit: { select: { id: true, unitNumber: true, title: true } } } },
      },
    });

    // Only an MCQ question that exists can be checked/persisted.
    if (!question || question.type !== QuestionType.MCQ) {
      return { ok: false, error: "not-found" };
    }

    // Derive the section this question was assembled under (feeds the score input).
    let sectionId = "";
    for (const section of parseAssembledSections(session.answersJson)) {
      if (section.questionIds.includes(questionId)) {
        sectionId = section.sectionId;
        break;
      }
    }

    const scoreInput = toScoreInput(question, sectionId);

    // Score the single question via the same pure scoring contract.
    const result = scoreExam([scoreInput], { [questionId]: answer });
    const questionResult = result.questions[0];
    if (!questionResult) {
      return { ok: false, error: "server-error" };
    }

    // Idempotent upsert for the single (userId, questionId, examSessionId) row:
    // delete any prior row for that triple, then create the fresh one.
    await prisma.$transaction(async (tx) => {
      await tx.response.deleteMany({
        where: { userId, questionId, examSessionId: sessionId },
      });
      await tx.response.create({
        data: {
          userId,
          questionId,
          examSessionId: sessionId,
          // IDK -> answer "" and isIDK true (flag is the source of truth).
          answer: answer.isIDK ? "" : answer.answer,
          isIDK: answer.isIDK,
          isCorrect: questionResult.isCorrect,
          misconceptionTags: questionResult.misconceptionTagsToShow,
        },
      });
    });

    return {
      ok: true,
      isIDK: questionResult.isIDK,
      isCorrect: questionResult.isCorrect,
      correctAnswer: questionResult.correctAnswer,
      explanation: question.explanation,
      misconceptionTagsToShow: questionResult.misconceptionTagsToShow,
    };
  } catch (err) {
    console.error("[checkPracticeAnswer] failed", err);
    return { ok: false, error: "server-error" };
  }
}

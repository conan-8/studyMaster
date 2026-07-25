/**
 * Data loading + view model for the results page (/app/results/[sessionId]).
 *
 * Everything here reads what the persistence layer already wrote — scores are
 * NEVER recomputed in the UI (rule 44):
 *  - ExamSession.scoreJson -> the frozen ScoreJson rollup (overall/sections/units),
 *    surfaced verbatim for the summary and the per-unit chart.
 *  - Response rows         -> the per-question system of record (rule 4). A row
 *    with isIDK === true is an IDK answer (the FLAG is the single source of
 *    truth, rule 31); a question with NO row is unanswered (rule 32); anything
 *    else is a real answered response, correct iff Response.isCorrect === true.
 *  - Question rows         -> stem, stimulus, choices, correct answer,
 *    explanation, misconception tags, and the unit (via Question.topic.unit).
 */
import { prisma } from "@/lib/prisma";
import type { ScoreJson, SectionRollup, UnitRollup } from "@/lib/exam/score";

/** One assembled section entry in ExamSession.answersJson (canonical A5 shape). */
type AssembledSection = { sectionId: string; questionIds: string[] };

/** One parsed MCQ choice from Question.choicesJson ({ id: "A", text: "..." }). */
export type Choice = { id: string; text: string };

/** Display status for a review entry, derived purely from persisted data. */
export type ReviewStatus = "correct" | "wrong" | "idk" | "unanswered";

export type ReviewEntry = {
  questionId: string;
  sectionId: string;
  unitNumber: number;
  unitTitle: string;
  stem: string;
  stimulus: string | null;
  choices: Choice[];
  correctAnswer: string;
  explanation: string;
  status: ReviewStatus;
  /** Choice id the user picked. "" for IDK and unanswered entries. */
  selectedAnswer: string;
  /** Persisted tags — surfaced only when the user picked a wrong distractor. */
  misconceptionTags: string[];
};

export type ResultsData = {
  score: ScoreJson;
  entries: ReviewEntry[];
};

/** The subset of ExamSession fields this loader needs. */
export type ResultsSession = {
  id: string;
  userId: string;
  answersJson: unknown; // Prisma Json column: Array<{ sectionId, questionIds }>
  scoreJson: unknown; // Prisma Json column: ScoreJson | null
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * answersJson -> ordered assembled sections. Canonical shape is
 * `Array<{ sectionId, questionIds }>` in section order (a `{ sections: [] }`
 * wrapper and a couple of key aliases are tolerated, mirroring the exam shell).
 */
export function parseAssembledSections(answersJson: unknown): AssembledSection[] {
  let list: unknown = answersJson;
  const wrapper = asRecord(answersJson);
  if (wrapper && Array.isArray(wrapper.sections)) {
    list = wrapper.sections;
  }
  if (!Array.isArray(list)) {
    return [];
  }

  const sections: AssembledSection[] = [];
  for (const entry of list) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    const sectionId = record.sectionId ?? record.id ?? record.section;
    if (typeof sectionId !== "string") {
      continue;
    }
    const ids = record.questionIds ?? record.ids ?? record.questions;
    sections.push({
      sectionId,
      questionIds: Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string")
        : [],
    });
  }
  return sections;
}

/** choicesJson -> ordered choice list for an MCQ question. */
export function parseChoices(choicesJson: unknown): Choice[] {
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

function toSectionRollup(value: unknown): SectionRollup | null {
  const record = asRecord(value);
  if (!record || typeof record.sectionId !== "string") {
    return null;
  }
  const correct = toNumber(record.correct);
  const total = toNumber(record.total);
  if (correct === null || total === null) {
    return null;
  }
  return { sectionId: record.sectionId, correct, total };
}

function toUnitRollup(value: unknown): UnitRollup | null {
  const record = asRecord(value);
  if (!record || typeof record.unitId !== "string") {
    return null;
  }
  const unitNumber = toNumber(record.unitNumber);
  const correct = toNumber(record.correct);
  const answered = toNumber(record.answered);
  const total = toNumber(record.total);
  const accuracy = toNumber(record.accuracy);
  if (
    unitNumber === null ||
    correct === null ||
    answered === null ||
    total === null ||
    accuracy === null
  ) {
    return null;
  }
  return {
    unitId: record.unitId,
    unitNumber,
    title: typeof record.title === "string" ? record.title : `Unit ${unitNumber}`,
    correct,
    answered,
    total,
    accuracy,
  };
}

/**
 * scoreJson -> the frozen ScoreJson shape (rules 15/44), or null when the
 * session has not been scored yet. This only validates the display shape;
 * nothing is recomputed.
 */
export function parseScoreJson(value: unknown): ScoreJson | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const overall = asRecord(record.overall);
  if (!overall) {
    return null;
  }
  const correct = toNumber(overall.correct);
  const total = toNumber(overall.total);
  const percent = toNumber(overall.percent);
  if (correct === null || total === null || percent === null) {
    return null;
  }

  return {
    overall: {
      correct,
      total,
      percent,
      idkCount: toNumber(overall.idkCount) ?? 0,
      unansweredCount: toNumber(overall.unansweredCount) ?? 0,
    },
    sections: Array.isArray(record.sections)
      ? record.sections
          .map(toSectionRollup)
          .filter((section): section is SectionRollup => section !== null)
      : [],
    units: Array.isArray(record.units)
      ? record.units
          .map(toUnitRollup)
          .filter((unit): unit is UnitRollup => unit !== null)
      : [],
  };
}

/**
 * Load the results view model for an owned session. Returns null when the
 * session has no persisted scoreJson yet (e.g. direct URL access before the
 * exam was submitted) so the page can render a "not scored yet" state.
 */
export async function loadResultsData(session: ResultsSession): Promise<ResultsData | null> {
  const score = parseScoreJson(session.scoreJson);
  if (!score) {
    return null;
  }

  const assembled = parseAssembledSections(session.answersJson);
  const questionIds = Array.from(new Set(assembled.flatMap((section) => section.questionIds)));
  if (questionIds.length === 0) {
    return { score, entries: [] };
  }

  // Per-question system of record: one row per answered question (IDK included);
  // unanswered questions have NO row (rules 4/27/32).
  const responses = await prisma.response.findMany({
    where: { examSessionId: session.id, userId: session.userId },
  });
  const responseByQuestion = new Map(responses.map((row) => [row.questionId, row] as const));

  // The assembled MCQ questions, with the unit resolved via Question.topic.unit.
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { topic: { include: { unit: true } } },
  });
  const questionById = new Map(questions.map((question) => [question.id, question] as const));

  // Review entries in assembled order (every MCQ question in the session).
  const entries: ReviewEntry[] = [];
  for (const section of assembled) {
    for (const questionId of section.questionIds) {
      const question = questionById.get(questionId);
      if (!question) {
        continue;
      }

      const response = responseByQuestion.get(questionId);
      // IDK keys off the persisted isIDK FLAG, never the empty answer string;
      // no Response row at all means unanswered (rule 31/32).
      const status: ReviewStatus = !response
        ? "unanswered"
        : response.isIDK
          ? "idk"
          : response.isCorrect === true
            ? "correct"
            : "wrong";

      entries.push({
        questionId,
        sectionId: section.sectionId,
        unitNumber: question.topic.unit.unitNumber,
        unitTitle: question.topic.unit.title,
        stem: question.stem,
        stimulus: question.stimulus,
        choices: parseChoices(question.choicesJson),
        correctAnswer: question.correctAnswer ?? "",
        explanation: question.explanation,
        status,
        selectedAnswer: response && !response.isIDK ? response.answer : "",
        // The persisted row already holds misconceptionTagsToShow (rule 30);
        // only a real wrong distractor ever surfaces them (rules 20/43).
        misconceptionTags: status === "wrong" && response ? response.misconceptionTags : [],
      });
    }
  }

  return { score, entries };
}

/**
 * Pure, DB-free MCQ scoring for StudyMate exam sessions.
 *
 * This module is the frozen scoring contract (spec/reconciled.md rules 8–25). It has NO
 * dependency on the database, network, React, Prisma, or any app code, and carries no
 * "use server"/"use client" directive. It is deterministic and side-effect-free: identical
 * inputs always produce identical outputs, and the inputs are never mutated.
 */

export interface ScoreUnitInfo {
  unitId: string;
  unitNumber: number;
  title: string;
}

export interface ScoreQuestionInput {
  id: string;
  sectionId: string;
  correctAnswer: string;
  misconceptionTags: string[];
  unit: ScoreUnitInfo;
}

export interface CapturedAnswer {
  answer: string;
  isIDK: boolean;
}

/** Keyed by question id. A question absent from the map is "unanswered". */
export type CapturedAnswerMap = Record<string, CapturedAnswer>;

export interface QuestionResult {
  questionId: string;
  selectedAnswer: string;
  isIDK: boolean;
  isCorrect: boolean;
  correctAnswer: string;
  misconceptionTagsToShow: string[];
}

export interface SectionRollup {
  sectionId: string;
  correct: number;
  total: number;
}

export interface UnitRollup {
  unitId: string;
  unitNumber: number;
  title: string;
  correct: number;
  answered: number;
  total: number;
  accuracy: number;
}

export interface OverallRollup {
  correct: number;
  total: number;
  percent: number;
  idkCount: number;
  unansweredCount: number;
}

/** Exactly the shape persisted to ExamSession.scoreJson. */
export interface ScoreJson {
  overall: OverallRollup;
  sections: SectionRollup[];
  units: UnitRollup[];
}

export interface ScoreResult extends ScoreJson {
  questions: QuestionResult[];
}

/** Internal accumulator for a unit before its `accuracy` is derived. */
interface UnitAccumulator {
  unitId: string;
  unitNumber: number;
  title: string;
  correct: number;
  answered: number;
  total: number;
}

/**
 * Score a set of assembled MCQ questions against a captured answer map.
 *
 * Frozen semantics:
 *  - A question is correct IFF its captured answer is non-IDK AND
 *    `trim(answer) === trim(correctAnswer)` (r16).
 *  - An IDK answer (`isIDK === true`) is NEVER correct and is never counted as correct in
 *    any statistic; it increments `overall.idkCount` and is excluded from per-unit
 *    `answered` (r17, r19, r22).
 *  - A question absent from the answer map is "unanswered": never correct, increments
 *    `overall.unansweredCount`, excluded from per-unit `answered`, and yields the frozen
 *    QuestionResult shape `{ selectedAnswer: "", isIDK: false, isCorrect: false,
 *    misconceptionTagsToShow: [] }` (r18, r19, r22).
 *  - `misconceptionTagsToShow` equals the question's `misconceptionTags` ONLY for a real
 *    (non-IDK) WRONG answer; otherwise `[]` (r20).
 *  - Section rollup `{ sectionId, correct, total }`: total = MCQ in section, correct = the
 *    correct ones (r21).
 *  - Unit rollup: `answered` counts only real non-IDK answers; `accuracy = correct/answered`
 *    and `0` when `answered === 0` (never NaN) (r22, r23).
 *  - `overall.percent = correct/total` over ALL assembled MCQ (IDK + unanswered count
 *    against), in `[0,1]`, and `0` when `total === 0` (r24).
 *  - Ordering: questions in input order; sections in first-appearance order of `sectionId`;
 *    units sorted by `unitNumber` asc, ties by `unitId` asc (r25).
 */
export function scoreExam(
  questions: ScoreQuestionInput[],
  answers: CapturedAnswerMap,
): ScoreResult {
  const questionResults: QuestionResult[] = [];

  // Section rollups keyed by sectionId. A Map preserves insertion order, which gives us the
  // required "first appearance of sectionId in input" ordering for free (r25).
  const sectionMap = new Map<string, SectionRollup>();
  // Unit accumulators keyed by unitId; accuracy is derived after the single pass (r23).
  const unitMap = new Map<string, UnitAccumulator>();

  let overallCorrect = 0;
  let idkCount = 0;
  let unansweredCount = 0;

  for (const q of questions) {
    // "Absent from the map" => unanswered (r18). Use an own-property check so the semantics
    // are precisely about presence, not about prototype-inherited keys.
    const hasAnswer = Object.prototype.hasOwnProperty.call(answers, q.id);
    const captured: CapturedAnswer | undefined = hasAnswer ? answers[q.id] : undefined;
    const isUnanswered = !hasAnswer || captured === undefined;
    const isIDK = !isUnanswered && captured.isIDK;
    // Correct IFF non-IDK AND trimmed answer === trimmed correctAnswer (r16, r17).
    const isCorrect =
      !isUnanswered &&
      !isIDK &&
      captured.answer.trim() === q.correctAnswer.trim();

    // Build the per-question result.
    let selectedAnswer: string;
    let misconceptionTagsToShow: string[];
    if (isUnanswered) {
      // Frozen unanswered shape (r18).
      selectedAnswer = "";
      misconceptionTagsToShow = [];
    } else {
      // Answered question: surface the captured answer string and IDK flag.
      selectedAnswer = captured.answer;
      // Tags ONLY for a real (non-IDK) WRONG distractor (r20). Copy the array so we never
      // alias the caller's input (keeps the function side-effect-free).
      misconceptionTagsToShow =
        !isIDK && !isCorrect ? [...q.misconceptionTags] : [];
    }

    questionResults.push({
      questionId: q.id,
      selectedAnswer,
      isIDK,
      isCorrect,
      correctAnswer: q.correctAnswer,
      misconceptionTagsToShow,
    });

    // Overall counters (r19).
    if (isCorrect) overallCorrect += 1;
    if (isIDK) idkCount += 1;
    if (isUnanswered) unansweredCount += 1;

    // Section rollup (r21).
    let section = sectionMap.get(q.sectionId);
    if (section === undefined) {
      section = { sectionId: q.sectionId, correct: 0, total: 0 };
      sectionMap.set(q.sectionId, section);
    }
    section.total += 1;
    if (isCorrect) section.correct += 1;

    // Unit accumulator (r22, r23). Unit metadata is taken from the first occurrence.
    let unit = unitMap.get(q.unit.unitId);
    if (unit === undefined) {
      unit = {
        unitId: q.unit.unitId,
        unitNumber: q.unit.unitNumber,
        title: q.unit.title,
        correct: 0,
        answered: 0,
        total: 0,
      };
      unitMap.set(q.unit.unitId, unit);
    }
    unit.total += 1;
    // `answered` counts only real non-IDK answers; IDK + unanswered are excluded (r22).
    // A correct answer is necessarily a real non-IDK answer, so `correct` stays within
    // `answered`.
    if (!isUnanswered && !isIDK) {
      unit.answered += 1;
      if (isCorrect) unit.correct += 1;
    }
  }

  const total = questions.length;
  const overall: OverallRollup = {
    correct: overallCorrect,
    total,
    // Ratio in [0,1]; 0 when total === 0 (no NaN) (r24).
    percent: total === 0 ? 0 : overallCorrect / total,
    idkCount,
    unansweredCount,
  };

  const sections: SectionRollup[] = [...sectionMap.values()];

  // Units sorted by unitNumber asc, ties by unitId asc (r25); accuracy derived per unit
  // with the answered === 0 -> 0 guard so it is never NaN (r23).
  const units: UnitRollup[] = [...unitMap.values()]
    .sort((a, b) => {
      if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
      if (a.unitId < b.unitId) return -1;
      if (a.unitId > b.unitId) return 1;
      return 0;
    })
    .map((u) => ({
      unitId: u.unitId,
      unitNumber: u.unitNumber,
      title: u.title,
      correct: u.correct,
      answered: u.answered,
      total: u.total,
      accuracy: u.answered === 0 ? 0 : u.correct / u.answered,
    }));

  return { overall, sections, units, questions: questionResults };
}

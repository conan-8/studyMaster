/**
 * DB-free unit tests for the pure scoring function `scoreExam` (./score).
 *
 * These are the builder's own deliverable tests (spec/reconciled.md rule 45). They cover,
 * at minimum, the eight mandated cases:
 *   1. IDK is never correct, even when its answer string matches correctAnswer.
 *   2. IDK is excluded from the per-unit `answered` denominator.
 *   3. An all-IDK unit yields accuracy === 0 and answered === 0 (no NaN).
 *   4. An unanswered question is not correct and is counted in overall.unansweredCount.
 *   5. A full mixed set asserting the entire ScoreResult shape, including that
 *      misconceptionTagsToShow appears ONLY on a real (non-IDK) wrong distractor.
 *   6. Trimming: " A " === "A".
 *   7. Empty input -> all zeros and empty arrays (no NaN).
 *   8. Ordering: units by unitNumber then unitId; sections by first appearance.
 *
 * The objective gate is the locked suite (tests/score.locked.test.ts); this file mirrors
 * the same frozen contract from the implementation's own directory.
 */
import { describe, it, expect } from "vitest";
import { scoreExam } from "./score";
import type {
  ScoreQuestionInput,
  CapturedAnswerMap,
  CapturedAnswer,
  ScoreResult,
} from "./score";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

interface QOpts {
  sectionId?: string;
  correctAnswer?: string;
  misconceptionTags?: string[];
  unitId?: string;
  unitNumber?: number;
  unitTitle?: string;
}

function mkQ(id: string, opts: QOpts = {}): ScoreQuestionInput {
  const unitNumber = opts.unitNumber ?? 1;
  return {
    id,
    sectionId: opts.sectionId ?? "s1",
    correctAnswer: opts.correctAnswer ?? "A",
    misconceptionTags: opts.misconceptionTags ?? [],
    unit: {
      unitId: opts.unitId ?? "u1",
      unitNumber,
      title: opts.unitTitle ?? `Unit ${unitNumber}`,
    },
  };
}

function real(answer: string): CapturedAnswer {
  return { answer, isIDK: false };
}

function idk(answer = ""): CapturedAnswer {
  return { answer, isIDK: true };
}

function qById(r: ScoreResult, questionId: string) {
  const found = r.questions.find((x) => x.questionId === questionId);
  if (!found) throw new Error(`No QuestionResult for ${questionId}`);
  return found;
}

// ---------------------------------------------------------------------------
// 1. IDK is never correct, even when the string matches (r17)
// ---------------------------------------------------------------------------
describe("scoreExam: IDK is never correct (case 1, r17)", () => {
  it("IDK whose answer string equals correctAnswer is still not correct", () => {
    const questions = [mkQ("q1", { correctAnswer: "A" })];
    const answers: CapturedAnswerMap = { q1: idk("A") };
    const r = scoreExam(questions, answers);
    const qr = qById(r, "q1");
    expect(qr.isIDK).toBe(true);
    expect(qr.isCorrect).toBe(false);
    expect(r.overall.correct).toBe(0);
    expect(r.sections[0].correct).toBe(0);
    expect(r.units[0].correct).toBe(0);
  });

  it("IDK never shows misconception tags", () => {
    const questions = [mkQ("q1", { correctAnswer: "A", misconceptionTags: ["m"] })];
    const r = scoreExam(questions, { q1: idk("B") });
    expect(qById(r, "q1").misconceptionTagsToShow).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. IDK excluded from per-unit `answered` (r22)
// ---------------------------------------------------------------------------
describe("scoreExam: IDK excluded from per-unit answered (case 2, r22)", () => {
  it("only real non-IDK answers count toward unit.answered", () => {
    const questions = [
      mkQ("q1", { unitId: "u1", unitNumber: 1, correctAnswer: "A" }),
      mkQ("q2", { unitId: "u1", unitNumber: 1, correctAnswer: "B" }),
    ];
    const answers: CapturedAnswerMap = {
      q1: real("A"), // real, correct
      q2: idk("B"), // IDK (string equals correctAnswer)
    };
    const r = scoreExam(questions, answers);
    const u = r.units[0];
    expect(u.answered).toBe(1);
    expect(u.correct).toBe(1);
    expect(u.total).toBe(2);
    expect(u.accuracy).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. All-IDK unit -> accuracy 0 & answered 0 (r23, r45)
// ---------------------------------------------------------------------------
describe("scoreExam: all-IDK unit (case 3, r23)", () => {
  it("yields answered 0 and accuracy 0 with no NaN", () => {
    const questions = [
      mkQ("q1", { unitId: "u1", unitNumber: 1, correctAnswer: "A" }),
      mkQ("q2", { unitId: "u1", unitNumber: 1, correctAnswer: "B" }),
    ];
    const answers: CapturedAnswerMap = { q1: idk(), q2: idk("B") };
    const r = scoreExam(questions, answers);
    const u = r.units[0];
    expect(u.answered).toBe(0);
    expect(u.correct).toBe(0);
    expect(u.total).toBe(2);
    expect(u.accuracy).toBe(0);
    expect(Number.isNaN(u.accuracy)).toBe(false);
    expect(r.overall.idkCount).toBe(2);
    expect(r.overall.correct).toBe(0);
    expect(r.overall.percent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Unanswered not correct + counted in unansweredCount (r18, r19)
// ---------------------------------------------------------------------------
describe("scoreExam: unanswered handling (case 4, r18/r19)", () => {
  it("an absent question is not correct, has the frozen shape, and bumps unansweredCount", () => {
    const questions = [
      mkQ("q1", { correctAnswer: "A" }),
      mkQ("q2", { correctAnswer: "B", misconceptionTags: ["m"] }),
    ];
    const answers: CapturedAnswerMap = { q1: real("A") }; // q2 unanswered
    const r = scoreExam(questions, answers);

    expect(r.overall.unansweredCount).toBe(1);
    expect(r.overall.idkCount).toBe(0);

    const qr = qById(r, "q2");
    expect(qr).toEqual({
      questionId: "q2",
      selectedAnswer: "",
      isIDK: false,
      isCorrect: false,
      correctAnswer: "B",
      misconceptionTagsToShow: [],
    });

    // Unanswered is excluded from the per-unit answered denominator (r22).
    const u = r.units[0];
    expect(u.answered).toBe(1);
    expect(u.total).toBe(2);
    // Unanswered counts against the overall denominator (r24).
    expect(r.overall.total).toBe(2);
    expect(r.overall.correct).toBe(1);
    expect(r.overall.percent).toBe(1 / 2);
  });
});

// ---------------------------------------------------------------------------
// 5. Full mixed set asserting the entire ScoreResult shape (r45, r20)
// ---------------------------------------------------------------------------
describe("scoreExam: full mixed rollup (case 5, r45)", () => {
  // Units also exercise ordering (r25): u1 -> #1, u3 -> #1 (tie, u1 < u3), u2 -> #2.
  const questions: ScoreQuestionInput[] = [
    mkQ("q1", { sectionId: "s1", unitId: "u1", unitNumber: 1, unitTitle: "Unit 1", correctAnswer: "A", misconceptionTags: ["m1"] }),
    mkQ("q2", { sectionId: "s1", unitId: "u1", unitNumber: 1, unitTitle: "Unit 1", correctAnswer: "B", misconceptionTags: ["m2"] }),
    mkQ("q3", { sectionId: "s1", unitId: "u2", unitNumber: 2, unitTitle: "Unit 2", correctAnswer: "C", misconceptionTags: ["m3"] }),
    mkQ("q4", { sectionId: "s2", unitId: "u2", unitNumber: 2, unitTitle: "Unit 2", correctAnswer: "D", misconceptionTags: ["m4"] }),
    mkQ("q5", { sectionId: "s2", unitId: "u3", unitNumber: 1, unitTitle: "Unit 3", correctAnswer: "E", misconceptionTags: ["m5"] }),
  ];
  const answers: CapturedAnswerMap = {
    q1: real("A"), // correct
    q2: real("C"), // wrong real distractor -> shows tags
    q3: idk(), // IDK
    // q4 unanswered
    q5: real("E"), // correct
  };

  it("asserts the entire ScoreResult shape", () => {
    const r = scoreExam(questions, answers);

    // Overall (r19, r24).
    expect(r.overall).toEqual({
      correct: 2,
      total: 5,
      percent: 2 / 5,
      idkCount: 1,
      unansweredCount: 1,
    });

    // Sections in first-appearance order (r21, r25).
    expect(r.sections).toEqual([
      { sectionId: "s1", correct: 1, total: 3 },
      { sectionId: "s2", correct: 1, total: 2 },
    ]);

    // Units sorted by unitNumber then unitId (r22, r23, r25).
    expect(r.units).toEqual([
      { unitId: "u1", unitNumber: 1, title: "Unit 1", correct: 1, answered: 2, total: 2, accuracy: 1 / 2 },
      { unitId: "u3", unitNumber: 1, title: "Unit 3", correct: 1, answered: 1, total: 1, accuracy: 1 },
      { unitId: "u2", unitNumber: 2, title: "Unit 2", correct: 0, answered: 0, total: 2, accuracy: 0 },
    ]);

    // Questions in input order (r25).
    expect(r.questions.map((x) => x.questionId)).toEqual(["q1", "q2", "q3", "q4", "q5"]);

    // misconceptionTagsToShow ONLY on the real wrong distractor (r20).
    expect(qById(r, "q1").misconceptionTagsToShow).toEqual([]); // correct
    expect(qById(r, "q2").misconceptionTagsToShow).toEqual(["m2"]); // wrong real
    expect(qById(r, "q3").misconceptionTagsToShow).toEqual([]); // IDK
    expect(qById(r, "q4").misconceptionTagsToShow).toEqual([]); // unanswered
    expect(qById(r, "q5").misconceptionTagsToShow).toEqual([]); // correct

    // Spot-check the full per-question shapes for the representative cases.
    expect(qById(r, "q1")).toEqual({
      questionId: "q1",
      selectedAnswer: "A",
      isIDK: false,
      isCorrect: true,
      correctAnswer: "A",
      misconceptionTagsToShow: [],
    });
    expect(qById(r, "q2")).toEqual({
      questionId: "q2",
      selectedAnswer: "C",
      isIDK: false,
      isCorrect: false,
      correctAnswer: "B",
      misconceptionTagsToShow: ["m2"],
    });
    expect(qById(r, "q4")).toEqual({
      questionId: "q4",
      selectedAnswer: "",
      isIDK: false,
      isCorrect: false,
      correctAnswer: "D",
      misconceptionTagsToShow: [],
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Trimming: " A " === "A" (r16)
// ---------------------------------------------------------------------------
describe("scoreExam: trimming (case 6, r16)", () => {
  it("trims both the captured answer and the correctAnswer", () => {
    const questions = [
      mkQ("q1", { correctAnswer: "A" }),
      mkQ("q2", { correctAnswer: "  B  " }),
    ];
    const answers: CapturedAnswerMap = {
      q1: real("  A  "),
      q2: real("B"),
    };
    const r = scoreExam(questions, answers);
    expect(qById(r, "q1").isCorrect).toBe(true);
    expect(qById(r, "q2").isCorrect).toBe(true);
    expect(r.overall.correct).toBe(2);
  });

  it("does NOT ignore internal whitespace", () => {
    const questions = [mkQ("q1", { correctAnswer: "AB" })];
    const r = scoreExam(questions, { q1: real("A B") });
    expect(qById(r, "q1").isCorrect).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Empty input -> all zeros + empty arrays (r24)
// ---------------------------------------------------------------------------
describe("scoreExam: empty input (case 7, r24)", () => {
  it("yields all zeros, empty arrays, and no NaN", () => {
    const r = scoreExam([], {});
    expect(r.overall).toEqual({
      correct: 0,
      total: 0,
      percent: 0,
      idkCount: 0,
      unansweredCount: 0,
    });
    expect(r.sections).toEqual([]);
    expect(r.units).toEqual([]);
    expect(r.questions).toEqual([]);
    expect(Number.isNaN(r.overall.percent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Ordering: units by unitNumber then unitId; sections by first appearance (r25)
// ---------------------------------------------------------------------------
describe("scoreExam: ordering (case 8, r25)", () => {
  it("sorts units by unitNumber asc, ties by unitId asc", () => {
    const questions = [
      mkQ("q1", { unitId: "u2", unitNumber: 2, correctAnswer: "A" }),
      mkQ("q2", { unitId: "u1", unitNumber: 2, correctAnswer: "B" }),
      mkQ("q3", { unitId: "u0", unitNumber: 1, correctAnswer: "C" }),
    ];
    const r = scoreExam(questions, {
      q1: real("A"),
      q2: real("B"),
      q3: real("C"),
    });
    expect(r.units.map((u) => u.unitId)).toEqual(["u0", "u1", "u2"]);
  });

  it("orders sections by first appearance of sectionId", () => {
    const questions = [
      mkQ("q1", { sectionId: "zeta", correctAnswer: "A" }),
      mkQ("q2", { sectionId: "alpha", correctAnswer: "B" }),
      mkQ("q3", { sectionId: "zeta", correctAnswer: "C" }),
    ];
    const r = scoreExam(questions, {
      q1: real("A"),
      q2: real("B"),
      q3: real("C"),
    });
    expect(r.sections.map((s) => s.sectionId)).toEqual(["zeta", "alpha"]);
  });

  it("keeps questions in input order and is deterministic", () => {
    const questions = [
      mkQ("qz", { correctAnswer: "A" }),
      mkQ("qa", { correctAnswer: "B" }),
    ];
    const answers: CapturedAnswerMap = { qz: real("A"), qa: real("B") };
    const a = scoreExam(questions, answers);
    const b = scoreExam(questions, answers);
    expect(a.questions.map((x) => x.questionId)).toEqual(["qz", "qa"]);
    expect(b).toEqual(a);
  });
});

// ---------------------------------------------------------------------------
// Extra coverage: all-correct / all-unanswered boundaries
// ---------------------------------------------------------------------------
describe("scoreExam: boundaries", () => {
  it("all correct -> percent 1 and unit accuracy 1", () => {
    const questions = [
      mkQ("q1", { correctAnswer: "A" }),
      mkQ("q2", { correctAnswer: "B" }),
    ];
    const r = scoreExam(questions, { q1: real("A"), q2: real("B") });
    expect(r.overall.percent).toBe(1);
    expect(r.units[0].accuracy).toBe(1);
    expect(r.units[0].answered).toBe(2);
  });

  it("a single wrong real answer shows tags and percent 0", () => {
    const questions = [mkQ("q1", { correctAnswer: "A", misconceptionTags: ["m1"] })];
    const r = scoreExam(questions, { q1: real("B") });
    expect(r.overall.percent).toBe(0);
    expect(qById(r, "q1").misconceptionTagsToShow).toEqual(["m1"]);
  });
});

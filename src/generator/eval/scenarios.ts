/**
 * Golden eval scenarios for the question generator (master plan §7.9).
 *
 * Every scenario is mock-backed and crafted against REAL repo data — the
 * real archetypes under research/sat/archetypes/, the real misconception
 * slices in database/<subject>/misconceptions.json, the real
 * generated-question schema, and the real sat-math:graph-system-two-lines
 * paramsSchema (parameters reused from the hand-authored fixture
 * research/sat/test-fixtures/generated-math-systems-001.json). The harness
 * therefore exercises the actual deterministic gates, not stubs of them.
 *
 * Categories:
 *   happy     — valid output on the first attempt
 *   repair    — invalid first attempt, valid on retry (tests the repair loop)
 *   rejection — every attempt fails (or the model terminally refuses)
 *   contract  — output contract edges (pipeline-field stripping, grid_in)
 *
 * To add a scenario: append an entry to SCENARIOS. A prompt/model change that
 * introduces a NEW failure mode must add a scenario pinning that mode.
 */

import type { MockScript } from '../../llm/index.js';

export interface EvalScenario {
  name: string;
  description: string;
  request: {
    subjectCode: 'SAT_RW' | 'SAT_MATH';
    skill: string;
    difficulty: 2 | 3 | 4;
    withDiagram?: boolean;
  };
  /** Consumed in order, one per provider.complete() call (i.e. per attempt). */
  scripts: MockScript[];
  /** attempts = exact attempt count when given. */
  expect: { outcome: 'accepted' | 'rejected'; attempts?: number };
  category: 'happy' | 'repair' | 'rejection' | 'contract';
}

// --- crafted model outputs (model-owned fields only, per the OUTPUT CONTRACT) -----

/** Valid SAT_RW transitions draft (difficulty 3), style of the hand-authored fixture. */
const VALID_RW_DRAFT = {
  questionType: 'mcq',
  stimulus: {
    type: 'passage',
    text: 'The Lorne public library lends telescope kits to any resident who presents a library card, and all six branch desks participate in the program. ______, cardholders may also reserve the kits online and collect them at whichever branch they choose, a service introduced after the library system merged with the county consortium.',
    tableJson: null,
    diagram: null,
  },
  stem: 'Which choice completes the text with the most logical transition?',
  choices: [
    { id: 'A', text: 'However,', misconceptionId: 'SAT_RW:transitions-wrong-relation' },
    { id: 'B', text: 'Moreover,', misconceptionId: null },
    { id: 'C', text: 'Conversely,', misconceptionId: 'SAT_RW:transitions-polarity-reversal' },
    { id: 'D', text: 'For example,', misconceptionId: 'SAT_RW:transitions-false-exemplification' },
  ],
  correctAnswer: 'B',
  rationale:
    "Sentence 2 extends sentence 1's claim about access rather than contrasting or illustrating it: branch-desk lending is joined by an additional online reservation service, which is a relationship of addition, and 'Moreover' names it. 'However' misdiagnoses the pair as contrast. 'Conversely' treats a parallel expansion as a reversed case — the wrong polarity within the wrong family. 'For example' fails because online reservation is a widening of the same service, not an instance of branch-desk lending.",
  difficultyTarget: 3,
} as const;

/** Same valid draft but only 3 choices — violates the mcq minItems: 4 gate. */
const THREE_CHOICE_RW_DRAFT = {
  ...VALID_RW_DRAFT,
  choices: VALID_RW_DRAFT.choices.slice(0, 3),
};

/**
 * Valid SAT_MATH systems-linear-equations draft with a figure; diagram
 * parameters are exactly the hand-authored fixture's (known to satisfy
 * sat-math:graph-system-two-lines paramsSchema).
 */
const VALID_MATH_DIAGRAM_DRAFT = {
  questionType: 'mcq',
  stimulus: {
    type: 'figure',
    text: null,
    tableJson: null,
    diagram: {
      archetypeId: 'sat-math:graph-system-two-lines',
      parameters: {
        line1: { slope: 2, yIntercept: -5, label: 'l' },
        line2: { slope: -0.5, yIntercept: 5, label: 'm' },
        intersectionIsInteger: true,
        markIntersection: true,
        xRange: { min: -5, max: 10 },
        labelLines: true,
      },
    },
  },
  stem: 'The graph shows the lines \\(2x - y = 5\\) and \\(x + 2y = 10\\) in the \\(xy\\)-plane. The two lines intersect at point \\(P\\). What is the \\(y\\)-coordinate of \\(P\\)?',
  choices: [
    { id: 'A', text: '1', misconceptionId: 'SAT_MATH:systems-linear-equations-elimination-scales-one-side-only' },
    { id: 'B', text: '3', misconceptionId: null },
    { id: 'C', text: '4', misconceptionId: 'SAT_MATH:systems-linear-equations-solving-for-x-when-asked-for-y' },
    { id: 'D', text: '5', misconceptionId: 'SAT_MATH:systems-linear-equations-adding-when-subtracting-needed' },
  ],
  correctAnswer: 'B',
  rationale:
    'Line \\(l\\) is \\(y = 2x - 5\\) and line \\(m\\) is \\(y = -0.5x + 5\\). Setting them equal gives \\(2.5x = 10\\), so \\(x = 4\\) and \\(y = 3\\) — the marked intersection \\(P = (4, 3)\\), confirmed by substitution into either equation. Choice C reports the x-coordinate: the correct solution with the wrong component. Choice A comes from scaling only the variable terms when aligning coefficients (\\(2x + 4y = 10\\)), which yields \\(y = 1\\). Choice D comes from subtracting the left sides while adding the right sides (\\(5y = 25\\)), which yields \\(y = 5\\).',
  difficultyTarget: 3,
} as const;

/** Same diagram draft but xRange.min = -12 violates the paramsSchema minimum of -10. */
const OUT_OF_BOUNDS_DIAGRAM_DRAFT = {
  ...VALID_MATH_DIAGRAM_DRAFT,
  stimulus: {
    ...VALID_MATH_DIAGRAM_DRAFT.stimulus,
    diagram: {
      ...VALID_MATH_DIAGRAM_DRAFT.stimulus.diagram,
      parameters: {
        ...VALID_MATH_DIAGRAM_DRAFT.stimulus.diagram.parameters,
        xRange: { min: -12, max: 10 },
      },
    },
  },
};

/** Valid draft PLUS spoofed pipeline fields — every one must be stripped/overridden. */
const BOSSY_RW_DRAFT = {
  ...VALID_RW_DRAFT,
  id: 'gen-sat-rw-transitions-999',
  subjectCode: 'SAT_MATH',
  taxonomyCode: 'SAT_MATH:circles',
  provenance: {
    archetypeSlug: 'circles',
    promptVersion: '0.0.0',
    model: 'spoofed',
    generatedAt: '1970-01-01T00:00:00Z',
    contentHash: 'spoofed',
  },
  review: { status: 'approved', reviewer: 'the-model-itself', notes: 'trust me' },
  allowedUses: ['display', 'eval'],
  variantOf: 'gen-sat-rw-transitions-001',
};

/** Valid grid_in draft for percentages (reverse-percent): empty choices, numeric key. */
const VALID_GRID_IN_PERCENTAGES_DRAFT = {
  questionType: 'grid_in',
  stimulus: {
    type: 'passage',
    text: 'During a clearance event, the price of a graphing calculator was marked up by 25% when the event ended, bringing the shelf price to $60.',
    tableJson: null,
    diagram: null,
  },
  stem: 'The price of the item was $60 after a 25% increase. What was the original price, in dollars?',
  choices: [],
  correctAnswer: '48',
  rationale:
    'Reverse percent: the original price is the final price divided by 1.25, so 60 / 1.25 = 48. Check forward: 25% of 48 is 12, and 48 + 12 = 60. Subtracting 25% of the final value (60 − 15 = 45) is the classic wrong-base back-solve.',
  difficultyTarget: 3,
} as const;

/** Valid SAT_MATH one-variable-data statement mcq (PSDA domain), difficulty 3. */
const VALID_ONE_VARIABLE_DATA_DRAFT = {
  questionType: 'mcq',
  stimulus: {
    type: 'passage',
    text: 'The ages of the 9 members of a chess club are 14, 15, 15, 16, 16, 17, 18, 19, and 68.',
    tableJson: null,
    diagram: null,
  },
  stem: 'A value of 30 is added to the data set. Which statistic changes by the greater amount, the mean or the median?',
  choices: [
    { id: 'A', text: 'The mean changes by the greater amount.', misconceptionId: null },
    { id: 'B', text: 'The median changes by the greater amount.', misconceptionId: 'SAT_MATH:one-variable-data-mean-vs-median-confusion' },
    { id: 'C', text: 'The mean and the median change by the same amount.', misconceptionId: 'SAT_MATH:one-variable-data-outlier-effect-misassigned' },
    { id: 'D', text: 'Neither the mean nor the median changes.', misconceptionId: 'SAT_MATH:one-variable-data-median-of-unordered-list' },
  ],
  correctAnswer: 'A',
  rationale:
    'The original mean is 198/9 = 22 and the original median is 16. Adding 30 gives a mean of 228/10 = 22.8 (a change of 0.8) and a median of (16 + 17)/2 = 16.5 (a change of 0.5), so the mean changes by the greater amount. Choice B assumes the median, as the middle value, must move most — but the inserted value lands near the existing middle, nudging the median by only 0.5. Choice C treats the statistics as equally robust; the mean is pulled by every value while the median is not. Choice D misses that both statistics recomputed over 10 values do move.',
  difficultyTarget: 3,
} as const;

// --- helpers ----------------------------------------------------------------------

const script = (draft: object): MockScript => ({ content: JSON.stringify(draft) });
const repeat = (s: MockScript, n: number): MockScript[] => Array.from({ length: n }, () => s);

// --- the golden set -----------------------------------------------------------------

export const SCENARIOS: EvalScenario[] = [
  {
    name: 'happy-rw-transitions',
    description: 'RW transitions item, valid on the first attempt',
    request: { subjectCode: 'SAT_RW', skill: 'transitions', difficulty: 3 },
    scripts: [script(VALID_RW_DRAFT)],
    expect: { outcome: 'accepted', attempts: 1 },
    category: 'happy',
  },
  {
    name: 'happy-math-systems-diagram',
    description: 'Math systems item with a two-line graph figure, valid on the first attempt (fixture params)',
    request: { subjectCode: 'SAT_MATH', skill: 'systems-linear-equations', difficulty: 3, withDiagram: true },
    scripts: [script(VALID_MATH_DIAGRAM_DRAFT)],
    expect: { outcome: 'accepted', attempts: 1 },
    category: 'happy',
  },
  {
    name: 'repair-three-choices-then-valid',
    description: 'Attempt 1 emits only 3 choices (schema gate), attempt 2 is valid',
    request: { subjectCode: 'SAT_RW', skill: 'transitions', difficulty: 3 },
    scripts: [script(THREE_CHOICE_RW_DRAFT), script(VALID_RW_DRAFT)],
    expect: { outcome: 'accepted', attempts: 2 },
    category: 'repair',
  },
  {
    name: 'repair-diagram-params-out-of-bounds',
    description: 'Attempt 1 diagram xRange.min = -12 (params gate), attempt 2 is valid',
    request: { subjectCode: 'SAT_MATH', skill: 'systems-linear-equations', difficulty: 3, withDiagram: true },
    scripts: [script(OUT_OF_BOUNDS_DIAGRAM_DRAFT), script(VALID_MATH_DIAGRAM_DRAFT)],
    expect: { outcome: 'accepted', attempts: 2 },
    category: 'repair',
  },
  {
    name: 'rejection-always-invalid',
    description: 'All 4 attempts emit a 3-choice draft; the budget exhausts into GenerateError',
    request: { subjectCode: 'SAT_RW', skill: 'transitions', difficulty: 3 },
    scripts: repeat(script(THREE_CHOICE_RW_DRAFT), 4),
    expect: { outcome: 'rejected', attempts: 4 },
    category: 'rejection',
  },
  {
    name: 'contract-pipeline-fields-stripped',
    description: 'Model emits spoofed id/provenance/review/allowedUses alongside valid content; pipeline values must win',
    request: { subjectCode: 'SAT_RW', skill: 'transitions', difficulty: 3 },
    scripts: [script(BOSSY_RW_DRAFT)],
    expect: { outcome: 'accepted', attempts: 1 },
    category: 'contract',
  },
  {
    name: 'rejection-terminal-model-error',
    description: 'Model refuses with {"error": ...} — terminal, exactly 1 attempt, no retry',
    request: { subjectCode: 'SAT_RW', skill: 'transitions', difficulty: 4 },
    scripts: [
      {
        content:
          '{"error": "requested difficulty unreachable: the archetype levers cannot produce a hard item with this stem template"}',
      },
    ],
    expect: { outcome: 'rejected', attempts: 1 },
    category: 'rejection',
  },
  {
    name: 'contract-grid-in-empty-choices',
    description: 'Percentages grid_in with empty choices and a numeric-string key is accepted',
    request: { subjectCode: 'SAT_MATH', skill: 'percentages', difficulty: 3 },
    scripts: [script(VALID_GRID_IN_PERCENTAGES_DRAFT)],
    expect: { outcome: 'accepted', attempts: 1 },
    category: 'contract',
  },
  {
    name: 'happy-psda-one-variable-data',
    description: 'PSDA one-variable-data statement item (mean vs median robustness), valid on the first attempt',
    request: { subjectCode: 'SAT_MATH', skill: 'one-variable-data', difficulty: 3 },
    scripts: [script(VALID_ONE_VARIABLE_DATA_DRAFT)],
    expect: { outcome: 'accepted', attempts: 1 },
    category: 'happy',
  },
];

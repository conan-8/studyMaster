/**
 * generate() orchestration tests, driven by the scripted MockProvider.
 *
 * Every "valid" mock output is crafted against REAL repo data (the real
 * transitions / systems-linear-equations archetypes, the real misconception
 * slices, the real generated-question schema and the real
 * sat-math:graph-system-two-lines paramsSchema) so these tests exercise the
 * actual gates, not stubs of them.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormatsPlugin from 'ajv-formats';

import { MockProvider } from '../llm/index.js';
import type { LLMRequest, LLMResponse } from '../llm/index.js';
import type { MockScript } from '../llm/index.js';
import { findRepoRoot } from './prompts.js';
import { assembleInputs } from './inputs.js';
import { nextId } from './ids.js';
import { validateDraft } from './validate-output.js';
import type { DraftQuestion } from './validate-output.js';
import { canonicalJson, GenerateError, generateQuestion, numericEquals } from './generate.js';
import { shuffleChoices } from './shuffle.js';
import { checkDuplicate, loadExistingQuestions, resetDedupCache } from './dedup.js';
import { assertValidParams } from '../renderers/lib/diagram.js';

// --- test helpers ---------------------------------------------------------------

/** MockProvider subclass that records every request for repair-loop assertions. */
class RecordingMockProvider extends MockProvider {
  readonly calls: LLMRequest[] = [];
  override async complete(req: LLMRequest): Promise<LLMResponse> {
    this.calls.push(req);
    return super.complete(req);
  }
}

function compileSchema(): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false });
  type FormatsPluginFn = (instance: Ajv) => Ajv;
  const addFormats: FormatsPluginFn =
    (addFormatsPlugin as unknown as { default?: FormatsPluginFn }).default ??
    (addFormatsPlugin as unknown as FormatsPluginFn);
  addFormats(ajv);
  const schemaFile = path.join(findRepoRoot(), 'schemas', 'generated-question.schema.json');
  return ajv.compile(JSON.parse(fs.readFileSync(schemaFile, 'utf8')) as object);
}

const validateQuestion = compileSchema();

/** Independent recompute of the documented hash convention (sorted keys, no whitespace, minus contentHash). */
function recomputeContentHash(question: Record<string, unknown>): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = sort((value as Record<string, unknown>)[key]);
      }
      return out;
    }
    return value;
  };
  const provenance = question.provenance as Record<string, unknown>;
  const { contentHash: _ignored, ...provenanceRest } = provenance;
  const hashInput = { ...question, provenance: provenanceRest };
  return createHash('sha256').update(JSON.stringify(sort(hashInput))).digest('hex');
}

const FIXED_NOW = () => new Date('2026-08-24T09:00:00.000Z');
const FIXED_ID = () => 'gen-sat-rw-transitions-042';

// --- crafted model outputs (real repo data) ---------------------------------------

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
};

const VALID_MATH_DIAGRAM_DRAFT = {
  questionType: 'mcq',
  stimulus: {
    type: 'figure',
    text: null,
    tableJson: null,
    diagram: {
      archetypeId: 'sat-math:graph-system-two-lines',
      parameters: {
        // slope deliberately a JSON number-as-string: exercises re-serialization
        line1: { slope: '2', yIntercept: -5, label: 'l' },
        line2: { slope: -0.5, yIntercept: 5, label: 'm' },
        intersectionIsInteger: true,
        markIntersection: true,
        xRange: { min: -5, max: 10 },
        labelLines: true,
      },
    },
  },
  stem: 'The graph shows the lines \\(l\\) and \\(m\\) in the \\(xy\\)-plane. The two lines intersect at point \\(P\\). What is the \\(y\\)-coordinate of \\(P\\)?',
  choices: [
    { id: 'A', text: '1', misconceptionId: 'SAT_MATH:systems-linear-equations-elimination-scales-one-side-only' },
    { id: 'B', text: '3', misconceptionId: null },
    { id: 'C', text: '4', misconceptionId: 'SAT_MATH:systems-linear-equations-solving-for-x-when-asked-for-y' },
    { id: 'D', text: '5', misconceptionId: 'SAT_MATH:systems-linear-equations-adding-when-subtracting-needed' },
  ],
  correctAnswer: 'B',
  rationale:
    'Line \\(l\\) has equation \\(y = 2x - 5\\) and line \\(m\\) has equation \\(y = -0.5x + 5\\). Setting them equal gives \\(2.5x = 10\\), so \\(x = 4\\) and \\(y = 3\\) — the marked intersection \\(P = (4, 3)\\), and substitution into either equation confirms it. Choice C reports the x-coordinate: the correct solution with the wrong component, the classic re-read-the-ask trap. Choice A comes from scaling only the variable terms when aligning coefficients (\\(2x + 4y = 10\\)), which yields \\(y = 1\\). Choice D comes from subtracting the left sides while adding the right sides (\\(5y = 25\\)), which yields \\(y = 5\\).',
  difficultyTarget: 3,
};

const THREE_CHOICE_DRAFT = {
  ...VALID_RW_DRAFT,
  choices: VALID_RW_DRAFT.choices.slice(0, 3),
};

// --- input assembly ----------------------------------------------------------------

test('assembleInputs loads real archetype + misconception slice for transitions', () => {
  const inputs = assembleInputs('SAT_RW', 'transitions', 3, false);
  assert.equal(inputs.subjectCode, 'SAT_RW');
  assert.equal(inputs.skill, 'transitions');
  assert.equal(inputs.difficulty, 3);
  assert.equal(inputs.withDiagram, false);
  assert.deepEqual(inputs.diagramArchetypeIds, []);
  assert.ok(inputs.misconceptions.length >= 5, 'transitions has five library misconceptions');
  assert.ok(
    inputs.misconceptions.every((m) =>
      /^SAT_RW:transitions-[a-z-]+$/.test(m.id) &&
      typeof m.name === 'string' &&
      typeof m.description === 'string' &&
      typeof m.detectionSignal === 'string',
    ),
  );
  assert.ok(inputs.promptUserMessage.includes('```json'));
  assert.ok(inputs.promptUserMessage.includes('SAT_RW:transitions'));
  assert.ok(inputs.promptUserMessage.includes('"distractorLogic"'));
  assert.ok(!inputs.promptUserMessage.includes('Diagram (this item requires a figure)'));
});

test('assembleInputs injects first allowed diagram archetype only when withDiagram', () => {
  const inputs = assembleInputs('SAT_MATH', 'systems-linear-equations', 3, true);
  assert.deepEqual(inputs.diagramArchetypeIds, ['sat-math:graph-system-two-lines']);
  assert.ok(inputs.promptUserMessage.includes('sat-math:graph-system-two-lines'));
  assert.ok(inputs.promptUserMessage.includes('"paramsSchema"'));
  assert.ok(inputs.promptUserMessage.includes('Classic grid-in territory'), 'questionTypeNotes guidance embedded');
});

test('assembleInputs throws listing available skills on unknown skill', () => {
  assert.throws(
    () => assembleInputs('SAT_RW', 'no-such-skill', 3, false),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /no-such-skill/);
      assert.match(err.message, /transitions/);
      return true;
    },
  );
});

test('assembleInputs casts difficulty and subject strictly', () => {
  assert.throws(() => assembleInputs('SAT_RW', 'transitions', 5 as unknown as 3, false), /difficulty/);
  assert.throws(
    () => assembleInputs('SAT_HISTORY' as unknown as 'SAT_RW', 'transitions', 3, false),
    /SAT_HISTORY/,
  );
});

test('assembleInputs rejects withDiagram for a skill without diagramSpec, naming diagram-capable skills', () => {
  assert.throws(
    () => assembleInputs('SAT_RW', 'transitions', 3, true),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /transitions/);
      assert.match(err.message, /No SAT_RW skill supports diagrams/);
      return true;
    },
  );
});

// --- nextId -----------------------------------------------------------------------

test('nextId continues from existing fixtures in both namespaces', () => {
  assert.equal(nextId('SAT_RW', 'transitions'), 'gen-sat-rw-transitions-003');
  // the math fixture uses the short slug 'systems', which is a DIFFERENT
  // namespace from the full skill slug — the anchored regex must not match it
  assert.equal(nextId('SAT_MATH', 'systems-linear-equations'), 'gen-sat-math-systems-linear-equations-002');
  assert.equal(nextId('SAT_MATH', 'systems'), 'gen-sat-math-systems-002');
  assert.equal(nextId('SAT_MATH', 'area-volume'), 'gen-sat-math-area-volume-002'); // sweep draft exists
});

// --- (a) valid first try ------------------------------------------------------------

test('(a) valid first attempt: accepted, schema-valid, hash recomputes', async () => {
  const provider = new MockProvider('mock-model-xyz', [{ content: JSON.stringify(VALID_RW_DRAFT) }]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });

  assert.equal(result.attempts.length, 1);
  assert.deepEqual(result.attempts[0], {
    attempt: 1,
    outcome: 'accepted',
    usage: { promptTokens: 0, completionTokens: 0 },
  });
  assert.equal(result.promptVersion, '1.2.0');
  assert.equal(result.model, 'mock-model-xyz');

  const question = result.question as Record<string, unknown>;
  assert.equal(question.id, 'gen-sat-rw-transitions-042');
  assert.equal(question.subjectCode, 'SAT_RW');
  assert.equal(question.taxonomyCode, 'SAT_RW:transitions');
  assert.deepEqual(question.allowedUses, ['display']);
  assert.equal(question.variantOf, null);

  // schema-valid with an independent ajv instance
  assert.ok(validateQuestion(question), `schema errors: ${JSON.stringify(validateQuestion.errors)}`);

  // review is pipeline-pending, never model-supplied
  assert.deepEqual(question.review, { status: 'pending', reviewer: null, notes: null });

  // key choice carries misconceptionId null — found position-agnostically,
  // because the deterministic shuffle may have moved it off 'B'
  const choices = question.choices as { id: string; text: string; misconceptionId: string | null }[];
  const keys = choices.filter((c) => c.misconceptionId === null);
  assert.equal(keys.length, 1, 'exactly one key choice');
  assert.equal(question.correctAnswer, keys[0]!.id, 'correctAnswer names the key after shuffling');
  assert.deepEqual(
    choices.map((c) => c.id),
    ['A', 'B', 'C', 'D'],
    'choices re-lettered A-D in shuffled order',
  );
  // the four choice texts survive the shuffle as a SET
  assert.deepEqual(
    choices.map((c) => c.text).sort(),
    VALID_RW_DRAFT.choices.map((c) => c.text).sort(),
  );

  // provenance + documented contentHash convention
  const provenance = question.provenance as Record<string, string>;
  assert.equal(provenance.archetypeSlug, 'transitions');
  assert.equal(provenance.promptVersion, '1.2.0');
  assert.equal(provenance.model, 'mock-model-xyz');
  assert.equal(provenance.generatedAt, '2026-08-24T09:00:00.000Z');
  assert.equal(recomputeContentHash(question), provenance.contentHash);
});

// --- (b) invalid then valid -----------------------------------------------------------

test('(b) invalid-then-valid: two attempts, repair message carries error strings', async () => {
  const invalid = {
    ...VALID_RW_DRAFT,
    difficultyTarget: 4, // cross-check: must echo requested 3
    choices: VALID_RW_DRAFT.choices.map((c, i) =>
      i === 2 ? { ...c, misconceptionId: 'SAT_RW:transitions-not-in-library' } : c,
    ),
  };
  const provider = new RecordingMockProvider('mock-model-xyz', [
    { content: JSON.stringify(invalid) },
    { content: JSON.stringify(VALID_RW_DRAFT) },
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });

  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0]!.outcome, 'rejected');
  const firstErrors = result.attempts[0]!.errors!;
  assert.ok(firstErrors.some((e) => e.startsWith('/difficultyTarget')), 'jsonPath error present');
  assert.ok(
    firstErrors.some((e) => e.includes("SAT_RW:transitions-not-in-library")),
    'misconception membership error present',
  );
  assert.equal(result.attempts[1]!.outcome, 'repaired');

  // retry conversation shape: [system, user, assistant(previous raw), user(repair)]
  assert.equal(provider.calls.length, 2);
  const retryMessages = provider.calls[1]!.messages;
  assert.equal(retryMessages.length, 4);
  assert.equal(retryMessages[0]!.role, 'system');
  assert.equal(retryMessages[1]!.role, 'user');
  assert.equal(retryMessages[2]!.role, 'assistant');
  assert.equal(retryMessages[2]!.content, JSON.stringify(invalid), 'assistant echo is previous raw output');
  const repair = retryMessages[3]!;
  assert.equal(repair.role, 'user');
  assert.ok(repair.content.startsWith('Your output failed validation. Fix ALL of these'));
  assert.ok(repair.content.includes('- /difficultyTarget must equal the requested difficulty 3'));
  assert.ok(repair.content.includes('SAT_RW:transitions-not-in-library'));

  assert.ok(validateQuestion(result.question), 'final question is schema-valid');
});

// --- (c) always invalid ---------------------------------------------------------------

test('(c) always-invalid: GenerateError aggregates attempt numbers + errors', async () => {
  const scripts: MockScript[] = Array.from({ length: 4 }, () => ({
    content: JSON.stringify(THREE_CHOICE_DRAFT),
  }));
  const provider = new MockProvider('mock-model-xyz', scripts);
  await assert.rejects(
    generateQuestion({
      subjectCode: 'SAT_RW',
      skill: 'transitions',
      difficulty: 3,
      provider,
      now: FIXED_NOW,
      idAllocator: FIXED_ID,
    }),
    (err: unknown) => {
      assert.ok(err instanceof GenerateError, `expected GenerateError, got ${err}`);
      const genErr = err as GenerateError;
      assert.equal(genErr.attempts.length, 4);
      assert.ok(genErr.attempts.every((a) => a.outcome === 'rejected'));
      assert.ok(genErr.attempts.every((a) => (a.errors ?? []).some((e) => e.startsWith('/choices'))));
      assert.match(genErr.message, /attempt 1/);
      assert.match(genErr.message, /attempt 4/);
      assert.match(genErr.message, /fewer than 4 items/);
      return true;
    },
  );
});

// --- (d) terminal {"error": ...} --------------------------------------------------------

test('(d) {"error": ...} is terminal — one attempt, no retry', async () => {
  const provider = new RecordingMockProvider('mock-model-xyz', [
    { content: '{"error": "requested difficulty unreachable: the archetype levers cannot produce a hard item with this stem template"}' },
  ]);
  await assert.rejects(
    generateQuestion({
      subjectCode: 'SAT_RW',
      skill: 'transitions',
      difficulty: 3,
      provider,
      now: FIXED_NOW,
      idAllocator: FIXED_ID,
    }),
    (err: unknown) => {
      assert.ok(err instanceof GenerateError);
      const genErr = err as GenerateError;
      assert.equal(genErr.attempts.length, 1);
      assert.equal(genErr.attempts[0]!.outcome, 'rejected');
      assert.match(genErr.attempts[0]!.errors![0]!, /unreachable/);
      assert.match(genErr.message, /unreachable/);
      return true;
    },
  );
  assert.equal(provider.calls.length, 1, 'no second provider call after a terminal refusal');
});

// --- (e) fence stripping ------------------------------------------------------------------

test('(e) model output wrapped in ```json fences is still accepted', async () => {
  const fenced = '```json\n' + JSON.stringify(VALID_RW_DRAFT, null, 2) + '\n```';
  const provider = new MockProvider('mock-model-xyz', [{ content: fenced }]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.outcome, 'accepted');
  assert.ok(validateQuestion(result.question));
});

// --- (f) diagram path ----------------------------------------------------------------------

test('(f) diagram: valid params accepted, string-numbers re-serialized, assertValidParams passes', async () => {
  const provider = new MockProvider('mock-model-xyz', [{ content: JSON.stringify(VALID_MATH_DIAGRAM_DRAFT) }]);
  const result = await generateQuestion({
    subjectCode: 'SAT_MATH',
    skill: 'systems-linear-equations',
    difficulty: 3,
    withDiagram: true,
    provider,
    now: FIXED_NOW,
    idAllocator: (_subject, skill) => `gen-sat-math-${skill}-007`,
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.outcome, 'accepted');

  const question = result.question as Record<string, unknown>;
  assert.ok(validateQuestion(question), `schema errors: ${JSON.stringify(validateQuestion.errors)}`);
  const diagram = (question.stimulus as { diagram: { archetypeId: string; parameters: Record<string, unknown> } }).diagram;
  assert.equal(diagram.archetypeId, 'sat-math:graph-system-two-lines');
  const line1 = diagram.parameters['line1'] as { slope: unknown };
  assert.equal(line1.slope, 2);
  assert.equal(typeof line1.slope, 'number', 'string "2" re-serialized to number 2');
  assert.doesNotThrow(() => assertValidParams(diagram.archetypeId, diagram.parameters));

  // the shuffle remapped the rationale's 'Choice X' references to follow the choices
  const outChoices = question.choices as { id: string; text: string }[];
  const letterOf = (text: string): string => outChoices.find((c) => c.text === text)!.id;
  const rationale = question.rationale as string;
  assert.ok(rationale.includes(`Choice ${letterOf('4')} reports the x-coordinate`), rationale);
  assert.ok(
    rationale.includes(`Choice ${letterOf('1')} comes from scaling only the variable terms`),
    rationale,
  );
  assert.ok(
    rationale.includes(`Choice ${letterOf('5')} comes from subtracting the left sides`),
    rationale,
  );
});

test('(f) diagram: invalid params repaired on attempt 2', async () => {
  const invalidParams = {
    ...VALID_MATH_DIAGRAM_DRAFT,
    stimulus: {
      ...VALID_MATH_DIAGRAM_DRAFT.stimulus,
      diagram: {
        ...VALID_MATH_DIAGRAM_DRAFT.stimulus.diagram,
        parameters: {
          ...VALID_MATH_DIAGRAM_DRAFT.stimulus.diagram.parameters,
          xRange: { min: -12, max: 10 }, // violates minimum -10
        },
      },
    },
  };
  const provider = new MockProvider('mock-model-xyz', [
    { content: JSON.stringify(invalidParams) },
    { content: JSON.stringify(VALID_MATH_DIAGRAM_DRAFT) },
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_MATH',
    skill: 'systems-linear-equations',
    difficulty: 3,
    withDiagram: true,
    provider,
    now: FIXED_NOW,
    idAllocator: (_subject, skill) => `gen-sat-math-${skill}-007`,
  });
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0]!.outcome, 'rejected');
  assert.ok(
    result.attempts[0]!.errors!.some((e) => e.startsWith('diagram/')),
    `diagram/-prefixed error present: ${JSON.stringify(result.attempts[0]!.errors)}`,
  );
  assert.equal(result.attempts[1]!.outcome, 'repaired');
  const question = result.question as Record<string, unknown>;
  assert.ok(validateQuestion(question));
  const diagram = (question.stimulus as { diagram: { archetypeId: string; parameters: unknown } }).diagram;
  assert.doesNotThrow(() => assertValidParams(diagram.archetypeId, diagram.parameters));
});

// --- (g) determinism -------------------------------------------------------------------------

test('(g) same scripts + fixed clock + fixed allocator → identical output', async () => {
  const run = async (): Promise<string> => {
    const provider = new MockProvider('mock-model-xyz', [{ content: JSON.stringify(VALID_RW_DRAFT) }]);
    const result = await generateQuestion({
      subjectCode: 'SAT_RW',
      skill: 'transitions',
      difficulty: 3,
      provider,
      now: FIXED_NOW,
      idAllocator: FIXED_ID,
    });
    return JSON.stringify(result.question);
  };
  assert.equal(await run(), await run());
});

// --- gate edges --------------------------------------------------------------------------------

test('validateDraft: diagram present without request, absent with request, both rejected', () => {
  const rwInputs = assembleInputs('SAT_RW', 'transitions', 3, false);
  const withDiagramUnasked = validateDraft(
    { ...VALID_RW_DRAFT, stimulus: { ...VALID_RW_DRAFT.stimulus, diagram: { archetypeId: 'sat-math:graph-line', parameters: {} } } },
    rwInputs,
  );
  assert.equal(withDiagramUnasked.ok, false);
  assert.ok((withDiagramUnasked as { errors: string[] }).errors.some((e) => e.startsWith('/stimulus/diagram')));

  const mathInputs = assembleInputs('SAT_MATH', 'systems-linear-equations', 3, true);
  const diagramMissing = validateDraft(
    { ...VALID_MATH_DIAGRAM_DRAFT, stimulus: { ...VALID_MATH_DIAGRAM_DRAFT.stimulus, diagram: null } },
    mathInputs,
  );
  assert.equal(diagramMissing.ok, false);
  assert.ok((diagramMissing as { errors: string[] }).errors.some((e) => e.startsWith('/stimulus/diagram')));
});

test('validateDraft: unparseable string collects the parse error', () => {
  const inputs = assembleInputs('SAT_RW', 'transitions', 3, false);
  const outcome = validateDraft('This is not JSON at all.', inputs);
  assert.equal(outcome.ok, false);
  assert.ok((outcome as { errors: string[] }).errors.length >= 1);
  assert.match((outcome as { errors: string[] }).errors[0]!, /^json:/);
});

test('validateDraft: strips pipeline keys the model emitted anyway', () => {
  const inputs = assembleInputs('SAT_RW', 'transitions', 3, false);
  const bossy = {
    ...VALID_RW_DRAFT,
    id: 'gen-sat-rw-transitions-999',
    subjectCode: 'SAT_MATH', // wrong on purpose — must be ignored, not trusted
    taxonomyCode: 'SAT_MATH:circles',
    provenance: { archetypeSlug: 'circles', promptVersion: '0.0.0', model: 'spoofed', generatedAt: '1970-01-01T00:00:00Z', contentHash: 'spoofed' },
    review: { status: 'approved', reviewer: 'the-model-itself', notes: 'trust me' },
    allowedUses: ['display', 'eval'],
    variantOf: 'gen-sat-rw-transitions-001',
  };
  const outcome = validateDraft(JSON.stringify(bossy), inputs);
  assert.equal(outcome.ok, true, JSON.stringify((outcome as { errors: string[] }).errors));
  const draft = (outcome as unknown as { draft: Record<string, unknown> }).draft;
  for (const key of ['id', 'subjectCode', 'taxonomyCode', 'provenance', 'review', 'allowedUses', 'variantOf']) {
    assert.ok(!(key in draft), `pipeline key '${key}' stripped from draft`);
  }
});

// --- (h) deterministic choice shuffle ------------------------------------------------

test('(h) shuffle: same draft + same seed → identical result; different seeds diverge', () => {
  const draft = VALID_RW_DRAFT as unknown as DraftQuestion;
  const a = shuffleChoices(draft, 'seed-alpha');
  const b = shuffleChoices(draft, 'seed-alpha');
  assert.deepEqual(a, b, 'same seed shuffles identically');
  const orders = new Set<string>();
  for (let i = 0; i < 24; i++) {
    orders.add(
      shuffleChoices(draft, `seed-${i}`)
        .choices.map((c) => c.text)
        .join('|'),
    );
  }
  assert.ok(orders.size > 1, 'different seeds eventually produce different orders');
});

test('(h) shuffle: key choice (misconceptionId null) maps to correctAnswer; re-lettered A-D', () => {
  const draft = VALID_RW_DRAFT as unknown as DraftQuestion;
  for (const seed of ['s-1', 's-2', 's-3']) {
    const out = shuffleChoices(draft, seed);
    assert.deepEqual(
      out.choices.map((c) => c.id),
      ['A', 'B', 'C', 'D'],
    );
    const key = out.choices.find((c) => c.misconceptionId === null);
    assert.ok(key, 'key choice survives the shuffle');
    assert.equal(out.correctAnswer, key!.id);
    assert.deepEqual(
      out.choices.map((c) => c.text).sort(),
      draft.choices.map((c) => c.text).sort(),
      'choice texts preserved as a set',
    );
  }
});

test('(h) shuffle: rationale "Choice X" references follow their choices; other mentions untouched', () => {
  const draft = {
    ...VALID_RW_DRAFT,
    choices: [
      { id: 'A', text: 'TA', misconceptionId: 'SAT_RW:transitions-wrong-relation' },
      { id: 'B', text: 'TB', misconceptionId: null },
      { id: 'C', text: 'TC', misconceptionId: 'SAT_RW:transitions-polarity-reversal' },
      { id: 'D', text: 'TD', misconceptionId: 'SAT_RW:transitions-false-exemplification' },
    ],
    rationale:
      'Choice A picks TA. Choice B picks TB. Choice C picks TC. Choice D picks TD. Choices A and Choices B are both plausible. The option C wording stays.',
  } as unknown as DraftQuestion;
  const out = shuffleChoices(draft, 'rationale-seed');
  for (const choice of out.choices) {
    assert.ok(
      out.rationale.includes(`Choice ${choice.id} picks ${choice.text}.`),
      `rationale keeps Choice ${choice.id} attached to ${choice.text}: ${out.rationale}`,
    );
  }
  const letterOfText = (t: string): string => out.choices.find((c) => c.text === t)!.id;
  assert.ok(
    out.rationale.includes(
      `Choices ${letterOfText('TA')} and Choices ${letterOfText('TB')} are both plausible`,
    ),
    `plural 'Choices X and Choices Y' references remapped: ${out.rationale}`,
  );
  assert.ok(out.rationale.includes('The option C wording stays.'), 'non-"Choice X" mention untouched');
});

test('(h) shuffle: grid_in is a no-op', () => {
  const gridDraft = {
    ...VALID_RW_DRAFT,
    questionType: 'grid_in',
    choices: [],
    correctAnswer: '8',
  } as unknown as DraftQuestion;
  const out = shuffleChoices(gridDraft, 'any-seed');
  assert.equal(out.choices, gridDraft.choices, 'same array reference');
  assert.equal(out.correctAnswer, '8');
  assert.equal(out.rationale, gridDraft.rationale);
});

// --- (i) near-duplicate detection ----------------------------------------------------

test('(i) checkDuplicate: exact full-item match short-circuits; distinct passes', () => {
  const draft = VALID_RW_DRAFT as unknown as DraftQuestion;
  const exact = checkDuplicate(draft, [
    {
      id: 'q-1',
      stem: `  ${draft.stem.toLowerCase()}  `, // normalization-insensitive
      stimulusText: (draft.stimulus.text ?? '').replace(/ /g, '   '), // whitespace-insensitive
      choices: draft.choices.map((c) => c.text).reverse(), // choice order-insensitive
    },
  ]);
  assert.deepEqual(exact, { duplicate: true, similarTo: 'q-1', jaccard: 1 });

  const distinct = checkDuplicate(draft, [
    {
      id: 'q-2',
      stem: 'A marine biology survey counted harbour seals at two colonies over five seasons.',
      stimulusText: 'Volunteer observers recorded colony counts each spring and autumn.',
      choices: ['12', '18', '24', '30'],
    },
  ]);
  assert.equal(distinct.duplicate, false);
  assert.equal(distinct.similarTo, undefined);
});

test('(i) checkDuplicate: templated stem — different passage + choices passes despite stem Jaccard 1.0', () => {
  // RW skills use FIXED stem templates, so the stem alone scores 1.0 against
  // any existing item of the same skill; similarity must come from the
  // COMBINED stem + stimulus + choices word set.
  const draft = VALID_RW_DRAFT as unknown as DraftQuestion;
  const result = checkDuplicate(draft, [
    {
      id: 'gen-sat-rw-transitions-001',
      stem: draft.stem, // the identical transitions stem template
      stimulusText:
        "The repair manuals published by the Alvarez guitar workshop in the 1960s have become standard references for luthiers restoring vintage instruments. ______, the workshop's original design notes are still consulted by makers building entirely new guitars.",
      choices: ['However,', 'Therefore,', 'Similarly,', 'Meanwhile,'],
    },
  ]);
  assert.equal(result.duplicate, false, `different passage + choices must pass: ${JSON.stringify(result)}`);
});

test('(i) checkDuplicate: near-identical full item (two words changed) is still rejected', () => {
  const draft = VALID_RW_DRAFT as unknown as DraftQuestion;
  const nearIdenticalPassage = (draft.stimulus.text ?? '')
    .replace('telescope kits', 'microscope kits')
    .replace('a library card', 'a member card');
  const result = checkDuplicate(draft, [
    {
      id: 'q-near',
      stem: draft.stem,
      stimulusText: nearIdenticalPassage,
      choices: draft.choices.map((c) => c.text),
    },
  ]);
  assert.equal(result.duplicate, true);
  assert.equal(result.similarTo, 'q-near');
  assert.ok((result.jaccard ?? 0) >= 0.85, `combined Jaccard above threshold: ${result.jaccard}`);
  assert.ok((result.jaccard ?? 0) < 1, 'not the exact-match short-circuit — the passage differs');
});

test('(i) loadExistingQuestions reads fixtures + generated dirs, memoized', () => {
  resetDedupCache();
  const existing = loadExistingQuestions();
  assert.ok(existing.length >= 30, `corpus loaded (${existing.length} questions)`);
  assert.ok(existing.some((q) => q.id === 'gen-sat-rw-transitions-001'));
  assert.ok(
    existing.every(
      (q) => typeof q.stem === 'string' && typeof q.stimulusText === 'string' && Array.isArray(q.choices),
    ),
  );
  assert.ok(
    existing.some((q) => q.id === 'gen-sat-rw-transitions-001' && q.stimulusText.length > 0),
    'passage stimulus text is carried for combined similarity',
  );
  assert.equal(loadExistingQuestions(), existing, 'memoized: same array identity');
  resetDedupCache();
  assert.notEqual(loadExistingQuestions(), existing, 'cache bust re-reads');
  resetDedupCache();
});

test('(i) dedup on: draft identical to an existing fixture is rejected as too similar', async () => {
  resetDedupCache();
  const fixtureRaw = fs.readFileSync(
    path.join(findRepoRoot(), 'research/sat/test-fixtures/generated-rw-transitions-001.json'),
    'utf8',
  );
  const scripts: MockScript[] = Array.from({ length: 4 }, () => ({ content: fixtureRaw }));
  const provider = new MockProvider('mock-model-xyz', scripts);
  await assert.rejects(
    generateQuestion({
      subjectCode: 'SAT_RW',
      skill: 'transitions',
      difficulty: 3,
      provider,
      dedup: true,
      now: FIXED_NOW,
      idAllocator: FIXED_ID,
    }),
    (err: unknown) => {
      assert.ok(err instanceof GenerateError, `expected GenerateError, got ${err}`);
      const genErr = err as GenerateError;
      assert.equal(genErr.attempts.length, 4);
      for (const a of genErr.attempts) {
        assert.equal(a.outcome, 'rejected');
        assert.ok(
          a.errors!.some(
            (e) =>
              e.includes('too similar to existing gen-sat-rw-transitions-001') &&
              /\(Jaccard 1\.00\)/.test(e) &&
              e.includes('substantially different scenario'),
          ),
          `too-similar error present: ${JSON.stringify(a.errors)}`,
        );
      }
      return true;
    },
  );
  resetDedupCache();
});

test('(i) dedup on: a distinct draft passes the duplicate gate', async () => {
  resetDedupCache();
  const provider = new MockProvider('mock-model-xyz', [{ content: JSON.stringify(VALID_MATH_DIAGRAM_DRAFT) }]);
  const result = await generateQuestion({
    subjectCode: 'SAT_MATH',
    skill: 'systems-linear-equations',
    difficulty: 3,
    withDiagram: true,
    provider,
    dedup: true,
    now: FIXED_NOW,
    idAllocator: (_subject, skill) => `gen-sat-math-${skill}-007`,
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.outcome, 'accepted');
  assert.ok(validateQuestion(result.question));
  resetDedupCache();
});

// --- (j) independent-solver verification ----------------------------------------------

/** The key letter generateQuestion's content-seeded shuffle will produce for a draft. */
function expectedShuffledKey(draft: object): string {
  const seed = createHash('sha256').update(canonicalJson(draft)).digest('hex');
  return shuffleChoices(draft as unknown as DraftQuestion, seed).correctAnswer;
}

function verifierScript(answer: string, difficulty: number, reasoning: string): MockScript {
  return {
    content: JSON.stringify({ answer, difficulty, verdict: 'solvable', reasoning }),
  };
}

test('(j) verify: verifier agreement → accepted with verify.status verified', async () => {
  const key = expectedShuffledKey(VALID_RW_DRAFT);
  const provider = new MockProvider('mock-model-xyz', [
    { content: JSON.stringify(VALID_RW_DRAFT) },
    verifierScript(key, 3, 'Solved independently; the addition relationship holds.'),
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    verify: true,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.outcome, 'accepted');
  assert.deepEqual(result.attempts[0]!.verify, { status: 'verified' });
});

test('(j) verify: verifier disagreement → rejected with reasoning, repaired on attempt 2', async () => {
  const key = expectedShuffledKey(VALID_RW_DRAFT);
  const wrong = ['A', 'B', 'C', 'D'].find((l) => l !== key)!;
  const reasoning = 'The passage signals contrast, so the key must be the contrast transition.';
  const provider = new RecordingMockProvider('mock-model-xyz', [
    { content: JSON.stringify(VALID_RW_DRAFT) },
    verifierScript(wrong, 3, reasoning),
    { content: JSON.stringify(VALID_RW_DRAFT) },
    verifierScript(key, 3, 'Solved independently on retry; addition is correct.'),
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    verify: true,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });

  assert.equal(result.attempts.length, 2);
  const first = result.attempts[0]!;
  assert.equal(first.outcome, 'rejected');
  assert.deepEqual(first.verify, { status: 'mismatch', expected: key, got: wrong });
  assert.ok(
    first.errors!.some(
      (e) => e.includes(`independent solver got ${wrong} but the draft keys ${key}`) && e.includes(reasoning),
    ),
    `mismatch error quotes the verifier reasoning: ${JSON.stringify(first.errors)}`,
  );
  assert.equal(result.attempts[1]!.outcome, 'repaired');
  assert.deepEqual(result.attempts[1]!.verify, { status: 'verified' });

  // the verifier call shape: [system: verifier prompt, user: shuffled model fields]
  assert.equal(provider.calls.length, 4, 'generation + verification calls interleaved per attempt');
  const verifierCall = provider.calls[1]!;
  assert.equal(verifierCall.messages.length, 2);
  assert.match(verifierCall.messages[0]!.content, /independent expert SAT solver/);
  assert.equal(verifierCall.jsonMode, true);

  // the attempt-2 repair message carries the verifier reasoning
  const repair = provider.calls[2]!.messages[3]!;
  assert.equal(repair.role, 'user');
  assert.ok(repair.content.includes(reasoning));
});

test('(j) verify: unparseable verifier output → accepted as unverified (fail-open)', async () => {
  const provider = new MockProvider('mock-model-xyz', [
    { content: JSON.stringify(VALID_RW_DRAFT) },
    { content: 'I solved it in my head; the answer is probably fine.' },
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    verify: true,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.outcome, 'accepted');
  assert.deepEqual(result.attempts[0]!.verify, { status: 'unverified' });
});

test('(j) verify: verifier LLMError → accepted as unverified (fail-open)', async () => {
  const provider = new MockProvider('mock-model-xyz', [
    { content: JSON.stringify(VALID_RW_DRAFT) },
    { error: 'HTTP 500 verifier exploded' },
    { error: 'HTTP 500 verifier exploded' },
    { error: 'HTTP 500 verifier exploded' },
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    verify: true,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });
  assert.equal(result.attempts.length, 1);
  assert.deepEqual(result.attempts[0]!.verify, { status: 'unverified' });
});

test('(j) verify: grid_in numeric equivalence — verifier 162.0 matches key 162', async () => {
  const fixtureRaw = fs.readFileSync(
    path.join(findRepoRoot(), 'research/sat/test-fixtures/generated-math-percentages-001.json'),
    'utf8',
  );
  const provider = new MockProvider('mock-model-xyz', [
    { content: fixtureRaw },
    verifierScript('162.0', 2, 'Counted the 2025 membership independently.'),
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_MATH',
    skill: 'percentages',
    difficulty: 2,
    provider,
    verify: true,
    now: FIXED_NOW,
    idAllocator: (_subject, skill) => `gen-sat-math-${skill}-009`,
  });
  assert.equal(result.attempts.length, 1);
  assert.deepEqual(result.attempts[0]!.verify, { status: 'verified' });
  const question = result.question as { correctAnswer: string; questionType: string };
  assert.equal(question.questionType, 'grid_in');
  assert.equal(question.correctAnswer, '162', 'grid_in answers are never shuffled');
});

// --- (k) transient provider retry -------------------------------------------------------

test('(k) transient provider errors are retried on the same request', async () => {
  const provider = new RecordingMockProvider('mock-model-xyz', [
    { error: 'HTTP 429 rate limited' },
    { error: 'request failed: socket hang up' },
    { content: JSON.stringify(VALID_RW_DRAFT) },
  ]);
  const result = await generateQuestion({
    subjectCode: 'SAT_RW',
    skill: 'transitions',
    difficulty: 3,
    provider,
    now: FIXED_NOW,
    idAllocator: FIXED_ID,
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.outcome, 'accepted');
  assert.equal(provider.calls.length, 3, 'two transient retries then success');
});

test('(k) non-transient LLMError propagates immediately', async () => {
  const provider = new RecordingMockProvider('mock-model-xyz', [
    { error: 'invalid api key' },
    { content: JSON.stringify(VALID_RW_DRAFT) },
  ]);
  await assert.rejects(
    generateQuestion({
      subjectCode: 'SAT_RW',
      skill: 'transitions',
      difficulty: 3,
      provider,
      now: FIXED_NOW,
      idAllocator: FIXED_ID,
    }),
    /invalid api key/,
  );
  assert.equal(provider.calls.length, 1, 'no retry for a non-transient error');
});

// --- numeric equivalence -----------------------------------------------------------------

test('numericEquals: int/decimal/fraction equivalence', () => {
  assert.ok(numericEquals('3/4', '0.75'));
  assert.ok(numericEquals('0.75', '3/4'));
  assert.ok(numericEquals('162', '162.0'));
  assert.ok(numericEquals('-1/2', '-0.5'));
  assert.ok(numericEquals('2', '2'));
  assert.ok(!numericEquals('2', '3'));
  assert.ok(!numericEquals('1/3', '0.33'));
  assert.ok(!numericEquals('3/4', '0.7'));
});

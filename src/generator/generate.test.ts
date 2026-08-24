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
import { GenerateError, generateQuestion } from './generate.js';
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
  stem: 'The graph shows the lines l and m in the xy-plane. The two lines intersect at point P. What is the y-coordinate of P?',
  choices: [
    { id: 'A', text: '1', misconceptionId: 'SAT_MATH:systems-linear-equations-elimination-scales-one-side-only' },
    { id: 'B', text: '3', misconceptionId: null },
    { id: 'C', text: '4', misconceptionId: 'SAT_MATH:systems-linear-equations-solving-for-x-when-asked-for-y' },
    { id: 'D', text: '5', misconceptionId: 'SAT_MATH:systems-linear-equations-adding-when-subtracting-needed' },
  ],
  correctAnswer: 'B',
  rationale:
    'Line l has equation y = 2x − 5 and line m has equation y = −0.5x + 5. Setting them equal gives 2.5x = 10, so x = 4 and y = 3 — the marked intersection P = (4, 3), and substitution into either equation confirms it. Choice C reports the x-coordinate: the correct solution with the wrong component, the classic re-read-the-ask trap. Choice A comes from scaling only the variable terms when aligning coefficients (2x + 4y = 10), which yields y = 1. Choice D comes from subtracting the left sides while adding the right sides (5y = 25), which yields y = 5.',
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
  assert.equal(nextId('SAT_RW', 'transitions'), 'gen-sat-rw-transitions-002');
  // the math fixture uses the short slug 'systems', which is a DIFFERENT
  // namespace from the full skill slug — the anchored regex must not match it
  assert.equal(nextId('SAT_MATH', 'systems-linear-equations'), 'gen-sat-math-systems-linear-equations-001');
  assert.equal(nextId('SAT_MATH', 'systems'), 'gen-sat-math-systems-002');
  assert.equal(nextId('SAT_MATH', 'circles'), 'gen-sat-math-circles-001'); // no fixture yet
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
  assert.deepEqual(result.attempts[0], { attempt: 1, outcome: 'accepted' });
  assert.equal(result.promptVersion, '1.0.0');
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

  // key choice carries misconceptionId null
  const choices = question.choices as { id: string; misconceptionId: string | null }[];
  const key = choices.find((c) => c.id === question.correctAnswer);
  assert.ok(key, 'keyed choice exists');
  assert.equal(key!.misconceptionId, null);
  assert.ok(choices.filter((c) => c.misconceptionId === null).length === 1);

  // provenance + documented contentHash convention
  const provenance = question.provenance as Record<string, string>;
  assert.equal(provenance.archetypeSlug, 'transitions');
  assert.equal(provenance.promptVersion, '1.0.0');
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

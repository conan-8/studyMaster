/**
 * Generator orchestration (master plan §7: "agents propose, deterministic
 * code disposes").
 *
 * generateQuestion() runs the propose-validate-repair loop:
 *
 *   assemble job inputs -> load prompt v-latest
 *   for attempt 1..maxAttempts:
 *     messages = [system: prompt text, user: promptUserMessage]
 *                + (retry: assistant: previous raw, user: repair message)
 *     provider.complete({messages, jsonMode: true})   (transient errors retried x2)
 *     model emitted {"error": ...}    -> terminal: log rejected, abort (no retry)
 *     validateDraft(...) failed       -> log ALL errors, retry if attempts remain
 *     dedup on + near-duplicate       -> log 'too similar' error, repair
 *     validateDraft ok + dedup ok     -> deterministic choice shuffle
 *     verify on + solver mismatch     -> log verifier error, repair
 *     all gates pass                  -> assign pipeline fields, return
 *   exhausted -> throw GenerateError with aggregated per-attempt errors
 *
 * The model NEVER supplies id / subjectCode / taxonomyCode / provenance /
 * review / allowedUses / variantOf: those keys are stripped before
 * validation and assigned here from trusted sources (id allocator, prompt
 * registry, provider response, injectable clock).
 */

import { createHash } from 'node:crypto';
import { LLMError } from '../llm/index.js';
import type { ChatMessage, LLMProvider, LLMRequest, LLMResponse, LLMUsage } from '../llm/index.js';
import { assembleInputs } from './inputs.js';
import type { GenerationInputs } from './inputs.js';
import { loadPrompt } from './prompts.js';
import { stripJsonFences, validateDraft } from './validate-output.js';
import type { DraftQuestion } from './validate-output.js';
import { nextId } from './ids.js';
import { shuffleChoices } from './shuffle.js';
import { checkDuplicate, loadExistingQuestions } from './dedup.js';

export interface GenerateOptions {
  subjectCode: 'SAT_RW' | 'SAT_MATH';
  skill: string;
  difficulty: 2 | 3 | 4;
  withDiagram?: boolean;
  provider: LLMProvider;
  /** Repair-retry budget. Default 4. */
  maxAttempts?: number;
  /** Injectable clock for tests. Default () => new Date(). */
  now?: () => Date;
  /** Injectable id allocator for tests. Default: nextId from ./ids.js. */
  idAllocator?: (subject: 'SAT_RW' | 'SAT_MATH', skill: string) => string;
  /** Near-duplicate gate against the existing-question corpus. Default false. */
  dedup?: boolean;
  /** Independent-solver verification via the question-verifier prompt. Default false. */
  verify?: boolean;
}

export interface AttemptLog {
  attempt: number;
  outcome: 'accepted' | 'repaired' | 'rejected';
  errors?: string[];
  /** Token usage reported by the provider for this attempt, when available. */
  usage?: LLMUsage;
  /** Independent-solver outcome, present only when GenerateOptions.verify is on. */
  verify?: {
    status: 'verified' | 'mismatch' | 'unverified';
    expected?: string;
    got?: string;
  };
}

export interface GenerateResult {
  /** Full generated-question JSON — schema-valid, including id/provenance/review. */
  question: object;
  attempts: AttemptLog[];
  promptVersion: string;
  model: string;
}

/** Thrown when every attempt failed (or the model terminally refused). */
export class GenerateError extends Error {
  constructor(
    message: string,
    readonly attempts: AttemptLog[],
  ) {
    super(message);
    this.name = 'GenerateError';
  }
}

// --- canonical JSON + content hash ---------------------------------------------

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Canonical JSON: recursively sorted keys, no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/**
 * sha256 hex over the canonical JSON of the question minus its
 * provenance.contentHash field (the field cannot hash itself).
 */
export function computeContentHash(question: Record<string, unknown>): string {
  const provenance = question.provenance;
  const hashInput =
    provenance !== null && typeof provenance === 'object'
      ? { ...question, provenance: omit(provenance as Record<string, unknown>, ['contentHash']) }
      : { ...question };
  return createHash('sha256').update(canonicalJson(hashInput)).digest('hex');
}

function omit(value: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const key of keys) delete out[key];
  return out;
}

// --- terminal spec-complaint detection -------------------------------------------

function tryParse(text: string): unknown {
  try {
    return JSON.parse(stripJsonFences(text));
  } catch {
    return undefined;
  }
}

/**
 * The system prompt lets the model refuse an impossible job with exactly
 * {"error": "<one sentence>"}. That is terminal: no point retrying a spec
 * complaint, so the loop aborts immediately.
 */
function detectTerminalError(content: string): string | null {
  const parsed = tryParse(content);
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.error === 'string' && rec.questionType === undefined) {
      return `model reported an unrecoverable spec problem: ${rec.error}`;
    }
  }
  return null;
}

// --- repair message -----------------------------------------------------------------

function repairMessage(errors: string[]): string {
  return [
    'Your output failed validation. Fix ALL of these and re-emit the full JSON only:',
    ...errors.map((err) => `- ${err}`),
  ].join('\n');
}

// --- pipeline field assignment --------------------------------------------------------

interface FinalizeContext {
  inputs: GenerationInputs;
  id: string;
  promptVersion: string;
  model: string;
  generatedAt: string;
}

function finalizeQuestion(draft: DraftQuestion, ctx: FinalizeContext): Record<string, unknown> {
  const provenanceBody = {
    archetypeSlug: ctx.inputs.skill,
    promptVersion: ctx.promptVersion,
    model: ctx.model,
    generatedAt: ctx.generatedAt,
  };
  const question: Record<string, unknown> = {
    ...draft,
    id: ctx.id,
    subjectCode: ctx.inputs.subjectCode,
    taxonomyCode: `${ctx.inputs.subjectCode}:${ctx.inputs.skill}`,
    provenance: provenanceBody, // contentHash appended below
    review: { status: 'pending', reviewer: null, notes: null },
    allowedUses: ['display'],
    variantOf: null,
  };
  question.provenance = { ...provenanceBody, contentHash: computeContentHash(question) };
  return question;
}

function aggregateFailure(attempts: AttemptLog[], ctx: { subject: string; skill: string }): string {
  const lines = attempts.map(
    (a) =>
      `  attempt ${a.attempt} (${a.outcome}): ${(a.errors ?? ['(no errors recorded)']).join(' | ')}`,
  );
  return (
    `Question generation failed after ${attempts.length} attempt(s) for ${ctx.subject}:${ctx.skill} — ` +
    `no attempt produced a schema-valid question.\n${lines.join('\n')}`
  );
}

// --- the loop ---------------------------------------------------------------------------

/** Usage attaches to attempt logs only when the provider reports it (mocks don't). */
function usageField(usage: LLMUsage | undefined): { usage?: LLMUsage } {
  return usage === undefined ? {} : { usage };
}

// --- transient provider retry --------------------------------------------------

/** Matches the transient failure shapes providers actually emit. */
const TRANSIENT_ERROR = /timed out|request failed|HTTP 5\d\d|HTTP 429|fetch failed|network/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call provider.complete, retrying transient LLMErrors (timeouts, 5xx, 429,
 * network failures) up to 2 extra times with a 400ms*try backoff. The SAME
 * request is resent. Non-transient LLMErrors and non-LLMError exceptions
 * propagate immediately.
 */
async function completeWithRetry(provider: LLMProvider, req: LLMRequest): Promise<LLMResponse> {
  for (let extra = 0; extra <= 2; extra++) {
    try {
      return await provider.complete(req);
    } catch (err) {
      if (!(err instanceof LLMError) || !TRANSIENT_ERROR.test(err.message) || extra === 2) {
        throw err;
      }
      await sleep(400 * (extra + 1));
    }
  }
  throw new Error('unreachable: completeWithRetry loop exited without return or throw');
}

// --- numeric equivalence (grid_in answers) --------------------------------------

/** Parse an int/decimal/fraction literal ('8', '0.75', '3/4') to a number; null if none. */
function parseNumeric(text: string): number | null {
  const t = text.trim();
  const fraction = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (fraction !== null) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
  return null;
}

/**
 * Numeric equivalence for grid_in answers: '3/4' equals '0.75', '8' equals
 * '8.0'. Non-numeric strings fall back to trimmed string equality.
 */
export function numericEquals(a: string, b: string): boolean {
  const x = parseNumeric(a);
  const y = parseNumeric(b);
  if (x === null || y === null) return a.trim() === b.trim();
  return Math.abs(x - y) < 1e-9;
}

// --- independent-solver verification ---------------------------------------------

type VerifyRun =
  | { status: 'verified' }
  | { status: 'unverified' }
  | { status: 'mismatch'; expected: string; got: string; error: string };

/**
 * Ask the question-verifier prompt to solve the (post-shuffle) draft
 * independently, then compare its answer/difficulty/verdict against the
 * draft. Fail-open: a missing verifier prompt, a verifier LLMError, or
 * unparseable verifier output all yield 'unverified' — never a rejection.
 * A one-step difficulty difference is a soft warning (no repair); only a
 * two-step difference (2 vs 4) is a repair error.
 */
async function runVerifier(provider: LLMProvider, draft: DraftQuestion): Promise<VerifyRun> {
  let systemText: string;
  try {
    systemText = loadPrompt('question-verifier').text;
  } catch {
    return { status: 'unverified' };
  }

  // The draft's rationale is deliberately NOT sent: it contains the worked
  // solution justifying the key, and an independent solver must not anchor
  // on it (checker finding — keeps verification genuinely independent).
  const payload = {
    questionType: draft.questionType,
    stimulus: draft.stimulus,
    stem: draft.stem,
    choices: draft.choices,
    correctAnswer: draft.correctAnswer,
    difficultyTarget: draft.difficultyTarget,
  };

  let content: string;
  try {
    const response = await completeWithRetry(provider, {
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      jsonMode: true,
    });
    content = response.content;
  } catch (err) {
    if (err instanceof LLMError) return { status: 'unverified' }; // fail-open
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(content));
  } catch {
    return { status: 'unverified' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'unverified' };
  }
  const rec = parsed as Record<string, unknown>;
  const answer = typeof rec.answer === 'string' ? rec.answer.trim() : null;
  const verdict = typeof rec.verdict === 'string' ? rec.verdict.trim() : null;
  const difficulty = typeof rec.difficulty === 'number' ? rec.difficulty : null;
  if (answer === null || verdict === null || difficulty === null) {
    return { status: 'unverified' };
  }
  const reasoning =
    typeof rec.reasoning === 'string' ? rec.reasoning : '(the verifier gave no reasoning)';

  const errors: string[] = [];
  if (verdict !== 'solvable') {
    errors.push(`independent verifier verdict '${verdict}' — the item must be solvable as written: ${reasoning}`);
  }
  const answerMatch =
    draft.questionType === 'mcq'
      ? answer.toUpperCase() === draft.correctAnswer
      : numericEquals(answer, draft.correctAnswer);
  if (!answerMatch) {
    errors.push(`independent solver got ${answer} but the draft keys ${draft.correctAnswer}: ${reasoning}`);
  }
  if (
    difficulty !== draft.difficultyTarget &&
    Math.abs(difficulty - draft.difficultyTarget) >= 2
  ) {
    errors.push(
      `independent verifier rates the difficulty ${difficulty} but the draft targets ${draft.difficultyTarget}: ${reasoning}`,
    );
  }
  // A one-step difficulty difference is a warning only — no repair.

  if (errors.length > 0) {
    return { status: 'mismatch', expected: draft.correctAnswer, got: answer, error: errors.join(' | ') };
  }
  return { status: 'verified' };
}

export async function generateQuestion(opts: GenerateOptions): Promise<GenerateResult> {
  const inputs = assembleInputs(opts.subjectCode, opts.skill, opts.difficulty, opts.withDiagram === true);
  const prompt = loadPrompt('question-generator');
  const maxAttempts = opts.maxAttempts ?? 4;
  const now = opts.now ?? (() => new Date());
  const allocateId = opts.idAllocator ?? nextId;
  const dedup = opts.dedup === true;
  const verify = opts.verify === true;

  const attempts: AttemptLog[] = [];
  let previousRaw: string | null = null;
  let previousErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt.text },
      { role: 'user', content: inputs.promptUserMessage },
    ];
    if (attempt > 1 && previousRaw !== null) {
      messages.push({ role: 'assistant', content: previousRaw });
      messages.push({ role: 'user', content: repairMessage(previousErrors) });
    }

    const response = await completeWithRetry(opts.provider, { messages, jsonMode: true });

    const terminal = detectTerminalError(response.content);
    if (terminal !== null) {
      attempts.push({ attempt, outcome: 'rejected', errors: [terminal], ...usageField(response.usage) });
      break; // terminal refusal: retrying a spec complaint is pointless
    }

    const outcome = validateDraft(response.content, inputs);
    if (!outcome.ok) {
      attempts.push({ attempt, outcome: 'rejected', errors: outcome.errors, ...usageField(response.usage) });
      previousRaw = response.content;
      previousErrors = outcome.errors;
      continue;
    }

    // Near-duplicate gate: runs on the model's original content, before the
    // choice shuffle rewrites letters.
    if (dedup) {
      const dup = checkDuplicate(outcome.draft, loadExistingQuestions());
      if (dup.duplicate) {
        const err =
          `too similar to existing ${dup.similarTo ?? 'question'} ` +
          `(Jaccard ${(dup.jaccard ?? 0).toFixed(2)}) — ` +
          'write a substantially different scenario, numbers, and context';
        attempts.push({ attempt, outcome: 'rejected', errors: [err], ...usageField(response.usage) });
        previousRaw = response.content;
        previousErrors = [err];
        continue;
      }
    }

    // Deterministic choice shuffle, seeded by the draft's own canonical JSON
    // so the same content always lands in the same order.
    const seed = createHash('sha256').update(canonicalJson(outcome.draft)).digest('hex');
    const shuffled = shuffleChoices(outcome.draft, seed);
    const draft: DraftQuestion = {
      ...outcome.draft,
      choices: shuffled.choices,
      correctAnswer: shuffled.correctAnswer,
      rationale: shuffled.rationale,
    };

    // Independent-solver verification (fail-open on verifier infra problems).
    let verifyLog: AttemptLog['verify'];
    if (verify) {
      const run = await runVerifier(opts.provider, draft);
      if (run.status === 'mismatch') {
        attempts.push({
          attempt,
          outcome: 'rejected',
          errors: [run.error],
          verify: { status: 'mismatch', expected: run.expected, got: run.got },
          ...usageField(response.usage),
        });
        previousRaw = response.content;
        previousErrors = [run.error];
        continue;
      }
      verifyLog = { status: run.status };
    }

    attempts.push({
      attempt,
      outcome: attempt === 1 ? 'accepted' : 'repaired',
      ...(verifyLog !== undefined ? { verify: verifyLog } : {}),
      ...usageField(response.usage),
    });
    const question = finalizeQuestion(draft, {
      inputs,
      id: allocateId(opts.subjectCode, opts.skill),
      promptVersion: prompt.version,
      model: response.model,
      generatedAt: now().toISOString(),
    });
    return { question, attempts, promptVersion: prompt.version, model: response.model };
  }

  throw new GenerateError(
    aggregateFailure(attempts, { subject: opts.subjectCode, skill: opts.skill }),
    attempts,
  );
}

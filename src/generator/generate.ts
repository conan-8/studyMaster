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
 *     provider.complete({messages, jsonMode: true})
 *     model emitted {"error": ...}    -> terminal: log rejected, abort (no retry)
 *     validateDraft(...) ok           -> assign pipeline fields, return
 *     validateDraft(...) failed       -> log ALL errors, retry if attempts remain
 *   exhausted -> throw GenerateError with aggregated per-attempt errors
 *
 * The model NEVER supplies id / subjectCode / taxonomyCode / provenance /
 * review / allowedUses / variantOf: those keys are stripped before
 * validation and assigned here from trusted sources (id allocator, prompt
 * registry, provider response, injectable clock).
 */

import { createHash } from 'node:crypto';
import type { ChatMessage, LLMProvider } from '../llm/index.js';
import { assembleInputs } from './inputs.js';
import type { GenerationInputs } from './inputs.js';
import { loadPrompt } from './prompts.js';
import { stripJsonFences, validateDraft } from './validate-output.js';
import type { DraftQuestion } from './validate-output.js';
import { nextId } from './ids.js';

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
}

export interface AttemptLog {
  attempt: number;
  outcome: 'accepted' | 'repaired' | 'rejected';
  errors?: string[];
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

export async function generateQuestion(opts: GenerateOptions): Promise<GenerateResult> {
  const inputs = assembleInputs(opts.subjectCode, opts.skill, opts.difficulty, opts.withDiagram === true);
  const prompt = loadPrompt('question-generator');
  const maxAttempts = opts.maxAttempts ?? 4;
  const now = opts.now ?? (() => new Date());
  const allocateId = opts.idAllocator ?? nextId;

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

    const response = await opts.provider.complete({ messages, jsonMode: true });

    const terminal = detectTerminalError(response.content);
    if (terminal !== null) {
      attempts.push({ attempt, outcome: 'rejected', errors: [terminal] });
      break; // terminal refusal: retrying a spec complaint is pointless
    }

    const outcome = validateDraft(response.content, inputs);
    if (outcome.ok) {
      attempts.push({ attempt, outcome: attempt === 1 ? 'accepted' : 'repaired' });
      const question = finalizeQuestion(outcome.draft, {
        inputs,
        id: allocateId(opts.subjectCode, opts.skill),
        promptVersion: prompt.version,
        model: response.model,
        generatedAt: now().toISOString(),
      });
      return { question, attempts, promptVersion: prompt.version, model: response.model };
    }

    attempts.push({ attempt, outcome: 'rejected', errors: outcome.errors });
    previousRaw = response.content;
    previousErrors = outcome.errors;
  }

  throw new GenerateError(
    aggregateFailure(attempts, { subject: opts.subjectCode, skill: opts.skill }),
    attempts,
  );
}

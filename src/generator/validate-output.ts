/**
 * The deterministic output gate (master plan §7: "agents propose,
 * deterministic code disposes").
 *
 * validateDraft() takes whatever the model produced (raw string or parsed
 * value) plus the job's GenerationInputs and returns EVERY violation it can
 * find — never first-only — because the full list feeds the repair-retry
 * message. Checks run in layers:
 *
 *   1. parse-tolerant extraction (optional ```json fences, then JSON.parse)
 *   2. pipeline-key stripping + JSON-native number re-serialization inside
 *      stimulus.diagram.parameters (models often emit "4" where the params
 *      schema wants 4; only strings that JSON.parse to finite numbers are
 *      coerced — no other magic)
 *   3. ajv against schemas/generated-question.schema.json (compiled once,
 *      module-level), with placeholder pipeline fields injected so the
 *      schema gates ONLY the model-owned fields
 *   4. cross-checks a schema cannot express: difficulty echo, diagram
 *      presence/gating (assertValidParams via the renderer lib), misconception
 *      slice membership, and key-choice wiring.
 */

import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormatsPlugin from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from './prompts.js';
import { assertValidParams } from '../renderers/lib/diagram.js';
import type { GenerationInputs } from './inputs.js';

export interface DraftDiagram {
  archetypeId: string;
  parameters: Record<string, unknown>;
}

export interface DraftStimulus {
  type: 'passage' | 'table' | 'figure' | 'notes' | 'none';
  text: string | null;
  tableJson: Record<string, unknown> | null;
  diagram: DraftDiagram | null;
}

export interface DraftChoice {
  id: string;
  text: string;
  misconceptionId: string | null;
}

/** The model's fields — exactly the OUTPUT CONTRACT keys, post-validation. */
export interface DraftQuestion {
  questionType: 'mcq' | 'grid_in';
  stimulus: DraftStimulus;
  stem: string;
  choices: DraftChoice[];
  correctAnswer: string;
  rationale: string;
  difficultyTarget: 2 | 3 | 4;
}

export type ValidateOutcome =
  | { ok: true; draft: DraftQuestion }
  | { ok: false; errors: string[] };

/** Pipeline-owned keys: stripped from model output before any validation. */
const PIPELINE_KEYS = [
  'id',
  'subjectCode',
  'taxonomyCode',
  'provenance',
  'review',
  'allowedUses',
  'variantOf',
] as const;

// --- module-level schema compile (once) ---------------------------------------

function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: true });
  type FormatsPluginFn = (instance: Ajv) => Ajv;
  const addFormats: FormatsPluginFn =
    (addFormatsPlugin as unknown as { default?: FormatsPluginFn }).default ??
    (addFormatsPlugin as unknown as FormatsPluginFn);
  addFormats(ajv);
  return ajv;
}

function compileQuestionSchema(): ValidateFunction {
  const schemaFile = path.join(findRepoRoot(), 'schemas', 'generated-question.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8')) as object;
  return createAjv().compile(schema);
}

const validateQuestion: ValidateFunction = compileQuestionSchema();

// --- parse-tolerant extraction -------------------------------------------------

/**
 * Strip optional markdown fences: a leading ```/```json line and a trailing
 * ``` line. Anything else passes through untouched.
 */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(trimmed);
  return match !== null ? match[1]! : trimmed;
}

// --- normalization --------------------------------------------------------------

function stripPipelineKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const key of PIPELINE_KEYS) delete out[key];
  return out;
}

/**
 * Re-serialize number-like strings inside stimulus.diagram.parameters:
 * a leaf string is replaced by JSON.parse(s) only when that yields a finite
 * number ("4" -> 4, "-0.5" -> -0.5, "2e3" -> 2000). No other coercion.
 */
function reSerializeNumbers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reSerializeNumbers);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = reSerializeNumbers(v);
    }
    return out;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
    } catch {
      // not a JSON-native number literal — keep the string
    }
  }
  return value;
}

/** Rebuild the stimulus.diagram path with re-serialized numbers (no caller mutation). */
function normalizeDiagramNumbers(draft: Record<string, unknown>): void {
  const stimulus = draft.stimulus;
  if (stimulus === null || typeof stimulus !== 'object' || Array.isArray(stimulus)) return;
  const diagram = (stimulus as Record<string, unknown>).diagram;
  if (diagram === null || typeof diagram !== 'object' || Array.isArray(diagram)) return;
  const d = diagram as Record<string, unknown>;
  if (d.parameters === null || typeof d.parameters !== 'object' || Array.isArray(d.parameters)) return;
  draft.stimulus = {
    ...(stimulus as Record<string, unknown>),
    diagram: { ...d, parameters: reSerializeNumbers(d.parameters) },
  };
}

/**
 * Inject schema-valid placeholder pipeline fields so ajv validates only the
 * model-owned fields. The real values are assigned by generate.ts AFTER
 * acceptance and are never taken from model output.
 */
function withPlaceholderPipelineFields(
  stripped: Record<string, unknown>,
  inputs: GenerationInputs,
): Record<string, unknown> {
  return {
    ...stripped,
    id: 'gen-placeholder-000',
    subjectCode: inputs.subjectCode,
    taxonomyCode: `${inputs.subjectCode}:${inputs.skill}`,
    provenance: {
      archetypeSlug: inputs.skill,
      promptVersion: '0.0.0',
      model: 'validation-placeholder',
      generatedAt: '1970-01-01T00:00:00.000Z',
      contentHash: '0'.repeat(64),
    },
    review: { status: 'pending', reviewer: null, notes: null },
    allowedUses: ['display'],
    variantOf: null,
  };
}

// --- cross-checks -----------------------------------------------------------------

function crossCheck(draft: Record<string, unknown>, inputs: GenerationInputs): string[] {
  const errors: string[] = [];

  // difficulty echo: the model must return the requested target verbatim
  if (draft.difficultyTarget !== inputs.difficulty) {
    errors.push(
      `/difficultyTarget must equal the requested difficulty ${inputs.difficulty} ` +
        `(got ${JSON.stringify(draft.difficultyTarget) ?? 'undefined'})`,
    );
  }

  // diagram presence gating
  const stimulus = draft.stimulus;
  const diagram =
    stimulus !== null && typeof stimulus === 'object' && !Array.isArray(stimulus)
      ? (stimulus as Record<string, unknown>).diagram
      : undefined;
  const hasDiagram = diagram !== null && diagram !== undefined;
  if (!inputs.withDiagram && hasDiagram) {
    errors.push('/stimulus/diagram must be null — no diagram was requested for this job');
  } else if (inputs.withDiagram && !hasDiagram) {
    errors.push('/stimulus/diagram is required — this job requests a figure');
  }
  if (hasDiagram && diagram !== null && typeof diagram === 'object' && !Array.isArray(diagram)) {
    const d = diagram as Record<string, unknown>;
    const archetypeId = d.archetypeId;
    if (typeof archetypeId === 'string') {
      if (!inputs.diagramArchetypeIds.includes(archetypeId)) {
        errors.push(
          `diagram/archetypeId '${archetypeId}' is not allowed for skill '${inputs.skill}' ` +
            `(allowed: ${inputs.diagramArchetypeIds.join(', ') || 'none'})`,
        );
      } else {
        try {
          assertValidParams(archetypeId, d.parameters);
        } catch (err) {
          for (const part of (err as Error).message.split('; ')) {
            errors.push(`diagram/${part}`);
          }
        }
      }
    }
  }

  // misconception slice membership
  const known = new Set(inputs.misconceptions.map((m) => m.id));
  if (Array.isArray(draft.choices)) {
    draft.choices.forEach((choice, i) => {
      if (choice !== null && typeof choice === 'object' && !Array.isArray(choice)) {
        const mc = (choice as Record<string, unknown>).misconceptionId;
        if (typeof mc === 'string' && !known.has(mc)) {
          errors.push(
            `/choices/${i}/misconceptionId '${mc}' is not in this skill's misconception library slice`,
          );
        }
      }
    });

    // key wiring: correctAnswer must name an existing choice whose misconceptionId is null
    if (draft.questionType === 'mcq' && typeof draft.correctAnswer === 'string') {
      const keyIndex = draft.choices.findIndex(
        (c) =>
          c !== null && typeof c === 'object' &&
          (c as Record<string, unknown>).id === draft.correctAnswer,
      );
      if (keyIndex === -1) {
        errors.push(`/correctAnswer '${draft.correctAnswer}' does not match any choice id`);
      } else {
        const keyChoice = draft.choices[keyIndex] as Record<string, unknown>;
        if (keyChoice.misconceptionId !== null) {
          errors.push(
            `/choices/${keyIndex}/misconceptionId must be null — choice '${draft.correctAnswer}' is the key`,
          );
        }
      }
    }
  }

  return errors;
}

// --- the gate -----------------------------------------------------------------------

/**
 * Validate raw model output against the schema + job cross-checks.
 * Collects ALL errors (schema errors as '<jsonPath> <message>', cross-check
 * and diagram errors with their own prefixes). On success returns the
 * normalized draft (pipeline keys stripped, diagram numbers re-serialized).
 */
export function validateDraft(raw: unknown, inputs: GenerationInputs): ValidateOutcome {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(stripJsonFences(raw));
    } catch (err) {
      return {
        ok: false,
        errors: [`json: model output is not parseable JSON after fence-stripping (${(err as Error).message})`],
      };
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        `json: model output must be a single JSON object (got ${Array.isArray(value) ? 'an array' : String(typeof value)})`,
      ],
    };
  }

  const stripped = stripPipelineKeys(value as Record<string, unknown>);
  normalizeDiagramNumbers(stripped);

  const errors: string[] = [];
  const candidate = withPlaceholderPipelineFields(stripped, inputs);
  if (!validateQuestion(candidate)) {
    for (const err of (validateQuestion.errors ?? []) as ErrorObject[]) {
      errors.push(`${err.instancePath || '/'} ${err.message ?? 'schema violation'}`);
    }
  }
  errors.push(...crossCheck(stripped, inputs));

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, draft: stripped as unknown as DraftQuestion };
}

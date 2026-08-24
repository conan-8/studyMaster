/**
 * Input assembly for the question generator (master plan §7: "agents
 * propose, deterministic code disposes").
 *
 * assembleInputs() is the pure step that turns a (subject, skill,
 * difficulty, withDiagram) job into everything the LLM prompt and the
 * deterministic gate need: the archetype spec, the skill's misconception
 * library slice, the allowed diagram archetype ids, and the fully rendered
 * user message. File reads are memoized; missing or inconsistent inputs
 * throw clean errors that name the available alternatives.
 *
 * Path conventions are src/-local: the repo root is located via
 * findRepoRoot() from ./prompts.js (NOT scripts/lib conventions).
 */

import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from './prompts.js';
import { loadDiagramArchetype } from '../renderers/lib/diagram.js';

export interface MisconceptionSlice {
  id: string;
  name: string;
  description: string;
  detectionSignal: string;
}

export interface GenerationInputs {
  subjectCode: 'SAT_RW' | 'SAT_MATH';
  skill: string;
  difficulty: 2 | 3 | 4;
  withDiagram: boolean;
  archetype: object;
  misconceptions: MisconceptionSlice[];
  diagramArchetypeIds: string[];
  promptUserMessage: string;
}

/** research/sat/archetypes/<section>/<skill>.json — section by subject. */
const SECTION_BY_SUBJECT: Record<'SAT_RW' | 'SAT_MATH', string> = {
  SAT_RW: 'rw',
  SAT_MATH: 'math',
};

const VALID_SUBJECTS = ['SAT_RW', 'SAT_MATH'] as const;
const VALID_DIFFICULTIES = [2, 3, 4] as const;

// --- memoized file reads -----------------------------------------------------

const jsonCache = new Map<string, unknown>();

function readJson(absPath: string, what: string): unknown {
  const cached = jsonCache.get(absPath);
  if (cached !== undefined) return cached;
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing ${what}: no file at ${path.relative(findRepoRoot(), absPath)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `Malformed ${what} (${path.relative(findRepoRoot(), absPath)}): not valid JSON — ${(err as Error).message}`,
    );
  }
  jsonCache.set(absPath, parsed);
  return parsed;
}

function listJsonBasename(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

function archetypesDir(subjectCode: 'SAT_RW' | 'SAT_MATH'): string {
  return path.join(findRepoRoot(), 'research', 'sat', 'archetypes', SECTION_BY_SUBJECT[subjectCode]);
}

/** Slugs of the subject's skills whose archetype carries a usable diagramSpec. */
function diagramCapableSkills(subjectCode: 'SAT_RW' | 'SAT_MATH'): string[] {
  const out: string[] = [];
  for (const slug of listJsonBasename(archetypesDir(subjectCode))) {
    const archetype = readJson(
      path.join(archetypesDir(subjectCode), `${slug}.json`),
      `archetype for skill '${slug}'`,
    ) as Record<string, unknown>;
    const spec = (archetype as { diagramSpec?: { allowedArchetypeIds?: unknown } }).diagramSpec;
    if (
      spec !== null &&
      typeof spec === 'object' &&
      Array.isArray(spec.allowedArchetypeIds) &&
      spec.allowedArchetypeIds.length > 0
    ) {
      out.push(slug);
    }
  }
  return out;
}

// --- input assembly ----------------------------------------------------------

/**
 * Assemble every generator input for one job. Throws clean errors for:
 * unknown subject codes, non-{2,3,4} difficulty, unknown skills (listing the
 * subject's available skills), archetypes misplaced under a skill slug,
 * skills with zero misconceptions in the library, and diagram requests for
 * skills whose archetype has no diagramSpec (naming the skills that do).
 */
export function assembleInputs(
  subjectCode: 'SAT_RW' | 'SAT_MATH',
  skill: string,
  difficulty: 2 | 3 | 4,
  withDiagram: boolean,
): GenerationInputs {
  if (!VALID_SUBJECTS.includes(subjectCode as 'SAT_RW' | 'SAT_MATH')) {
    throw new Error(
      `Unknown subjectCode '${String(subjectCode)}'. Valid subject codes: ${VALID_SUBJECTS.join(', ')}`,
    );
  }
  if (!VALID_DIFFICULTIES.includes(difficulty as 2 | 3 | 4)) {
    throw new Error(`difficulty must be one of 2, 3, or 4 (got ${String(difficulty)})`);
  }
  if (typeof skill !== 'string' || skill.length === 0) {
    throw new Error(`skill must be a non-empty string (got ${JSON.stringify(skill)})`);
  }

  const archetypeRel = `research/sat/archetypes/${SECTION_BY_SUBJECT[subjectCode]}/${skill}.json`;
  const archetypeFile = path.join(findRepoRoot(), archetypeRel);
  if (!fs.existsSync(archetypeFile)) {
    const available = listJsonBasename(archetypesDir(subjectCode));
    throw new Error(
      `Unknown skill '${skill}' for subject ${subjectCode}: no archetype at ${archetypeRel}. ` +
        `Available skills for ${subjectCode}: ${available.join(', ') || '(none)'}`,
    );
  }
  const archetype = readJson(archetypeFile, `archetype for skill '${skill}'`) as Record<string, unknown>;
  if (archetype === null || typeof archetype !== 'object' || Array.isArray(archetype)) {
    throw new Error(`Malformed archetype ${archetypeRel}: expected a JSON object`);
  }
  const taxonomyCode = `${subjectCode}:${skill}`;
  if (archetype.slug !== skill || archetype.taxonomyCode !== taxonomyCode) {
    throw new Error(
      `Malformed archetype ${archetypeRel}: slug/taxonomyCode mismatch ` +
        `(slug ${JSON.stringify(archetype.slug)}, taxonomyCode ${JSON.stringify(archetype.taxonomyCode)}; ` +
        `expected '${skill}' / '${taxonomyCode}')`,
    );
  }

  const misconceptionsFile = readJson(
    path.join(findRepoRoot(), 'database', subjectCode, 'misconceptions.json'),
    `misconception library for ${subjectCode}`,
  ) as { misconceptions?: Record<string, unknown>[] };
  const all = Array.isArray(misconceptionsFile?.misconceptions) ? misconceptionsFile.misconceptions! : null;
  if (all === null) {
    throw new Error(`Malformed misconception library for ${subjectCode}: missing "misconceptions" array`);
  }
  const slice: MisconceptionSlice[] = [];
  for (const m of all) {
    if (m?.taxonomyCode !== taxonomyCode) continue;
    slice.push({
      id: String(m.id),
      name: String(m.name),
      description: String(m.description),
      detectionSignal: String(m.detectionSignal),
    });
  }
  if (slice.length === 0) {
    const covered = [...new Set(all.map((m) => String(m?.taxonomyCode)))]
      .filter((code) => code.startsWith(`${subjectCode}:`))
      .map((code) => code.slice(subjectCode.length + 1))
      .sort();
    throw new Error(
      `Skill '${skill}' (${taxonomyCode}) has zero misconceptions in database/${subjectCode}/misconceptions.json — ` +
        `the generator cannot wire distractors without library coverage. ` +
        `Skills WITH coverage: ${covered.join(', ') || '(none)'}`,
    );
  }

  const spec = (archetype as { diagramSpec?: { allowedArchetypeIds?: unknown } }).diagramSpec;
  const diagramArchetypeIds: string[] =
    spec !== null &&
    typeof spec === 'object' &&
    Array.isArray(spec.allowedArchetypeIds) &&
    spec.allowedArchetypeIds.every((id) => typeof id === 'string')
      ? (spec.allowedArchetypeIds as string[])
      : [];
  if (withDiagram && diagramArchetypeIds.length === 0) {
    const capable = diagramCapableSkills(subjectCode);
    throw new Error(
      `Skill '${skill}' (${subjectCode}) cannot take a diagram: its archetype has no diagramSpec.allowedArchetypeIds. ` +
        (capable.length > 0
          ? `Skills in ${subjectCode} that DO support diagrams: ${capable.join(', ')}.`
          : `No ${subjectCode} skill supports diagrams (diagram-capable skills exist only in SAT_MATH).`),
    );
  }

  return {
    subjectCode,
    skill,
    difficulty,
    withDiagram,
    archetype,
    misconceptions: slice,
    diagramArchetypeIds,
    promptUserMessage: renderUserMessage({
      subjectCode,
      skill,
      taxonomyCode,
      difficulty,
      archetype,
      misconceptions: slice,
      withDiagram,
      diagramArchetypeIds,
    }),
  };
}

// --- user message rendering --------------------------------------------------

interface MessageContext {
  subjectCode: 'SAT_RW' | 'SAT_MATH';
  skill: string;
  taxonomyCode: string;
  difficulty: 2 | 3 | 4;
  archetype: Record<string, unknown>;
  misconceptions: MisconceptionSlice[];
  withDiagram: boolean;
  diagramArchetypeIds: string[];
}

function renderUserMessage(ctx: MessageContext): string {
  const parts: string[] = [
    '## Generation job',
    '',
    `- subjectCode: ${ctx.subjectCode}`,
    `- skill: ${ctx.skill}`,
    `- taxonomyCode: ${ctx.taxonomyCode}`,
    `- difficultyTarget: ${ctx.difficulty} (2 = easy, 3 = medium, 4 = hard)`,
    '',
  ];

  const questionTypeNotes = ctx.archetype.questionTypeNotes;
  if (typeof questionTypeNotes === 'string' && questionTypeNotes.length > 0) {
    parts.push('## Question type guidance (archetype.questionTypeNotes)', '', questionTypeNotes, '');
  }

  parts.push(
    '## Archetype spec (authoritative — follow generationRecipe in its stated step order)',
    '',
    '```json',
    JSON.stringify(ctx.archetype, null, 2),
    '```',
    '',
    '## Misconception library slice for this skill (your distractor generators)',
    '',
    '```json',
    JSON.stringify(ctx.misconceptions, null, 2),
    '```',
    '',
  );

  if (ctx.withDiagram) {
    const archetypeId = ctx.diagramArchetypeIds[0]!;
    const { paramsSchema } = loadDiagramArchetype(archetypeId);
    parts.push(
      '## Diagram (this item requires a figure)',
      '',
      'Use this archetypeId verbatim as stimulus.diagram.archetypeId; stimulus.diagram.parameters must satisfy the paramsSchema below, and stimulus.type must be "figure".',
      '',
      '```json',
      JSON.stringify({ archetypeId, paramsSchema }, null, 2),
      '```',
      '',
    );
  }

  parts.push(
    'Emit exactly one JSON object following the system prompt\'s OUTPUT CONTRACT — the model fields only, no id/provenance/review, no commentary.',
  );
  return parts.join('\n');
}

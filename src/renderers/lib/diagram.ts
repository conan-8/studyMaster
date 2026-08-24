/**
 * Diagram archetype loading + params validation.
 *
 * The paramsSchema embedded in each database/diagrams/<id>.json file is the
 * SINGLE source of truth for parameter rules (mirroring scripts/lib/validate.ts
 * house style: ajv with allErrors, ajv-formats for date-time etc.). The
 * renderer layer adds only cross-field guarantees a schema cannot express
 * (e.g. "marked point lies on the line"), each throwing with a jsonPath-style
 * locator so callers can trace violations back to the offending parameter.
 */

import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormatsPlugin from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DiagramArchetype {
  archetypeId: string;
  title: string;
  description: string;
  subjectsApplicable: string[];
  paramsSchema: object;
  rendererRef: string;
  notes: string | null;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIAGRAMS_DIR = path.join(REPO_ROOT, 'database', 'diagrams');

const archetypeCache = new Map<string, DiagramArchetype>();
let knownIds: string[] | null = null;

function listKnownIds(): string[] {
  if (knownIds === null) {
    knownIds = fs
      .readdirSync(DIAGRAMS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  }
  return knownIds;
}

/** Load database/diagrams/<archetypeId>.json (memoized). Throws cleanly on unknown ids. */
export function loadDiagramArchetype(archetypeId: string): DiagramArchetype {
  const cached = archetypeCache.get(archetypeId);
  if (cached !== undefined) return cached;
  const file = path.join(DIAGRAMS_DIR, `${archetypeId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Unknown diagram archetype '${archetypeId}': no file at database/diagrams/${archetypeId}.json. ` +
        `Known archetypes: ${listKnownIds().join(', ')}`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<DiagramArchetype>;
  const archetype: DiagramArchetype = {
    archetypeId: raw.archetypeId ?? archetypeId,
    title: raw.title ?? archetypeId,
    description: raw.description ?? '',
    subjectsApplicable: raw.subjectsApplicable ?? [],
    paramsSchema: raw.paramsSchema ?? {},
    rendererRef: raw.rendererRef ?? '',
    notes: raw.notes ?? null,
  };
  archetypeCache.set(archetypeId, archetype);
  return archetype;
}

// House-style ajv (see scripts/lib/validate.ts): allErrors, non-strict,
// ajv-formats plugin (CJS module — the plugin is the module itself).
function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: true });
  type FormatsPluginFn = (instance: Ajv) => Ajv;
  const addFormats: FormatsPluginFn =
    (addFormatsPlugin as unknown as { default?: FormatsPluginFn }).default ??
    (addFormatsPlugin as unknown as FormatsPluginFn);
  addFormats(ajv);
  return ajv;
}

const ajvInstance: Ajv = createAjv();
const compileCache = new Map<string, ValidateFunction>();

function validatorFor(archetypeId: string): ValidateFunction {
  const cached = compileCache.get(archetypeId);
  if (cached !== undefined) return cached;
  const { paramsSchema } = loadDiagramArchetype(archetypeId);
  const validate = ajvInstance.compile(paramsSchema);
  compileCache.set(archetypeId, validate);
  return validate;
}

/**
 * Validate params against the archetype's paramsSchema; throws Error listing
 * every violation as '<jsonPath>: <message>' (e.g. '/slope: must be <= 6').
 */
export function assertValidParams(archetypeId: string, params: unknown): asserts params {
  const validate = validatorFor(archetypeId);
  if (validate(params)) return;
  const lines = (validate.errors ?? []).map((err: ErrorObject) => {
    const jsonPath = err.instancePath || '/';
    return `${jsonPath}: ${err.message ?? 'schema violation'}`;
  });
  throw new Error(
    `Invalid params for diagram archetype '${archetypeId}': ${lines.join('; ')}`,
  );
}

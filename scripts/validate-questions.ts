/**
 * validate-questions: generated questions vs schemas/generated-question.schema.json.
 * Scans BOTH generated-question namespaces (shared discovery in
 * scripts/lib/catalog.ts#generatedQuestionFiles):
 *   - research/sat/test-fixtures/generated-*.json (hand-authored fixtures)
 *   - research/sat/generated/*.json (committed generator drafts; .gitkeep skipped)
 * Cross-checks per question:
 *   - taxonomyCode exists in the subject taxonomy
 *   - every choices[].misconceptionId resolves in the subject misconceptions
 *   - provenance.archetypeSlug resolves to a known archetype file
 *   - stimulus.diagram.archetypeId exists in database/diagrams/ and
 *     stimulus.diagram.parameters validates against that archetype's paramsSchema
 *
 * The suite is neutral to review.status: fresh generator drafts are 'pending'
 * by design and validate exactly like approved fixtures. If no generated
 * questions exist yet, the suite passes with a note.
 */
import path from 'node:path';
import {
  createAjv,
  loadJson,
  runSuite,
  schemaValidate,
  taxonomyCodes,
  misconceptionIds,
  diagramArchetypeIds,
  archetypeFiles,
  generatedQuestionFiles,
  DIAGRAMS_DIR,
} from './lib/catalog.js';
import { REPO_ROOT } from './lib/validate.js';

const GENERATED_QUESTION_SCHEMA = path.join(REPO_ROOT, 'schemas', 'generated-question.schema.json');

interface GeneratedQuestion {
  id?: string;
  subjectCode?: string;
  taxonomyCode?: string;
  choices?: Array<{ id: string; misconceptionId: string | null }>;
  stimulus?: { diagram?: { archetypeId: string; parameters: unknown } | null };
  provenance?: { archetypeSlug: string };
}

runSuite('questions', (reporter) => {
  const ajv = createAjv();
  const files = generatedQuestionFiles();
  if (files.length === 0) {
    reporter.note('no generated questions under research/sat/test-fixtures/ or research/sat/generated/ yet — nothing to validate');
    return 0;
  }

  const diagramIds = diagramArchetypeIds();
  const archetypeSlugs = new Map<string, string>();
  for (const { file } of archetypeFiles()) {
    const slug = (loadJson(file) as { slug?: string }).slug;
    if (slug) archetypeSlugs.set(slug, file);
  }
  const taxonomyCache = new Map<string, Set<string>>();
  const misconceptionCache = new Map<string, Set<string>>();
  const paramsSchemaCache = new Map<string, object>();
  let checked = 0;

  for (const file of files) {
    const data = loadJson(file) as GeneratedQuestion;
    if (!schemaValidate(ajv, GENERATED_QUESTION_SCHEMA, file, data, reporter)) {
      checked++;
      continue;
    }
    const subject = data.subjectCode ?? '';
    if (!taxonomyCache.has(subject)) taxonomyCache.set(subject, taxonomyCodes(subject));
    if (!misconceptionCache.has(subject)) misconceptionCache.set(subject, misconceptionIds(subject));

    if (data.taxonomyCode && !taxonomyCache.get(subject)!.has(data.taxonomyCode)) {
      reporter.error(file, '/taxonomyCode', `taxonomyCode '${data.taxonomyCode}' does not exist in database/${subject}/taxonomy.json`);
    }
    (data.choices ?? []).forEach((c, i) => {
      if (c.misconceptionId !== null && !misconceptionCache.get(subject)!.has(c.misconceptionId)) {
        reporter.error(file, `/choices/${i}/misconceptionId`, `misconceptionId '${c.misconceptionId}' does not exist in database/${subject}/misconceptions.json`);
      }
    });
    const slug = data.provenance?.archetypeSlug;
    if (slug && !archetypeSlugs.has(slug)) {
      reporter.error(file, '/provenance/archetypeSlug', `archetypeSlug '${slug}' does not match any research/sat/archetypes/*/*.json`);
    }
    const diagram = data.stimulus?.diagram;
    if (diagram) {
      if (!diagramIds.has(diagram.archetypeId)) {
        reporter.error(file, '/stimulus/diagram/archetypeId', `diagram archetype '${diagram.archetypeId}' does not exist in database/diagrams/`);
      } else {
        // Cross-check: parameters validate against the archetype's paramsSchema.
        if (!paramsSchemaCache.has(diagram.archetypeId)) {
          const entry = loadJson(path.join(DIAGRAMS_DIR, `${diagram.archetypeId}.json`)) as { paramsSchema: object };
          paramsSchemaCache.set(diagram.archetypeId, entry.paramsSchema);
        }
        try {
          const validateParams = ajv.compile(paramsSchemaCache.get(diagram.archetypeId)!);
          if (!validateParams(diagram.parameters)) {
            for (const err of validateParams.errors ?? []) {
              reporter.error(file, `/stimulus/diagram/parameters${err.instancePath || '/'}`, `paramsSchema violation: ${err.message ?? 'invalid'}`);
            }
          }
        } catch (err) {
          reporter.error(file, '/stimulus/diagram/archetypeId', `cannot compile paramsSchema of '${diagram.archetypeId}': ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    checked++;
  }
  return checked;
});

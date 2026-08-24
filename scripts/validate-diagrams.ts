/**
 * validate-diagrams: database/diagrams/*.json vs schemas/diagram-archetype.schema.json.
 * Cross-check: each entry's paramsSchema must itself be a valid draft-07 JSON
 * Schema (ajv equivalent of Draft7Validator.check_schema) with type 'object'.
 */
import path from 'node:path';
import { createAjv, loadJson, runSuite, schemaValidate, DIAGRAMS_DIR } from './lib/catalog.js';
import { REPO_ROOT, walkJson } from './lib/validate.js';

const DIAGRAM_SCHEMA = path.join(REPO_ROOT, 'schemas', 'diagram-archetype.schema.json');

runSuite('diagrams', (reporter) => {
  const ajv = createAjv();
  const files = walkJson(DIAGRAMS_DIR);
  if (files.length === 0) {
    reporter.note('no diagram archetype files under database/diagrams/');
    return 0;
  }
  let checked = 0;
  for (const file of files) {
    const data = loadJson(file) as { archetypeId?: string; paramsSchema?: unknown };
    if (!schemaValidate(ajv, DIAGRAM_SCHEMA, file, data, reporter)) {
      checked++;
      continue;
    }
    // Cross-check: paramsSchema is itself a valid draft-07 schema (check_schema).
    try {
      ajv.compile(data.paramsSchema as object);
    } catch (err) {
      reporter.error(file, '/paramsSchema', `paramsSchema is not a valid draft-07 JSON Schema: ${err instanceof Error ? err.message : String(err)}`);
    }
    checked++;
  }
  return checked;
});

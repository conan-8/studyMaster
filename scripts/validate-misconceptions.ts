/**
 * validate-misconceptions: database/<SUBJECT>/misconceptions.json vs
 * schemas/misconception.schema.json.
 * Cross-checks:
 *   - every misconception's taxonomyCode exists in the subject's taxonomy.json
 *   - misconception ids are unique within the file
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createAjv,
  loadJson,
  runSuite,
  schemaValidate,
  listSubjects,
  subjectDir,
  taxonomyCodes,
} from './lib/catalog.js';
import { REPO_ROOT } from './lib/validate.js';

const MISCONCEPTION_SCHEMA = path.join(REPO_ROOT, 'schemas', 'misconception.schema.json');

interface Misconception {
  id: string;
  taxonomyCode: string;
}

runSuite('misconceptions', (reporter) => {
  const ajv = createAjv();
  const subjects = listSubjects();
  if (subjects.length === 0) {
    reporter.note('no subjects with exam_format.json found');
    return 0;
  }
  let checked = 0;
  for (const subject of subjects) {
    const file = path.join(subjectDir(subject), 'misconceptions.json');
    if (!fs.existsSync(file)) {
      reporter.error(file, '/', `missing misconceptions.json for subject '${subject}'`);
      continue;
    }
    const data = loadJson(file) as { subject?: { code?: string }; misconceptions?: Misconception[] };
    if (!schemaValidate(ajv, MISCONCEPTION_SCHEMA, file, data, reporter)) {
      checked++;
      continue;
    }
    const codes = taxonomyCodes(subject);
    const seen = new Set<string>();
    (data.misconceptions ?? []).forEach((m, i) => {
      if (!codes.has(m.taxonomyCode)) {
        reporter.error(file, `/misconceptions/${i}/taxonomyCode`, `taxonomyCode '${m.taxonomyCode}' does not exist in database/${subject}/taxonomy.json`);
      }
      if (seen.has(m.id)) {
        reporter.error(file, `/misconceptions/${i}/id`, `duplicate misconception id '${m.id}'`);
      }
      seen.add(m.id);
    });
    checked++;
  }
  return checked;
});

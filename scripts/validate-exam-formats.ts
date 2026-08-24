/**
 * validate-exam-formats: database/<SUBJECT>/exam_format.json vs
 * database/exam_format.schema.json.
 * Cross-check: unitWeights weightPercent values sum to 100 ± 0.5 per subject.
 */
import path from 'node:path';
import {
  createAjv,
  loadJson,
  runSuite,
  schemaValidate,
  subjectDir,
  listSubjects,
  EXAM_FORMAT_SCHEMA_PATH,
} from './lib/catalog.js';

interface UnitWeight {
  unit: number;
  weightPercent: number | { min: number; max: number };
}

runSuite('exam-formats', (reporter) => {
  const ajv = createAjv();
  const subjects = listSubjects();
  if (subjects.length === 0) {
    reporter.note('no database/<SUBJECT>/exam_format.json files found');
    return 0;
  }
  let checked = 0;
  for (const subject of subjects) {
    const file = path.join(subjectDir(subject), 'exam_format.json');
    const data = loadJson(file) as { subject?: { code?: string }; unitWeights?: UnitWeight[] };
    if (!schemaValidate(ajv, EXAM_FORMAT_SCHEMA_PATH, file, data, reporter)) {
      checked++;
      continue;
    }
    // Cross-check: directory name must match the declared subject code.
    if (data.subject?.code !== subject) {
      reporter.error(file, '/subject/code', `subject code '${data.subject?.code}' does not match directory '${subject}'`);
    }
    // Cross-check: unit weights sum to 100 ± 0.5.
    const weights = data.unitWeights ?? [];
    let sum = 0;
    for (const w of weights) {
      sum += typeof w.weightPercent === 'number' ? w.weightPercent : (w.weightPercent.min + w.weightPercent.max) / 2;
    }
    if (Math.abs(sum - 100) > 0.5) {
      reporter.error(file, '/unitWeights', `weightPercent values sum to ${sum}, expected 100 ± 0.5`);
    }
    checked++;
  }
  return checked;
});

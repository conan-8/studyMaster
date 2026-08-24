/**
 * validate-taxonomy: database/<SUBJECT>/taxonomy.json vs schemas/taxonomy.schema.json.
 * Cross-checks:
 *   - every parentCode resolves to another node in the same file
 *   - skill slugs ⊆ the skill enum in research/sat/question.schema.json
 *   - declared subject matches the subject's database/<SUBJECT>/exam_format.json
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
  skillEnum,
} from './lib/catalog.js';
import { REPO_ROOT } from './lib/validate.js';

const TAXONOMY_SCHEMA = path.join(REPO_ROOT, 'schemas', 'taxonomy.schema.json');

interface TaxonomyNode {
  code: string;
  kind: string;
  slug: string;
  parentCode: string | null;
}

runSuite('taxonomy', (reporter) => {
  const ajv = createAjv();
  const subjects = listSubjects();
  if (subjects.length === 0) {
    reporter.note('no subjects with exam_format.json found');
    return 0;
  }
  const allowedSkills = skillEnum();
  let checked = 0;
  for (const subject of subjects) {
    const file = path.join(subjectDir(subject), 'taxonomy.json');
    if (!fs.existsSync(file)) {
      reporter.error(file, '/', `missing taxonomy.json for subject '${subject}'`);
      continue;
    }
    const data = loadJson(file) as { subject?: { code?: string; name?: string }; nodes?: TaxonomyNode[] };
    if (!schemaValidate(ajv, TAXONOMY_SCHEMA, file, data, reporter)) {
      checked++;
      continue;
    }
    const nodes = data.nodes ?? [];
    const codes = new Set(nodes.map((n) => n.code));
    // Cross-check: parentCode resolves in-file.
    nodes.forEach((n, i) => {
      if (n.parentCode !== null && !codes.has(n.parentCode)) {
        reporter.error(file, `/nodes/${i}/parentCode`, `parentCode '${n.parentCode}' does not resolve to any node in this file`);
      }
      // Cross-check: skill slugs ⊆ question.schema.json skill enum.
      if (n.kind === 'skill' && !allowedSkills.has(n.slug)) {
        reporter.error(file, `/nodes/${i}/slug`, `skill slug '${n.slug}' is not in the skill enum of research/sat/question.schema.json`);
      }
    });
    // Cross-check: declared subject matches the exam_format.json subject.
    const examFormat = loadJson(path.join(subjectDir(subject), 'exam_format.json')) as { subject?: { code?: string; name?: string } };
    if (data.subject?.code !== examFormat.subject?.code) {
      reporter.error(file, '/subject/code', `subject code '${data.subject?.code}' does not match exam_format.json code '${examFormat.subject?.code}'`);
    }
    checked++;
  }
  return checked;
});

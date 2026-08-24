/**
 * validate-sat-bank: validates harvested SAT questions against
 * research/sat/question.schema.json (the harvested-question contract).
 *
 *   tsx scripts/validate-sat-bank.ts              -> research/sat/question-bank/ recursively
 *   tsx scripts/validate-sat-bank.ts --fixtures   -> additionally the test-fixtures harvest files
 *                                                    (harvest-*.json and *-sample.json)
 *
 * Cross-checks index.jsonl when present (bank: research/sat/index.jsonl,
 * fixtures: research/sat/test-fixtures/index.jsonl): every indexed path must
 * exist, and every harvested file must be indexed (hand-written *-sample.json
 * examples are exempt). Prints a skill × difficulty counts summary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createAjv, loadJson, runSuite, schemaValidate, QUESTION_SCHEMA_PATH } from './lib/catalog.js';
import { REPO_ROOT, walkJson, type Reporter } from './lib/validate.js';

const SAT_DIR = path.join(REPO_ROOT, 'research', 'sat');
const BANK_DIR = path.join(SAT_DIR, 'question-bank');
const FIXTURES_DIR = path.join(SAT_DIR, 'test-fixtures');

interface HarvestedQuestion {
  skill?: string;
  difficultyOfficial?: string;
}

interface IndexEntry {
  path?: string;
}

function validateSet(
  reporter: Reporter,
  ajv: ReturnType<typeof createAjv>,
  files: string[],
  indexFile: string,
  mustBeIndexed: (file: string) => boolean,
  summary: Map<string, Map<string, number>>,
): number {
  let checked = 0;
  for (const file of files) {
    const data = loadJson(file) as HarvestedQuestion;
    if (schemaValidate(ajv, QUESTION_SCHEMA_PATH, file, data, reporter)) {
      const skill = data.skill ?? '<unknown>';
      const difficulty = data.difficultyOfficial ?? '<unknown>';
      if (!summary.has(skill)) summary.set(skill, new Map());
      const row = summary.get(skill)!;
      row.set(difficulty, (row.get(difficulty) ?? 0) + 1);
    }
    checked++;
  }
  // Cross-check index.jsonl when present.
  if (fs.existsSync(indexFile)) {
    const indexed = new Set<string>();
    const lines = fs.readFileSync(indexFile, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    lines.forEach((line, i) => {
      let entry: IndexEntry;
      try {
        entry = JSON.parse(line) as IndexEntry;
      } catch {
        reporter.error(indexFile, `/line ${i + 1}`, 'index.jsonl line is not valid JSON');
        return;
      }
      if (typeof entry.path !== 'string') {
        reporter.error(indexFile, `/line ${i + 1}`, 'index entry missing "path"');
        return;
      }
      indexed.add(entry.path);
      if (!fs.existsSync(path.join(SAT_DIR, entry.path))) {
        reporter.error(indexFile, `/line ${i + 1}`, `indexed path '${entry.path}' does not exist`);
      }
    });
    for (const file of files) {
      const relToSat = path.relative(SAT_DIR, file);
      if (mustBeIndexed(file) && !indexed.has(relToSat)) {
        reporter.error(file, '/', `file is not indexed in ${path.relative(REPO_ROOT, indexFile)}`);
      }
    }
  } else if (files.length > 0) {
    reporter.note(`no index.jsonl at ${path.relative(REPO_ROOT, indexFile)} — index cross-check skipped`);
  }
  return checked;
}

runSuite('sat-bank', (reporter) => {
  const ajv = createAjv();
  const summary = new Map<string, Map<string, number>>();
  let checked = 0;

  // Question bank (recursive).
  const bankFiles = walkJson(BANK_DIR);
  if (bankFiles.length === 0) {
    reporter.note('research/sat/question-bank/ has no .json files — bank validation skipped');
  } else {
    checked += validateSet(reporter, ajv, bankFiles, path.join(SAT_DIR, 'index.jsonl'), () => true, summary);
  }

  // Test-fixtures harvest files.
  if (process.argv.includes('--fixtures')) {
    const fixtureFiles = fs.existsSync(FIXTURES_DIR)
      ? fs
          .readdirSync(FIXTURES_DIR)
          .filter((n) => (n.startsWith('harvest-') && n.endsWith('.json')) || n.endsWith('-sample.json'))
          .sort()
          .map((n) => path.join(FIXTURES_DIR, n))
      : [];
    if (fixtureFiles.length === 0) {
      reporter.note('no harvest-*.json or *-sample.json files under research/sat/test-fixtures/');
    } else {
      checked += validateSet(
        reporter,
        ajv,
        fixtureFiles,
        path.join(FIXTURES_DIR, 'index.jsonl'),
        (file) => path.basename(file).startsWith('harvest-'),
        summary,
      );
    }
  }

  // Skill × difficulty summary.
  if (summary.size > 0) {
    console.log('  skill × difficulty counts:');
    for (const [skill, row] of [...summary.entries()].sort()) {
      const parts = [...row.entries()].sort().map(([d, n]) => `${d}=${n}`).join(' ');
      console.log(`    ${skill}: ${parts}`);
    }
  }
  return checked;
});

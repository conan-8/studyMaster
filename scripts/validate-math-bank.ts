/**
 * validate-math-bank: content-quality gate over the harvested SAT question
 * bank, scoped to math records (research/sat/question-bank/ssqb-*.json with
 * section === 'math'; harvested payloads carry section 'math' and origin
 * 'bluebook' | 'question_bank').
 *
 *   tsx scripts/validate-math-bank.ts
 *
 * Per-record checks (fields live at the payload top level; a `payload`
 * wrapper is tolerated if present):
 *   - stem: non-empty, >= 15 chars, contains '?', does NOT contain
 *     'Correct Answer' or 'Rationale' (leaked answer/rationale text)
 *   - questionType 'mcq': exactly 4 choices, every choice text non-empty
 *     and !== '[image]'
 *   - questionType 'grid_in': correctAnswer non-empty
 *   - rationale non-empty (warn-only, never gates)
 *   - when stimulus.figureAsset is set: figure PNG exists at BOTH
 *     research/sat/question-bank/assets/ssqb-<source_id>.png and
 *     bluebook-mockup/public/assets/ssqb-<source_id>.png, each > 5000 bytes
 *
 * Records with needsTranscription === true are EXPECTED to fail stem/choice
 * checks pre-transcription: they are counted separately as "pending
 * transcription", not as hard failures. Hard failure = a record WITHOUT
 * needsTranscription that violates any check, OR a needsTranscription record
 * whose figure PNG is missing/tiny (figures are harvested, not transcribed).
 *
 * Output: human summary (totals + per-problem counts) on stdout and
 * research/sat/question-bank/math-quality-report.json
 *   {generatedAt, totalMath, clean, pendingTranscription, hardFailures,
 *    issues: [{id, problems: string[]}]}
 * (issues lists every record with at least one problem, hard failures and
 * pending-transcription content problems alike).
 *
 * Exit code: 0 iff hardFailures === 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, walkJson } from './lib/validate.js';

const BANK_DIR = path.join(REPO_ROOT, 'research', 'sat', 'question-bank');
const BANK_ASSETS_DIR = path.join(REPO_ROOT, 'research', 'sat', 'assets');
const BLUEBOOK_ASSETS_DIR = path.join(REPO_ROOT, 'bluebook-mockup', 'public', 'assets');
const REPORT_PATH = path.join(BANK_DIR, 'math-quality-report.json');
const MIN_PNG_BYTES = 5000;
const MIN_STEM_CHARS = 15;

/** Problem categories that are content (transcription-fixable), not assets. */
const PNG_CATEGORIES = new Set(['png-missing', 'png-too-small']);

/** Warn-only categories: tracked in the report but never gate the exit code.
 *  rationale-empty is unfixable from PNGs (the harvest render cuts above the
 *  rationale text) and the app never displays harvested rationales. */
const WARN_CATEGORIES = new Set(['rationale-empty']);

interface Problem {
  category: string;
  message: string;
}

interface Choice {
  id?: unknown;
  text?: unknown;
}

interface RecordIssues {
  id: string;
  problems: string[];
}

interface QualityReport {
  generatedAt: string;
  totalMath: number;
  clean: number;
  pendingTranscription: number;
  hardFailures: number;
  issues: RecordIssues[];
}

function relToRoot(abs: string): string {
  return path.relative(REPO_ROOT, abs);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Harvested payloads carry fields at top level; tolerate a `payload` wrapper. */
function payloadOf(file: string): Record<string, unknown> | null {
  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  const record = asRecord(raw);
  if (!record) return null;
  return asRecord(record.payload) ?? record;
}

function checkStem(stem: unknown, problems: Problem[]): void {
  const text = isString(stem) ? stem : '';
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    problems.push({ category: 'stem-empty', message: 'stem is empty' });
    return;
  }
  if (trimmed.length < MIN_STEM_CHARS) {
    problems.push({
      category: 'stem-too-short',
      message: `stem is shorter than ${MIN_STEM_CHARS} chars (${trimmed.length})`,
    });
  }
  if (!text.includes('?')) {
    problems.push({ category: 'stem-no-question-mark', message: "stem does not contain '?'" });
  }
  if (text.includes('Correct Answer')) {
    problems.push({
      category: 'stem-leaked-answer',
      message: "stem contains 'Correct Answer' (answer text leaked into stem)",
    });
  }
  if (text.includes('Rationale')) {
    problems.push({
      category: 'stem-leaked-rationale',
      message: "stem contains 'Rationale' (rationale text leaked into stem)",
    });
  }
}

function checkMcqChoices(choices: unknown, problems: Problem[]): void {
  const list = Array.isArray(choices) ? choices : [];
  if (list.length !== 4) {
    problems.push({
      category: 'choices-wrong-count',
      message: `mcq must have exactly 4 choices, got ${list.length}`,
    });
  }
  for (const entry of list) {
    const choice = asRecord(entry);
    const id = choice !== null && isString(choice.id) ? choice.id : '?';
    const text = choice !== null && isString(choice.text) ? choice.text.trim() : '';
    if (text.length === 0) {
      problems.push({ category: 'choice-text-invalid', message: `choice ${id} text is empty` });
    } else if (text === '[image]') {
      problems.push({
        category: 'choice-text-invalid',
        message: `choice ${id} text is '[image]' (untranscribed figure)`,
      });
    }
  }
}

function checkGridInAnswer(correctAnswer: unknown, problems: Problem[]): void {
  const text = isString(correctAnswer) ? correctAnswer.trim() : '';
  if (text.length === 0) {
    problems.push({
      category: 'correct-answer-empty',
      message: 'grid_in correctAnswer is empty',
    });
  }
}

function checkRationale(rationale: unknown, problems: Problem[]): void {
  const text = isString(rationale) ? rationale.trim() : '';
  if (text.length === 0) {
    problems.push({ category: 'rationale-empty', message: 'rationale is empty' });
  }
}

function checkFigurePng(dir: string, sourceId: string, problems: Problem[]): void {
  const png = path.join(dir, `${sourceId}.png`);
  const relPng = relToRoot(png);
  if (!fs.existsSync(png)) {
    problems.push({ category: 'png-missing', message: `figure PNG missing at ${relPng}` });
    return;
  }
  const size = fs.statSync(png).size;
  if (size <= MIN_PNG_BYTES) {
    problems.push({
      category: 'png-too-small',
      message: `figure PNG too small at ${relPng} (${size} bytes, need > ${MIN_PNG_BYTES})`,
    });
  }
}

function main(): void {
  const files = walkJson(BANK_DIR).filter((f) => path.basename(f).startsWith('ssqb-'));

  let totalMath = 0;
  let clean = 0;
  let pendingTranscription = 0;
  let hardFailures = 0;
  const categoryCounts = new Map<string, number>();
  const issues: RecordIssues[] = [];
  const hardFailureSummaries: string[] = [];

  for (const file of files) {
    const fallbackId = path.basename(file, '.json');
    let payload: Record<string, unknown> | null;
    try {
      payload = payloadOf(file);
    } catch (err) {
      // Unparseable bank record: cannot even determine section — treat as
      // a hard failure so the gate never silently skips corrupted data.
      totalMath++;
      hardFailures++;
      const message = `invalid JSON: ${err instanceof Error ? err.message : String(err)}`;
      categoryCounts.set('invalid-json', (categoryCounts.get('invalid-json') ?? 0) + 1);
      issues.push({ id: fallbackId, problems: [message] });
      hardFailureSummaries.push(`${fallbackId}: ${message}`);
      continue;
    }
    if (!payload || payload.section !== 'math') continue;

    totalMath++;
    const sourceId = isString(payload.sourceId) && payload.sourceId.length > 0 ? payload.sourceId : fallbackId;
    const needsTranscription = payload.needsTranscription === true;
    const problems: Problem[] = [];

    checkStem(payload.stem, problems);

    if (payload.questionType === 'mcq') {
      checkMcqChoices(payload.choices, problems);
    } else if (payload.questionType === 'grid_in') {
      checkGridInAnswer(payload.correctAnswer, problems);
    }

    checkRationale(payload.rationale, problems);

    // Figure asset check applies only when stimulus.figureAsset is set.
    const stimulus = asRecord(payload.stimulus);
    const figureAsset = stimulus ? stimulus.figureAsset : undefined;
    if (isString(figureAsset) && figureAsset.length > 0) {
      checkFigurePng(BANK_ASSETS_DIR, sourceId, problems);
      checkFigurePng(BLUEBOOK_ASSETS_DIR, sourceId, problems);
    }

    // Per-record category counts (each category counted once per record).
    for (const category of new Set(problems.map((p) => p.category))) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    const pngProblems = problems.filter((p) => PNG_CATEGORIES.has(p.category));
    const gatingProblems = problems.filter((p) => !WARN_CATEGORIES.has(p.category));
    let status: 'clean' | 'pending' | 'hard';
    if (gatingProblems.length === 0) {
      status = needsTranscription ? 'pending' : 'clean';
    } else if (needsTranscription && pngProblems.length === 0) {
      status = 'pending';
    } else {
      status = 'hard';
    }

    if (problems.length > 0) {
      issues.push({ id: sourceId, problems: problems.map((p) => p.message) });
    }

    if (status === 'clean') {
      clean++;
    } else if (status === 'pending') {
      pendingTranscription++;
    } else {
      hardFailures++;
      hardFailureSummaries.push(`${sourceId}: ${problems.map((p) => p.message).join('; ')}`);
    }
  }

  // Human summary.
  console.log("math-bank quality gate — research/sat/question-bank/ssqb-*.json (section 'math')");
  console.log(`  total math records:     ${totalMath}`);
  console.log(`  clean:                  ${clean}`);
  console.log(`  pending transcription:  ${pendingTranscription}`);
  console.log(`  hard failures:          ${hardFailures}`);
  if (categoryCounts.size > 0) {
    console.log('  per-problem counts (records per category):');
    const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [category, count] of sorted) {
      console.log(`    ${category}: ${count}`);
    }
  } else {
    console.log('  per-problem counts: none — every math record is clean');
  }
  if (hardFailureSummaries.length > 0) {
    const shown = hardFailureSummaries.slice(0, 20);
    console.log(`  hard failures (showing ${shown.length} of ${hardFailureSummaries.length}):`);
    for (const line of shown) console.log(`    ${line}`);
  }

  // Machine-readable report.
  const report: QualityReport = {
    generatedAt: new Date().toISOString(),
    totalMath,
    clean,
    pendingTranscription,
    hardFailures,
    issues,
  };
  fs.mkdirSync(BANK_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`  report written: ${relToRoot(REPORT_PATH)}`);

  const status = hardFailures === 0 ? 'PASS' : 'FAIL';
  console.log(
    `[math-bank] ${status}: ${totalMath} math record(s) checked, ${hardFailures} hard failure(s), ` +
      `${pendingTranscription} pending transcription`,
  );
  process.exit(hardFailures === 0 ? 0 : 1);
}

main();

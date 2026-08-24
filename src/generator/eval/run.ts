/**
 * Eval harness for the question generator (master plan §7.9: "no prompt/model
 * version promotes without meeting or beating the incumbent"). v0 is
 * mock-backed: each golden scenario scripts the model's responses, so the
 * harness pins the FULL pipeline behaviour — prompt assembly, the
 * deterministic gate, the repair loop, and pipeline-field assignment — with
 * zero network and byte-identical reproducibility.
 *
 * Per scenario: build a MockProvider from the scenario's scripts, run
 * generateQuestion with a fixed clock and a deterministic id allocator
 * (`gen-eval-<n>-000`), and compare outcome + attempt count against expect.
 * Accepted runs are additionally checked against the pipeline invariants:
 * the id is the allocator's (never the model's) and review.status is
 * 'pending' — this is what proves untrusted-field stripping end to end.
 *
 * CLI (`npm run eval:generator`): prints a results table + summary metrics,
 * writes src/generator/eval/report-last-run.json, exits 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MockProvider } from '../../llm/index.js';
import { GenerateError, generateQuestion } from '../generate.js';
import { loadPrompt, findRepoRoot } from '../prompts.js';
import { SCENARIOS } from './scenarios.js';
import type { EvalScenario } from './scenarios.js';

const FIXED_NOW = () => new Date('2026-08-24T09:00:00.000Z');
const EVAL_MODEL = 'eval-mock-model';

// --- result types ---------------------------------------------------------------------

export interface ScenarioResult {
  name: string;
  category: EvalScenario['category'];
  pass: boolean;
  expectedOutcome: 'accepted' | 'rejected';
  expectedAttempts: number | null;
  actualOutcome: 'accepted' | 'rejected';
  actualAttempts: number;
  /** Validation/terminal errors seen across attempts (empty on clean acceptance). */
  errorsSeen: string[];
  /** Why the scenario failed its expectation (empty when it passed). */
  failures: string[];
}

export interface EvalMetrics {
  total: number;
  passed: number;
  /** passed / total */
  passRate: number;
  /** accepted in exactly 1 attempt / all accepted */
  acceptedFirstTryRate: number | null;
  /** mean attempt count over accepted scenarios */
  avgAttemptsPerAccepted: number | null;
  /** accepted after >= 1 rejected attempt / all runs that took a repair retry */
  repairRecoveryRate: number | null;
  /** correctly rejected / scenarios expected to reject */
  rejectionCorrectness: number | null;
}

export interface EvalReport {
  ranAt: string;
  promptVersion: string;
  node: string;
  metrics: EvalMetrics;
  scenarios: ScenarioResult[];
}

// --- running one scenario ---------------------------------------------------------------

/**
 * Execute one golden scenario and grade it. `n` feeds the deterministic id
 * allocator (id = `gen-eval-<n>-000`) so runs are reproducible and the
 * pipeline-id invariant is checkable.
 */
export async function runScenario(scenario: EvalScenario, n: number): Promise<ScenarioResult> {
  const expectedId = `gen-eval-${n}-000`;
  const provider = new MockProvider(EVAL_MODEL, scenario.scripts);

  let actualOutcome: 'accepted' | 'rejected';
  let attempts: { attempt: number; outcome: string; errors?: string[] }[];
  const failures: string[] = [];

  try {
    const result = await generateQuestion({
      ...scenario.request,
      provider,
      now: FIXED_NOW,
      idAllocator: () => expectedId,
    });
    actualOutcome = 'accepted';
    attempts = result.attempts;

    // Pipeline invariants (prove untrusted-field stripping for every accepted run):
    const question = result.question as Record<string, unknown>;
    if (question.id !== expectedId) {
      failures.push(`pipeline id did not win: expected '${expectedId}', got ${JSON.stringify(question.id)}`);
    }
    if (typeof question.id !== 'string' || !question.id.startsWith('gen-')) {
      failures.push(`question.id ${JSON.stringify(question.id)} does not start with 'gen-'`);
    }
    const review = question.review as { status?: unknown } | undefined;
    if (review?.status !== 'pending') {
      failures.push(`review.status must be 'pending' (model-supplied review stripped), got ${JSON.stringify(review?.status)}`);
    }
  } catch (err) {
    if (err instanceof GenerateError) {
      actualOutcome = 'rejected';
      attempts = err.attempts;
    } else {
      // Not a generation failure — a harness/pipeline bug. Fail loudly.
      actualOutcome = 'rejected';
      attempts = [];
      failures.push(`unexpected error (not GenerateError): ${(err as Error).message}`);
    }
  }

  const errorsSeen = attempts.flatMap((a) => a.errors ?? []);
  if (actualOutcome !== scenario.expect.outcome) {
    failures.push(`outcome: expected ${scenario.expect.outcome}, got ${actualOutcome}`);
  }
  if (scenario.expect.attempts !== undefined && attempts.length !== scenario.expect.attempts) {
    failures.push(`attempts: expected exactly ${scenario.expect.attempts}, got ${attempts.length}`);
  }

  return {
    name: scenario.name,
    category: scenario.category,
    pass: failures.length === 0,
    expectedOutcome: scenario.expect.outcome,
    expectedAttempts: scenario.expect.attempts ?? null,
    actualOutcome,
    actualAttempts: attempts.length,
    errorsSeen,
    failures,
  };
}

// --- metrics ----------------------------------------------------------------------------

function ratio(num: number, den: number): number | null {
  return den === 0 ? null : num / den;
}

export function computeMetrics(results: ScenarioResult[]): EvalMetrics {
  const passed = results.filter((r) => r.pass).length;
  const accepted = results.filter((r) => r.actualOutcome === 'accepted');
  const firstTry = accepted.filter((r) => r.actualAttempts === 1);
  // Repair-eligible: the loop actually retried after a rejected attempt
  // (attempts > 1 means attempt 1 was a NON-terminal rejection).
  const repairEligible = results.filter((r) => r.actualAttempts > 1);
  const repairRecovered = repairEligible.filter((r) => r.actualOutcome === 'accepted');
  const expectedRejections = results.filter((r) => r.expectedOutcome === 'rejected');
  const correctlyRejected = expectedRejections.filter((r) => r.actualOutcome === 'rejected');

  return {
    total: results.length,
    passed,
    passRate: ratio(passed, results.length) ?? 0,
    acceptedFirstTryRate: ratio(firstTry.length, accepted.length),
    avgAttemptsPerAccepted:
      accepted.length === 0
        ? null
        : accepted.reduce((sum, r) => sum + r.actualAttempts, 0) / accepted.length,
    repairRecoveryRate: ratio(repairRecovered.length, repairEligible.length),
    rejectionCorrectness: ratio(correctlyRejected.length, expectedRejections.length),
  };
}

// --- report rendering ---------------------------------------------------------------------

function pct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(0)}%`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function renderTable(results: ScenarioResult[]): string {
  const header = ['scenario', 'category', 'expect', 'actual', 'pass'];
  const rows = results.map((r) => [
    r.name,
    r.category,
    `${r.expectedOutcome}${r.expectedAttempts !== null ? ` (${r.expectedAttempts})` : ''}`,
    `${r.actualOutcome} (${r.actualAttempts})`,
    r.pass ? 'PASS' : 'FAIL',
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const line = (cols: string[]) => cols.map((c, i) => pad(c, widths[i]!)).join('  ');
  const divider = widths.map((w) => '-'.repeat(w)).join('  ');
  return [line(header), divider, ...rows.map(line)].join('\n');
}

export function renderMetrics(metrics: EvalMetrics): string {
  return [
    '--- metrics ---',
    `overall pass rate:        ${pct(metrics.passRate)} (${metrics.passed}/${metrics.total})`,
    `accepted-first-try rate:  ${pct(metrics.acceptedFirstTryRate)}`,
    `avg attempts per accepted: ${metrics.avgAttemptsPerAccepted === null ? 'n/a' : metrics.avgAttemptsPerAccepted.toFixed(2)}`,
    `repair-recovery rate:     ${pct(metrics.repairRecoveryRate)}`,
    `rejection-correctness:    ${pct(metrics.rejectionCorrectness)}`,
  ].join('\n');
}

// --- CLI ----------------------------------------------------------------------------------

const REPORT_PATH = path.join(findRepoRoot(), 'src', 'generator', 'eval', 'report-last-run.json');

async function main(): Promise<void> {
  const promptVersion = loadPrompt('question-generator').version;
  const results: ScenarioResult[] = [];
  for (const [i, scenario] of SCENARIOS.entries()) {
    results.push(await runScenario(scenario, i + 1));
  }

  const metrics = computeMetrics(results);
  console.log(`question-generator eval — prompt question-generator@${promptVersion}, model ${EVAL_MODEL} (mock)`);
  console.log('');
  console.log(renderTable(results));
  console.log('');
  console.log(renderMetrics(metrics));
  for (const r of results.filter((r) => !r.pass)) {
    console.log('');
    console.log(`FAIL ${r.name}:`);
    for (const f of r.failures) console.log(`  - ${f}`);
    for (const e of r.errorsSeen.slice(0, 5)) console.log(`  error seen: ${e}`);
  }

  const report: EvalReport = {
    ranAt: new Date().toISOString(),
    promptVersion,
    node: process.version,
    metrics,
    scenarios: results,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log('');
  console.log(`report written: ${path.relative(findRepoRoot(), REPORT_PATH)}`);

  if (metrics.passed !== metrics.total) {
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}

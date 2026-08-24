/**
 * Smoke tests for the eval harness: runScenario() drives one happy and one
 * rejection golden scenario end to end through the real pipeline (real
 * archetypes, real misconception slices, real schema, scripted mock model)
 * and grades the outcome against the scenario's expectation.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runScenario, computeMetrics } from './run.js';
import { SCENARIOS } from './scenarios.js';
import type { EvalScenario } from './scenarios.js';

function scenarioByName(name: string): EvalScenario {
  const found = SCENARIOS.find((s) => s.name === name);
  assert.ok(found, `scenario '${name}' exists in the golden set`);
  return found!;
}

test('runScenario: happy RW scenario accepted in 1 attempt with pipeline invariants', async () => {
  const result = await runScenario(scenarioByName('happy-rw-transitions'), 1);
  assert.equal(result.pass, true, `failures: ${JSON.stringify(result.failures)}`);
  assert.equal(result.actualOutcome, 'accepted');
  assert.equal(result.actualAttempts, 1);
  assert.deepEqual(result.errorsSeen, []);
});

test('runScenario: terminal-error rejection scenario rejected in exactly 1 attempt', async () => {
  const result = await runScenario(scenarioByName('rejection-terminal-model-error'), 7);
  assert.equal(result.pass, true, `failures: ${JSON.stringify(result.failures)}`);
  assert.equal(result.actualOutcome, 'rejected');
  assert.equal(result.actualAttempts, 1);
  assert.ok(
    result.errorsSeen.some((e) => e.includes('unrecoverable spec problem')),
    'terminal refusal error recorded',
  );
});

test('computeMetrics: all-pass results yield 100% pass rate and correct sub-metrics', async () => {
  const happy = await runScenario(scenarioByName('happy-rw-transitions'), 1);
  const repair = await runScenario(scenarioByName('repair-three-choices-then-valid'), 3);
  const rejection = await runScenario(scenarioByName('rejection-terminal-model-error'), 7);
  assert.ok(happy.pass && repair.pass && rejection.pass);

  const metrics = computeMetrics([happy, repair, rejection]);
  assert.equal(metrics.total, 3);
  assert.equal(metrics.passed, 3);
  assert.equal(metrics.passRate, 1);
  assert.equal(metrics.acceptedFirstTryRate, 1 / 2); // 1 of 2 accepted was first-try
  assert.equal(metrics.avgAttemptsPerAccepted, 1.5);
  assert.equal(metrics.repairRecoveryRate, 1); // the 1 repair-eligible run recovered
  assert.equal(metrics.rejectionCorrectness, 1);
});

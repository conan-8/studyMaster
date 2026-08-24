/**
 * End-to-end: a generated question's stimulus.diagram renders through the
 * public render() entry point. The fixture is the hand-authored integration
 * question gen-sat-math-systems-001 — two lines with an integer intersection
 * at (4, 3), both line labels drawn.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { render } from '../index.js';
import { assertSvgStructure, assertWellFormedXml } from './helpers.js';

interface GeneratedQuestion {
  id: string;
  stimulus: {
    diagram: {
      archetypeId: string;
      parameters: Record<string, unknown>;
    } | null;
  };
}

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'research',
  'sat',
  'test-fixtures',
  'generated-math-systems-001.json',
);

/** Loads the systems fixture; exposed for the gallery script. */
export function loadSystemsFixture(): GeneratedQuestion {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as GeneratedQuestion;
}

void test('generated question stimulus.diagram renders a well-formed figure', () => {
  const question = loadSystemsFixture();
  assert.ok(question.stimulus.diagram !== null, 'fixture must carry a diagram stimulus');
  const { archetypeId, parameters } = question.stimulus.diagram;
  assert.strictEqual(archetypeId, 'sat-math:graph-system-two-lines');

  const svg = render(archetypeId, structuredClone(parameters));
  assertSvgStructure(svg);
  assertWellFormedXml(svg);

  // Both line labels (labelLines: true) are drawn as text content...
  assert.ok(svg.includes('>l</text>'), 'line1 label "l" must be rendered');
  assert.ok(svg.includes('>m</text>'), 'line2 label "m" must be rendered');
  // ...and the computed intersection (markIntersection + intersectionIsInteger)
  // is marked with its integer coordinate label: 2x - y = 5 and x + 2y = 10
  // meet at (4, 3).
  assert.ok(svg.includes('>(4, 3)</text>'), 'marked intersection (4, 3) must be rendered');
});

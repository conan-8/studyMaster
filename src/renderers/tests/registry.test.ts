/**
 * Registry integrity: every database/diagrams/<id>.json archetype has a
 * registered renderer whose archetypeId/rendererRef match the archetype file,
 * and the registry holds nothing beyond the archetypes on disk.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getRenderer, registeredArchetypeIds } from '../index.js';
import { loadDiagramArchetype } from '../lib/diagram.js';

const DIAGRAMS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'database',
  'diagrams',
);

const archetypeIdsOnDisk: string[] = fs
  .readdirSync(DIAGRAMS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length))
  .sort();

void test('registry covers every archetype in database/diagrams/, with no extras', () => {
  assert.ok(archetypeIdsOnDisk.length > 0, 'expected diagram archetypes on disk');
  assert.deepStrictEqual(registeredArchetypeIds(), archetypeIdsOnDisk);
});

for (const id of archetypeIdsOnDisk) {
  void test(`getRenderer('${id}') resolves and matches the archetype file`, () => {
    const renderer = getRenderer(id);
    const archetype = loadDiagramArchetype(id);
    assert.strictEqual(renderer.archetypeId, id);
    assert.strictEqual(archetype.archetypeId, id);
    assert.strictEqual(renderer.rendererRef, archetype.rendererRef);
    assert.notStrictEqual(renderer.rendererRef, '', 'rendererRef must be set');
  });
}

void test('unknown archetype ids throw a clean error listing known archetypes', () => {
  assert.throws(
    () => getRenderer('sat-math:no-such-diagram'),
    /Unknown diagram archetype 'sat-math:no-such-diagram'/,
  );
  assert.throws(
    () => getRenderer('sat-math:no-such-diagram'),
    /Known archetypes:/,
  );
});

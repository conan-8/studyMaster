import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { findRepoRoot, listPrompts, loadPrompt } from './prompts.js';

test('listPrompts returns the manifest entries', () => {
  const prompts = listPrompts();
  assert.ok(Array.isArray(prompts));
  assert.ok(prompts.length >= 1);
  const qg = prompts.find((p) => p.id === 'question-generator');
  assert.ok(qg, 'registry must register question-generator');
  assert.equal(qg.version, '1.0.0');
  assert.equal(qg.file, 'question-generator/v1.0.0.md');
  assert.equal(qg.agent, 'G1');
});

test('loadPrompt resolves latest version when omitted and returns text', () => {
  const prompt = loadPrompt('question-generator');
  assert.equal(prompt.id, 'question-generator');
  assert.equal(prompt.version, '1.2.0');
  assert.ok(prompt.text.length > 0);
  assert.ok(prompt.text.includes('OUTPUT CONTRACT'), 'prompt must contain the OUTPUT CONTRACT marker');
});

test('loadPrompt resolves the question-verifier prompt', () => {
  const prompt = loadPrompt('question-verifier');
  assert.equal(prompt.id, 'question-verifier');
  assert.equal(prompt.version, '1.0.0');
  assert.ok(prompt.text.length > 0);
  assert.ok(prompt.text.includes('OUTPUT CONTRACT'), 'prompt must contain the OUTPUT CONTRACT marker');
});

test('loadPrompt with explicit version works', () => {
  const prompt = loadPrompt('question-generator', '1.0.0');
  assert.equal(prompt.version, '1.0.0');
  assert.ok(prompt.text.includes('OUTPUT CONTRACT'));
});

test('prompt text covers the generation contract vocabulary', () => {
  const { text } = loadPrompt('question-generator');
  for (const term of ['misconceptionId', 'generationRecipe', 'validationChecklist', 'grid_in']) {
    assert.ok(text.includes(term), `prompt text must mention '${term}'`);
  }
});

test('loadPrompt throws listing available versions on unknown version', () => {
  assert.throws(
    () => loadPrompt('question-generator', '9.9.9'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /question-generator/);
      assert.match(err.message, /1\.0\.0/);
      return true;
    },
  );
});

test('loadPrompt throws listing known ids on unknown id', () => {
  assert.throws(
    () => loadPrompt('no-such-prompt'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /no-such-prompt/);
      assert.match(err.message, /question-generator/);
      return true;
    },
  );
});

test('registry files exist on disk for every manifest entry', () => {
  const root = findRepoRoot();
  for (const entry of listPrompts()) {
    const file = path.join(root, 'prompts', entry.file);
    assert.ok(fs.existsSync(file), `manifest entry ${entry.id}@${entry.version} missing file ${entry.file}`);
  }
});

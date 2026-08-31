/**
 * Near-duplicate detection for generated drafts.
 *
 * checkDuplicate() compares a validated draft against the corpus of already
 * generated questions (research/sat/test-fixtures/generated-*.json plus
 * research/sat/generated/*.json) using normalized-text word-set Jaccard over
 * the COMBINED content — stem + stimulus text + every choice text, each
 * normalized and their words unioned — with an exact-duplicate short-circuit
 * on the combined normalized text (identical stem AND stimulus text AND
 * choice-text set). A combined Jaccard >= 0.85 flags the draft as a
 * duplicate and reports the most-similar existing id.
 *
 * The combined set matters because RW stem templates are FIXED: every
 * transitions item shares one stem, so stem-only Jaccard would be 1.0
 * against every existing item of the skill and reject every new draft. The
 * passage and choices carry the real content signal.
 *
 * Normalization: lowercase, strip \( \) math delimiters and backslash
 * commands, collapse whitespace — so LaTeX dressing does not hide a dup.
 *
 * The corpus read is memoized; resetDedupCache() busts the cache for tests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from './prompts.js';
import type { DraftQuestion } from './validate-output.js';

export interface ExistingQuestion {
  id: string;
  stem: string;
  /** stimulus.text of the existing question ('' when it has no text). */
  stimulusText: string;
  choices: string[];
}

export interface DedupResult {
  duplicate: boolean;
  /** Id of the most-similar existing question, when duplicate. */
  similarTo?: string;
  /** Combined word-set Jaccard of the most-similar existing question, when duplicate. */
  jaccard?: number;
}

/** Combined word-set Jaccard at or above this flags a near-duplicate. */
export const DEDUP_THRESHOLD = 0.85;

/** Lowercase, strip math delimiters/backslash commands, collapse whitespace. */
function normalizeText(text: string): string {
  return text
    .replace(/\\\(|\\\)/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter((w) => w.length > 0));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Union of the word sets of stem + stimulus text + every choice text. */
function combinedWords(stem: string, stimulusText: string, choices: string[]): Set<string> {
  const words = new Set<string>();
  for (const part of [stem, stimulusText, ...choices]) {
    for (const w of wordSet(part)) words.add(w);
  }
  return words;
}

/** Sorted normalized choice texts (order-insensitive equality). */
function sortedNormalizedChoices(choices: string[]): string[] {
  return choices.map((c) => normalizeText(c)).sort();
}

/**
 * Flag drafts that duplicate (exactly or near-) an existing question.
 * Exact short-circuit: identical normalized stem AND stimulus text AND
 * choice-text set. Otherwise: combined (stem + stimulus + choices) word-set
 * Jaccard >= 0.85.
 */
export function checkDuplicate(draft: DraftQuestion, existing: ExistingQuestion[]): DedupResult {
  const draftStem = normalizeText(draft.stem);
  const draftStimulus = normalizeText(draft.stimulus.text ?? '');
  const draftChoices = sortedNormalizedChoices(draft.choices.map((c) => c.text));
  const draftWords = combinedWords(draft.stem, draft.stimulus.text ?? '', draft.choices.map((c) => c.text));

  let best: { id: string; score: number } | null = null;
  for (const q of existing) {
    const qChoices = sortedNormalizedChoices(q.choices);
    const exact =
      normalizeText(q.stem) === draftStem &&
      normalizeText(q.stimulusText) === draftStimulus &&
      qChoices.length === draftChoices.length &&
      qChoices.every((t, i) => t === draftChoices[i]);
    if (exact) {
      return { duplicate: true, similarTo: q.id, jaccard: 1 };
    }
    const score = jaccard(draftWords, combinedWords(q.stem, q.stimulusText, q.choices));
    if (best === null || score > best.score) best = { id: q.id, score };
  }

  if (best !== null && best.score >= DEDUP_THRESHOLD) {
    return { duplicate: true, similarTo: best.id, jaccard: best.score };
  }
  return { duplicate: false };
}

// --- corpus loading (memoized) -------------------------------------------------

let corpusCache: ExistingQuestion[] | null = null;

/** generated-*.json fixtures plus everything in research/sat/generated/. */
function corpusFiles(root: string): string[] {
  const files: string[] = [];
  const fixturesDir = path.join(root, 'research', 'sat', 'test-fixtures');
  if (fs.existsSync(fixturesDir)) {
    files.push(
      ...fs
        .readdirSync(fixturesDir)
        .filter((f) => f.startsWith('generated-') && f.endsWith('.json'))
        .map((f) => path.join(fixturesDir, f)),
    );
  }
  const generatedDir = path.join(root, 'research', 'sat', 'generated');
  if (fs.existsSync(generatedDir)) {
    files.push(
      ...fs
        .readdirSync(generatedDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(generatedDir, f)),
    );
  }
  return files.sort();
}

/**
 * Read the existing-question corpus ({id, stem, stimulus text, choice texts}
 * only). Unreadable or malformed files are skipped — the validate:all suites
 * flag them, not dedup. Memoized; call resetDedupCache() to force a re-read.
 */
export function loadExistingQuestions(): ExistingQuestion[] {
  if (corpusCache !== null) return corpusCache;
  const out: ExistingQuestion[] = [];
  for (const file of corpusFiles(findRepoRoot())) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.id !== 'string' || typeof rec.stem !== 'string') continue;
    const stimulus = rec.stimulus;
    const stimulusText =
      stimulus !== null && typeof stimulus === 'object' && !Array.isArray(stimulus)
        ? (stimulus as Record<string, unknown>).text
        : undefined;
    const choices: string[] = Array.isArray(rec.choices)
      ? rec.choices
          .map((c) =>
            c !== null && typeof c === 'object' && !Array.isArray(c)
              ? (c as Record<string, unknown>).text
              : undefined,
          )
          .filter((t): t is string => typeof t === 'string')
      : [];
    out.push({
      id: rec.id,
      stem: rec.stem,
      stimulusText: typeof stimulusText === 'string' ? stimulusText : '',
      choices,
    });
  }
  corpusCache = out;
  return out;
}

/** Bust the memoized corpus (tests that add/remove corpus files). */
export function resetDedupCache(): void {
  corpusCache = null;
}

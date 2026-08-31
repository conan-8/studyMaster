/**
 * Deterministic choice shuffle (kills key-position bias).
 *
 * shuffleChoices() reorders an mcq draft's four choices with a seeded
 * Fisher–Yates — a mulberry32 PRNG fed by the first 8 hex chars of the
 * sha256 of the seed string — re-letters them A–D in their new order,
 * remaps correctAnswer to the key choice's new letter, and rewrites every
 * "Choice X"/"choices X" reference in the rationale through the old→new
 * letter map (other letter mentions are left untouched). grid_in drafts
 * pass through untouched. The same (draft, seed) pair always produces the
 * same result, so generation stays byte-deterministic.
 */

import { createHash } from 'node:crypto';
import type { DraftChoice, DraftQuestion } from './validate-output.js';

const LETTERS = 'ABCDEFGHIJ';

/** mulberry32: tiny deterministic PRNG over a uint32 seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRNG seed: first 8 hex chars of the sha256 of the seed string, as uint32. */
function seedFromString(seed: string): number {
  const hex = createHash('sha256').update(seed).digest('hex');
  return parseInt(hex.slice(0, 8), 16);
}

export interface ShuffledChoices {
  choices: DraftChoice[];
  correctAnswer: string;
  rationale: string;
}

/**
 * Shuffle the draft's choices deterministically. grid_in (or a choice-less
 * draft) is returned as-is. For mcq the returned choices are re-lettered
 * A–D in shuffled order, correctAnswer names the key's new letter, and the
 * rationale's "Choice X" references are remapped old→new.
 */
export function shuffleChoices(draft: DraftQuestion, seed: string): ShuffledChoices {
  if (draft.questionType !== 'mcq' || draft.choices.length === 0) {
    return { choices: draft.choices, correctAnswer: draft.correctAnswer, rationale: draft.rationale };
  }

  const rand = mulberry32(seedFromString(seed));

  // Fisher–Yates over original indices
  const order = draft.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }

  const oldToNew = new Map<string, string>();
  const choices = order.map((oldIndex, newIndex) => {
    const choice = draft.choices[oldIndex]!;
    const newLetter = LETTERS[newIndex]!;
    oldToNew.set(choice.id, newLetter);
    return { ...choice, id: newLetter };
  });

  const correctAnswer = oldToNew.get(draft.correctAnswer) ?? draft.correctAnswer;

  // Remap only "Choice X" / "choice X" references; every other letter
  // mention (e.g. 'option B') passes through. Match length encodes the
  // plural: 'Choice X' is 8 chars, 'Choices X' is 9.
  const rationale = draft.rationale.replace(
    /([Cc])hoices? ([A-D])\b/g,
    (full, c: string, letter: string) =>
      `${c}hoice${full.length > 8 ? 's' : ''} ${oldToNew.get(letter) ?? letter}`,
  );

  return { choices, correctAnswer, rationale };
}

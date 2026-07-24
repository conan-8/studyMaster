/**
 * Pure, DB-free helpers for exam assembly (part-core).
 *
 * Everything in this module is deterministic given its inputs so it can be unit
 * tested without a database:
 *   - a seeded PRNG (xmur3 string hash -> mulberry32) for per-user sampling,
 *   - a Fisher-Yates shuffle driven by that PRNG,
 *   - the largest-remainder (Hamilton) apportionment used to split the 40-MCQ
 *     Section I across the four APCSA units by `Unit.examWeight`,
 *   - a mapper from a blueprint section `type` string to the Prisma
 *     `QuestionType` enum (FRQ et al. have no enum value -> null -> empty pick),
 *   - the weighted per-unit sampler that assembleExam uses for an MCQ section.
 */
import { QuestionType } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Seeded PRNG (R21)
// ---------------------------------------------------------------------------

/**
 * xmur3 string hash. Returns a function that yields successive 32-bit unsigned
 * integers; call it once to seed mulberry32.
 */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32 PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a deterministic PRNG from an arbitrary seed string (e.g.
 * `${userId}:${nonce}`). Different seed strings -> different streams.
 */
export function makeRng(seedString: string): () => number {
  return mulberry32(xmur3(seedString)());
}

/**
 * Build a per-call seed string. Combines the user id with a per-call nonce
 * (timestamp + random) so the same user assembling twice still differs (R21).
 */
export function makeCallSeed(userId: string, nonce?: string): string {
  const n = nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}:${n}`;
}

// ---------------------------------------------------------------------------
// Shuffle (R21)
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle driven by `rng`. Returns a NEW array; input untouched. */
export function shuffle<T>(input: ReadonlyArray<T>, rng: () => number): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Largest-remainder / Hamilton apportionment (R19/R20)
// ---------------------------------------------------------------------------

/**
 * Apportion `total` integer seats across `weights` using the largest-remainder
 * (Hamilton) method.
 *
 * - Each weight's raw target is `weight / sum(weights) * total`; its floor is the
 *   initial seat count.
 * - The remaining seats (`total - sum(floors)`) are handed out one at a time to
 *   the largest fractional remainders.
 * - Ties in fractional remainder are broken deterministically by ASCENDING index
 *   (i.e. ascending unit number, since callers pass units ordered by unitNumber).
 *
 * The result always sums to exactly `total` (for total >= 0). With the four APCSA
 * weights 0.20/0.30/0.14/0.36 and total 40 this yields exactly [8, 12, 6, 14].
 */
export function hamiltonSplit(weights: ReadonlyArray<number>, total: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (total <= 0) return new Array<number>(n).fill(0);

  const sum = weights.reduce((acc, w) => acc + (w > 0 ? w : 0), 0);

  // Degenerate fallback (no positive weights): spread seats round-robin so the
  // result still sums to `total`. Not hit for the seeded APCSA units.
  if (sum <= 0) {
    const base = Math.floor(total / n);
    const result = new Array<number>(n).fill(base);
    let rem = total - base * n;
    for (let i = 0; i < n && rem > 0; i++, rem--) result[i] += 1;
    return result;
  }

  const raw = weights.map((w) => ((w > 0 ? w : 0) / sum) * total);
  const floors = raw.map((r) => Math.floor(r));
  const allocated = floors.reduce((acc, c) => acc + c, 0);
  const remaining = total - allocated;

  const order = raw
    .map((r, index) => ({ index, remainder: r - floors[index] }))
    .sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      return a.index - b.index; // tie-break: ascending unit number
    });

  const result = floors.slice();
  for (let k = 0; k < remaining; k++) {
    result[order[k % n].index] += 1;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Section type -> QuestionType mapping (R17/R18)
// ---------------------------------------------------------------------------

const SECTION_TYPE_TO_QUESTION_TYPE: Record<string, QuestionType> = {
  MCQ: QuestionType.MCQ,
  SAQ: QuestionType.SAQ,
  DBQ: QuestionType.DBQ,
  LEQ: QuestionType.LEQ,
};

/**
 * Map a blueprint section `type` string to a Prisma `QuestionType` enum value.
 * Returns null for section types that have no enum value (e.g. "FRQ"); callers
 * treat null as "no questions can be assembled" -> empty selection (R18), NOT an
 * error. The QuestionType enum is unchanged (MCQ | SAQ | DBQ | LEQ) — R11.
 */
export function sectionTypeToQuestionType(type: string): QuestionType | null {
  return SECTION_TYPE_TO_QUESTION_TYPE[type] ?? null;
}

// ---------------------------------------------------------------------------
// Weighted per-unit sampler (R19/R20/R23/R27)
// ---------------------------------------------------------------------------

export interface UnitPool {
  unitId: string;
  /** Active candidate question ids for this unit (already type-filtered). */
  ids: ReadonlyArray<string>;
}

/**
 * Assemble the question ids for one weighted section (e.g. the 40-MCQ Section I).
 *
 * `poolsByUnit` and `weights` MUST be aligned by index and ordered by ascending
 * unit number. The section's `questionCount` is apportioned across the units via
 * the Hamilton method (R20); each unit then contributes min(target, available)
 * ids drawn from a seeded shuffle of its pool (R21). When a unit (or the whole
 * pool) has fewer candidates than its target, we fill what we can and simply
 * return fewer ids — best-effort, never throws (R23/R27). The shortfall is
 * observable as `result.length < questionCount`.
 */
export function sampleWeightedSection(
  poolsByUnit: ReadonlyArray<UnitPool>,
  weights: ReadonlyArray<number>,
  questionCount: number,
  rng: () => number,
): string[] {
  const targets = hamiltonSplit(weights, questionCount);
  const selected: string[] = [];
  const n = Math.min(poolsByUnit.length, targets.length);
  for (let i = 0; i < n; i++) {
    const shuffled = shuffle(poolsByUnit[i].ids, rng);
    const take = Math.min(targets[i], shuffled.length);
    for (let k = 0; k < take; k++) selected.push(shuffled[k]);
  }
  return selected;
}

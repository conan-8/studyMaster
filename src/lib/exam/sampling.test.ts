// @vitest-environment node
/**
 * part-core supplementary unit tests — PURE assembly helpers (no database).
 *
 * Covers the deterministic logic behind assembleExam (R56):
 *   - Hamilton weighted split totals 40 -> 8/12/6/14 (R19/R20),
 *   - per-user sets differ when the pool >= 40 (R21/R22),
 *   - best-effort fill + shortfall when the pool < 40 (R23/R27),
 *   - FRQ section type -> null -> empty selection (R18),
 *   - PRNG/shuffle determinism + distinctness (R21).
 *
 * These never touch the DB, so they always pass under `vitest run`.
 */
import { describe, expect, it } from "vitest";
import { QuestionType } from "@/generated/prisma";
import {
  hamiltonSplit,
  makeRng,
  sampleWeightedSection,
  sectionTypeToQuestionType,
  shuffle,
  type UnitPool,
} from "@/lib/exam/sampling";

const APCSA_WEIGHTS = [0.2, 0.3, 0.14, 0.36];

/** Build `perUnit` pools of `size` distinct ids each, ids tagged "u{n}-{i}". */
function buildPools(perUnit: number[], size: number): UnitPool[] {
  return perUnit.map((count, idx) => {
    const n = idx + 1;
    const ids: string[] = [];
    for (let i = 0; i < Math.min(count, size); i++) ids.push(`u${n}-${i}`);
    return { unitId: `unit-${n}`, ids };
  });
}

function unitOf(id: string): number {
  // ids look like "u3-07"
  return Number(id.slice(1, id.indexOf("-")));
}

function countByUnit(ids: string[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const id of ids) counts[unitOf(id)] += 1;
  return counts;
}

describe("hamiltonSplit (R19/R20)", () => {
  it("splits 40 MCQ by APCSA weights into exactly 8/12/6/14 (total 40)", () => {
    const result = hamiltonSplit(APCSA_WEIGHTS, 40);
    expect(result).toEqual([8, 12, 6, 14]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("always sums to exactly the requested total", () => {
    for (const total of [0, 1, 5, 10, 39, 40, 41, 100]) {
      const result = hamiltonSplit(APCSA_WEIGHTS, total);
      expect(result.length).toBe(4);
      expect(result.reduce((a, b) => a + b, 0)).toBe(total);
      for (const c of result) expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it("breaks fractional-remainder ties by ascending unit number", () => {
    // Three equal weights, 4 seats: raw 1.333 each, floors 1/1/1 (sum 3), one
    // remaining seat. All remainders tie -> ascending index -> unit 1 gets it.
    expect(hamiltonSplit([1, 1, 1], 4)).toEqual([2, 1, 1]);
  });

  it("returns [] for no units and all-zeros for a zero total", () => {
    expect(hamiltonSplit([], 40)).toEqual([]);
    expect(hamiltonSplit(APCSA_WEIGHTS, 0)).toEqual([0, 0, 0, 0]);
  });
});

describe("sectionTypeToQuestionType (R17/R18/R11)", () => {
  it("maps MCQ/SAQ/DBQ/LEQ to their QuestionType enum values", () => {
    expect(sectionTypeToQuestionType("MCQ")).toBe(QuestionType.MCQ);
    expect(sectionTypeToQuestionType("SAQ")).toBe(QuestionType.SAQ);
    expect(sectionTypeToQuestionType("DBQ")).toBe(QuestionType.DBQ);
    expect(sectionTypeToQuestionType("LEQ")).toBe(QuestionType.LEQ);
  });

  it("returns null for FRQ (and other non-enum section types) -> empty selection, not an error", () => {
    expect(sectionTypeToQuestionType("FRQ")).toBeNull();
    expect(sectionTypeToQuestionType("ESSAY")).toBeNull();
    expect(sectionTypeToQuestionType("PERFORMANCE_TASK")).toBeNull();
  });
});

describe("shuffle / makeRng determinism (R21)", () => {
  const items = Array.from({ length: 20 }, (_, i) => `x${i}`);

  it("is deterministic for the same seed string", () => {
    const a = shuffle(items, makeRng("user-1:nonce-1"));
    const b = shuffle(items, makeRng("user-1:nonce-1"));
    expect(a).toEqual(b);
    expect(a.slice().sort()).toEqual(items.slice().sort()); // a permutation
  });

  it("differs for different seed strings", () => {
    const a = shuffle(items, makeRng("user-1:nonce-1"));
    const b = shuffle(items, makeRng("user-2:nonce-1"));
    expect(a.join(",")).not.toBe(b.join(","));
  });
});

describe("sampleWeightedSection (R20/R21/R22/R23/R27)", () => {
  it("distributes a full 80-pool into 8/12/6/14 (total 40, all distinct)", () => {
    const pools = buildPools([20, 20, 20, 20], 20);
    const selected = sampleWeightedSection(pools, APCSA_WEIGHTS, 40, makeRng("user-c:1"));
    expect(selected.length).toBe(40);
    expect(new Set(selected).size).toBe(40);
    const byUnit = countByUnit(selected);
    expect(byUnit[1]).toBe(8);
    expect(byUnit[2]).toBe(12);
    expect(byUnit[3]).toBe(6);
    expect(byUnit[4]).toBe(14);
  });

  it("gives two different users non-identical sets when the pool >= 40 (R21/R22)", () => {
    const pools = buildPools([20, 20, 20, 20], 20);
    const setA = sampleWeightedSection(pools, APCSA_WEIGHTS, 40, makeRng("user-a:1"))
      .slice()
      .sort();
    const setB = sampleWeightedSection(pools, APCSA_WEIGHTS, 40, makeRng("user-b:1"))
      .slice()
      .sort();
    expect(setA.length).toBe(40);
    expect(setB.length).toBe(40);
    expect(setA.join(",")).not.toBe(setB.join(","));
  });

  it("best-effort fills and records a shortfall when the pool < 40 (R23/R27)", () => {
    // Only 5 active questions exist: 2/2/1/0 across the four units.
    const pools = buildPools([2, 2, 1, 0], 20);
    const selected = sampleWeightedSection(pools, APCSA_WEIGHTS, 40, makeRng("user-d:1"));
    expect(selected.length).toBe(5); // filled every available question
    expect(selected.length).toBeLessThan(40); // shortfall recorded as count < target
    expect(new Set(selected).size).toBe(5);
    for (const id of selected) expect(unitOf(id)).toBeGreaterThanOrEqual(1);
  });

  it("returns an empty list when every pool is empty (no throw)", () => {
    const pools = buildPools([0, 0, 0, 0], 20);
    const selected = sampleWeightedSection(pools, APCSA_WEIGHTS, 40, makeRng("user-x:1"));
    expect(selected).toEqual([]);
  });
});

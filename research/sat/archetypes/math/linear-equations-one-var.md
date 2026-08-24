# Linear Equations in One Variable

**Slug:** `linear-equations-one-var` · **Domain:** Algebra

## What it tests

Solving a linear equation in one unknown — presented either as a bare
equation or dressed as a 15–60 word word problem (pricing, mixing,
counting, ages). The student must translate, distribute, isolate, and
verify; special forms additionally test reading `5 = 8` as *no solution*
and `7 = 7` as *infinitely many*. Distractors are the exact outputs of
canonical algebra bugs, not random near-misses.

## Original example item (medium difficulty — distribution + transposition)

> If 4(x + 8) = 56, what is the value of x?

- A) 6
- B) 12
- C) 22
- D) 96

**Key: A (x = 6).** Distribute fully: 4x + 32 = 56, so 4x = 24 and x = 6.
Check: 4(6 + 8) = 4 · 14 = 56. ✓

**Why the distractors fail:**

- **B) 12** — `SAT_MATH:linear-equations-one-var-partial-distribution`:
  distributing 4 to x only gives 4x + 8 = 56, so x = 12.
- **C) 22** — `SAT_MATH:linear-equations-one-var-sign-error-when-moving-terms`:
  from 4x + 32 = 56 the student "moves" the 32 without flipping its sign:
  4x = 56 + 32 = 88, so x = 22.
- **D) 96** — `SAT_MATH:linear-equations-one-var-multiplying-by-reciprocal-incorrectly`:
  from 4x = 24 the student multiplies by the coefficient instead of dividing:
  x = 4 · 24 = 96.

## Difficulty commentary

- **Easy:** one-apply-the-op skeleton `ax + b = c`, positive integers,
  one-sentence word-problem translation, integer key.
- **Medium:** distribution `a(x + b) = c` or fractional coefficient
  `(p/q)x + b = c`; two-step context translation; indirect asks.
- **Hard:** variables on both sides `a(x + b) = d(x + e)`; special forms
  where x cancels (no solution vs infinitely many); ask for an expression
  in the root (`3x - 2`), grid-in fractional keys.

## Generation notes

1. **Choose the skeleton first**, then parameters: pick a, d ∈ [2, 9] and
   constants so the key is an integer or has denominator ≤ 12.
2. **Compute distractors by re-running the bug machinery** on the same
   equation (partial distribution, unflipped transposition, multiply-by-
   fraction). If any bug value collides with another choice, perturb the
   constant — never invent an unexplained number.
3. **Verify by substitution.** The key must satisfy the ORIGINAL equation;
   a bug output almost never does (that is the built-in self-check to
   teach).
4. **Grid-in hygiene:** student-produced keys must be non-negative
   rationals fitting the 4-column grid; count asks stay MCQ with all
   three options (no solution / exactly one / infinitely many) present.

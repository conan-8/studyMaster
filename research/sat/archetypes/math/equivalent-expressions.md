# Equivalent Expressions

**Slug:** `equivalent-expressions` · **Domain:** Advanced Math

## What it tests

Rewriting expressions by the structure-preserving operations: expanding
products, distributing negatives, combining like terms, exponent laws,
and factoring. No stimulus — the expression and the requested form live
in the stem. Every distractor is the output of a specific canonical bug
applied to the same expression, and every item is verifiable by numeric
substitution.

## Original example item (hard difficulty — two chained operations)

> Which expression is equivalent to (2x - 3)² - (x² - 4)?

- A) 3x² - 13
- B) 3x² - 5
- C) 3x² - 12x + 5
- D) 3x² - 12x + 13

**Key: D.** Expand the square by FOIL: 4x² - 12x + 9. Distribute the
minus to BOTH terms: -(x² - 4) = -x² + 4. Combine: 3x² - 12x + 13.
Numeric check at x = 1: (2 - 3)² - (1 - 4) = 1 + 3 = 4, and
3 - 12 + 13 = 4. ✓

**Why the distractors fail:**

- **A) 3x² - 13** — both bugs chained:
  `SAT_MATH:equivalent-expressions-distributing-exponent-across-addition`
  gives 4x² - 9, then
  `SAT_MATH:equivalent-expressions-negative-distribution-sign-error`
  gives -x² - 4; combined: 3x² - 13.
- **B) 3x² - 5** — the exponent-distribution bug alone: 4x² - 9 with a
  correct -(x² - 4) gives 3x² - 5.
- **C) 3x² - 12x + 5** — the negative-distribution bug alone: a correct
  square with -(x² - 4) mangled to -x² - 4 gives 5 as the constant.

## Difficulty commentary

- **Easy:** one operation, positive coefficients, no minus-parentheses.
- **Medium:** two chained operations; subtraction before parentheses;
  factoring where c has competing factor pairs.
- **Hard:** three-term expansions with a coefficient ask; factor by
  grouping; choice sets where every distractor shares the key's first
  and last terms, differing only in the middle coefficient.

## Generation notes

1. **Build the correct form first**, then reverse-engineer the stem —
   this guarantees exactly one canonical simplification path.
2. **Distractors are bug outputs on the same stem** — square term-by-
   term, drop the minus on the second term, merge unlike powers, swap
   the exponent-law operation, or factor with the wrong-sum pair.
3. **Run the three-value numeric test** (0, 1, a negative) on every
   choice: the key passes everywhere; any distractor that passes
   everywhere is accidentally equivalent and must be discarded.
4. **Format hygiene:** sort all choices in descending powers so surface
   format never leaks the answer.

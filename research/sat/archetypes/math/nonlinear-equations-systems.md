# Nonlinear Equations and Systems

**Slug:** `nonlinear-equations-systems` · **Domain:** Advanced Math

## What it tests

Solving quadratic, cancelable, radical/rational equations and linear-
quadratic systems — with full solution sets (no lost roots), extraneous
candidates rejected by checking, and solution counts read from the
discriminant. The ask is often a sum, product, or count, which is exactly
where partial-solve and extraneous-root bugs surface.

## Original example item (medium difficulty — sum of solutions)

> What is the sum of the solutions to x² - 2x - 3 = 0?

- A) -2
- B) 2
- C) 3
- D) 4

**Key: B.** Factor: (x - 3)(x + 1) = 0, so x = 3 or x = -1, and the sum
is 3 + (-1) = 2. Viete check: sum = -b/a = 2/1 = 2. ✓

**Why the distractors fail:**

- **A) -2** — `SAT_MATH:nonlinear-equations-systems-quadratic-formula-sign-error`:
  -b computed as b (the double-negative slip on -(-2)), giving the sum
  with the wrong sign.
- **C) 3** — `SAT_MATH:nonlinear-equations-systems-zero-product-partial-solve`:
  solving only the first factor (x = 3) and reporting it where a sum of
  BOTH solutions is asked.
- **D) 4** — the same quadratic-formula sign bug on the roots: computed
  as 1 and 3 (signs flipped), the sum lands on 4.

## Difficulty commentary

- **Easy:** monic, factorable, distinct small roots; zero-product
  already visible; every candidate checks.
- **Medium:** non-monic or rearrange-first; sum/product asks requiring
  both roots; linear-quadratic systems with integer intersections.
- **Hard:** cancelable shapes (x² = kx) where dividing loses the zero
  root; radical/rational equations with an extraneous candidate;
  tangency parameter items (find k for exactly one intersection).

## Generation notes

1. **Choose roots first**, then expand — the equation is factorable by
   construction and Viete's formulas give an independent key check.
2. **Design radical/rational items** so squaring yields exactly one
   extraneous candidate (e.g. √(2x + 3) = x → candidates 3 and -1, only
   3 checks); the trap choice reports both.
3. **Distractors are bug outputs:** canceled-away root, first-factor-
   only, sign-flipped roots, mis-signed discriminant, extraneous
   candidate accepted, reversed count.
4. **Never cancel a variable** — items should reward moving everything
   to one side and factoring; that's also the remediation story the
   distractors teach.

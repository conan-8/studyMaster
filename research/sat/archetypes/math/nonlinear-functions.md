# Nonlinear Functions

**Slug:** `nonlinear-functions` · **Domain:** Advanced Math

## What it tests

Interpreting quadratic and exponential functions: reading the vertex and
extreme value from vertex form, finding intercepts (substituting x = 0
rather than reading factored-form zeros), selecting compounding growth
models a·b^t over additive ones, and honoring the max/min direction set
by the leading coefficient. Contexts are projectiles, revenue, population,
and depreciation.

## Original example item (medium-hard — vertex position vs value)

> The function f is defined by f(x) = -(x - 4)² + 18. What is the value
> of x at which f attains its maximum?

- A) -4
- B) 4
- C) 18
- D) -18

**Key: B.** The squared term vanishes when x - 4 = 0, so x = 4, and
f(4) = 18 is the maximum. Check: f(3) = -(−1)² + 18 = 17 < 18 and
f(5) = 17 < 18. ✓

**Why the distractors fail:**

- **A) -4** — `SAT_MATH:nonlinear-functions-vertex-form-sign-error`:
  reading the vertex of (x - 4)² as -4 (the parenthesis hides a
  subtraction; its zero is +4).
- **C) 18** — `SAT_MATH:nonlinear-functions-max-min-direction-swap`:
  the maximum VALUE reported where the x-position of the maximum is
  asked.
- **D) -18** — the vertex-sign bug applied to k: (-4, -18) read as the
  vertex, then its y-coordinate reported for the x-ask (same swap bug
  on top of the sign slip).

## Difficulty commentary

- **Easy:** vertex/intercept read from forms with positive parameters;
  one-period growth; value-vs-position both unambiguous.
- **Medium:** negative h or negative a; multi-period compounding
  ('15%' → multiplier 1.15); decay (1 - r).
- **Hard:** value asks where the vertex x-position is the trap, in
  context (maximum height); solving past thresholds with b^t; table or
  graph variants with the vertex between lattice points.

## Generation notes

1. **Fix parameters with h ≠ 0 and k ≠ 0** so sign-flip twins are
   visible; use t ≥ 2 periods so additive and compounding totals differ.
2. **Distractors are mechanical twins:** (-h, k); a zero offered as the
   y-intercept; a(1 + rt) for a·b^t; the x-position for a value ask;
   max/min labels swapped.
3. **Verify the key twice:** f(h) = k exactly, and the y-intercept from
   x = 0 in whatever form is given.
4. **Graph variants** use `sat-math:graph-function` with the same
   coefficients; mark only lattice points so the figure stays SAT-clean.

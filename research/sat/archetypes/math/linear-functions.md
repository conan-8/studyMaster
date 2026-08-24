# Linear Functions

**Slug:** `linear-functions` · **Domain:** Algebra

## What it tests

Building, interpreting, and evaluating linear functions: reading slope and
intercept from a context, table, or graph; computing slope from two
points; and substituting whole inputs into function notation. Distractors
are mechanical twins of the key — the same two numbers with roles
exchanged, the slope inverted or negated, or an evaluation that appends
the increment in the wrong place.

## Original example item (medium difficulty — slope from two points)

> Line ℓ passes through the points (2, 3) and (6, 11) in the xy-plane.
> What is the slope of line ℓ?

- A) -2
- B) 1/2
- C) 2
- D) -1/2

**Key: C.** Slope = Δy/Δx = (11 - 3)/(6 - 2) = 8/4 = 2. The line rises 8
units over a run of 4.

**Why the distractors fail:**

- **A) -2** — `SAT_MATH:linear-functions-slope-sign-from-inconsistent-point-order`:
  (11 - 3)/(2 - 6) = -2, the slope computed with the subtractions in
  opposite orders.
- **B) 1/2** — `SAT_MATH:linear-functions-slope-rise-run-inversion`: run
  over rise, 4/8.
- **D) -1/2** — both bugs chained: run over rise AND mismatched point
  order.

## Difficulty commentary

- **Easy:** read m and b straight from a graph (lattice points), an
  equation, or a context where rate and starting value appear verbatim.
- **Medium:** slope from two points with a negative rise or run; rate
  derived from two data pairs; interpretation of m or b with units.
- **Hard:** f(x + h) whole-input substitution; comparing two linear
  functions; choice sets where all four share the same numbers in
  permuted roles.

## Generation notes

1. **Fix m and b first** (integers, |m| ≤ 6, |b| ≤ 10), then write the
   context so the rate and starting value each occupy exactly one
   sentence. Tables render ≥ 3 rows from (x, mx + b); graphs use
   `sat-math:graph-line` with the same m and b.
2. **Pick parameters that keep twins distinct:** avoid m = b, |m| = 1,
   |m| = 1/m, and b = 0, or two bug outputs will collide.
3. **Verify the key against two data points** — a model that fits only
   one row is not the key, and that same check is what rules out the
   swapped-intercept distractor.
4. **Function-notation asks:** distractors come from appending the
   increment after evaluating (2x + 4 for f(x + 3)) or splitting
   f(2 + 3) into f(2) + f(3); generate them by performing exactly those
   mis-operations.

# Linear Inequalities

**Slug:** `linear-inequalities` · **Domain:** Algebra

## What it tests

Solving and interpreting linear inequalities: isolating the variable with
the symbol flip on negative division, honoring strict vs inclusive
boundaries, shading the correct half-plane, and intersecting compound
constraints — plus SAT-style feasibility asks ("greatest number of...")
where the boundary integer is the trap. Distractors share the correct
boundary; only direction, strictness, or region membership varies.

## Original example item (medium difficulty — flip + strictness)

> Which of the following is the solution to 5 - 2x > 13?

- A) x < -4
- B) x > -4
- C) x ≤ -4
- D) x < -9

**Key: A.** Subtract 5: -2x > 8. Divide by -2 and FLIP: x < -4. Check
with x = -5 (interior): 5 - 2(-5) = 15 > 13 ✓. Check the boundary
x = -4: 5 - 2(-4) = 13, not > 13 — correctly excluded by the strict
symbol. ✓

**Why the distractors fail:**

- **B) x > -4** — `SAT_MATH:linear-inequalities-forgetting-to-flip-when-dividing-by-negative`:
  correct boundary, direction never flipped after dividing by -2.
- **C) x ≤ -4** — `SAT_MATH:linear-inequalities-strict-vs-inclusive-boundary-swap`:
  correct work on direction, but the boundary is folded into a strict
  solution set.
- **D) x < -9** — the un-flip bug riding on a transposition slip
  (the one-variable sign bug carried into inequalities): the student
  moves the 5 without negating (-2x > 18) and keeps the direction,
  producing x > -9's mirror — wrong boundary AND wrong direction.

## Difficulty commentary

- **Easy:** positive coefficient, no flip ever needed; choices differ in
  direction only.
- **Medium:** negative coefficient forces the flip; strictness becomes
  the discriminator; 'at least / no more than' translation.
- **Hard:** compound AND constraints and absolute-value forms; standard-
  form half-plane shading; feasibility asks where the boundary integer
  must be excluded.

## Generation notes

1. **Design backwards:** pick the boundary integer and direction, then
   write the inequality that produces them — this guarantees the
   boundary is shared by all choices.
2. **Distractors are the twin set:** un-flipped direction, swapped
   strictness, boundary-value-as-solution, complementary rays for
   compounds, mirrored shading for graphs.
3. **Always run the two-point test:** one interior point must satisfy
   the original inequality, and the boundary must fail (strict) or
   pass (inclusive). This is also the discriminating check that kills
   two distractors at once.
4. **Feasibility asks** ('greatest number of...') need whole-number
   answers the scenario can realize; the rounded-up boundary integer is
   the required trap.

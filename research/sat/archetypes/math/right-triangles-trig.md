# Archetype: Right Triangles and Trigonometry

- **Slug:** `right-triangles-trig`
- **Taxonomy:** `SAT_MATH:right-triangles-trig` (Geometry and Trigonometry)
- **Stimulus:** right-triangle figure (`figure`) via `sat-math:triangle-labeled` —
  right-angle mark, labeled acute angle, labeled sides; contexts like ladders and ramps
- **Answer mode:** computed side/angle or trig ratio; ~60% `mcq` (ratio choices),
  ~40% `grid_in` (integer sides, nearest-degree angles)

## What the skill tests

SOH-CAH-TOA ratio selection from the target angle's perspective, the Pythagorean theorem
in both directions (add squares for the hypotenuse, **subtract** when it's known),
cofunction relationships between the two acute angles, and inverse trig to recover an
angle from two sides.

## Worked example (medium — cofunction)

**Stimulus.** In right triangle ABC, angle C is the right angle and the measure of
angle B is 22.6°. The length of side AC is 5 and the length of side AB is 13.
(sin 22.6° ≈ 5/13, cos 22.6° ≈ 12/13)

**Stem.** What is the value of cos A?

- A) 5/13
- B) 12/13
- C) 13/12
- D) 5/12

**Key:** A (5/13). Angles A and B are complementary (A = 90° − 22.6° = 67.4°), so
cos A = sin B = 5/13 — side AC is *opposite* B and *adjacent* to A, and 5-12-13
confirms it (12² + 5² = 13²).

**Rationale (each distractor names its misconception):**

- **B) 12/13** — `SAT_MATH:right-triangles-trig-complement-cofunction-error`: takes
  cos of angle **B** (or assumes cos A = cos B): the cofunction is missed, and the
  same-triangle ratio for the wrong angle is reported.
- **C) 13/12** — ratio inversion companion of the sin/cos swap: hypotenuse over leg —
  impossible as a cosine but produced when the fraction is flipped while 'fixing'
  (cosines must be ≤ 1; magnitude check kills it).
- **D) 5/12** — `SAT_MATH:right-triangles-trig-tan-as-opposite-over-hypotenuse`
  family: the two legs divided — the tangent ratio tan B (5/12) offered as a cosine,
  dragging the wrong pair of sides into the ratio.

## Generation notes

- Start from a true triple (3-4-5, 5-12-13, 8-15-17, 7-24-25 and multiples, sides
  3–60); give angle measures consistent with the triple's ratios (sin 22.6° ≈ 5/13).
- Distractors reuse the triangle's own sides: legs exchanged (sin↔cos swap),
  hypotenuse swapped into tangent, sqrt(a² + c²) for missing-leg items, bare ratio
  (0.75) for angle items.
- Missing-leg items are the add-vs-subtract battleground: the bogus leg always exceeds
  the hypotenuse — the built-in impossibility check.
- Angle items must state rounding (“to the nearest degree”); keys are integers.
- Grid-in keys: integer sides or angle measures ≤ 4 characters.

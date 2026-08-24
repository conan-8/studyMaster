# Archetype: Lines, Angles, and Triangles

- **Slug:** `lines-angles-triangles`
- **Taxonomy:** `SAT_MATH:lines-angles-triangles` (Geometry and Trigonometry)
- **Stimulus:** labeled figure (`figure`) — labeled triangle or parallel lines cut by a
  transversal (`sat-math:triangle-labeled`, `sat-math:parallel-lines-transversal`)
- **Answer mode:** computed angle/side or must-be-true statement; balanced `mcq`/`grid_in`

## What the skill tests

Angle chasing with the core theorems: triangle angle sum (180°), linear pairs and
vertical angles, complementary vs supplementary pairs, parallel-line relationships
(corresponding, alternate, same-side interior — **only** when parallelism is given or
marked), the exterior angle theorem, and similarity proportions with correctly paired
corresponding sides.

## Worked example (medium — exterior angle)

**Stimulus.** In triangle ABC, the measure of angle A is 65° and the measure of angle B
is 45°. Side AC is extended through C to point D.

**Stem.** What is the measure, in degrees, of angle BCD (the exterior angle at C)?

- A) 110
- B) 65
- C) 70
- D) 250

**Key:** A (110). The exterior angle equals the sum of the two remote interior angles:
65 + 45 = 110. Check: the adjacent interior angle at C is 180 − 110 = 70, and
65 + 45 + 70 = 180. ✓

**Rationale (each distractor names its misconception):**

- **B) 65** — `SAT_MATH:lines-angles-triangles-exterior-angle-single-remote`: equates the
  exterior angle with one remote interior angle (the given 65°) instead of their sum.
- **C) 70** — `SAT_MATH:lines-angles-triangles-complementary-supplementary-swap`
  (wrong member of the pair): computes the ADJACENT interior angle — the exterior's
  supplement — and reports it, answering the wrong member of the linear pair.
- **D) 250** — `SAT_MATH:lines-angles-triangles-triangle-sum-360-error`: applies the
  360° total, computing 360 − (65 + 45) = 250 — exactly 180 more than the adjacent
  interior angle the same wrong total produces.

## Generation notes

- Fix every angle as multiples of 5 summing to the true totals **before** writing any
  algebraic expression; expressions must evaluate back to the pre-fixed integers.
- Distractors are computed, never invented: 90 − a vs 180 − a swap, 360 − (a + b)
  (= key + 180 in third-angle items), one remote interior where the sum is the key,
  the copied given angle (unstated-parallelism trap).
- Parallel arrows only when the parallel theorem is licensed; “must be true”
  statement items include exactly one claim that holds without parallelism.
- Similarity: mark congruent angles so the correspondence is unique; the crossed-pairing
  proportion yields the reciprocal-scaled distractor.
- All angles positive multiples of 5 (10–170); side lengths integers 3–30 with scale
  factors 1.5/2/3; answers grid-in-compatible integers.

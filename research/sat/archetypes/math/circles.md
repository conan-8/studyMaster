# Archetype: Circles

- **Slug:** `circles`
- **Taxonomy:** `SAT_MATH:circles` (Geometry and Trigonometry)
- **Stimulus:** circle figure via `sat-math:circle-features` (center O, labeled
  radius/diameter/chord/central or inscribed angle), or an equation-only variant with
  (x − h)² + (y − k)² = r² in the stem
- **Answer mode:** computed value in kπ form, coordinate pair, or degree measure;
  `mcq` dominant, `grid_in` for degrees/coefficients/coordinates

## What the skill tests

Circle measurements (circumference, area) with a rigorous radius/diameter discipline,
arc length and sector area as **fractions** (θ/360) of the whole, the central-vs-
inscribed angle relationship, and reading/writing the standard-form equation — center
from the parentheses, radius as the **square root** of the right side.

## Worked example (medium — sector area)

**Stimulus.** In the circle with center O, the diameter is 12 and the central angle AOB
measures 60°.

**Stem.** What is the area of the sector formed by central angle AOB, in terms of π?

- A) 6π
- B) 24π
- C) 36π
- D) 18π

**Key:** A (6π). Radius = 12/2 = 6; sector = (60/360) × π(6)² = (1/6)(36π) = 6π.

**Rationale (each distractor names its misconception):**

- **B) 24π** — sector built on the diameter-as-radius error compounded with the
  fraction: (1/6)(144π) = 24π, i.e., `SAT_MATH:circles-radius-diameter-swap`
  (uses r = 12 instead of 6).
- **C) 36π** — `SAT_MATH:circles-arc-sector-uses-full-circle`: the full circle area
  π(6)² = 36π with no θ/360 fraction taken — the sector silently becomes the disk.
- **D) 18π** — the fraction misapplied at half strength ((1/2)(36π) instead of
  (1/6)): the complement/supplement-style slip of the same bug family, dropping the
  angle-to-fraction conversion.

## Generation notes

- Convert to radius FIRST and write it on the figure; the diameter-statement variant
  keeps the swap trap live (4× areas, 2× lengths).
- Arc/sector: angles from {30, 45, 60, 90, 120, 150} with r 6–12 so k stays integer
  in kπ answers; the θ/360 fraction is always < 1 — sector < disk, arc < circumference.
- Inscribed-angle items put the vertex ON the circle; the distractor is the arc itself
  (and vice versa: half where double is asked).
- Equation items: integer centers in [−9, 9], perfect-square r²; distractors = sign-
  flipped center (one bug) or un-square-rooted radius (36 for 36) — never both bugs
  in one choice.
- Grid-in variants never carry π: ask for the coefficient k, a degree measure, or a
  coordinate.

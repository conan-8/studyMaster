# Archetype: Area and Volume

- **Slug:** `area-volume`
- **Taxonomy:** `SAT_MATH:area-volume` (Geometry and Trigonometry)
- **Stimulus:** word problem with stated dimensions (`passage`, 20–70 words); SAT
  reference formulas assumed; **no diagram**
- **Answer mode:** computed number — strong `grid_in` lean; `mcq` for scale-factor traps

## What the skill tests

Selecting and applying the right measure — area vs perimeter vs volume vs surface area —
from a real-world context, computing it from given (or derived) dimensions, and reasoning
about how the measures scale when dimensions change (k, k², k³).

## Worked example (medium — slant-height trap)

**Stimulus.** A parallelogram-shaped sign has a base of 10 feet. The side edge measures
6 feet, and the perpendicular distance between the base and the opposite side is 5 feet.
The sign is to be painted on one side.

**Stem.** What is the area, in square feet, of the face to be painted?

- A) 60
- B) 50
- C) 30
- D) 26

**Key:** B (50). Area of a parallelogram = base × perpendicular height = 10 × 5 = 50.

**Rationale (each distractor names its misconception):**

- **A) 60** — `SAT_MATH:area-volume-slant-height-used-as-height`: multiplies the base by
  the slanted side edge (10 × 6), using the non-perpendicular length where the height
  belongs.
- **C) 30** — `SAT_MATH:area-volume-triangle-area-missing-half` shadow: applies the
  triangle formula (½ · 10 · 6) with the WRONG height — the slant again, plus the half —
  compounding two bugs into a plausible number.
- **D) 26** — `SAT_MATH:area-volume-computing-area-when-perimeter-asked`: offers the
  perimeter 10 + 6 + 10 + 6 = 32's cousin (10 + 2×5 + 6 = 26 via mangled pairing) — a
  length where an area is asked, caught by unit checking ("square feet").

## Generation notes

- Fix the asked measure first and let a context word name it: *cover/paint* = area,
  *fence/border* = perimeter, *fill* = volume.
- Distractors are computed siblings on the same numbers: other measure, b×h (2× key),
  base × slant, linear k offered as the scale multiplier.
- Slant traps require the stimulus to state BOTH a slant measure and a perpendicular
  height (Pythagorean-consistent, e.g., 5-12-13 pairs).
- Scaling items ask for the multiplier (4, 8, 9), not the new measurement; hard band
  includes reverse scaling (area 9× → sides 3×) and dimension trade-offs
  (width doubles, height halves).
- Dimensions: integers 2–30; areas ≤ 900; volumes ≤ 2,000; cylinders as kπ with
  integer k; everything exact and grid-in compatible.

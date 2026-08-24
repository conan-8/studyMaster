# Linear Equations in Two Variables

**Slug:** `linear-equations-two-vars` · **Domain:** Algebra

## What it tests

Working with the equation of a line as an object: extracting slope and
intercepts from standard or slope-intercept form, and constructing an
equation from a point plus a slope / parallel / perpendicular condition.
The canonical items carry no stimulus — the given equation or point-and-
condition lives in the stem. Distractors are the classic sign and
role-swap outputs.

## Original example item (hard difficulty — perpendicular construction)

> Which equation is an equation of the line that passes through (2, -5)
> and is perpendicular to the line with equation y = (1/2)x + 3?

- A) y = -2x - 1
- B) y = -2x + 9
- C) y = -(1/2)x - 4
- D) y = (1/2)x - 6

**Key: A.** Perpendicular to slope 1/2 means slope -1/2 · ... : flip and
negate 1/2 → -2. Through (2, -5): y = -2(x - 2) - 5 = -2x + 4 - 5 =
-2x - 1. Check: -2(2) - 1 = -5. ✓

**Why the distractors fail:**

- **B) y = -2x + 9** — `SAT_MATH:linear-equations-two-vars-point-slope-sign-error`:
  built from y - 5 = -2(x - 2), dropping the double negative on the
  y-coordinate (-5).
- **C) y = -(1/2)x - 4** — `SAT_MATH:linear-equations-two-vars-perpendicular-slope-not-reciprocated`:
  negates the slope (-1/2) but never flips it.
- **D) y = (1/2)x - 6** — same misconception, other half: copies the
  original slope 1/2 (neither flips nor negates).

## Difficulty commentary

- **Easy:** slope/intercept read directly from y = mx + b; positive
  anchor coordinates.
- **Medium:** standard form needing -A/B or a solve-for-y; construction
  through a point with a negative coordinate.
- **Hard:** perpendicular construction with fractional slope through an
  off-axis point; two-point equations with neither point an intercept;
  indirect asks (sum of intercepts).

## Generation notes

1. **Pick C as a common multiple of A and B** so both intercepts are
   integers; pick anchor points with a negative coordinate so the
   point-slope bug is live.
2. **Compute distractors by machine:** unnegated A/B; other-axis
   intercept; key intercept shifted by 2|y1|; slopes -m and 1/m for the
   true -1/m. Expand every choice to confirm four distinct lines.
3. **Always verify the key** by substituting the given point and checking
   the slope condition (parallel: same m; perpendicular: product of
   slopes = -1).
4. **Form discipline:** if the ask requests slope-intercept form, only
   one choice should be in another form at most — form mismatch must
   not become an accidental cue.

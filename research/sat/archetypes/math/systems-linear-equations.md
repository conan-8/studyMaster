# Systems of Linear Equations

**Slug:** `systems-linear-equations` · **Domain:** Algebra

## What it tests

Solving a 2×2 linear system by substitution or elimination — or reading
its graph — and, crucially, answering what was actually asked (y, x + y,
a count). Parameter items force the no-solution / infinitely-many
judgment. Distractors are the exact outputs of elimination and
substitution bugs, plus the evergreen "solved for the wrong variable".

## Original example item (medium difficulty — elimination with scaling)

> 2x + y = 12
> x + 2y = 9
>
> If (x, y) is the solution to the system of equations above, what is
> the value of y?

- A) -1
- B) 2
- C) 5
- D) 7

**Key: B.** Multiply the second equation by 2: 2x + 4y = 18. Subtract
the first: (2x + 4y) - (2x + y) = 18 - 12, so 3y = 6 and y = 2 (then
x = 5). Check: 2(5) + 2 = 12 ✓ and 5 + 2(2) = 9 ✓.

**Why the distractors fail:**

- **A) -1** — `SAT_MATH:systems-linear-equations-elimination-scales-one-side-only`:
  multiplying x + 2y = 9 by 2 on the left only gives the bug equation
  2x + 4y = 9; subtracting the first equation then yields 3y = -3, so
  y = -1.
- **C) 5** — `SAT_MATH:systems-linear-equations-solving-for-x-when-asked-for-y`:
  the correct x-coordinate, reported for a y-ask.
- **D) 7** — same misconception, combination form: x + y reported where
  y alone is asked.

## Difficulty commentary

- **Easy:** one equation pre-solved for a variable; integer solution;
  ask for a single coordinate.
- **Medium:** elimination needs a scale factor of 2 or 3; combination
  asks (x + y); context translation.
- **Hard:** parameter items (find k for no solution / infinitely many);
  subtraction required with matched signs; grid-in combination asks.

## Generation notes

1. **Pick the solution (p, q) first**, then compute constants from it —
   the system is consistent by construction and both solve paths
   (elimination AND substitution) should be run as verification.
2. **Distractors are computed, not invented:** the corrupted-constant
   system's solution, the added-instead-of-subtracted result, the other
   coordinate, the un-combined sum. Each must equal its bug's exact
   output on this system.
3. **Count asks** always offer all three options (none / one /
   infinitely many); for parallel systems, (0, k) is the classic forced
   numeric trap.
4. **Graph variants** use `sat-math:graph-system-two-lines` with integer
   intersections inside the window; omit the intersection dot for
   no-solution items.

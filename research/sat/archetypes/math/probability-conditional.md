# Archetype: Probability and Conditional Probability

- **Slug:** `probability-conditional`
- **Taxonomy:** `SAT_MATH:probability-conditional` (Problem-Solving and Data Analysis)
- **Stimulus:** survey setup + 2×2 contingency table (`sat-math:table-two-way`)
- **Answer mode:** computed probability — strong `grid_in` lean; `mcq` for union/complement items

## What the skill tests

Computing probabilities as ratios of counts from a two-way table — unconditional
(cell/total), conditional (cell ÷ the *given* group's margin), unions of overlapping
events (add, then subtract the intersection), and complements ("does not", "neither").
The recurring skill is shrinking the universe correctly: the word after "given that"
owns the denominator.

## Worked example (medium — conditional)

**Stimulus.** A survey asked 200 students whether they take an art class or a music
class. (Two-way table: of 120 juniors, 48 take art and 72 do not; of 80 seniors,
24 take art and 56 do not.)

**Stem.** If a junior is selected at random, what is the probability that the junior
takes art?

- A) 2/5
- B) 3/10
- C) 2/3
- D) 3/5

**Key:** A (2/5). The condition "junior" shrinks the universe to 120 students; the
favorable cell is 48; 48/120 = 2/5.

**Rationale (each distractor names its misconception):**

- **B) 3/10** — `SAT_MATH:probability-conditional-conditional-denominator-error`: divides
  by the grand total (48/200), answering the *joint* probability P(junior AND art)
  instead of the conditional P(art | junior).
- **C) 2/3** — `SAT_MATH:probability-conditional-numerator-denominator-swap`:
  the transposed conditional P(junior | art) = 48/72 — divides the same cell by the
  art-takers' margin instead of the juniors' margin.
- **D) 3/5** — `SAT_MATH:probability-conditional-ignoring-complement` companion: reports
  the complement 72/120 (junior NOT taking art) — underlines that the NOT and the
  direction must both be checked before answering.

## Generation notes

- Build the table before the question: totals 50–500 (multiples of 10), integer cells
  whose margins are friendly, and the condition margin chosen **distinct** from the
  transpose margin so joint/transpose distractors are real numbers.
- Keys reduce to denominators ≤ 12 (3/8, 5/12) or terminate by hundredths; grid-in keys
  expressible as fraction or ≤ 4-character decimal.
- Distractors are computed from the same cells: cell/grand-total, cell/wrong-margin,
  add-without-subtract union, direct-p for NOT items — never invented values.
- Hard band: complement *inside* a condition, stems phrased so the transpose is the
  salient trap ("what is the probability an art-taker is a junior?"), and "at least one"
  two-draw items using the complement shortcut.

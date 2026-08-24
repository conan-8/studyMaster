# Archetype: Ratios, Rates, and Proportional Relationships

- **Slug:** `ratios-rates-proportions`
- **Taxonomy:** `SAT_MATH:ratios-rates-proportions` (Problem-Solving and Data Analysis)
- **Stimulus:** short real-world scenario (`passage_table`, 20–80 words), often with a 2–4 row data table (`sat-math:table-data`)
- **Answer mode:** computed number — heavy `grid_in` lean; `mcq` when choices are unit rates or setup recognition

## What the skill tests

Setting up and solving proportions from ratios, rates, and unit conversions in context:
part-to-part and part-to-whole shares, unit-rate scaling (miles per hour, price per ounce),
constant-product (inverse) relationships such as work rates, and measurement conversions.
Every item turns on writing the proportion with **matching unit positions** and picking the
right relation type (direct vs. inverse) before computing.

## Worked example (medium)

**Stimulus.** A bakery uses a frosting recipe with a flour-to-sugar ratio of 3 : 5 by weight.
The bakery is making frosting for a large order that requires 40 kilograms of frosting total.

**Stem.** How many kilograms of flour does the bakery need?

- A) 15
- B) 24
- C) 25
- D) 8

**Key:** A (15). Parts sum to 3 + 5 = 8; flour share = (3/8) · 40 = 15 kg.
Check: sugar = (5/8) · 40 = 25, and 15 + 25 = 40. ✓

**Rationale (each distractor names its misconception):**

- **B) 24** — `SAT_MATH:ratios-rates-proportions-part-whole-confusion`: treats the part-to-part
  ratio term as the part-to-whole fraction, computing (3/5) · 40 = 24 instead of (3/8) · 40.
- **C) 25** — the sugar share: a near-miss that answers the *other* part, exploiting hasty
  reading of which quantity the stem requests (companion to the part-whole bug).
- **D) 8** — the parts *sum*, offered as a magnitude error when the student stops after
  adding parts and reports the denominator instead of the share.

## Generation notes

- Fix the relation first (direct / part-to-whole / inverse), then choose givens whose totals
  divide cleanly by the parts sum (totals 20–500; parts sums 4–12).
- Distractors are **computed**, never invented: (a) part/other-part × total, (b) correct
  proportion with one side reciprocated, (c) wrong-direction conversion (key × factor²),
  (d) direct-scaled answer in inverse contexts. All five values must stay distinct.
- Direction check before publishing: more hours ⇒ more miles; more machines ⇒ fewer days.
- Grid-in keys: positive, ≤ 4 characters, terminating decimal or denominator ≤ 12.
- Hard band: inverse work-rate chains and three-part ratios (a : b : c) with a
  difference question appended ("how many more A than B").

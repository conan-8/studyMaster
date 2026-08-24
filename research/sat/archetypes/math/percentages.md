# Archetype: Percentages

- **Slug:** `percentages`
- **Taxonomy:** `SAT_MATH:percentages` (Problem-Solving and Data Analysis)
- **Stimulus:** pricing / growth / measurement scenario (`passage_table`, 25–80 words), sometimes a small item-price table (`sat-math:table-data`)
- **Answer mode:** computed number — `grid_in` lean for final amounts; `mcq` for percent-change and setup items

## What the skill tests

Fluency with the four percent operations and — above all — with the **base**: percent OF a
value, the final amount after an increase/decrease, percent change between two values
(denominator = original), recovering the original from the final value (divide, don't
subtract), and compounding successive changes instead of adding them.

## Worked example (hard — successive change)

**Stimulus.** A jacket originally priced at $150 is put on sale at 20% off. During a
promotion, an additional 10% is taken off the sale price at the register.

**Stem.** What is the price of the jacket after both discounts?

- A) $105.00
- B) $108.00
- C) $120.00
- D) $135.00

**Key:** B ($108.00). 0.80 × 150 = 120 after the first discount; 0.90 × 120 = 108 after
the second. Equivalent check: 0.72 × 150 = 108 — a 28% total discount.

**Rationale (each distractor names its misconception):**

- **A) $105** — `SAT_MATH:percentages-percent-of-vs-percent-increase` family: applies a
  combined 30% reduction to a mis-set base (0.70 × 150) and then subtracts a further
  step — reporting a deeper reduction than any compounding yields.
- **C) $120** — change-vs-final bug: computes only the FIRST discount (0.80 × 150) and
  stops, treating the intermediate amount as the final price.
- **D) $135** — `SAT_MATH:percentages-successive-percents-added` in the "one discount
  only on the wrong remainder" form: takes 10% off the ORIGINAL (150 − 0.10 × 150)
  after the 20% cut — percents applied to the wrong base.

*(The clean add-vs-compound pair 0.70 × 150 = $105 vs 0.72 × 150 = $108 anchors A; the
variant with $105 as the direct 30%-off value is the canonical trap.)*

## Generation notes

- Fix the operation first (OF / final / change / reverse / chain), then pick numbers:
  originals $20–$90, rates multiples of 5 (tax-style 6%/8% at medium+).
- Distractors are exact formula evaluations on the same numbers — never invented:
  r × original, (new−old)/new × 100, (1 − r₁ − r₂) × original, final × (1 − r),
  and (sparingly) 10× keys for rates under 5% (decimal slip).
- Forward-verify every key: reapply the stated change to the key and confirm the
  stimulus's stated value.
- Keep money exact to the cent; grid-in keys ≤ 4 characters.
- Hard band: "r% up then r% down never returns to the original" and add-vs-compound
  gap questions, where the gap itself ($105 vs $108) is the whole question.

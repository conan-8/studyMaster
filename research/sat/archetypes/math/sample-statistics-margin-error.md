# Archetype: Sample Statistics and Margin of Error

- **Slug:** `sample-statistics-margin-error`
- **Taxonomy:** `SAT_MATH:sample-statistics-margin-error` (Problem-Solving and Data Analysis)
- **Stimulus:** prose research report (`passage`, 40–100 words) — sample, statistic, margin
  of error; **no diagram**
- **Answer mode:** which-statement — `mcq` only; choices are claims, not numbers

## What the skill tests

Interpreting a sample estimate as an interval, not a point: computing the plausible band
estimate ± ME, judging which values the data support, knowing the margin **shrinks** as
the sample grows (≈ 1/√n), and reading the sampling frame as the limit of what the
result describes.

## Statement-distractor pattern (generator-critical)

This archetype has **no computed numeric distractors**. Each wrong choice is a named
misconception expressed as a study claim, built by mutating exactly ONE element of the
true claim while keeping the sentence shape identical: flip the direction of the
sample-size effect, drop one side of the interval, widen the population beyond the
sampling frame, or delete the hedge ("about", "plausibly") that marks an estimate.

## Worked example (medium)

**Stimulus.** A researcher surveyed a random sample of 200 residents of a city and found
that 52% exercise at least once a week. The margin of error for the estimate was 3%.

**Stem.** Based on the survey, which of the following is a plausible value for the
percent of ALL residents of the city who exercise at least once a week?

- A) 54%
- B) 56%
- C) 47%
- D) 62%

**Key:** A (54%). The plausible band is 52% − 3% to 52% + 3%, i.e., 49% to 55%;
54% lies inside.

**Rationale (each distractor names its misconception):**

- **B) 56%** — `SAT_MATH:sample-statistics-margin-error-interval-misapplied`: one point
  beyond the upper end; the student anchored on the estimate and applied the margin
  one-sidedly or misremembered the band (52 + 3 = 55, not 56).
- **C) 47%** — the mirrored one-sided error: subtracted too far (52 − 5), misaplying
  the margin's width on the lower side.
- **D) 62%** — `SAT_MATH:sample-statistics-margin-error-estimate-treated-as-exact`
  variant: treats the estimate as exact and inflates precision elsewhere; a value 10
  points out is indefensible inside any 3-point margin.

## Generation notes

- Pick n from 50–500, percentages 15–85, ME 2–6 whole points; keep the band inside 0–100.
- Build the true claim first (interval, direction of effect, or scope), then emit four
  same-shape sentences, each a one-element mutation mapping to one misconception id.
- Plausible-value items: the key sits inside the band; distractors at/just beyond the
  endpoints (±1 point) and one far out — state endpoint handling in the stem.
- Biased-frame items: perfect numbers, wrong sample source (gym members for city
  residents) — the scope mutation is the whole question.
- Two-group items: overlapping bands (48 ± 4 vs 54 ± 4) — a difference is NOT
  established when the bands overlap.

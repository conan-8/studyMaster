# Archetype: One-Variable Data

- **Slug:** `one-variable-data`
- **Taxonomy:** `SAT_MATH:one-variable-data` (Problem-Solving and Data Analysis)
- **Stimulus:** distribution figure (`figure`) — dot plot, histogram, or box plot
  (`sat-math:dot-plot`, `sat-math:histogram`, `sat-math:box-plot`) with a one-sentence caption
- **Answer mode:** computed number or true-statement selection; `grid_in` for exact statistics, `mcq` for comparisons

## What the skill tests

Reading and computing the statistics of a single-variable distribution: mean, median, mode,
range, and IQR from a dot plot / histogram / box plot — plus the conceptual layer of which
measure of center a skewed distribution warrants, and how outliers and added values move the
mean versus the median. The skill is as much definitional discrimination (mean ↔ median,
range ↔ max) as it is computation.

## Worked example (medium — mean recompute)

**Stimulus.** The dot plot shows the scores of 5 students on a quiz. The mean of the
5 scores is 80. A sixth student joins the class and scores 90 on the same quiz.

**Stem.** What is the mean of the 6 quiz scores?

- A) 81.7
- B) 85
- C) 80
- D) 90

**Key:** A (81.7, to the nearest tenth). Old total = 80 × 5 = 400; new total = 400 + 90 = 490;
490 ÷ 6 = 81.666… ≈ 81.7.

**Rationale (each distractor names its misconception):**

- **B) 85** — `SAT_MATH:one-variable-data-mean-recompute-after-value-change`: averages the
  old mean with the new value, (80 + 90)/2, equally weighting one score against the whole
  existing set instead of rebuilding from the total.
- **C) 80** — the unchanged old mean: assumes adding a value above the mean cannot move it
  (robustness direction confused — the mean uses every value; only the median may hold still).
- **D) 90** — the added value itself: reports the salient new data point rather than any
  average (mean-vs-median confusion's numeric shadow).

## Generation notes

- Pick the display to match the question: dot plot → exact computation; histogram →
  median-bin/shape; box plot → five-number summary and comparisons.
- Design data sets where **mean and median genuinely differ** (plant one outlier or skew)
  whenever the swap distractor is live; scramble display order when the unordered-middle
  distractor is used.
- Numeric distractors are computed, never invented: companion statistic, printed-middle
  value, maximum, (old mean + new)/2.
- Statement items: each wrong claim negates exactly one robustness/definition fact
  (e.g., "the median changes more than the mean").
- Values: 6–20 integers on realistic scales (scores 40–100, ages 8–20); means exact to
  one decimal; grid-in answers ≤ 4 characters.

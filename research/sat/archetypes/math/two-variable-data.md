# Archetype: Two-Variable Data

- **Slug:** `two-variable-data`
- **Taxonomy:** `SAT_MATH:two-variable-data` (Problem-Solving and Data Analysis)
- **Stimulus:** scatterplot figure (`sat-math:scatterplot`), optional drawn line of best
  fit, observational source caption
- **Answer mode:** statement selection (dominant) or computed prediction; `mcq` lean,
  `grid_in` for clean in-range predictions

## What the skill tests

Interpreting a bivariate relationship: direction and **strength** of association, reading
and using a line of best fit (predictions, slope and intercept meaning in context,
residuals), and the discipline of staying associational for observational data and inside
the observed x-range. The conceptual core: slope is a rate, the intercept is a starting
value, strength is scatter — not steepness.

## Worked example (hard — slope vs. tightness)

**Stimulus.** A health survey recorded the minutes exercised per week and the resting
heart rate for 9 adults. Scatterplot A shows a steep downward trend through a wide,
loose cloud. Scatterplot B shows a gentle downward trend with points hugging the line
tightly.

**Stem.** Which statement is supported by the data?

- A) The relationship in Scatterplot A is stronger because its trend line is steeper.
- B) The relationship in Scatterplot B is stronger because its points cluster closer to
  its trend line.
- C) Exercising more minutes per week causes a lower resting heart rate.
- D) Neither scatterplot shows any relationship between exercise and heart rate.

**Key:** B. Correlation strength is how tightly points sit around the trend line
(small residuals), independent of the line's slope.

**Rationale (each distractor names its misconception):**

- **A** — `SAT_MATH:two-variable-data-correlation-strength-from-slope`: judges strength by
  steepness; the steep-loose panel was built precisely so slope and scatter disagree.
- **C** — `SAT_MATH:two-variable-data-treating-correlation-as-causation`: converts the
  survey's association into a causal claim; no treatment was assigned, so causal verbs
  outrun the design.
- **D** — direction-negation: both panels clearly show a (negative) association; the
  claim overcorrects by denying any relationship.

## Generation notes

- **Build order:** fix the fitted line (m one-decimal in [−4, 4], b in [0, 20]), then emit
  5–12 points whose residual offsets set the cloud's tightness **independently** of the
  slope — the `sat-math:scatterplot` archetype exposes trend slope and residual spread as
  separate parameters, and slope-vs-tightness items work by making them disagree.
- Statement distractors are ONE mutation each of the true claim: causal verb swap,
  slope/intercept role swap, strength-as-steepness, reliability extended beyond the data
  range — every wrong choice stays diagnosable.
- Caption the source as a survey/records whenever the causal distractor is live;
  predictions are asked only inside the plotted x-range unless extrapolation is the target.
- Keep predictions exact (integer or terminating decimal ≤ 4 grid characters) using the
  same m/b as the drawn line.

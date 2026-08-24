/**
 * Shared figure style: Bluebook/SAT aesthetic.
 *
 * Minimalist black ink on white, light gray coordinate grid, sans-serif for
 * axis/tick labels, italic serif for math-convention labels (variables like
 * x, y, l). Every renderer draws exclusively from these constants so the
 * whole question bank shares one coherent look.
 */

export const COLORS = {
  /** Primary ink: axes, curves, dots, labels. */
  ink: '#1a1a1a',
  /** Light grid lines for coordinate planes. */
  grid: '#d9d9d9',
  /**
   * Accent for secondary features (e.g. line of best fit). The palette is
   * deliberately monochrome — differentiation comes from stroke pattern
   * (dashed) and weight, not hue.
   */
  accent: '#1a1a1a',
  /** Interiors of "open" markers (dots on scatterplots, etc.). */
  fill: '#ffffff',
} as const;

export const FONT = {
  /** Axis and tick labels. */
  family: 'Helvetica, Arial, sans-serif',
  /** Math-convention labels: variables, function names, line tags. */
  familyMath: "Georgia, 'Times New Roman', serif",
  /** Axis + tick label size (px). */
  size: 13,
  /** Point/coordinate label size (px). */
  sizeSmall: 11,
} as const;

export const STROKE = {
  /** Axis lines. */
  axis: 1.25,
  /** Primary drawn features: lines, curves, best-fit lines. */
  line: 1.75,
  /** Grid lines and thin details. */
  thin: 1,
} as const;

/**
 * Renderer: sat-math:bar-chart (BarChart).
 *
 * Vertical bars for 2–6 categories: y-axis from 0 to a clean tick multiple
 * at/above yAxisMax, equal-width bars with gaps (~40% of the band), optional
 * value labels above bars, category labels below (never truncated — wrapped
 * to two lines by deterministic word-split when wider than the band).
 *
 * Params notes (schema: database/diagrams/sat-math:bar-chart.json):
 * - yAxisMax must be >= the largest category value (renderer validates);
 *   the axis top is snapped UP to the next multiple of the tick step.
 * - yTickStep null lets the renderer pick a clean step (1/2/5 × 10^n via
 *   niceTicks); a provided step is honored verbatim.
 * - Duplicate category labels are a parse-time error (per archetype notes).
 * - Values are strictly positive per schema, so no zero-height bar exists;
 *   bar heights are exactly value/yTop proportional, axis starts at 0.
 * - xAxisLabel null (or '') draws no x-axis title.
 */

import { assertValidParams } from './lib/diagram.js';
import { niceTicks, linearScale } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface Category {
  label: string;
  value: number;
}

interface BarChartParams {
  categories: Category[];
  yAxisMax: number;
  yTickStep?: number | null;
  yAxisLabel: string;
  xAxisLabel?: string | null;
  showValues: boolean;
}

const CANVAS = { width: 360, height: 320 } as const;
const MARGINS = { top: 28, right: 20, bottom: 56, left: 52 } as const;
const GAP_FRACTION = 0.4; // gap as a fraction of the band
const TICK = 4; // tick-mark half-length (px)

/**
 * Deterministic 2-line word wrap for category labels wider than `bandW`.
 * Greedy fill of line 1, remainder on line 2; single over-long words and
 * still-overfull second lines are left as-is (never truncated).
 */
function wrapLabel(label: string, bandW: number): [string] | [string, string] {
  if (approxTextWidth(label, FONT.size) <= bandW) return [label];
  const words = label.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 1) return [label];
  let line1 = words[0]!;
  let i = 1;
  while (i < words.length && approxTextWidth(`${line1} ${words[i]!}`, FONT.size) <= bandW) {
    line1 = `${line1} ${words[i]!}`;
    i++;
  }
  return [line1, words.slice(i).join(' ')];
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:bar-chart',
  rendererRef: 'BarChart',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:bar-chart', params);
    const p = params as unknown as BarChartParams;

    const cats = p.categories;
    const maxValue = Math.max(...cats.map((c) => c.value));

    // Cross-field guarantees from the schema descriptions/notes.
    if (p.yAxisMax < maxValue) {
      throw new Error(
        `/yAxisMax: ${fmt(p.yAxisMax)} is below the largest category value ${fmt(maxValue)}`,
      );
    }
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        if (cats[i]!.label === cats[j]!.label) {
          throw new Error(
            `/categories/${j}: duplicate category label '${cats[j]!.label}' (also at /categories/${i})`,
          );
        }
      }
    }

    // Tick step: provided verbatim, else clean 1/2/5×10^n from niceTicks.
    let step: number;
    if (p.yTickStep !== null && p.yTickStep !== undefined) {
      step = p.yTickStep;
    } else {
      const auto = niceTicks(0, p.yAxisMax, 6);
      step = auto.length >= 2 ? auto[1]! - auto[0]! : p.yAxisMax;
    }
    // Axis top snapped UP to a clean multiple of the step covering yAxisMax.
    const yTop = Math.max(Math.ceil(p.yAxisMax / step - 1e-9) * step, step);
    const yTicks: number[] = [];
    for (let v = 0; v <= yTop + step * 1e-9; v += step) {
      yTicks.push(Math.round(v * 1e10) / 1e10);
    }

    const left = MARGINS.left;
    const right = CANVAS.width - MARGINS.right;
    const top = MARGINS.top;
    const bottom = CANVAS.height - MARGINS.bottom;
    const plotW = right - left;
    const plotH = bottom - top;

    const yScale = linearScale([0, yTop], [bottom, top]);

    const n = cats.length;
    const band = plotW / n;
    const barW = band * (1 - GAP_FRACTION);

    const desc =
      `Bar chart of ${n} categories, max ${fmt(yTop)}` +
      (p.showValues ? ', values labeled' : '') +
      `. Y-axis: ${p.yAxisLabel}.`;

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: 'Categorical Bar Chart',
      desc,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    // Light horizontal gridlines at nonzero ticks (under the bars).
    bld.group({ stroke: COLORS.grid, 'stroke-width': STROKE.thin });
    for (const t of yTicks) {
      if (t === 0) continue;
      bld.line(left, yScale(t), right, yScale(t), {});
    }
    bld.end();

    // Bars (solid ink — the house palette is monochrome).
    for (let i = 0; i < n; i++) {
      const x0 = left + i * band + (band - barW) / 2;
      const yTopPx = yScale(cats[i]!.value);
      bld.rect(x0, yTopPx, barW, bottom - yTopPx, { fill: COLORS.ink });
    }

    // Axis lines (x at 0, y at left), plain SAT data-figure style.
    bld.line(left, bottom, right, bottom, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
    bld.line(left, bottom, left, top, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });

    // Y ticks + labels.
    for (const t of yTicks) {
      const py = yScale(t);
      bld.line(left - TICK, py, left, py, { stroke: COLORS.ink, 'stroke-width': STROKE.thin });
      bld.text(left - TICK - 4, py + FONT.size * 0.35, fmt(t), { anchor: 'end' });
    }
    // Y-axis title: rotated beside the axis (data-figure convention, sans).
    {
      const lx = left - TICK - 8 - approxTextWidth(fmt(yTop), FONT.size) - FONT.size;
      const ly = (top + bottom) / 2;
      bld.text(lx, ly, p.yAxisLabel, {
        anchor: 'middle',
        rotate: { angle: -90, cx: lx, cy: ly },
      });
    }

    // Value labels above bars.
    if (p.showValues) {
      for (let i = 0; i < n; i++) {
        const cx = left + i * band + band / 2;
        bld.text(cx, yScale(cats[i]!.value) - 5, fmt(cats[i]!.value), {
          anchor: 'middle',
          size: FONT.sizeSmall,
        });
      }
    }

    // Category labels below the x-axis, wrapped to at most two lines.
    let secondLineUsed = false;
    for (let i = 0; i < n; i++) {
      const cx = left + i * band + band / 2;
      const lines = wrapLabel(cats[i]!.label, band - 4);
      for (let li = 0; li < lines.length; li++) {
        if (li === 1) secondLineUsed = true;
        bld.text(cx, bottom + 6 + (li + 1) * (FONT.size + 2), lines[li]!, { anchor: 'middle' });
      }
    }

    // X-axis title centered below the category labels (sans-serif data label).
    const xLabel = p.xAxisLabel ?? null;
    if (xLabel !== null && xLabel !== '') {
      bld.text(
        (left + right) / 2,
        bottom + 6 + (secondLineUsed ? 3 : 2) * (FONT.size + 2) + 6,
        xLabel,
        { anchor: 'middle' },
      );
    }

    bld.end();
    return bld.toString();
  },
};

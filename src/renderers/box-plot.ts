/**
 * Renderer: sat-math:box-plot (BoxPlot).
 *
 * Box-and-whisker plot above a number line: box from Q1 to Q3, solid median
 * line inside, whiskers to min and max with caps at the endpoints.
 *
 * Params notes (schema: database/diagrams/sat-math:box-plot.json):
 * - The ordering invariant min <= q1 <= median <= q3 <= max is enforced at
 *   parse time (renderer validates), as are axisMin <= min and axisMax >=
 *   max, so a geometrically impossible plot cannot be drawn.
 * - tickStep null picks a clean step (1/2/5 × 10^n via niceTicks); a
 *   provided step (1|2|5|10) is honored verbatim.
 * - showValues declares default false but ajv does not apply defaults, so
 *   the renderer applies it itself.
 * - Axis extent always covers the whiskers with at least half a tick of
 *   padding (archetype notes): if the authored axisMin/axisMax leave less,
 *   the DRAWN domain is extended just enough — labeled ticks still honor
 *   axisMin/axisMax, so no params combination can fail on padding.
 * - showValues labels the five values numerically above the plot; labels
 *   that would collide (including coincident values like min == q1) are
 *   offset deterministically onto a second vertical level.
 */

import { assertValidParams } from './lib/diagram.js';
import { niceTicks, linearScale } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface FiveNumberSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

interface BoxPlotParams {
  fiveNumberSummary: FiveNumberSummary;
  axisMin: number;
  axisMax: number;
  axisLabel: string;
  tickStep?: number | null;
  showValues?: boolean;
}

const CANVAS = { width: 360, height: 190 } as const;
const MARGINS = { top: 52, right: 24, bottom: 50, left: 24 } as const;
const BOX_H = 34;
const BOX_LIFT = 46; // box bottom this many px above the number line
const CAP_HALF = 8; // whisker cap half-height
const TICK = 4;

export const renderer: Renderer = {
  archetypeId: 'sat-math:box-plot',
  rendererRef: 'BoxPlot',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:box-plot', params);
    const p = params as unknown as BoxPlotParams;

    const showValues = p.showValues ?? false;
    const s = p.fiveNumberSummary;

    // Cross-field guarantees (per the schema descriptions).
    const ordered: [keyof FiveNumberSummary, number][] = [
      ['min', s.min],
      ['q1', s.q1],
      ['median', s.median],
      ['q3', s.q3],
      ['max', s.max],
    ];
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i]![1] < ordered[i - 1]![1]) {
        throw new Error(
          `/fiveNumberSummary/${ordered[i]![0]}: ${fmt(ordered[i]![1])} is less than ` +
            `${ordered[i - 1]![0]} (${fmt(ordered[i - 1]![1])}) — must satisfy ` +
            'min <= q1 <= median <= q3 <= max',
        );
      }
    }
    if (p.axisMin > s.min) {
      throw new Error(
        `/axisMin: ${fmt(p.axisMin)} must be <= fiveNumberSummary.min (${fmt(s.min)})`,
      );
    }
    if (p.axisMax < s.max) {
      throw new Error(
        `/axisMax: ${fmt(p.axisMax)} must be >= fiveNumberSummary.max (${fmt(s.max)})`,
      );
    }

    // Tick step: provided verbatim, else a clean 1/2/5×10^n step.
    let step: number;
    if (p.tickStep !== null && p.tickStep !== undefined) {
      step = p.tickStep;
    } else {
      const auto = niceTicks(p.axisMin, p.axisMax, 9);
      step = auto.length >= 2 ? auto[1]! - auto[0]! : p.axisMax - p.axisMin;
    }

    // Drawn domain: at least half a tick of padding beyond both whiskers;
    // labeled ticks stay within the authored [axisMin, axisMax].
    const domainMin = Math.min(p.axisMin, s.min - step / 2);
    const domainMax = Math.max(p.axisMax, s.max + step / 2);

    const left = MARGINS.left;
    const right = CANVAS.width - MARGINS.right;
    const axisY = CANVAS.height - MARGINS.bottom;

    const xScale = linearScale([domainMin, domainMax], [left, right]);

    const ticks: number[] = [];
    {
      const first = Math.ceil((p.axisMin - 1e-9) / step) * step;
      for (let v = first; v <= p.axisMax + step * 1e-9; v += step) {
        ticks.push(Math.round(v * 1e10) / 1e10);
      }
    }

    const boxBottom = axisY - BOX_LIFT;
    const boxTop = boxBottom - BOX_H;
    const whiskerY = (boxTop + boxBottom) / 2;

    const desc =
      `Box-and-whisker plot: min ${fmt(s.min)}, Q1 ${fmt(s.q1)}, median ${fmt(s.median)}, ` +
      `Q3 ${fmt(s.q3)}, max ${fmt(s.max)}. Axis: ${p.axisLabel}.`;

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: 'Box-and-Whisker Plot',
      desc,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    // Number line (drawn across the padded domain) + ticks + labels.
    bld.line(left, axisY, right, axisY, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
    for (const t of ticks) {
      const px = xScale(t);
      bld.line(px, axisY, px, axisY + TICK, { stroke: COLORS.ink, 'stroke-width': STROKE.thin });
      bld.text(px, axisY + TICK + 4 + FONT.sizeSmall * 0.8, fmt(t), {
        anchor: 'middle',
        size: FONT.sizeSmall,
      });
    }
    bld.text((left + right) / 2, axisY + TICK + 4 + FONT.sizeSmall + 4 + FONT.size, p.axisLabel, {
      anchor: 'middle',
    });

    // Whiskers: from the box edges out to min/max, caps at both endpoints.
    const xMin = xScale(s.min);
    const xQ1 = xScale(s.q1);
    const xMed = xScale(s.median);
    const xQ3 = xScale(s.q3);
    const xMax = xScale(s.max);
    bld.line(xMin, whiskerY, xQ1, whiskerY, { stroke: COLORS.ink, 'stroke-width': STROKE.line });
    bld.line(xQ3, whiskerY, xMax, whiskerY, { stroke: COLORS.ink, 'stroke-width': STROKE.line });
    bld.line(xMin, whiskerY - CAP_HALF, xMin, whiskerY + CAP_HALF, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.line,
    });
    bld.line(xMax, whiskerY - CAP_HALF, xMax, whiskerY + CAP_HALF, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.line,
    });

    // Box q1..q3 (white interior, ink outline) + solid median line inside.
    bld.rect(xQ1, boxTop, xQ3 - xQ1, BOX_H, {
      fill: COLORS.fill,
      stroke: COLORS.ink,
      'stroke-width': STROKE.line,
    });
    bld.line(xMed, boxTop, xMed, boxBottom, { stroke: COLORS.ink, 'stroke-width': STROKE.line });

    // Optional numeric labels for the five values, de-collided across two
    // vertical levels above the plot (level 1 above level 0).
    if (showValues) {
      const levelY = (level: number): number => boxTop - 10 - level * (FONT.sizeSmall + 5);
      // Deterministic order: left to right; ties broken by the canonical
      // min/q1/median/q3/max order so coincident values stack deterministically.
      const labels = ordered
        .map(([key, v], idx) => ({ key, v, x: xScale(v), idx }))
        .sort((a, b) => a.x - b.x || a.idx - b.idx);
      const placed: { x: number; w: number; level: number }[] = [];
      for (const lb of labels) {
        const text = fmt(lb.v);
        const w = approxTextWidth(text, FONT.sizeSmall);
        let level = 0;
        const collides = (lv: number): boolean =>
          placed.some(
            (pl) => pl.level === lv && Math.abs(pl.x - lb.x) < (pl.w + w) / 2 + 5,
          );
        if (collides(0)) level = 1;
        if (collides(1)) level = 2; // extreme crowding: third level, still deterministic
        placed.push({ x: lb.x, w, level });
        bld.text(lb.x, levelY(level), text, { anchor: 'middle', size: FONT.sizeSmall });
      }
    }

    bld.end();
    return bld.toString();
  },
};

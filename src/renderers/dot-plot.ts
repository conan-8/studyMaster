/**
 * Renderer: sat-math:dot-plot (DotPlot).
 *
 * Dots stacked vertically above a number line, one dot per data value.
 * Entries are sorted by value before drawing; the full dataset is entries
 * expanded by count, and the mean/median markers (if requested) are computed
 * from that expanded dataset — never authored.
 *
 * Params notes (schema: database/diagrams/sat-math:dot-plot.json):
 * - tickStep null lets the renderer pick the COARSEST of [5, 2, 1, 0.5]
 *   that still lands on every entry value (values are multiples of 0.5, so
 *   0.5 always works as the fallback).
 * - markMean/markMedian declare default false but ajv does not apply
 *   defaults, so the renderer applies them itself.
 * - Duplicate entry values are a parse-time error (per archetype notes).
 * - Axis extent is padded one tick beyond the min/max entry values so no
 *   dot sits on an axis end (per archetype notes).
 * - markMean: dashed vertical line + triangle marker at the mean, labeled
 *   'mean' above; markMedian: dashed vertical line + tick marker at the
 *   median, labeled 'median' above. If both labels would collide, mean is
 *   anchored to the left and median to the right (deterministic).
 * - Tick labels are thinned to every m-th tick (m the smallest power of two
 *   that avoids collision) when the full set would overlap; first and last
 *   ticks are always labeled.
 */

import { assertValidParams } from './lib/diagram.js';
import { linearScale } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface Entry {
  value: number;
  count: number;
}

interface DotPlotParams {
  entries: Entry[];
  axisLabel: string;
  tickStep?: number | null;
  markMean?: boolean;
  markMedian?: boolean;
}

const CANVAS = { width: 360, height: 210 } as const;
const MARGINS = { top: 34, right: 24, bottom: 52, left: 24 } as const;
const DOT_R = 4.5;
const DOT_PITCH = 2 * DOT_R + 2; // equal vertical spacing between stacked dots
const TICK = 4;
const STEPS: readonly number[] = [5, 2, 1, 0.5];

/** True when v is an integer multiple of step (eps-tolerant). */
function onStep(v: number, step: number): boolean {
  const q = v / step;
  return Math.abs(q - Math.round(q)) < 1e-9;
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:dot-plot',
  rendererRef: 'DotPlot',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:dot-plot', params);
    const p = params as unknown as DotPlotParams;

    const markMean = p.markMean ?? false;
    const markMedian = p.markMedian ?? false;

    // Sort entries by value; duplicates are a parse-time error.
    const entries = [...p.entries].sort((a, b) => a.value - b.value);
    for (let i = 1; i < entries.length; i++) {
      if (entries[i]!.value === entries[i - 1]!.value) {
        throw new Error(
          `/entries: duplicate value ${fmt(entries[i]!.value)} — each entry value must be distinct`,
        );
      }
    }

    // Tick step: provided verbatim, else coarsest of [5,2,1,0.5] hitting all.
    let step: number;
    if (p.tickStep !== null && p.tickStep !== undefined) {
      step = p.tickStep;
    } else {
      step = STEPS.find((s) => entries.every((e) => onStep(e.value, s))) ?? 0.5;
    }

    // Axis extent: one tick of padding beyond the min/max entry values.
    const minV = entries[0]!.value;
    const maxV = entries[entries.length - 1]!.value;
    const axisMin = minV - step;
    const axisMax = maxV + step;

    // Expanded dataset for the computed statistics.
    let n = 0;
    let sum = 0;
    const expanded: number[] = [];
    for (const e of entries) {
      n += e.count;
      sum += e.value * e.count;
      for (let i = 0; i < e.count; i++) expanded.push(e.value);
    }
    const mean = sum / n;
    const median =
      n % 2 === 1
        ? expanded[(n - 1) / 2]!
        : (expanded[n / 2 - 1]! + expanded[n / 2]!) / 2;

    const left = MARGINS.left;
    const right = CANVAS.width - MARGINS.right;
    const top = MARGINS.top;
    const axisY = CANVAS.height - MARGINS.bottom;

    const xScale = linearScale([axisMin, axisMax], [left, right]);

    // All tick values across the extent.
    const ticks: number[] = [];
    for (let v = axisMin; v <= axisMax + step * 1e-9; v += step) {
      ticks.push(Math.round(v * 1e10) / 1e10);
    }

    // Label thinning: smallest power-of-two m so adjacent labels fit.
    let maxTickLabelW = 0;
    for (const t of ticks) maxTickLabelW = Math.max(maxTickLabelW, approxTextWidth(fmt(t), FONT.sizeSmall));
    const tickPx = (right - left) / (axisMax - axisMin) * step;
    let m = 1;
    while (m * tickPx < maxTickLabelW + 6 && m < ticks.length) m *= 2;

    const maxCount = Math.max(...entries.map((e) => e.count));
    const desc =
      `Dot plot of ${n} data points from ${fmt(minV)} to ${fmt(maxV)}` +
      (markMean ? `, mean ${fmt(mean)} marked` : '') +
      (markMedian ? `, median ${fmt(median)} marked` : '') +
      `. Axis: ${p.axisLabel}.`;

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: 'Dot Plot (Line Plot)',
      desc,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    // Dots: stacked above each value, equal spacing, open circles.
    for (const e of entries) {
      const cx = xScale(e.value);
      for (let i = 0; i < e.count; i++) {
        const cy = axisY - DOT_R - 3 - i * DOT_PITCH;
        bld.circle(cx, cy, DOT_R, {
          fill: COLORS.fill,
          stroke: COLORS.ink,
          'stroke-width': STROKE.axis,
        });
      }
    }

    // Number line.
    bld.line(left, axisY, right, axisY, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });

    // Ticks (all) + labels (every m-th, first/last always).
    for (let i = 0; i < ticks.length; i++) {
      const px = xScale(ticks[i]!);
      bld.line(px, axisY, px, axisY + TICK, { stroke: COLORS.ink, 'stroke-width': STROKE.thin });
      if (i % m === 0 || i === 0 || i === ticks.length - 1) {
        bld.text(px, axisY + TICK + 4 + FONT.sizeSmall * 0.8, fmt(ticks[i]!), {
          anchor: 'middle',
          size: FONT.sizeSmall,
        });
      }
    }

    // Axis title centered below the tick labels.
    bld.text((left + right) / 2, axisY + TICK + 4 + FONT.sizeSmall + 4 + FONT.size, p.axisLabel, {
      anchor: 'middle',
    });

    // Mean / median markers: dashed vertical line up to the marker-label
    // level, a small marker on the number line, and a label above the line.
    const markerTop = Math.max(top, axisY - (maxCount * DOT_PITCH + 14));
    interface Marker {
      x: number;
      name: string;
      kind: 'mean' | 'median';
    }
    const markers: Marker[] = [];
    if (markMean) markers.push({ x: xScale(mean), name: 'mean', kind: 'mean' });
    if (markMedian) markers.push({ x: xScale(median), name: 'median', kind: 'median' });
    for (const mk of markers) {
      bld.line(mk.x, axisY, mk.x, markerTop, {
        stroke: COLORS.ink,
        'stroke-width': STROKE.thin,
        'stroke-dasharray': '5 4',
      });
      if (mk.kind === 'mean') {
        // Triangle marker at the mean (per schema description).
        bld.polygon(
          [
            [mk.x, axisY - 2],
            [mk.x - 4.5, axisY - 10],
            [mk.x + 4.5, axisY - 10],
          ],
          { fill: COLORS.ink },
        );
      } else {
        // Vertical tick at the median (per schema description).
        bld.line(mk.x, axisY - 8, mk.x, axisY + TICK, {
          stroke: COLORS.ink,
          'stroke-width': STROKE.line,
        });
      }
    }
    // Marker labels, with a deterministic de-collision rule.
    if (markers.length === 1) {
      bld.text(markers[0]!.x, markerTop - 6, markers[0]!.name, {
        anchor: 'middle',
        size: FONT.sizeSmall,
      });
    } else if (markers.length === 2) {
      const [m0, m1] = markers;
      const w0 = approxTextWidth(m0!.name, FONT.sizeSmall);
      const w1 = approxTextWidth(m1!.name, FONT.sizeSmall);
      if (Math.abs(m0!.x - m1!.x) < (w0 + w1) / 2 + 6) {
        // Too close: mean label left of its line, median right of its line.
        bld.text(m0!.x - 5, markerTop - 6, m0!.name, { anchor: 'end', size: FONT.sizeSmall });
        bld.text(m1!.x + 5, markerTop - 6, m1!.name, { anchor: 'start', size: FONT.sizeSmall });
      } else {
        bld.text(m0!.x, markerTop - 6, m0!.name, { anchor: 'middle', size: FONT.sizeSmall });
        bld.text(m1!.x, markerTop - 6, m1!.name, { anchor: 'middle', size: FONT.sizeSmall });
      }
    }

    bld.end();
    return bld.toString();
  },
};

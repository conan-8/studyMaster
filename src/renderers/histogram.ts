/**
 * Renderer: sat-math:histogram (Histogram).
 *
 * Equal-width CONTIGUOUS bins (no gaps — that is what makes it a histogram)
 * of continuous data with frequency on the y-axis. Bin boundary labels are
 * computed as binStart + i*binWidth, never authored.
 *
 * Params notes (schema: database/diagrams/sat-math:histogram.json):
 * - yAxisLabel (default 'Frequency') and binEdgesAreIntegers (default true)
 *   and showFrequencyLabels (default false) declare defaults ajv does not
 *   apply, so the renderer applies them itself.
 * - binEdgesAreIntegers=true makes the renderer validate that binStart and
 *   binWidth are integers, so boundary labels stay SAT-clean.
 * - An all-zero frequency list is a parse-time error (renderer validates).
 * - The schema defines NO highlight-bin field, so none is drawn (brief asked
 *   to honor it only if the schema defines one).
 * - Edge labels: every k-th boundary is labeled, where k is the smallest
 *   power-of-two multiple such that labels fit (approxTextWidth); the first
 *   and last edges are always labeled.
 * - Y-axis top is snapped to a clean tick multiple strictly above the
 *   maximum frequency (per the archetype notes).
 */

import { assertValidParams } from './lib/diagram.js';
import { niceTicks, linearScale } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface HistogramParams {
  binStart: number;
  binWidth: number;
  frequencies: number[];
  xAxisLabel: string;
  yAxisLabel?: string;
  binEdgesAreIntegers?: boolean;
  showFrequencyLabels?: boolean;
}

const CANVAS = { width: 360, height: 320 } as const;
const MARGINS = { top: 28, right: 20, bottom: 50, left: 48 } as const;
const TICK = 4;

export const renderer: Renderer = {
  archetypeId: 'sat-math:histogram',
  rendererRef: 'Histogram',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:histogram', params);
    const p = params as unknown as HistogramParams;

    const yAxisLabel = p.yAxisLabel ?? 'Frequency';
    const edgesInt = p.binEdgesAreIntegers ?? true;
    const showFreq = p.showFrequencyLabels ?? false;
    const freqs = p.frequencies;
    const nBins = freqs.length;

    // Cross-field guarantees from the schema descriptions/notes.
    if (edgesInt) {
      if (!Number.isInteger(p.binStart)) {
        throw new Error(`/binStart: ${fmt(p.binStart)} is not an integer (binEdgesAreIntegers is true)`);
      }
      if (!Number.isInteger(p.binWidth)) {
        throw new Error(`/binWidth: ${fmt(p.binWidth)} is not an integer (binEdgesAreIntegers is true)`);
      }
    }
    const maxFreq = Math.max(...freqs);
    if (maxFreq === 0) {
      throw new Error('/frequencies: at least one bin must have a positive frequency');
    }

    // Y-axis: clean 1/2/5×10^n step, top snapped strictly above maxFreq.
    const auto = niceTicks(0, maxFreq, 6);
    const step = auto.length >= 2 ? auto[1]! - auto[0]! : maxFreq;
    let yTop = Math.ceil(maxFreq / step - 1e-9) * step;
    if (yTop <= maxFreq) yTop += step;
    const yTicks: number[] = [];
    for (let v = 0; v <= yTop + step * 1e-9; v += step) {
      yTicks.push(Math.round(v * 1e10) / 1e10);
    }

    const left = MARGINS.left;
    const right = CANVAS.width - MARGINS.right;
    const top = MARGINS.top;
    const bottom = CANVAS.height - MARGINS.bottom;
    const plotW = right - left;

    const yScale = linearScale([0, yTop], [bottom, top]);
    const binPx = plotW / nBins;
    const edgeX = (i: number): number => left + i * binPx;
    const edgeVal = (i: number): number =>
      Math.round((p.binStart + i * p.binWidth) * 1e10) / 1e10;

    // Label every k-th edge: smallest power-of-two k so labels don't collide.
    let maxLabelW = 0;
    for (let i = 0; i <= nBins; i++) {
      maxLabelW = Math.max(maxLabelW, approxTextWidth(fmt(edgeVal(i)), FONT.sizeSmall));
    }
    let k = 1;
    while (k * binPx < maxLabelW + 8 && k < nBins) k *= 2;

    const desc =
      `Histogram of ${nBins} bins from ${fmt(p.binStart)} with width ${fmt(p.binWidth)}` +
      `, max frequency ${maxFreq}. X-axis: ${p.xAxisLabel}.`;

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: 'Histogram',
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

    // Contiguous bars: adjacent rects share edges; light fill + ink outline
    // keeps neighboring bins distinguishable in the monochrome palette.
    for (let i = 0; i < nBins; i++) {
      if (freqs[i]! === 0) continue;
      const yTopPx = yScale(freqs[i]!);
      bld.rect(edgeX(i), yTopPx, binPx, bottom - yTopPx, {
        fill: COLORS.grid,
        stroke: COLORS.ink,
        'stroke-width': STROKE.thin,
      });
    }

    // Axis lines.
    bld.line(left, bottom, right, bottom, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
    bld.line(left, bottom, left, top, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });

    // Y ticks + labels.
    for (const t of yTicks) {
      const py = yScale(t);
      bld.line(left - TICK, py, left, py, { stroke: COLORS.ink, 'stroke-width': STROKE.thin });
      bld.text(left - TICK - 4, py + FONT.size * 0.35, fmt(t), { anchor: 'end' });
    }
    // Y-axis title, rotated beside the axis.
    {
      const lx = left - TICK - 8 - approxTextWidth(fmt(yTop), FONT.size) - FONT.size;
      const ly = (top + bottom) / 2;
      bld.text(lx, ly, yAxisLabel, {
        anchor: 'middle',
        rotate: { angle: -90, cx: lx, cy: ly },
      });
    }

    // Boundary labels under bin EDGES: every k-th, plus always first & last.
    // If the last edge is too close to the last multiple-of-k edge, drop the
    // multiple (deterministic no-collision rule).
    const labeled = new Set<number>();
    for (let i = 0; i <= nBins; i += k) labeled.add(i);
    labeled.add(0);
    labeled.add(nBins);
    if (nBins % k !== 0) {
      const prev = Math.floor(nBins / k) * k;
      if ((nBins - prev) * binPx < maxLabelW + 8) labeled.delete(prev);
    }
    for (const i of [...labeled].sort((a, b) => a - b)) {
      bld.text(edgeX(i), bottom + 6 + FONT.sizeSmall, fmt(edgeVal(i)), {
        anchor: 'middle',
        size: FONT.sizeSmall,
      });
    }

    // Optional frequency labels above bars.
    if (showFreq) {
      for (let i = 0; i < nBins; i++) {
        if (freqs[i]! === 0) continue;
        bld.text(edgeX(i) + binPx / 2, yScale(freqs[i]!) - 5, String(freqs[i]!), {
          anchor: 'middle',
          size: FONT.sizeSmall,
        });
      }
    }

    // X-axis title centered below the boundary labels.
    bld.text((left + right) / 2, bottom + 6 + FONT.sizeSmall + 4 + FONT.size, p.xAxisLabel, {
      anchor: 'middle',
    });

    bld.end();
    return bld.toString();
  },
};

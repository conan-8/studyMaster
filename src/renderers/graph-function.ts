/**
 * Renderer: sat-math:graph-function (GraphFunction).
 *
 * One nonlinear curve — quadratic y = ax^2 + bx + c, exponential y = a*b^x, or
 * absolute value y = a|x - h| + k — sampled at a FIXED count of 121 evenly
 * spaced x values (deterministic; never adaptive), with the exact vertex /
 * V-point inserted when it lies inside the range so kinks are crisp. The
 * y-extent is auto-fitted to the sampled values (always including 0) so the
 * interesting region is visible. Marked points are validated to lie on the
 * curve and labeled with their generated coordinates.
 *
 * Schema bounds permit degenerate coefficients the description forbids
 * ("a nonzero", "b never 1"); those cross-field rules are enforced here:
 * a = 0 or b = 1 throws before drawing.
 */

import { assertValidParams } from './lib/diagram.js';
import type { ObstacleSegment } from './lib/plot.js';
import {
  CANVAS,
  GRAPH_MARGINS,
  axisObstacles,
  coordinatePlane,
  markPoint,
  placePointLabel,
  plotArea,
} from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

const SAMPLE_INTERVALS = 120; // 121 samples: enough for smooth curves, fixed.

type Fn = (x: number) => number;

interface MarkedPoint {
  x: number;
  y: number;
}

interface GraphFunctionParams {
  functionType: 'quadratic' | 'exponential' | 'absolute_value';
  quadratic?: { a: number; b: number; c: number };
  exponential?: { a: number; b: number };
  absoluteValue?: { a: number; h: number; k: number };
  xRange: { min: number; max: number };
  markedPoints: MarkedPoint[];
}

function signed(n: number): string {
  return n >= 0 ? ` + ${fmt(n)}` : ` - ${fmt(-n)}`;
}

function equationText(p: GraphFunctionParams): string {
  if (p.functionType === 'quadratic') {
    const { a, b, c } = p.quadratic!;
    let s = `y = ${fmt(a)}x²`;
    if (b !== 0) s += b === 1 ? ' + x' : b === -1 ? ' - x' : signed(b);
    if (c !== 0) s += signed(c);
    return s;
  }
  if (p.functionType === 'exponential') {
    const { a, b } = p.exponential!;
    return `y = ${fmt(a)}(${fmt(b)})^x`;
  }
  const { a, h, k } = p.absoluteValue!;
  const inner = h === 0 ? 'x' : h > 0 ? `x - ${fmt(h)}` : `x + ${fmt(-h)}`;
  let s = `y = ${fmt(a)}|${inner}|`;
  if (k !== 0) s += signed(k);
  return s;
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:graph-function',
  rendererRef: 'GraphFunction',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:graph-function', params);
    const p = params as unknown as GraphFunctionParams;

    // Exactly one coefficient block is present (schema allOf guarantees the
    // matching one); the description-level degeneracy rules are enforced here.
    let f: Fn;
    let specialX: number | null = null; // exact kink/vertex x to insert
    if (p.functionType === 'quadratic') {
      const q = p.quadratic;
      if (q === undefined) throw new Error('quadratic: required when functionType is quadratic');
      if (q.a === 0) throw new Error('quadratic.a: must be nonzero');
      f = (x: number): number => q.a * x * x + q.b * x + q.c;
      specialX = -q.b / (2 * q.a);
    } else if (p.functionType === 'exponential') {
      const e = p.exponential;
      if (e === undefined) throw new Error('exponential: required when functionType is exponential');
      if (e.b === 1) throw new Error('exponential.b: must not equal 1 (that is a flat line)');
      f = (x: number): number => e.a * Math.pow(e.b, x);
    } else {
      const av = p.absoluteValue;
      if (av === undefined) {
        throw new Error('absoluteValue: required when functionType is absolute_value');
      }
      if (av.a === 0) throw new Error('absoluteValue.a: must be nonzero');
      f = (x: number): number => av.a * Math.abs(x - av.h) + av.k;
      specialX = av.h;
    }

    const minX = p.xRange.min;
    const maxX = p.xRange.max;

    // Fixed even sampling; insert the exact vertex/V-point inside the range.
    const xs: number[] = [];
    for (let i = 0; i <= SAMPLE_INTERVALS; i++) {
      xs.push(minX + ((maxX - minX) * i) / SAMPLE_INTERVALS);
    }
    if (specialX !== null && specialX > minX && specialX < maxX) {
      xs.push(specialX);
      xs.sort((u, v) => u - v);
      for (let i = xs.length - 1; i > 0; i--) {
        if (Math.abs(xs[i]! - xs[i - 1]!) < 1e-9) xs.splice(i, 1);
      }
    }

    // y-extent auto-fitted to the samples, always including 0, minimum span 4.
    let yLo = 0;
    let yHi = 0;
    for (const x of xs) {
      const y = f(x);
      if (!Number.isFinite(y)) throw new Error(`xRange: function is not finite at x = ${fmt(x)}`);
      yLo = Math.min(yLo, y);
      yHi = Math.max(yHi, y);
    }
    yLo = Math.min(0, Math.floor(yLo));
    yHi = Math.max(0, Math.ceil(yHi));
    while (yHi - yLo < 4) {
      yHi += 1;
      yLo -= 1;
    }

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: 'Nonlinear function graph',
      desc: `Graph of ${equationText(p)}, x from ${minX} to ${maxX}.`,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    const area = plotArea(CANVAS.width, CANVAS.height, GRAPH_MARGINS);
    const plane = coordinatePlane(bld, {
      xDomain: [minX, maxX],
      yDomain: [yLo, yHi],
      area,
      xLabel: 'x',
      yLabel: 'y',
    });
    const { xScale, yScale } = plane;

    bld.polyline(
      xs.map((x) => [xScale(x), yScale(f(x))] as [number, number]),
      {
        fill: 'none',
        stroke: COLORS.ink,
        'stroke-width': STROKE.line,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      },
    );

    // Marked points: validated to lie on the curve, dotted and labeled in
    // empty space — never over the curve or the axes.
    const curveObstacles: ObstacleSegment[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      curveObstacles.push({
        x1: xScale(xs[i]!),
        y1: yScale(f(xs[i]!)),
        x2: xScale(xs[i + 1]!),
        y2: yScale(f(xs[i + 1]!)),
      });
    }
    const obstacles = [...curveObstacles, ...axisObstacles(plane, area, [minX, maxX], [yLo, yHi])];
    for (let i = 0; i < p.markedPoints.length; i++) {
      const mp = p.markedPoints[i]!;
      if (Math.abs(mp.y - f(mp.x)) > 0.011) {
        throw new Error(
          `markedPoints/${i}: point (${fmt(mp.x)}, ${fmt(mp.y)}) does not lie on ${equationText(p)}`,
        );
      }
      const px = xScale(mp.x);
      const py = yScale(mp.y);
      markPoint(bld, px, py, { r: 3 });
      const text = `(${fmt(mp.x)}, ${fmt(mp.y)})`;
      const w = approxTextWidth(text, FONT.sizeSmall);
      const pos = placePointLabel({ px, py, width: w, area, obstacles });
      bld.text(pos.x, pos.y, text, {
        anchor: 'middle',
        size: FONT.sizeSmall,
      });
    }

    bld.end();
    return bld.toString();
  },
};

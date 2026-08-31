/**
 * Renderer: sat-math:graph-system-two-lines (GraphSystemTwoLines).
 *
 * Two lines from their (slope, yIntercept) pairs. The intersection is always
 * COMPUTED from the pairs — never authored separately — so the figure and the
 * answer key cannot disagree.
 *
 * `intersectionIsInteger` is a generation-quality flag: it gates validation
 * (intersection must have integer coordinates inside the grid) and, per the
 * schema ("if false the intersection is left unlabeled"), whether the
 * solution coordinate label is drawn. It never changes the geometry: same
 * lines, same dot position either way.
 *
 * Parallel lines (equal slopes) are only valid with markIntersection=false
 * ("no solution"/"infinitely many solutions" items) — otherwise the renderer
 * rejects the params. labelLines defaults to false (schema-declared default,
 * applied here since ajv does not apply defaults).
 */

import { assertValidParams } from './lib/diagram.js';
import {
  CANVAS,
  GRAPH_MARGINS,
  axisObstacles,
  clipSegment,
  coordinatePlane,
  markPoint,
  placePointLabel,
  plotArea,
} from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth, linearEquation } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface LineParams {
  slope: number;
  yIntercept: number;
  label: string;
}

interface GraphSystemParams {
  line1: LineParams;
  line2: LineParams;
  intersectionIsInteger: boolean;
  markIntersection: boolean;
  xRange: { min: number; max: number };
  labelLines?: boolean;
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:graph-system-two-lines',
  rendererRef: 'GraphSystemTwoLines',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:graph-system-two-lines', params);
    const p = params as unknown as GraphSystemParams;

    const { line1, line2 } = p;
    const minX = p.xRange.min;
    const maxX = p.xRange.max;
    const parallel = line1.slope === line2.slope;
    if (parallel && p.markIntersection) {
      throw new Error(
        `line2.slope: equal slopes (${line1.slope}) make the lines parallel/coincident — ` +
          'there is no unique intersection to mark; markIntersection must be false',
      );
    }

    // Intersection from the two pairs only.
    const ix = parallel ? NaN : (line2.yIntercept - line1.yIntercept) / (line1.slope - line2.slope);
    const iy = parallel ? NaN : line1.slope * ix + line1.yIntercept;
    if (p.intersectionIsInteger && !parallel) {
      const isInt = Math.abs(ix - Math.round(ix)) < 1e-9 && Math.abs(iy - Math.round(iy)) < 1e-9;
      if (!isInt || ix < minX || ix > maxX) {
        throw new Error(
          `intersection: (${fmt(ix)}, ${fmt(iy)}) is not an integer point inside ` +
            `xRange [${minX}, ${maxX}] as intersectionIsInteger requires`,
        );
      }
    }

    // Symmetric y-extent covering both lines and (when finite) the intersection.
    let yAbs = 0;
    for (const [m, b] of [
      [line1.slope, line1.yIntercept],
      [line2.slope, line2.yIntercept],
    ] as const) {
      yAbs = Math.max(yAbs, Math.abs(b), Math.abs(m * minX + b), Math.abs(m * maxX + b));
    }
    if (!parallel) yAbs = Math.max(yAbs, Math.abs(iy));
    const yMax = Math.max(Math.ceil(yAbs), 3);

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: 'System of two linear equations — graph',
      desc:
        `Lines ${linearEquation(line1.slope, line1.yIntercept)} and ` +
        `${linearEquation(line2.slope, line2.yIntercept)} in the xy-plane, x from ${minX} to ${maxX}.`,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    const area = plotArea(CANVAS.width, CANVAS.height, GRAPH_MARGINS);
    const plane = coordinatePlane(bld, {
      xDomain: [minX, maxX],
      yDomain: [-yMax, yMax],
      area,
      xLabel: 'x',
      yLabel: 'y',
    });
    const { xScale, yScale } = plane;
    const rect = { x0: area.left, y0: area.top, x1: area.right, y1: area.bottom };

    const drawLine = (m: number, b: number): [number, number, number, number] | null => {
      const xd0 = minX - 2;
      const xd1 = maxX + 2;
      const clipped = clipSegment(
        xScale(xd0),
        yScale(m * xd0 + b),
        xScale(xd1),
        yScale(m * xd1 + b),
        rect,
      );
      if (clipped === null) return null;
      const [ax, ay, bx, by] = clipped;
      bld.line(ax, ay, bx, by, { stroke: COLORS.ink, 'stroke-width': STROKE.line });
      return clipped;
    };

    const seg1 = drawLine(line1.slope, line1.yIntercept);
    const seg2 = drawLine(line2.slope, line2.yIntercept);

    // Intersection: filled dot when markIntersection; coordinate label when
    // intersectionIsInteger (schema: false leaves it unlabeled). The label is
    // placed in empty space — never over the two lines or the axes.
    if (p.markIntersection && !parallel) {
      const px = xScale(ix);
      const py = yScale(iy);
      markPoint(bld, px, py, { r: 3.5 });
      if (p.intersectionIsInteger) {
        const text = `(${fmt(Math.round(ix))}, ${fmt(Math.round(iy))})`;
        const w = approxTextWidth(text, FONT.sizeSmall);
        const lineSeg = (m: number, b: number): { x1: number; y1: number; x2: number; y2: number } => ({
          x1: xScale(minX),
          y1: yScale(m * minX + b),
          x2: xScale(maxX),
          y2: yScale(m * maxX + b),
        });
        const obstacles = [
          lineSeg(line1.slope, line1.yIntercept),
          lineSeg(line2.slope, line2.yIntercept),
          ...axisObstacles(plane, area, [minX, maxX], [-yMax, yMax]),
        ];
        const pos = placePointLabel({ px, py, width: w, area, obstacles });
        bld.text(pos.x, pos.y, text, {
          anchor: 'middle',
          size: FONT.sizeSmall,
        });
      }
    }

    // Line tags at opposite ends of the two lines, offset to the side away
    // from the other line (schema notes: avoid collision).
    if (p.labelLines === true) {
      const tag = (
        ln: LineParams,
        seg: [number, number, number, number] | null,
        other: LineParams,
        end: 'right' | 'left',
      ): void => {
        if (seg === null) return;
        const [x1, y1, x2, y2] = seg;
        const ex = end === 'right' ? Math.max(x1, x2) : Math.min(x1, x2);
        const ey = end === 'right' ? (x2 >= x1 ? y2 : y1) : (x2 >= x1 ? y1 : y2);
        const xd = xScale.invert(ex);
        const otherPy = yScale(other.slope * xd + other.yIntercept);
        // other line above this end -> label below, and vice versa.
        const below = otherPy < ey;
        const w = approxTextWidth(ln.label, FONT.size);
        const lx =
          end === 'right'
            ? Math.min(ex + 7, area.right - w - 4)
            : Math.max(ex - 7, area.left + w + 4);
        const ly = Math.min(Math.max(ey + (below ? 16 : -9), area.top + 12), area.bottom - 6);
        bld.text(lx, ly, ln.label, {
          anchor: end === 'right' ? 'start' : 'end',
          size: FONT.size,
          family: FONT.familyMath,
          italic: true,
        });
      };
      tag(line1, seg1, line2, 'right');
      tag(line2, seg2, line1, 'left');
    }

    bld.end();
    return bld.toString();
  },
};

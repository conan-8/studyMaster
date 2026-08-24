/**
 * Renderer: sat-math:scatterplot (Scatterplot).
 *
 * First-quadrant scatterplot: open-circle data points on a unit grid, sparse
 * numbered ticks, optional axis titles from params (x centered under the
 * plot, y rotated beside the plot — SAT data-figure convention), and an
 * optional dashed line of best fit clipped to the axes. The best-fit line's
 * slope/intercept come verbatim from params, so the stem's predicted values
 * derive from the same m and b.
 *
 * Schema notes enforced here (cross-field, not expressible in the schema):
 * - gridExtent must cover every point with at least one cell of headroom;
 * - coincident points are jittered apart by half a cell (offset capped at
 *   one cell so the guaranteed headroom always contains the jitter).
 */

import { assertValidParams } from './lib/diagram.js';
import { CANVAS, GRAPH_MARGINS, clipSegment, coordinatePlane, markPoint, plotArea } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface Point {
  x: number;
  y: number;
}

interface ScatterplotParams {
  points: Point[];
  gridExtent: { xMax: number; yMax: number };
  lineOfBestFit: { slope: number; yIntercept: number; show: boolean } | null;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const POINT_R = 3.5;

export const renderer: Renderer = {
  archetypeId: 'sat-math:scatterplot',
  rendererRef: 'Scatterplot',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:scatterplot', params);
    const p = params as unknown as ScatterplotParams;

    const { xMax, yMax } = p.gridExtent;

    // Headroom validation: one full cell beyond every point.
    for (let i = 0; i < p.points.length; i++) {
      const pt = p.points[i]!;
      if (pt.x + 1 > xMax || pt.y + 1 > yMax) {
        throw new Error(
          `points/${i}: point (${fmt(pt.x)}, ${fmt(pt.y)}) needs one cell of headroom — ` +
            `gridExtent must be at least (${fmt(Math.max(xMax, pt.x + 1))}, ${fmt(Math.max(yMax, pt.y + 1))})`,
        );
      }
    }

    // Deterministic jitter: kth occurrence of a coincident pair shifts right
    // by k half-cells (k capped at 2 so the shift stays inside the headroom).
    const seen = new Map<string, number>();
    const placed: { x: number; y: number }[] = p.points.map((pt) => {
      const key = `${Math.round(pt.x * 1e9)}:${Math.round(pt.y * 1e9)}`;
      const occ = seen.get(key) ?? 0;
      seen.set(key, occ + 1);
      return { x: pt.x + Math.min(occ, 2) * 0.5, y: pt.y };
    });

    const lbf = p.lineOfBestFit;
    const title =
      lbf !== null && lbf.show
        ? `Scatterplot of ${p.points.length} points with line of best fit`
        : `Scatterplot of ${p.points.length} points`;

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title,
      desc: `Data points on a grid from 0 to ${xMax} (x) and 0 to ${yMax} (y).`,
    });
    bld.group({
      fill: COLORS.ink,
      'font-size': FONT.size,
      'font-family': FONT.family,
    });

    const area = plotArea(CANVAS.width, CANVAS.height, GRAPH_MARGINS);
    const { xScale, yScale } = coordinatePlane(bld, {
      xDomain: [0, xMax],
      yDomain: [0, yMax],
      area,
      xLabel: p.xAxisLabel === '' ? undefined : p.xAxisLabel,
      yLabel: p.yAxisLabel === '' ? undefined : p.yAxisLabel,
      xLabelAnchor: 'middle',
      yLabelRotate: true,
      arrows: 'positive',
    });

    // Line of best fit first (under the points), dashed, clipped to the axes.
    if (lbf !== null && lbf.show) {
      const clipped = clipSegment(
        xScale(0),
        yScale(lbf.yIntercept),
        xScale(xMax),
        yScale(lbf.slope * xMax + lbf.yIntercept),
        { x0: area.left, y0: area.top, x1: area.right, y1: area.bottom },
      );
      if (clipped !== null) {
        const [ax, ay, bx, by] = clipped;
        bld.line(ax, ay, bx, by, {
          stroke: COLORS.accent,
          'stroke-width': STROKE.line,
          'stroke-dasharray': '7 5',
        });

      }
    }

    for (const pt of placed) {
      markPoint(bld, xScale(pt.x), yScale(pt.y), { r: POINT_R, open: true });
    }

    bld.end();
    return bld.toString();
  },
};

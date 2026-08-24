/**
 * Renderer: sat-math:graph-line (GraphLine).
 *
 * A single line y = mx + b across the visible plane: symmetric y-extent
 * computed from the line, unit-grid coordinate plane, line clipped to the
 * plot rect (evaluated slightly past the axis range so it always spans the
 * full grid), optional intercept dots, and up to three marked on-line points
 * labeled with perpendicular auto-offsets.
 *
 * Params notes: the schema declares defaults (xAxisLabel/yAxisLabel 'x'/'y',
 * showIntercepts false) but ajv does not apply them, so this renderer applies
 * the same documented defaults itself. An explicitly empty label string draws
 * no axis title. Schema: database/diagrams/sat-math:graph-line.json.
 */

import { assertValidParams } from './lib/diagram.js';
import {
  CANVAS,
  GRAPH_MARGINS,
  Plane,
  clipSegment,
  clampCentered,
  coordinatePlane,
  markPoint,
  plotArea,
} from './lib/plot.js';
import { SvgBuilder } from './lib/svg.js';
import { approxTextWidth, linearEquation } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface MarkedPoint {
  x: number;
  y: number;
  label: string;
}

interface GraphLineParams {
  slope: number;
  yIntercept: number;
  xRange: { min: number; max: number };
  markedPoints: MarkedPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  showIntercepts?: boolean;
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:graph-line',
  rendererRef: 'GraphLine',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:graph-line', params);
    const p = params as unknown as GraphLineParams;

    const m = p.slope;
    const b = p.yIntercept;
    const minX = p.xRange.min;
    const maxX = p.xRange.max;

    // Symmetric y-extent from the line's values at the range ends + intercept.
    const yAbs = Math.max(Math.abs(b), Math.abs(m * minX + b), Math.abs(m * maxX + b));
    const yMax = Math.max(Math.ceil(yAbs), 3);

    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: `Linear function graph: ${linearEquation(m, b)}`,
      desc: `Line ${linearEquation(m, b)} in the xy-plane, x from ${minX} to ${maxX}.`,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    const area = plotArea(CANVAS.width, CANVAS.height, GRAPH_MARGINS);
    const xLabel = p.xAxisLabel === '' ? undefined : (p.xAxisLabel ?? 'x');
    const yLabel = p.yAxisLabel === '' ? undefined : (p.yAxisLabel ?? 'y');
    const plane: Plane = coordinatePlane(bld, {
      xDomain: [minX, maxX],
      yDomain: [-yMax, yMax],
      area,
      xLabel,
      yLabel,
    });
    const { xScale, yScale } = plane;

    // The line: evaluated 2 units past the axis range on both sides, then
    // clipped to the plot rect so it always spans the full visible grid.
    const xd0 = minX - 2;
    const xd1 = maxX + 2;
    const clipped = clipSegment(
      xScale(xd0),
      yScale(m * xd0 + b),
      xScale(xd1),
      yScale(m * xd1 + b),
      { x0: area.left, y0: area.top, x1: area.right, y1: area.bottom },
    );
    if (clipped !== null) {
      const [ax, ay, bx, by] = clipped;
      bld.line(ax, ay, bx, by, { stroke: COLORS.ink, 'stroke-width': STROKE.line });
    }

    // Optional intercept dots (no textual labels, per schema).
    if (p.showIntercepts === true) {
      markPoint(bld, xScale(0), yScale(b), { r: 3 });
      if (m !== 0) {
        const xi = -b / m;
        if (xi >= minX && xi <= maxX) markPoint(bld, xScale(xi), yScale(0), { r: 3 });
      }
    }

    // Marked points: schema says the renderer validates each lies on the line.
    for (let i = 0; i < p.markedPoints.length; i++) {
      const mp = p.markedPoints[i]!;
      if (Math.abs(mp.y - (m * mp.x + b)) > 0.011) {
        throw new Error(
          `markedPoints/${i}: point (${mp.x}, ${mp.y}) does not lie on the line ` +
            `${linearEquation(m, b)}`,
        );
      }
    }
    const cellW = area.width / (maxX - minX);
    const lineDx = cellW;
    const lineDy = m * cellW;
    const len = Math.hypot(lineDx, lineDy);
    let nx = -lineDy / len;
    let ny = lineDx / len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    } // normal pointing "up" on screen
    for (let i = 0; i < p.markedPoints.length; i++) {
      const mp = p.markedPoints[i]!;
      const px = xScale(mp.x);
      const py = yScale(mp.y);
      markPoint(bld, px, py, { r: 3 });
      // Alternate sides so neighboring labels never overlap each other; flip
      // back inside if the offset would leave the plot area.
      let side = i % 2 === 0 ? 1 : -1;
      if (py + side * ny * 16 < area.top + 10) side = -side;
      const lx = px + side * nx * 16;
      const ly = py + side * ny * 16 + 4;
      const w = approxTextWidth(mp.label, FONT.sizeSmall);
      bld.text(clampCentered(lx, area.left, area.right, w), ly, mp.label, {
        anchor: 'middle',
        size: FONT.sizeSmall,
      });
    }

    bld.end();
    return bld.toString();
  },
};

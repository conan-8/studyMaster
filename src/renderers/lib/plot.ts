/**
 * Reusable coordinate-plane engine for SAT-style figures.
 *
 * Everything here is deterministic: scales, SAT-clean tick steps
 * (1, 2, 5 x 10^k), Bluebook-style axes (ink lines, arrowheads, sparse
 * numbered labels, italic serif axis titles), light gray grid, plus small
 * geometry helpers (segment clipping, dot marking) shared by the graph
 * renderers.
 */

import { SvgBuilder, fmt } from './svg.js';
import { COLORS, FONT, STROKE } from './style.js';

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

export type Scale = ((v: number) => number) & {
  /** Map a pixel coordinate back to data space. */
  invert: (px: number) => number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
};

/** Linear scale domain -> range, with .invert(). */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const scale = (v: number): number => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  return Object.assign(scale, {
    invert: (px: number): number => d0 + ((px - r0) / (r1 - r0)) * (d1 - d0),
    domain: [d0, d1] as const,
    range: [r0, r1] as const,
  });
}

/** SAT-clean tick values covering [min, max] with step from 1,2,5 x 10^k. */
export function niceTicks(min: number, max: number, maxTicks = 12): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const rough = span / Math.max(1, maxTicks - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const eps = step * 1e-6;
  const first = Math.ceil((min + eps) / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + eps; v += step) {
    out.push(Math.round(v * 1e10) / 1e10);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** Default figure canvas shared by all coordinate-plane renderers. */
export const CANVAS = { width: 360, height: 320 } as const;

/** Default margins leaving room for arrows, tick labels, and axis titles. */
export const GRAPH_MARGINS: Margins = { top: 28, right: 24, bottom: 40, left: 48 };

export function plotArea(width: number, height: number, margins: Margins): PlotArea {
  const left = margins.left;
  const right = width - margins.right;
  const top = margins.top;
  const bottom = height - margins.bottom;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

export interface AxisOptions {
  /** Data -> px scale along this axis. */
  scale: Scale;
  /** px position of the axis line (y for x-axis, x for y-axis). */
  atPixel: number;
  /** Tick values (data units) to mark and label. */
  ticks: number[];
  /** px bounds of the axis line; arrowhead(s) drawn just outside. */
  fromPx: number;
  toPx: number;
  /** Axis title ('x', 'Time (minutes)', ...). Rendered italic serif. */
  label?: string;
  /** Also draw an arrowhead on the negative end (default true). */
  arrowNegativeEnd?: boolean;
  /** Tick-mark half-length in px (default 0: SAT style numbers only). */
  tickSize?: number;
  /** Suppress the '0' label at the origin (default true). */
  skipZeroLabel?: boolean;
  /** px gap between axis line and number labels (default 5). */
  labelGap?: number;
  fontSize?: number;
  /** Arrowhead length in px (default 8). */
  arrowSize?: number;
  /** x-axis title placement: at the + arrow (default) or centered below. */
  labelAnchor?: 'end' | 'middle';
  /** y-axis title rotated 90° counter-clockwise, centered beside the axis. */
  labelRotate?: boolean;
}

/** Draw an x-axis (line + arrowheads + numbered tick labels + optional title). */
export function xAxisGroup(b: SvgBuilder, o: AxisOptions): void {
  const y = o.atPixel;
  const size = o.fontSize ?? FONT.size;
  const gap = o.labelGap ?? 5;
  const arrow = o.arrowSize ?? 8;
  const tick = o.tickSize ?? 0;

  b.group({});
  b.line(o.fromPx, y, o.toPx, y, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
  b.polygon(
    [
      [o.toPx + arrow, y],
      [o.toPx, y - arrow * 0.4],
      [o.toPx, y + arrow * 0.4],
    ],
    { fill: COLORS.ink },
  );
  if (o.arrowNegativeEnd !== false) {
    b.polygon(
      [
        [o.fromPx - arrow, y],
        [o.fromPx, y - arrow * 0.4],
        [o.fromPx, y + arrow * 0.4],
      ],
      { fill: COLORS.ink },
    );
  }
  for (const t of o.ticks) {
    const px = o.scale(t);
    if (px < o.fromPx + 1 || px > o.toPx - 1) continue;
    if (tick > 0) {
      b.line(px, y - tick, px, y + tick, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
    }
    if (t === 0 && o.skipZeroLabel !== false) continue;
    b.text(px, y + gap + size * 0.8, fmt(t), {
      anchor: 'middle',
      size,
      fill: COLORS.ink,
    });
  }
  if (o.label !== undefined) {
    if (o.labelAnchor === 'middle') {
      b.text((o.fromPx + o.toPx) / 2, y + gap + size * 2.1, o.label, {
        anchor: 'middle',
        size,
        family: FONT.familyMath,
        italic: true,
        fill: COLORS.ink,
      });
    } else {
      b.text(o.toPx + arrow + 3, y + size * 0.35, o.label, {
        anchor: 'start',
        size,
        family: FONT.familyMath,
        italic: true,
        fill: COLORS.ink,
      });
    }
  }
  b.end();
}

/** Draw a y-axis (line + arrowheads + numbered tick labels + optional title). */
export function yAxisGroup(b: SvgBuilder, o: AxisOptions): void {
  const x = o.atPixel;
  const size = o.fontSize ?? FONT.size;
  const gap = o.labelGap ?? 5;
  const arrow = o.arrowSize ?? 8;
  const tick = o.tickSize ?? 0;

  b.group({});
  // fromPx is the bottom end (larger py), toPx the top/positive end.
  b.line(x, o.fromPx, x, o.toPx, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
  b.polygon(
    [
      [x, o.toPx - arrow],
      [x - arrow * 0.4, o.toPx],
      [x + arrow * 0.4, o.toPx],
    ],
    { fill: COLORS.ink },
  );
  if (o.arrowNegativeEnd !== false) {
    b.polygon(
      [
        [x, o.fromPx + arrow],
        [x - arrow * 0.4, o.fromPx],
        [x + arrow * 0.4, o.fromPx],
      ],
      { fill: COLORS.ink },
    );
  }
  for (const t of o.ticks) {
    const py = o.scale(t);
    if (py < o.toPx + 1 || py > o.fromPx - 1) continue;
    if (tick > 0) {
      b.line(x - tick, py, x + tick, py, { stroke: COLORS.ink, 'stroke-width': STROKE.axis });
    }
    if (t === 0 && o.skipZeroLabel !== false) continue;
    b.text(x - gap, py + size * 0.35, fmt(t), {
      anchor: 'end',
      size,
      fill: COLORS.ink,
    });
  }
  if (o.label !== undefined) {
    if (o.labelRotate === true) {
      const lx = x - gap - size * 1.6;
      const ly = (o.fromPx + o.toPx) / 2;
      b.text(lx, ly, o.label, {
        anchor: 'middle',
        size,
        family: FONT.familyMath,
        italic: true,
        fill: COLORS.ink,
        rotate: { angle: -90, cx: lx, cy: ly },
      });
    } else {
      b.text(x, o.toPx - arrow - 6, o.label, {
        anchor: 'middle',
        size,
        family: FONT.familyMath,
        italic: true,
        fill: COLORS.ink,
      });
    }
  }
  b.end();
}

/** Light gray grid across the scales' px ranges (skips the 0 lines; axes cover them). */
export function gridGroup(
  b: SvgBuilder,
  xScale: Scale,
  yScale: Scale,
  xTicks: number[],
  yTicks: number[],
): void {
  b.group({ stroke: COLORS.grid, 'stroke-width': STROKE.thin });
  const top = yScale.range[1];
  const bottom = yScale.range[0];
  const left = xScale.range[0];
  const right = xScale.range[1];
  for (const t of xTicks) {
    if (t === 0) continue;
    const px = xScale(t);
    b.line(px, top, px, bottom, {});
  }
  for (const t of yTicks) {
    if (t === 0) continue;
    const py = yScale(t);
    b.line(left, py, right, py, {});
  }
  b.end();
}

// ---------------------------------------------------------------------------
// One-call coordinate plane (grid + axes) — the shared scaffold.
// ---------------------------------------------------------------------------

export interface CoordinatePlaneOptions {
  xDomain: [number, number];
  yDomain: [number, number];
  area: PlotArea;
  xLabel?: string;
  yLabel?: string;
  /** x-axis title at the + arrow ('end', default) or centered below ('middle'). */
  xLabelAnchor?: 'end' | 'middle';
  /** Rotate the y-axis title 90° CCW beside the axis (for long titles). */
  yLabelRotate?: boolean;
  /** Arrowheads on both ends ('both', default) or positive ends only ('positive'). */
  arrows?: 'both' | 'positive';
  maxTicks?: number;
}

export interface Plane {
  xScale: Scale;
  yScale: Scale;
  xTicks: number[];
  yTicks: number[];
  area: PlotArea;
}

/**
 * Draw grid + x/y axes (at data 0) into `b` and return the scales/ticks.
 * Requires 0 within both domains (all current archetypes guarantee it).
 */
export function coordinatePlane(b: SvgBuilder, o: CoordinatePlaneOptions): Plane {
  const xScale = linearScale(o.xDomain, [o.area.left, o.area.right]);
  const yScale = linearScale(o.yDomain, [o.area.bottom, o.area.top]);
  const maxTicks = o.maxTicks ?? 12;
  const xTicks = niceTicks(o.xDomain[0], o.xDomain[1], maxTicks);
  const yTicks = niceTicks(o.yDomain[0], o.yDomain[1], maxTicks);

  gridGroup(b, xScale, yScale, xTicks, yTicks);

  const arrowNegative = o.arrows !== 'positive';
  xAxisGroup(b, {
    scale: xScale,
    atPixel: yScale(0),
    ticks: xTicks,
    fromPx: o.area.left - 4,
    toPx: o.area.right + 2,
    label: o.xLabel,
    labelAnchor: o.xLabelAnchor,
    arrowNegativeEnd: arrowNegative,
  });
  yAxisGroup(b, {
    scale: yScale,
    atPixel: xScale(0),
    ticks: yTicks,
    fromPx: o.area.bottom + 4,
    toPx: o.area.top - 2,
    label: o.yLabel,
    labelRotate: o.yLabelRotate,
    arrowNegativeEnd: arrowNegative,
  });
  return { xScale, yScale, xTicks, yTicks, area: o.area };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export interface PxRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Clip segment (a -> b) to the px rect (Liang–Barsky). Returns the clipped
 * endpoints or null when the segment lies entirely outside.
 */
export function clipSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: PxRect,
): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x0, r.x1 - ax, ay - r.y0, r.y1 - ay];
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return null;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return [ax + t0 * dx, ay + t0 * dy, ax + t1 * dx, ay + t1 * dy];
}

/** Draw a point dot: filled (default) or open (white fill + ink ring). */
export function markPoint(
  b: SvgBuilder,
  px: number,
  py: number,
  opts: { r?: number; open?: boolean } = {},
): void {
  const r = opts.r ?? 3;
  if (opts.open === true) {
    b.circle(px, py, r, {
      fill: COLORS.fill,
      stroke: COLORS.ink,
      'stroke-width': STROKE.axis,
    });
  } else {
    b.circle(px, py, r, { fill: COLORS.ink });
  }
}

/** Clamp x so a text block of width w centered at the returned x stays within [lo, hi]. */
export function clampCentered(px: number, lo: number, hi: number, w: number): number {
  return Math.min(Math.max(px, lo + w / 2), hi - w / 2);
}

/** A straight obstacle segment in pixel space (lines, axes, sampled curves). */
export interface ObstacleSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function pointSegDist(px: number, py: number, s: ObstacleSegment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return Math.hypot(px - s.x1, py - s.y1);
  const t = Math.min(1, Math.max(0, ((px - s.x1) * dx + (py - s.y1) * dy) / l2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/** True when the two segments cross (proper or endpoint touch). */
function segmentsIntersect(s: ObstacleSegment, t: ObstacleSegment): boolean {
  const d1x = s.x2 - s.x1;
  const d1y = s.y2 - s.y1;
  const d2x = t.x2 - t.x1;
  const d2y = t.y2 - t.y1;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return false; // parallel: overlap impossible for our thin obstacles
  const u = ((t.x1 - s.x1) * d2y - (t.y1 - s.y1) * d2x) / den;
  const v = ((t.x1 - s.x1) * d1y - (t.y1 - s.y1) * d1x) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

/** True when the segment crosses or enters the rect (x0,y0)-(x1,y1). */
function segmentCrossesRect(s: ObstacleSegment, x0: number, y0: number, x1: number, y1: number): boolean {
  const inside = (px: number, py: number): boolean => px >= x0 && px <= x1 && py >= y0 && py <= y1;
  if (inside(s.x1, s.y1) || inside(s.x2, s.y2)) return true;
  return (
    segmentsIntersect(s, { x1: x0, y1: y0, x2: x1, y2: y0 }) ||
    segmentsIntersect(s, { x1: x1, y1: y0, x2: x1, y2: y1 }) ||
    segmentsIntersect(s, { x1: x1, y1: y1, x2: x0, y2: y1 }) ||
    segmentsIntersect(s, { x1: x0, y1: y1, x2: x0, y2: y0 })
  );
}

/**
 * Place a coordinate label near (px, py) in empty space: score candidate
 * positions (8 directions x 2 distances) by the minimum distance from the
 * label box to every obstacle segment (plot lines, axes, curves). A candidate
 * whose box is CROSSED by an obstacle (a corner-distance check alone cannot
 * see that) is rejected outright. Candidates whose box leaves the plot area
 * are only used when no fully-inside candidate exists. Deterministic — tie
 * order favors NE, then clockwise.
 */
export function placePointLabel(opts: {
  px: number;
  py: number;
  width: number;
  area: PlotArea;
  obstacles: ObstacleSegment[];
}): { x: number; y: number } {
  const { px, py, width, area, obstacles } = opts;
  const halfW = width / 2 + 3;
  const halfH = 9;
  // Screen coords are y-down; "up" is negative dy. NE first, clockwise.
  const dirs: Array<[number, number]> = [
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
  ];
  let best: { x: number; y: number; score: number } | null = null;
  for (const dist of [18, 28, 38]) {
    for (const [ux, uy] of dirs) {
      const norm = Math.hypot(ux, uy);
      const cx = px + (ux / norm) * dist;
      const cy = py + (uy / norm) * dist;
      const inside =
        cx - halfW >= area.left &&
        cx + halfW <= area.right &&
        cy - halfH >= area.top &&
        cy + halfH <= area.bottom;
      const crossed = obstacles.some((seg) =>
        segmentCrossesRect(seg, cx - halfW, cy - halfH, cx + halfW, cy + halfH),
      );
      let minDist = Number.POSITIVE_INFINITY;
      for (const sx of [cx - halfW, cx + halfW]) {
        for (const sy of [cy - halfH, cy + halfH]) {
          for (const seg of obstacles) {
            minDist = Math.min(minDist, pointSegDist(sx, sy, seg));
          }
        }
      }
      // Inside-area dominates; never-crossed dominates; then max clearance.
      const score = (inside ? 2000 : 0) + (crossed ? -1000 : 0) + minDist;
      if (best === null || score > best.score) {
        best = { x: cx, y: cy, score };
      }
    }
  }
  const chosen = best ?? { x: px + 18, y: py - 18 };
  return {
    x: clampCentered(chosen.x, area.left, area.right, width),
    y: Math.min(Math.max(chosen.y, area.top + halfH), area.bottom - halfH / 2),
  };
}

/**
 * Axis obstacle segments for a coordinate plane (only axes inside the
 * domain). Each axis contributes its line PLUS a buffer segment on the
 * tick-label side so labels also stay clear of the tick numbers: x-axis
 * ticks sit below the axis, y-axis ticks left of it.
 */
export function axisObstacles(plane: Plane, area: PlotArea, xDomain: [number, number], yDomain: [number, number]): ObstacleSegment[] {
  const out: ObstacleSegment[] = [];
  if (xDomain[0] <= 0 && xDomain[1] >= 0) {
    const ax = plane.xScale(0);
    out.push({ x1: ax, y1: area.top, x2: ax, y2: area.bottom });
    out.push({ x1: ax - 18, y1: area.top, x2: ax - 18, y2: area.bottom });
  }
  if (yDomain[0] <= 0 && yDomain[1] >= 0) {
    const ay = plane.yScale(0);
    out.push({ x1: area.left, y1: ay, x2: area.right, y2: ay });
    out.push({ x1: area.left, y1: ay + 16, x2: area.right, y2: ay + 16 });
  }
  return out;
}

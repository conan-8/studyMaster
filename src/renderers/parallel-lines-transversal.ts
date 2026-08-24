/**
 * Renderer: sat-math:parallel-lines-transversal (ParallelLinesTransversal).
 *
 * Two horizontal parallel lines cut by a transversal tilted
 * transversalAngleDegrees from the horizontal (measured counterclockwise,
 * math orientation). Both parallels are drawn from the same construction
 * (y = YT and y = YB), so they are parallel by construction, and the two
 * intersection points are COMPUTED (lineIntersect on the drawn lines), never
 * parameterized. The transversal is extended past both lines and clipped to
 * the canvas.
 *
 * Angle numbering — implemented exactly as the schema documents it
 * (givenAngle.position): positions 1-4 at the TOP intersection with
 * 1 = upper-left, 2 = upper-right, 3 = lower-left, 4 = lower-right; positions
 * 5-8 in the SAME order at the bottom intersection (5 UL, 6 UR, 7 LL, 8 LR).
 * Each numeral sits on its region's bisector (normalized sum of the two
 * bounding rays) at a fixed radius. The given angle draws an arc between its
 * region's bounding rays plus the param's measureText — the measure text is
 * printed verbatim and REPLACES the numeral at that position (two labels
 * cannot share one region); transversalAngleDegrees never constrains it.
 * highlightAngles draw smaller accent arcs nested inside the numeral radius
 * so they never overlap the numerals.
 *
 * Line labels: the param string is rendered verbatim in italic serif —
 * subscripts are expressed with Unicode characters (ℓ₁, ℓ₂), a deterministic
 * single-text-node choice instead of tspan baseline-shift gymnastics.
 * showParallelMarks / showAngleNumbers default to true in the schema; ajv
 * does not apply defaults, so the renderer applies them itself.
 * Schema: database/diagrams/sat-math:parallel-lines-transversal.json
 */

import { assertValidParams, loadDiagramArchetype } from './lib/diagram.js';
import { clipSegment } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import {
  add,
  bisectorDir,
  lineIntersect,
  scale,
  sub,
  unit,
  type Pt,
} from './lib/geom.js';
import type { Renderer } from './types.js';

interface GivenAngle {
  position: number;
  measureText: string;
}

interface ParallelLinesTransversalParams {
  transversalAngleDegrees: number;
  givenAngle: GivenAngle | null;
  highlightAngles: number[];
  lineLabels: { top: string | null; bottom: string | null; transversal: string | null };
  showParallelMarks?: boolean;
  showAngleNumbers?: boolean;
}

const CANVAS = { width: 360, height: 320 } as const;
/** Horizontal extent of both parallel lines (px). */
const XL = 28;
const XR = 332;
/** y positions of the top and bottom parallel lines (px). */
const YT = 110;
const YB = 210;
/** Transversal overhang past each intersection before canvas clipping. */
const EXT = 70;
/** Clip rect keeping the transversal inside the canvas (px). */
const SAFE = { x0: 16, y0: 14, x1: 344, y1: 306 };
/** Numeral radius along each region's bisector (px). */
const NUMERAL_RADIUS = 26;
/** Highlight-arc radius, nested inside the numerals (px). */
const HIGHLIGHT_RADIUS = 14;
/** Given-angle arc radius (px). */
const GIVEN_ARC_RADIUS = 22;
/** Given-angle text radius along the same bisector, outside the arc (px). */
const GIVEN_TEXT_RADIUS = 46;

const RAY_L: Pt = { x: -1, y: 0 };
const RAY_R: Pt = { x: 1, y: 0 };

/**
 * The two bounding rays of each numbered region at an intersection, in
 * region order [upper-left, upper-right, lower-left, lower-right]; `up` and
 * `down` are the transversal's unit directions (up = toward smaller y).
 */
function regionRays(up: Pt): ReadonlyArray<readonly [Pt, Pt]> {
  const down = scale(up, -1);
  return [
    [RAY_L, up],
    [RAY_R, up],
    [RAY_L, down],
    [RAY_R, down],
  ];
}

/** Which intersection (0 = top, 1 = bottom) and region index a position uses. */
function positionLocation(position: number): { inter: 0 | 1; region: number } {
  return { inter: position <= 4 ? 0 : 1, region: (position - 1) % 4 };
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:parallel-lines-transversal',
  rendererRef: 'ParallelLinesTransversal',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:parallel-lines-transversal', params);
    const p = params as unknown as ParallelLinesTransversalParams;

    // --- Renderer-side validation promised by the schema notes ------------
    const seen = new Set<number>();
    for (const n of p.highlightAngles) {
      if (seen.has(n)) {
        throw new Error(`highlightAngles: duplicate position ${n} (positions must be unique)`);
      }
      seen.add(n);
    }

    const theta = p.transversalAngleDegrees;

    // --- Construction: two parallels + one tilted transversal -------------
    const topLine: readonly [Pt, Pt] = [
      { x: XL, y: YT },
      { x: XR, y: YT },
    ];
    const bottomLine: readonly [Pt, Pt] = [
      { x: XL, y: YB },
      { x: XR, y: YB },
    ];
    // Unit direction "up along the transversal" in screen px: math angle
    // theta counterclockwise from +x, with y pointing down on screen.
    const upDir: Pt = {
      x: Math.cos((theta * Math.PI) / 180),
      y: -Math.sin((theta * Math.PI) / 180),
    };
    // Seed the transversal through the canvas center; COMPUTE where it
    // crosses each parallel (never parameterized).
    const seed: Pt = { x: CANVAS.width / 2, y: CANVAS.height / 2 };
    const farA = add(seed, scale(upDir, 1000));
    const farB = sub(seed, scale(upDir, 1000));
    const P1 = lineIntersect(seed, farA, topLine[0], topLine[1]);
    const P2 = lineIntersect(seed, farA, bottomLine[0], bottomLine[1]);
    if (P1 === null || P2 === null) {
      throw new Error(
        `transversalAngleDegrees: ${fmt(theta)}° transversal does not cross both parallel lines`,
      );
    }

    // Transversal segment: EXT past each intersection, clipped to the canvas.
    const tRaw: [number, number, number, number] = [
      P1.x + upDir.x * EXT,
      P1.y + upDir.y * EXT,
      P2.x - upDir.x * EXT,
      P2.y - upDir.y * EXT,
    ];
    const tClip = clipSegment(tRaw[0], tRaw[1], tRaw[2], tRaw[3], SAFE);
    const transversal: [number, number, number, number] =
      tClip ?? [tRaw[0], tRaw[1], tRaw[2], tRaw[3]];

    // --- Accessibility -----------------------------------------------------
    const arch = loadDiagramArchetype('sat-math:parallel-lines-transversal');
    const givenDesc =
      p.givenAngle !== null
        ? `angle ${p.givenAngle.position} marked ${p.givenAngle.measureText}`
        : 'no given measure';
    const hlDesc = p.highlightAngles.length > 0 ? p.highlightAngles.join(', ') : 'none';
    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: arch.title,
      desc:
        `Two parallel lines cut by a transversal tilted ${fmt(theta)}° from the ` +
        `horizontal; ${givenDesc}; highlighted angles: ${hlDesc}.`,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    const lineAttrs = { stroke: COLORS.ink, 'stroke-width': STROKE.line };
    const serifItalic = { family: FONT.familyMath, italic: true } as const;

    // --- Lines -------------------------------------------------------------
    bld.line(topLine[0].x, topLine[0].y, topLine[1].x, topLine[1].y, lineAttrs);
    bld.line(bottomLine[0].x, bottomLine[0].y, bottomLine[1].x, bottomLine[1].y, lineAttrs);
    bld.line(transversal[0], transversal[1], transversal[2], transversal[3], lineAttrs);

    // --- Parallel marks: matching chevrons, one per line, left of the -----
    // --- crossing, both pointing the same (rightward) direction -----------
    if (p.showParallelMarks !== false) {
      const chevron = (x: number, y: number): void => {
        bld.polyline(
          [
            [x - 6, y - 4.5],
            [x + 4, y],
            [x - 6, y + 4.5],
          ],
          { fill: 'none', stroke: COLORS.ink, 'stroke-width': STROKE.axis },
        );
      };
      chevron((XL + P1.x) / 2, YT);
      chevron((XL + P2.x) / 2, YB);
    }

    // --- Angle regions -----------------------------------------------------
    const inters: readonly Pt[] = [P1, P2];
    const rays = regionRays(upDir);

    const bisectorOf = (inter: number, region: number): Pt => {
      const P = inters[inter]!;
      const [ra, rb] = rays[region]!;
      return bisectorDir(P, add(P, ra), add(P, rb));
    };

    /** Small arc between a region's bounding rays at radius r, bowing
     * through the region's bisector (short-way arc, so largeArc is 0). */
    const regionArc = (position: number, r: number, strokeWidth: number): void => {
      const { inter, region } = positionLocation(position);
      const P = inters[inter]!;
      const [ra, rb] = rays[region]!;
      const a1 = Math.atan2(ra.y, ra.x);
      const a2 = Math.atan2(rb.y, rb.x);
      let delta = a2 - a1;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta <= -Math.PI) delta += 2 * Math.PI;
      const x1 = P.x + r * Math.cos(a1);
      const y1 = P.y + r * Math.sin(a1);
      const x2 = P.x + r * Math.cos(a2);
      const y2 = P.y + r * Math.sin(a2);
      const sweepFlag = delta > 0 ? 1 : 0;
      bld.path(
        `M ${fmt(x1)} ${fmt(y1)} A ${fmt(r)} ${fmt(r)} 0 0 ${sweepFlag} ${fmt(x2)} ${fmt(y2)}`,
        { fill: 'none', stroke: COLORS.ink, 'stroke-width': strokeWidth },
      );
    };

    // Highlight arcs first (nested inside the numerals' radius).
    for (const n of p.highlightAngles) {
      regionArc(n, HIGHLIGHT_RADIUS, STROKE.thin);
    }

    // Given angle: arc + the param's measure text (verbatim, never
    // recomputed), replacing the numeral at that position.
    const given = p.givenAngle ?? null;
    if (given !== null) {
      regionArc(given.position, GIVEN_ARC_RADIUS, STROKE.axis);
      const { inter, region } = positionLocation(given.position);
      const P = inters[inter]!;
      const bis = bisectorOf(inter, region);
      const tx = P.x + bis.x * GIVEN_TEXT_RADIUS;
      const ty = P.y + bis.y * GIVEN_TEXT_RADIUS + 4;
      const w = approxTextWidth(given.measureText, FONT.size);
      const cx = Math.min(Math.max(tx, 8 + w / 2), CANVAS.width - 8 - w / 2);
      const cy = Math.min(Math.max(ty, 16), CANVAS.height - 8);
      bld.text(cx, cy, given.measureText, { anchor: 'middle', ...serifItalic });
    }

    // Numerals 1-8 on each region's bisector (suppressed at the given
    // position, where the measure text replaces the numeral).
    if (p.showAngleNumbers !== false) {
      for (let n = 1; n <= 8; n++) {
        if (given !== null && given.position === n) continue;
        const { inter, region } = positionLocation(n);
        const P = inters[inter]!;
        const bis = bisectorOf(inter, region);
        bld.text(P.x + bis.x * NUMERAL_RADIUS, P.y + bis.y * NUMERAL_RADIUS + 4, String(n), {
          anchor: 'middle',
          size: FONT.sizeSmall,
        });
      }
    }

    // --- Line labels (verbatim param text, italic serif) -------------------
    if (p.lineLabels.top !== null && p.lineLabels.top !== '') {
      bld.text(XR - 6, YT - 8, p.lineLabels.top, { anchor: 'end', ...serifItalic });
    }
    if (p.lineLabels.bottom !== null && p.lineLabels.bottom !== '') {
      bld.text(XR - 6, YB + 18, p.lineLabels.bottom, { anchor: 'end', ...serifItalic });
    }
    if (p.lineLabels.transversal !== null && p.lineLabels.transversal !== '') {
      // Beside the transversal's upper end: pull 10px back from the end
      // with the smaller y, then offset 14px to the upper-side normal.
      const [ax, ay, bx, by] = transversal;
      const upIsA = ay <= by;
      const end: Pt = { x: upIsA ? ax : bx, y: upIsA ? ay : by };
      const other: Pt = { x: upIsA ? bx : ax, y: upIsA ? by : ay };
      const along = unit(sub(end, other));
      const back = { x: end.x - along.x * 10, y: end.y - along.y * 10 };
      let n: Pt = { x: -along.y, y: along.x };
      if (n.y > -1e-9) {
        if (n.y > 1e-9 || n.x >= 0) n = { x: -n.x, y: -n.y };
      }
      const pos = { x: back.x + n.x * 14, y: back.y + n.y * 14 + 4 };
      bld.text(pos.x, pos.y, p.lineLabels.transversal, { anchor: 'middle', ...serifItalic });
    }

    bld.end();
    return bld.toString();
  },
};

/**
 * Renderer: sat-math:triangle-labeled (TriangleLabeled).
 *
 * A triangle drawn purely from its three vertex coordinates: the polygon is
 * auto-fit to the canvas with a UNIFORM scale (never distorted), sides are
 * labeled at their midpoints offset outward along the outward normal, angle
 * labels sit on the interior angle bisector at a fixed radius (grown in
 * fixed steps if a short side's label is in the way — deterministic
 * tie-break), and rightAngleAt draws the classic small square aligned to
 * the two adjacent SIDES (not to an idealized 90°). No grid or axes.
 *
 * Params notes: showVertexNames defaults to true in the schema but ajv does
 * not apply defaults, so the renderer applies the documented default itself.
 * The schema's vertex description promises renderer-side rejection of
 * degenerate triples (min pairwise distance 1 unit, min angle 10°) and of a
 * rightAngleAt that does not measure 90° ± 0.5° — both throw with a
 * jsonPath-style locator. The schema defines no tick-mark/congruence fields,
 * so none are drawn.
 * Schema: database/diagrams/sat-math:triangle-labeled.json
 */

import { assertValidParams, loadDiagramArchetype } from './lib/diagram.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import {
  angleAtVertex,
  bisectorDir,
  len,
  lineIntersect,
  mid,
  normals,
  offsetPoint,
  pointSegDistance,
  sub,
  unit,
  type Pt,
} from './lib/geom.js';
import type { Renderer } from './types.js';

type VertexName = 'A' | 'B' | 'C';
type SideName = 'AB' | 'BC' | 'CA';

interface PointParam {
  x: number;
  y: number;
}

interface SideLabel {
  side: SideName;
  text: string;
}

interface AngleLabel {
  vertex: VertexName;
  text: string;
}

interface TriangleLabeledParams {
  vertices: Record<VertexName, PointParam>;
  sideLabels: SideLabel[];
  angleLabels: AngleLabel[];
  rightAngleAt: VertexName | null;
  showVertexNames?: boolean;
}

const CANVAS = { width: 360, height: 320 } as const;
/** Auto-fit padding: leaves room for outward side labels and vertex names. */
const PAD = 50;
/** Side-label offset from the side midpoint, along the outward normal (px). */
const SIDE_LABEL_OFFSET = 14;
/** Angle-label radius along the interior bisector (px), before tie-breaks. */
const ANGLE_LABEL_RADIUS = 26;
/** Deterministic tie-break: grow the angle radius in these steps ... */
const ANGLE_RADIUS_STEP = 6;
/** ... up to this cap, if a side label is in the way. */
const ANGLE_RADIUS_MAX = 64;
/** Right-angle mark leg length along each adjacent side (px). */
const RIGHT_MARK_LEG = 12;
/** Vertex-name offset from the vertex, along the outward centroid ray (px). */
const VERTEX_LABEL_OFFSET = 17;

/** The other two vertices for each vertex (order fixed for determinism). */
const OTHERS: Record<VertexName, readonly [VertexName, VertexName]> = {
  A: ['B', 'C'],
  B: ['A', 'C'],
  C: ['A', 'B'],
};

/** Side endpoints plus the opposite (interior-side) vertex. */
const SIDES: Record<SideName, readonly [VertexName, VertexName, VertexName]> = {
  AB: ['A', 'B', 'C'],
  BC: ['B', 'C', 'A'],
  CA: ['C', 'A', 'B'],
};

const VERTEX_ORDER: readonly VertexName[] = ['A', 'B', 'C'];

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function labelBox(cx: number, cy: number, text: string, size: number): Box {
  const w = approxTextWidth(text, size);
  const h = size + 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

/** True when segment p1-p2 crosses the box (or enters it), catching cases corner distances miss. */
function segCrossesBox(p1: Pt, p2: Pt, box: Box): boolean {
  const inside = (q: Pt): boolean => q.x >= box.x0 && q.x <= box.x1 && q.y >= box.y0 && q.y <= box.y1;
  if (inside(p1) || inside(p2)) return true;
  const edges: Array<[Pt, Pt]> = [
    [{ x: box.x0, y: box.y0 }, { x: box.x1, y: box.y0 }],
    [{ x: box.x1, y: box.y0 }, { x: box.x1, y: box.y1 }],
    [{ x: box.x1, y: box.y1 }, { x: box.x0, y: box.y1 }],
    [{ x: box.x0, y: box.y1 }, { x: box.x0, y: box.y0 }],
  ];
  return edges.some(([a, b]) => lineIntersect(a, b, p1, p2) !== null && segmentsTouch(a, b, p1, p2));
}

/** Both intersection parameters within the finite segments (for edge tests). */
function segmentsTouch(a: Pt, b: Pt, p1: Pt, p2: Pt): boolean {
  const hit = lineIntersect(a, b, p1, p2);
  if (hit === null) return false;
  const on = (lo: number, hi: number, v: number): boolean => v >= Math.min(lo, hi) - 1e-9 && v <= Math.max(lo, hi) + 1e-9;
  return on(a.x, b.x, hit.x) && on(a.y, b.y, hit.y) && on(p1.x, p2.x, hit.x) && on(p1.y, p2.y, hit.y);
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:triangle-labeled',
  rendererRef: 'TriangleLabeled',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:triangle-labeled', params);
    const p = params as unknown as TriangleLabeledParams;

    const V: Record<VertexName, Pt> = {
      A: { x: p.vertices.A.x, y: p.vertices.A.y },
      B: { x: p.vertices.B.x, y: p.vertices.B.y },
      C: { x: p.vertices.C.x, y: p.vertices.C.y },
    };

    // --- Geometry validation promised by the schema descriptions ----------
    for (let i = 0; i < VERTEX_ORDER.length; i++) {
      for (let j = i + 1; j < VERTEX_ORDER.length; j++) {
        const ni = VERTEX_ORDER[i]!;
        const nj = VERTEX_ORDER[j]!;
        const d = len(sub(V[ni], V[nj]));
        if (d < 1) {
          throw new Error(
            `vertices: ${ni} and ${nj} are only ${fmt(d)} units apart (minimum 1)`,
          );
        }
      }
    }
    for (const n of VERTEX_ORDER) {
      const [o1, o2] = OTHERS[n];
      const a = angleAtVertex(V[o1], V[n], V[o2]);
      if (a < 10) {
        throw new Error(`vertices: angle at ${n} is ${fmt(a)}° (minimum 10°) — degenerate triangle`);
      }
    }
    if (p.rightAngleAt !== null) {
      const n = p.rightAngleAt;
      const [o1, o2] = OTHERS[n];
      const a = angleAtVertex(V[o1], V[n], V[o2]);
      if (Math.abs(a - 90) > 0.5) {
        throw new Error(
          `rightAngleAt: angle at ${n} measures ${fmt(a)}°, not 90° ± 0.5°`,
        );
      }
    }

    // --- Uniform auto-fit with padding (math coords, y up -> SVG y down) --
    const xs = VERTEX_ORDER.map((n) => V[n].x);
    const ys = VERTEX_ORDER.map((n) => V[n].y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bw = Math.max(maxX - minX, 1e-9);
    const bh = Math.max(maxY - minY, 1e-9);
    const s = Math.min((CANVAS.width - 2 * PAD) / bw, (CANVAS.height - 2 * PAD) / bh);
    const ox = PAD + ((CANVAS.width - 2 * PAD) - bw * s) / 2;
    const oy = PAD + ((CANVAS.height - 2 * PAD) - bh * s) / 2;
    const W: Record<VertexName, Pt> = {
      A: { x: ox + (V.A.x - minX) * s, y: oy + (maxY - V.A.y) * s },
      B: { x: ox + (V.B.x - minX) * s, y: oy + (maxY - V.B.y) * s },
      C: { x: ox + (V.C.x - minX) * s, y: oy + (maxY - V.C.y) * s },
    };

    // --- Accessibility -----------------------------------------------------
    const arch = loadDiagramArchetype('sat-math:triangle-labeled');
    const descParts = [
      `Triangle with vertices A(${fmt(V.A.x)}, ${fmt(V.A.y)}), B(${fmt(V.B.x)}, ${fmt(V.B.y)}), C(${fmt(V.C.x)}, ${fmt(V.C.y)}).`,
    ];
    if (p.rightAngleAt !== null) descParts.push(`Right angle at ${p.rightAngleAt}.`);
    if (p.sideLabels.length > 0) {
      descParts.push(`Side labels: ${p.sideLabels.map((sl) => `${sl.side} = ${sl.text}`).join(', ')}.`);
    }
    if (p.angleLabels.length > 0) {
      descParts.push(`Angle labels: ${p.angleLabels.map((al) => `${al.vertex} = ${al.text}`).join(', ')}.`);
    }
    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: arch.title,
      desc: descParts.join(' '),
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    // --- Triangle ----------------------------------------------------------
    bld.polygon(
      [
        [W.A.x, W.A.y],
        [W.B.x, W.B.y],
        [W.C.x, W.C.y],
      ],
      { fill: 'none', stroke: COLORS.ink, 'stroke-width': STROKE.line },
    );

    // --- Side labels (midpoint + outward normal, serif italic) ------------
    const sideBoxes: Box[] = [];
    for (const sl of p.sideLabels) {
      const [e1, e2, opp] = SIDES[sl.side];
      const P1 = W[e1];
      const P2 = W[e2];
      const m = mid(P1, P2);
      // Outward normal: of the two perpendiculars, the one pointing AWAY
      // from the opposite vertex (which lies on the interior side). The
      // perpendiculars keep the edge's length, so unit() before offsetting.
      const edge = sub(P2, P1);
      const { left, right } = normals(edge);
      const away = sub(W[opp], m);
      const n = unit(left.x * away.x + left.y * away.y < 0 ? left : right);
      const cx = m.x + n.x * SIDE_LABEL_OFFSET;
      const cy = m.y + n.y * SIDE_LABEL_OFFSET;
      sideBoxes.push(labelBox(cx, cy, sl.text, FONT.size));
      bld.text(cx, cy + 4, sl.text, {
        anchor: 'middle',
        family: FONT.familyMath,
        italic: true,
      });
    }

    // --- Right-angle mark: small square aligned to the two adjacent sides -
    if (p.rightAngleAt !== null) {
      const n = p.rightAngleAt;
      const [o1, o2] = OTHERS[n];
      const v = W[n];
      const u = unit(sub(W[o1], v));
      const w = unit(sub(W[o2], v));
      const c1 = {
        x: v.x + u.x * RIGHT_MARK_LEG,
        y: v.y + u.y * RIGHT_MARK_LEG,
      };
      const c2 = {
        x: c1.x + w.x * RIGHT_MARK_LEG,
        y: c1.y + w.y * RIGHT_MARK_LEG,
      };
      const c3 = {
        x: v.x + w.x * RIGHT_MARK_LEG,
        y: v.y + w.y * RIGHT_MARK_LEG,
      };
      bld.polyline(
        [
          [c1.x, c1.y],
          [c2.x, c2.y],
          [c3.x, c3.y],
        ],
        { fill: 'none', stroke: COLORS.ink, 'stroke-width': STROKE.axis },
      );
    }

    // --- Angle labels (interior bisector; radius grows for wide labels, ----
    // --- side labels, and any adjacent side the box would clip) -----------
    for (const al of p.angleLabels) {
      const n = al.vertex;
      const [o1, o2] = OTHERS[n];
      const v = W[n];
      const bis = bisectorDir(v, W[o1], W[o2]);
      const halfW = approxTextWidth(al.text, FONT.size) / 2;
      // Start at the fixed radius or beyond the label's own half-width —
      // a wide label ("(2x + 15)°") centered too close to the vertex
      // necessarily spills over the adjacent sides.
      let r = Math.max(ANGLE_LABEL_RADIUS, halfW + 8);
      while (r < ANGLE_RADIUS_MAX) {
        const probe = offsetPoint(v, bis, r);
        const box = labelBox(probe.x, probe.y, al.text, FONT.size);
        const clipsSide =
          segCrossesBox(v, W[o1], box) || segCrossesBox(v, W[o2], box);
        if (!sideBoxes.some((sb) => boxesOverlap(box, sb)) && !clipsSide) break;
        r += ANGLE_RADIUS_STEP;
      }
      // ... then keep the label inside the triangle: the bisector meets the
      // opposite side at >= pointSegDistance(v, opposite side), so 0.7x that
      // distance is safely interior (with a 20px floor for legibility).
      const dOpp = pointSegDistance(v, W[o1], W[o2]);
      r = Math.min(r, Math.max(20, 0.7 * dOpp));
      const pos = offsetPoint(v, bis, r);
      bld.text(pos.x, pos.y + 4, al.text, {
        anchor: 'middle',
        family: FONT.familyMath,
        italic: true,
      });
    }

    // --- Vertex names (schema default: shown) ------------------------------
    if (p.showVertexNames !== false) {
      const g: Pt = {
        x: (W.A.x + W.B.x + W.C.x) / 3,
        y: (W.A.y + W.B.y + W.C.y) / 3,
      };
      for (const n of VERTEX_ORDER) {
        const pos = offsetPoint(W[n], sub(W[n], g), VERTEX_LABEL_OFFSET);
        bld.text(pos.x, pos.y + 4, n, {
          anchor: 'middle',
          family: FONT.familyMath,
          italic: true,
        });
      }
    }

    bld.end();
    return bld.toString();
  },
};

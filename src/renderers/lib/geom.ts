/**
 * Pure 2-D geometry helpers for the geometry-diagram renderers
 * (triangle-labeled, circle-features, parallel-lines-transversal).
 *
 * Everything here is deterministic: plain arithmetic on {x, y} points, no
 * randomness, no locale, no clock. Angles are degrees unless a name says
 * radians; "math orientation" means y-up (renderers flip y themselves when
 * mapping to SVG pixels, which preserves angles and ratios).
 */

export interface Pt {
  x: number;
  y: number;
}

export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Point at radius `r` and `angleDeg` (counterclockwise from +x) around `center`. */
export function polar(center: Pt, r: number, angleDeg: number): Pt {
  const t = deg2rad(angleDeg);
  return { x: center.x + r * Math.cos(t), y: center.y + r * Math.sin(t) };
}

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(p: Pt, k: number): Pt {
  return { x: p.x * k, y: p.y * k };
}

export function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Length (magnitude) of the vector `p`. */
export function len(p: Pt): number {
  return Math.hypot(p.x, p.y);
}

/** `p` normalized to length 1; throws on the zero vector (degenerate input). */
export function unit(p: Pt): Pt {
  const l = len(p);
  if (l < 1e-12) throw new RangeError('unit(): zero-length vector has no direction');
  return { x: p.x / l, y: p.y / l };
}

/**
 * Both perpendiculars of `p`: `left` is the +90° rotation (-y, x) and
 * `right` the -90° rotation (y, -x), in the coordinate system `p` lives in.
 */
export function normals(p: Pt): { left: Pt; right: Pt } {
  return { left: { x: -p.y, y: p.x }, right: { x: p.y, y: -p.x } };
}

/**
 * Intersection of the infinite lines through p1-p2 and p3-p4, or null when
 * the lines are parallel (or coincident — no unique intersection).
 */
export function lineIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d1 = sub(p2, p1);
  const d2 = sub(p4, p3);
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p3.x - p1.x) * d2.y - (p3.y - p1.y) * d2.x) / den;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

/** Distance from point `p` to the finite segment a-b. */
export function pointSegDistance(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return len(sub(p, a));
  const tRaw = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
  const t = Math.min(1, Math.max(0, tRaw));
  return len(sub(p, { x: a.x + t * ab.x, y: a.y + t * ab.y }));
}

/**
 * Interior angle (degrees, in [0, 180]) at vertex `b` of the path a-b-c:
 * the angle between the rays b->a and b->c. For a triangle a-b-c (in any
 * vertex order) this is the interior angle at b.
 */
export function angleAtVertex(a: Pt, b: Pt, c: Pt): number {
  const u = unit(sub(a, b));
  const v = unit(sub(c, b));
  const d = Math.min(1, Math.max(-1, u.x * v.x + u.y * v.y));
  return rad2deg(Math.acos(d));
}

/**
 * Unit vector from vertex `v` along the bisector of the angle p-v-q, i.e.
 * pointing into the angle's interior. Symmetric in p and q.
 */
export function bisectorDir(v: Pt, p: Pt, q: Pt): Pt {
  return unit(add(unit(sub(p, v)), unit(sub(q, v))));
}

/** `pt` moved `dist` along the direction of `dir` (`dir` need not be unit). */
export function offsetPoint(pt: Pt, dir: Pt, dist: number): Pt {
  const u = unit(dir);
  return { x: pt.x + u.x * dist, y: pt.y + u.y * dist };
}

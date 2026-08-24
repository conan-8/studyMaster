/**
 * Renderer: sat-math:circle-features (CircleFeatures).
 *
 * A circle constructed only from center + radius + feature angles: every
 * feature is DERIVED geometry (a diameter is the segment through the center
 * at angleDegrees; a tangent is perpendicular to the radius at its foot),
 * so labeled lengths can never conflict with the drawing. The figure lives
 * in the fixed [0, 12] x [0, 12] frame the schema bounds describe (center
 * in [4, 8]^2, radius <= 4), mapped to the canvas by one UNIFORM scale with
 * y flipped (math orientation) — the center parameter therefore places the
 * circle in the frame. Labels sit exactly at feature angles (the schema
 * guarantees >= 20° separation, validated here) and are clamped inside the
 * canvas. No axes are drawn.
 *
 * Params notes: `centerLabel` is optional with no schema default; when the
 * key is absent the renderer treats it as null (label hidden), matching the
 * documented "null hides it". `sweepDegrees` is required (non-null) for
 * central_angle — enforced here with a jsonPath-style error — and ignored
 * for every other type, exactly as the schema states. Because the schema
 * parameterizes each non-central_angle feature by its single placement
 * angle, a chord's two circle points are drawn at angleDegrees ± 40° (a
 * fixed, documented 80° arc span, clearly shorter than a diameter): the
 * placement angle bisects the chord's arc.
 * Schema: database/diagrams/sat-math:circle-features.json
 */

import { assertValidParams, loadDiagramArchetype } from './lib/diagram.js';
import { clipSegment } from './lib/plot.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import { polar, type Pt } from './lib/geom.js';
import type { Renderer } from './types.js';

type FeatureType = 'radius' | 'diameter' | 'chord' | 'tangent' | 'central_angle';

interface Feature {
  type: FeatureType;
  angleDegrees: number;
  sweepDegrees?: number | null;
  label: string;
}

interface CircleFeaturesParams {
  center: { x: number; y: number };
  radius: number;
  features: Feature[];
  centerLabel?: string | null;
  showCenterDot: boolean;
}

const CANVAS = { width: 360, height: 320 } as const;
/** The fixed figure frame the schema's bounds imply: [0, 12] x [0, 12]. */
const FRAME_MAX = 12;
const PAD = 26;
/** Fixed half-arc-span of a chord (see file header). */
const CHORD_HALF_SPAN = 40;
/** Perpendicular label offset for radius/diameter/chord labels (px). */
const LABEL_OFFSET = 13;
/** Radial offset for a tangent's label, outside the rim (px). */
const TANGENT_LABEL_OFFSET = 17;
/** Central-angle arc radius as a fraction of the circle's px radius. */
const CENTRAL_ARC_FRACTION = 0.82;
/** Gap between the central-angle arc and its degree label (px). */
const CENTRAL_LABEL_GAP = 15;
/** Tangent segment half-length as a fraction of the circle's px radius. */
const TANGENT_HALF_FRACTION = 0.9;
/** Minimum angular separation between two features' circle points (deg). */
const MIN_SEPARATION_DEG = 20;

/** Smallest angular distance between two angles on a circle (deg, in [0, 180]). */
function angularSeparation(aDeg: number, bDeg: number): number {
  const d = Math.abs(((aDeg - bDeg) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

/**
 * Circle points (angles in degrees) where a feature touches the
 * circumference — the anchors the >= 20° separation guarantee applies to.
 */
function anchorsOf(f: Feature): number[] {
  switch (f.type) {
    case 'radius':
    case 'tangent':
      return [f.angleDegrees];
    case 'diameter':
      return [f.angleDegrees, f.angleDegrees + 180];
    case 'chord':
      return [f.angleDegrees - CHORD_HALF_SPAN, f.angleDegrees + CHORD_HALF_SPAN];
    case 'central_angle':
      return [f.angleDegrees, f.angleDegrees + (f.sweepDegrees ?? 0)];
  }
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:circle-features',
  rendererRef: 'CircleFeatures',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:circle-features', params);
    const p = params as unknown as CircleFeaturesParams;

    // --- Cross-field validation promised by the schema notes --------------
    for (let i = 0; i < p.features.length; i++) {
      const f = p.features[i]!;
      if (f.type === 'central_angle' && typeof f.sweepDegrees !== 'number') {
        throw new Error(
          `features/${i}/sweepDegrees: required when type is 'central_angle'`,
        );
      }
    }
    for (let i = 0; i < p.features.length; i++) {
      for (let j = i + 1; j < p.features.length; j++) {
        const fi = p.features[i]!;
        const fj = p.features[j]!;
        for (const ai of anchorsOf(fi)) {
          for (const aj of anchorsOf(fj)) {
            const sep = angularSeparation(ai, aj);
            if (sep < MIN_SEPARATION_DEG - 1e-9) {
              throw new Error(
                `features/${j}/angleDegrees: feature ${j} (${fj.type}) is only ` +
                  `${fmt(sep)}° from feature ${i} (${fi.type}) at the circumference ` +
                  `(minimum ${MIN_SEPARATION_DEG}°)`,
              );
            }
          }
        }
      }
    }

    // --- Uniform mapping of the fixed [0, 12]^2 frame (y up -> y down) ----
    const side = Math.min(CANVAS.width, CANVAS.height) - 2 * PAD;
    const s = side / FRAME_MAX;
    const ox = (CANVAS.width - side) / 2;
    const oy = (CANVAS.height - side) / 2;
    const map = (x: number, y: number): Pt => ({
      x: ox + x * s,
      y: oy + (FRAME_MAX - y) * s,
    });

    const c = map(p.center.x, p.center.y);
    const rPx = p.radius * s;

    /** Circle point at math angle `aDeg`, `rho` px from the center. */
    const onCircle = (aDeg: number, rho: number): Pt => {
      // Math angle a with y flipped == polar at -a in screen coordinates.
      return polar(c, rho, -aDeg);
    };
    /** Unit radial direction at math angle `aDeg`, in screen px. */
    const radialDir = (aDeg: number): Pt => {
      const q = onCircle(aDeg, 1);
      return { x: q.x - c.x, y: q.y - c.y };
    };
    /** Unit direction perpendicular to the radius at `aDeg`, in screen px. */
    const tangentDir = (aDeg: number): Pt => {
      const u = radialDir(aDeg);
      return { x: -u.y, y: u.x };
    };
    /** Clamp a label anchor so its text stays inside the canvas. */
    const clampLabel = (pos: Pt, text: string): Pt => {
      const w = approxTextWidth(text, FONT.size);
      return {
        x: Math.min(Math.max(pos.x, 10 + w / 2), CANVAS.width - 10 - w / 2),
        y: Math.min(Math.max(pos.y, 18), CANVAS.height - 12),
      };
    };

    // --- Accessibility -----------------------------------------------------
    const arch = loadDiagramArchetype('sat-math:circle-features');
    const featureDesc = p.features
      .map((f) => {
        if (f.type === 'central_angle') {
          return `central angle of ${fmt(f.sweepDegrees ?? 0)}° starting at ${fmt(f.angleDegrees)}°`;
        }
        return `${f.type.replace('_', ' ')} at ${fmt(f.angleDegrees)}°`;
      })
      .join(', ');
    const bld = new SvgBuilder({
      width: CANVAS.width,
      height: CANVAS.height,
      title: arch.title,
      desc:
        `Circle centered at (${fmt(p.center.x)}, ${fmt(p.center.y)}) with radius ` +
        `${fmt(p.radius)}; features: ${featureDesc}.`,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    const lineAttrs = { stroke: COLORS.ink, 'stroke-width': STROKE.line };
    const serifItalic = {
      anchor: 'middle' as const,
      family: FONT.familyMath,
      italic: true,
    };

    // --- Circle + center ---------------------------------------------------
    bld.circle(c.x, c.y, rPx, { fill: 'none', stroke: COLORS.ink, 'stroke-width': STROKE.line });
    if (p.showCenterDot) {
      bld.circle(c.x, c.y, 3, { fill: COLORS.ink });
    }
    const cLabel = p.centerLabel ?? null;
    if (cLabel !== null && cLabel !== '') {
      const pos = clampLabel({ x: c.x, y: c.y - (p.showCenterDot ? 10 : 0) }, cLabel);
      bld.text(pos.x, pos.y + 4, cLabel, serifItalic);
    }

    // --- Features ----------------------------------------------------------
    for (const f of p.features) {
      const a = f.angleDegrees;
      switch (f.type) {
        case 'radius': {
          const foot = onCircle(a, rPx);
          bld.line(c.x, c.y, foot.x, foot.y, lineAttrs);
          const m = { x: (c.x + foot.x) / 2, y: (c.y + foot.y) / 2 };
          const n = tangentDir(a); // fixed perpendicular side: deterministic
          const pos = clampLabel(
            { x: m.x + n.x * LABEL_OFFSET, y: m.y + n.y * LABEL_OFFSET },
            f.label,
          );
          bld.text(pos.x, pos.y + 4, f.label, serifItalic);
          break;
        }
        case 'diameter': {
          const pA = onCircle(a, rPx);
          const pB = onCircle(a + 180, rPx);
          bld.line(pA.x, pA.y, pB.x, pB.y, lineAttrs);
          // Label beside the half on the angleDegrees side (the midpoint
          // itself is the center, which carries the center dot/label).
          const q = { x: (c.x + pA.x) / 2, y: (c.y + pA.y) / 2 };
          const n = tangentDir(a);
          const pos = clampLabel(
            { x: q.x + n.x * LABEL_OFFSET, y: q.y + n.y * LABEL_OFFSET },
            f.label,
          );
          bld.text(pos.x, pos.y + 4, f.label, serifItalic);
          break;
        }
        case 'chord': {
          const pA = onCircle(a - CHORD_HALF_SPAN, rPx);
          const pB = onCircle(a + CHORD_HALF_SPAN, rPx);
          bld.line(pA.x, pA.y, pB.x, pB.y, lineAttrs);
          const m = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
          // Offset outward (toward the rim, away from the center).
          const out = { x: m.x - c.x, y: m.y - c.y };
          const ol = Math.hypot(out.x, out.y) || 1;
          const pos = clampLabel(
            {
              x: m.x + (out.x / ol) * LABEL_OFFSET,
              y: m.y + (out.y / ol) * LABEL_OFFSET,
            },
            f.label,
          );
          bld.text(pos.x, pos.y + 4, f.label, serifItalic);
          break;
        }
        case 'tangent': {
          const foot = onCircle(a, rPx);
          const t = tangentDir(a);
          const half = TANGENT_HALF_FRACTION * rPx;
          const raw: [number, number, number, number] = [
            foot.x - t.x * half,
            foot.y - t.y * half,
            foot.x + t.x * half,
            foot.y + t.y * half,
          ];
          const clipped = clipSegment(raw[0], raw[1], raw[2], raw[3], {
            x0: 12,
            y0: 12,
            x1: CANVAS.width - 12,
            y1: CANVAS.height - 12,
          });
          if (clipped !== null) {
            bld.line(clipped[0], clipped[1], clipped[2], clipped[3], lineAttrs);
          }
          const u = radialDir(a);
          const pos = clampLabel(
            { x: foot.x + u.x * TANGENT_LABEL_OFFSET, y: foot.y + u.y * TANGENT_LABEL_OFFSET },
            f.label,
          );
          bld.text(pos.x, pos.y + 4, f.label, serifItalic);
          break;
        }
        case 'central_angle': {
          const sweep = f.sweepDegrees ?? 0;
          const a2 = a + sweep;
          const pA = onCircle(a, rPx);
          const pB = onCircle(a2, rPx);
          bld.line(c.x, c.y, pA.x, pA.y, lineAttrs);
          bld.line(c.x, c.y, pB.x, pB.y, lineAttrs);
          // Arc between the radii, near the rim. Sweep <= 180 (schema), and
          // increasing math angle is visually counterclockwise here, which
          // in y-down screen coordinates is the sweep-flag 0 direction.
          const arcR = CENTRAL_ARC_FRACTION * rPx;
          const qA = onCircle(a, arcR);
          const qB = onCircle(a2, arcR);
          const largeArc = sweep >= 180 ? 1 : 0;
          bld.path(
            `M ${fmt(qA.x)} ${fmt(qA.y)} A ${fmt(arcR)} ${fmt(arcR)} 0 ${largeArc} 0 ${fmt(qB.x)} ${fmt(qB.y)}`,
            { fill: 'none', stroke: COLORS.ink, 'stroke-width': STROKE.axis },
          );
          // Degree label on the bisector, just outside the arc.
          const bisAngle = a + sweep / 2;
          const u = radialDir(bisAngle);
          const pos = clampLabel(
            { x: c.x + u.x * (arcR + CENTRAL_LABEL_GAP), y: c.y + u.y * (arcR + CENTRAL_LABEL_GAP) },
            f.label,
          );
          bld.text(pos.x, pos.y + 4, f.label, serifItalic);
          break;
        }
      }
    }

    bld.end();
    return bld.toString();
  },
};

// The arc path in the central_angle case uses fmt() on every coordinate and
// a fixed flag order ("0 <largeArc> 0"), keeping path output byte-stable.

/**
 * Deterministic text metrics for label collision avoidance.
 *
 * No DOM is available (renderers emit strings), so text width is estimated
 * from per-character classes approximating Helvetica metrics. The estimate
 * only needs to be stable and roughly right — it powers offsets and clamps,
 * never final geometry that must match a reference rendering.
 */

import { escapeText, fmt } from './svg.js';

/** Narrow lowercase/diacritics + punctuation, ~0.30em. */
const NARROW = new Set(['i', 'l', 'j', 't', 'f', 'r', '.', ',', "'", ':', ';', '!', ' ']);
/** Wide glyphs, ~0.85em. */
const WIDE = new Set(['m', 'w', 'M', 'W', '@']);

/**
 * Estimated rendered width of `str` at font size `size` (px), by character
 * class: narrow ~0.30em, wide ~0.85em, other uppercase ~0.68em, digits
 * ~0.56em, everything else ~0.54em.
 */
export function approxTextWidth(str: string, size = 13): number {
  let em = 0;
  for (const ch of str) {
    if (NARROW.has(ch)) em += 0.3;
    else if (WIDE.has(ch)) em += 0.85;
    else if (ch >= 'A' && ch <= 'Z') em += 0.68;
    else if (ch >= '0' && ch <= '9') em += 0.56;
    else em += 0.54;
  }
  return em * size;
}

export { escapeText };

/** Format a coefficient for equation text: integers plain, else 2-decimal. */
function num(n: number): string {
  return fmt(n);
}

/**
 * Human-readable "y = mx + b" with sign handling and suppressed 1/-1/0
 * coefficients, e.g. "y = -x + 4", "y = 0.5x - 1.5", "y = 3".
 */
export function linearEquation(m: number, b: number): string {
  let lhs = 'y = ';
  if (m === 0) {
    lhs += num(b);
    return lhs;
  }
  lhs += m === 1 ? 'x' : m === -1 ? '-x' : `${num(m)}x`;
  if (b === 0) return lhs;
  lhs += b > 0 ? ` + ${num(b)}` : ` - ${num(-b)}`;
  return lhs;
}

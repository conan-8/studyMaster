/**
 * Renderer contract for diagram archetypes.
 *
 * Renderers are DETERMINISTIC: the same params must always produce a
 * byte-identical SVG document string (no clock, no randomness, no locale).
 * Each renderer is paired 1:1 with a database/diagrams/<archetypeId>.json
 * archetype whose paramsSchema is the single source of truth for params.
 */

export interface Renderer {
  /** Archetype id, e.g. 'sat-math:graph-line'. */
  archetypeId: string;
  /** Must equal the archetype's rendererRef, e.g. 'GraphLine'. */
  rendererRef: string;
  /** Render a full standalone SVG document string from validated params. */
  render(params: Record<string, unknown>): string;
}

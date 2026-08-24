/**
 * Renderer registry.
 *
 * getRenderer(archetypeId) resolves the renderer for a diagram archetype;
 * render(archetypeId, params) validates + renders in one call. All renderers
 * are deterministic: same params -> byte-identical SVG document string.
 */

import { renderer as barChart } from './bar-chart.js';
import { renderer as boxPlot } from './box-plot.js';
import { renderer as circleFeatures } from './circle-features.js';
import { renderer as dotPlot } from './dot-plot.js';
import { renderer as graphFunction } from './graph-function.js';
import { renderer as graphLine } from './graph-line.js';
import { renderer as graphSystemTwoLines } from './graph-system-two-lines.js';
import { renderer as histogram } from './histogram.js';
import { renderer as parallelLinesTransversal } from './parallel-lines-transversal.js';
import { renderer as scatterplot } from './scatterplot.js';
import { renderer as tableData } from './table-data.js';
import { renderer as tableTwoWay } from './table-two-way.js';
import { renderer as triangleLabeled } from './triangle-labeled.js';
import { loadDiagramArchetype } from './lib/diagram.js';
import type { Renderer } from './types.js';

const REGISTRY: Readonly<Record<string, Renderer>> = {
  [barChart.archetypeId]: barChart,
  [boxPlot.archetypeId]: boxPlot,
  [circleFeatures.archetypeId]: circleFeatures,
  [dotPlot.archetypeId]: dotPlot,
  [graphFunction.archetypeId]: graphFunction,
  [graphLine.archetypeId]: graphLine,
  [graphSystemTwoLines.archetypeId]: graphSystemTwoLines,
  [histogram.archetypeId]: histogram,
  [parallelLinesTransversal.archetypeId]: parallelLinesTransversal,
  [scatterplot.archetypeId]: scatterplot,
  [tableData.archetypeId]: tableData,
  [tableTwoWay.archetypeId]: tableTwoWay,
  [triangleLabeled.archetypeId]: triangleLabeled,
};

/** Every archetype id with a registered renderer, sorted. */
export function registeredArchetypeIds(): string[] {
  return Object.keys(REGISTRY).sort();
}

export function getRenderer(archetypeId: string): Renderer {
  const r = REGISTRY[archetypeId];
  if (r !== undefined) return r;
  // loadDiagramArchetype throws cleanly on unknown ids (list of known ids);
  // reaching the second throw means a database archetype lacks a renderer.
  loadDiagramArchetype(archetypeId);
  throw new Error(
    `No renderer registered for '${archetypeId}' (rendererRef ` +
      `'${loadDiagramArchetype(archetypeId).rendererRef}') — add it to src/renderers/index.ts`,
  );
}

export function render(archetypeId: string, params: Record<string, unknown>): string {
  return getRenderer(archetypeId).render(params);
}

export type { Renderer } from './types.js';

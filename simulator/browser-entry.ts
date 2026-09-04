/**
 * Browser bundle entry — pre-registers every diagram archetype (esbuild
 * bundles these JSON imports inline) so the renderers never touch the
 * filesystem, then re-exports the public renderer API.
 *
 * Build: npm run build:sim  ->  bluebook-mockup/public/renderers.js (IIFE,
 * global CramduckRenderers). Usage in the simulator HTML:
 *   const svg = CramduckRenderers.render('sat-math:graph-line', params);
 */

import { registerDiagramArchetypes } from '../src/renderers/lib/diagram.js';
import type { DiagramArchetype } from '../src/renderers/lib/diagram.js';

import barChart from '../database/diagrams/sat-math:bar-chart.json';
import boxPlot from '../database/diagrams/sat-math:box-plot.json';
import circleFeatures from '../database/diagrams/sat-math:circle-features.json';
import dotPlot from '../database/diagrams/sat-math:dot-plot.json';
import graphFunction from '../database/diagrams/sat-math:graph-function.json';
import graphLine from '../database/diagrams/sat-math:graph-line.json';
import graphSystemTwoLines from '../database/diagrams/sat-math:graph-system-two-lines.json';
import histogram from '../database/diagrams/sat-math:histogram.json';
import parallelLinesTransversal from '../database/diagrams/sat-math:parallel-lines-transversal.json';
import scatterplot from '../database/diagrams/sat-math:scatterplot.json';
import tableData from '../database/diagrams/sat-math:table-data.json';
import tableTwoWay from '../database/diagrams/sat-math:table-two-way.json';
import triangleLabeled from '../database/diagrams/sat-math:triangle-labeled.json';

registerDiagramArchetypes([
  barChart,
  boxPlot,
  circleFeatures,
  dotPlot,
  graphFunction,
  graphLine,
  graphSystemTwoLines,
  histogram,
  parallelLinesTransversal,
  scatterplot,
  tableData,
  tableTwoWay,
  triangleLabeled,
] as DiagramArchetype[]);

export { render, getRenderer, registeredArchetypeIds } from '../src/renderers/index.js';

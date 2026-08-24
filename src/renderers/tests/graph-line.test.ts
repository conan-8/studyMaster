import { renderer } from '../graph-line.js';
import { GOLDEN_GRAPH_LINE as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// slope/yIntercept change the line; xRange the grid; markedPoints the dots;
// the omitted defaults (xAxisLabel 'x', yAxisLabel 'y', showIntercepts false)
// are toggled on here to prove they are honored.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:graph-line',
  golden,
  coverage: [
    { key: 'slope', params: { ...golden, slope: -1, markedPoints: [] } },
    { key: 'yIntercept', params: { ...golden, yIntercept: 3, markedPoints: [] } },
    { key: 'xRange', params: { ...golden, xRange: { min: -8, max: 8 } } },
    {
      key: 'markedPoints',
      params: { ...golden, markedPoints: [{ x: 0, y: -1, label: 'R' }] },
    },
    { key: 'xAxisLabel', params: { ...golden, xAxisLabel: 't' } },
    { key: 'yAxisLabel', params: { ...golden, yAxisLabel: 'q' } },
    { key: 'showIntercepts', params: { ...golden, showIntercepts: true } },
  ],
  invalid: [
    {
      label: 'missing required slope',
      params: { yIntercept: -1, xRange: { min: -5, max: 5 }, markedPoints: [] },
      match: 'slope',
    },
    {
      label: 'slope out of bounds',
      params: { ...golden, slope: 7 },
      match: '/slope',
    },
  ],
});

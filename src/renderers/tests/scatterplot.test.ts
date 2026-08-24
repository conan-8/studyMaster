import { renderer } from '../scatterplot.js';
import { GOLDEN_SCATTERPLOT as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// xAxisLabel/yAxisLabel have no schema default — omitted from golden, set here
// (SAT data-figure axis titles appear only when authored).
runRendererSuite(renderer, {
  archetypeId: 'sat-math:scatterplot',
  golden,
  coverage: [
    {
      key: 'points',
      params: {
        ...golden,
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
          { x: 5, y: 6 },
          { x: 7, y: 5 },
          { x: 9, y: 9 },
        ],
      },
    },
    { key: 'gridExtent', params: { ...golden, gridExtent: { xMax: 14, yMax: 14 } } },
    {
      key: 'lineOfBestFit',
      params: { ...golden, lineOfBestFit: { slope: 1, yIntercept: 1, show: true } },
    },
    { key: 'xAxisLabel', params: { ...golden, xAxisLabel: 'Hours studied' } },
    { key: 'yAxisLabel', params: { ...golden, yAxisLabel: 'Quiz score' } },
  ],
  invalid: [
    {
      label: 'too few points',
      params: {
        ...golden,
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
          { x: 5, y: 6 },
          { x: 7, y: 5 },
        ],
      },
      match: '/points',
    },
    {
      label: 'gridExtent beyond the schema maximum',
      params: { ...golden, gridExtent: { xMax: 30, yMax: 12 } },
      match: '/gridExtent/xMax',
    },
  ],
});

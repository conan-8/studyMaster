import { renderer } from '../bar-chart.js';
import { GOLDEN_BAR_CHART as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// yTickStep is omitted from golden (renderer picks a clean step); setting it
// here overrides. xAxisLabel defaults to no title; showValues is required.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:bar-chart',
  golden,
  coverage: [
    {
      key: 'categories',
      params: {
        ...golden,
        categories: [
          { label: 'Club A', value: 12 },
          { label: 'Club B', value: 25 },
          { label: 'Club C', value: 15 },
        ],
      },
    },
    { key: 'yAxisMax', params: { ...golden, yAxisMax: 50 } },
    { key: 'yTickStep', params: { ...golden, yTickStep: 5 } }, // auto step is 10
    { key: 'yAxisLabel', params: { ...golden, yAxisLabel: 'Members' } },
    { key: 'xAxisLabel', params: { ...golden, xAxisLabel: 'Club' } },
    { key: 'showValues', params: { ...golden, showValues: false } },
  ],
  invalid: [
    {
      label: 'missing required showValues',
      params: {
        categories: [
          { label: 'A', value: 10 },
          { label: 'B', value: 20 },
        ],
        yAxisMax: 30,
        yAxisLabel: 'Students',
      },
      match: 'showValues',
    },
    {
      label: 'yAxisMax out of bounds (zero is excluded)',
      params: { ...golden, yAxisMax: 0 },
      match: '/yAxisMax',
    },
  ],
});

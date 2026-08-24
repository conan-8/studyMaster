import { renderer } from '../box-plot.js';
import { GOLDEN_BOX_PLOT as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// tickStep omitted from golden (clean auto step); showValues set true in
// golden so the false variant proves the labels disappear.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:box-plot',
  golden,
  coverage: [
    {
      key: 'fiveNumberSummary',
      params: { ...golden, fiveNumberSummary: { min: 2, q1: 5, median: 9, q3: 12, max: 16 } },
    },
    { key: 'axisMin', params: { ...golden, axisMin: -4 } },
    { key: 'axisMax', params: { ...golden, axisMax: 24 } },
    { key: 'axisLabel', params: { ...golden, axisLabel: 'Points' } },
    { key: 'tickStep', params: { ...golden, tickStep: 2 } }, // auto step is 5
    { key: 'showValues', params: { ...golden, showValues: false } },
  ],
  invalid: [
    {
      label: 'missing required axisLabel',
      params: {
        fiveNumberSummary: { min: 2, q1: 5, median: 8, q3: 12, max: 16 },
        axisMin: 0,
        axisMax: 20,
      },
      match: 'axisLabel',
    },
    {
      label: 'axisMax beyond the schema maximum',
      params: { ...golden, axisMax: 60 },
      match: '/axisMax',
    },
  ],
});

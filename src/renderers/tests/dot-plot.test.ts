import { renderer } from '../dot-plot.js';
import { GOLDEN_DOT_PLOT as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// tickStep omitted from golden (renderer picks the coarsest clean step: 2);
// markMedian defaults false and is toggled on here.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:dot-plot',
  golden,
  coverage: [
    {
      key: 'entries',
      params: {
        ...golden,
        entries: [
          { value: 2, count: 3 },
          { value: 4, count: 2 },
          { value: 6, count: 5 },
          { value: 8, count: 1 },
        ],
      },
    },
    { key: 'axisLabel', params: { ...golden, axisLabel: 'Movies watched' } },
    { key: 'tickStep', params: { ...golden, tickStep: 1 } },
    { key: 'markMean', params: { ...golden, markMean: false } },
    { key: 'markMedian', params: { ...golden, markMedian: true } },
  ],
  invalid: [
    {
      label: 'too few entries',
      params: { ...golden, entries: [{ value: 2, count: 3 }, { value: 4, count: 2 }] },
      match: '/entries',
    },
    {
      label: 'entry value out of bounds',
      params: {
        ...golden,
        entries: [
          { value: 2, count: 3 },
          { value: 4, count: 2 },
          { value: 25, count: 4 },
        ],
      },
      match: '/entries/2/value',
    },
  ],
});

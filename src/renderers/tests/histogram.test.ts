import { renderer } from '../histogram.js';
import { GOLDEN_HISTOGRAM as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// yAxisLabel ('Frequency'), binEdgesAreIntegers (true) and
// showFrequencyLabels (false) all carry schema defaults exercised by their
// omission in golden.
//
// FINDING (documented, not a bug): binEdgesAreIntegers is a VALIDATION-ONLY
// gate — with integer binStart/binWidth, toggling it cannot change the
// drawing; its effect is on which param sets are accepted. Coverage is
// therefore demonstrated behaviorally: { binStart: 2.5,
// binEdgesAreIntegers: false } renders (and differs from golden), whereas the
// same params with binEdgesAreIntegers: true throw — asserted below.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:histogram',
  golden,
  coverage: [
    { key: 'binStart', params: { ...golden, binStart: 5 } },
    { key: 'binWidth', params: { ...golden, binWidth: 5 } },
    { key: 'frequencies', params: { ...golden, frequencies: [3, 7, 12, 5, 4] } },
    { key: 'xAxisLabel', params: { ...golden, xAxisLabel: 'Weight (kg)' } },
    { key: 'yAxisLabel', params: { ...golden, yAxisLabel: 'Count' } },
    { key: 'binEdgesAreIntegers', params: { ...golden, binStart: 2.5, binEdgesAreIntegers: false } },
    { key: 'showFrequencyLabels', params: { ...golden, showFrequencyLabels: true } },
  ],
  invalid: [
    {
      label: 'binWidth of zero (exclusiveMinimum)',
      params: { ...golden, binWidth: 0 },
      match: '/binWidth',
    },
    {
      label: 'missing required frequencies',
      params: { binStart: 0, binWidth: 10, xAxisLabel: 'Height (cm)' },
      match: 'frequencies',
    },
    {
      label: 'non-integer edges rejected when binEdgesAreIntegers is true',
      params: { ...golden, binStart: 2.5 },
      match: '/binStart',
    },
  ],
});

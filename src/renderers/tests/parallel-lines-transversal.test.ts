import { renderer } from '../parallel-lines-transversal.js';
import { GOLDEN_PARALLEL_LINES_TRANSVERSAL as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// showParallelMarks/showAngleNumbers (default true) are omitted from golden;
// the false variants remove the chevrons and the 1-8 numerals. The givenAngle
// measure text REPLACES the numeral at its position.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:parallel-lines-transversal',
  golden,
  coverage: [
    { key: 'transversalAngleDegrees', params: { ...golden, transversalAngleDegrees: 75 } },
    { key: 'givenAngle', params: { ...golden, givenAngle: { position: 5, measureText: '60°' } } },
    { key: 'highlightAngles', params: { ...golden, highlightAngles: [2] } },
    {
      key: 'lineLabels',
      params: { ...golden, lineLabels: { top: 'p', bottom: 'q', transversal: 't' } },
    },
    { key: 'showParallelMarks', params: { ...golden, showParallelMarks: false } },
    { key: 'showAngleNumbers', params: { ...golden, showAngleNumbers: false } },
  ],
  invalid: [
    {
      label: 'missing required lineLabels',
      params: {
        transversalAngleDegrees: 60,
        givenAngle: null,
        highlightAngles: [],
      },
      match: 'lineLabels',
    },
    {
      label: 'transversalAngleDegrees out of bounds',
      params: { ...golden, transversalAngleDegrees: 200 },
      match: '/transversalAngleDegrees',
    },
  ],
});

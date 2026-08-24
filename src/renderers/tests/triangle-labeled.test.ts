import { renderer } from '../triangle-labeled.js';
import { GOLDEN_TRIANGLE_LABELED as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// showVertexNames (default true) is omitted from golden; the vertices variant
// stretches AB while keeping the exact 90° angle at A that rightAngleAt
// requires (renderer validates ±0.5°).
runRendererSuite(renderer, {
  archetypeId: 'sat-math:triangle-labeled',
  golden,
  coverage: [
    {
      key: 'vertices',
      params: {
        ...golden,
        vertices: { A: { x: 0, y: 0 }, B: { x: 8, y: 0 }, C: { x: 0, y: 4 } },
        sideLabels: [
          { side: 'AB', text: '8' },
          { side: 'CA', text: '4' },
        ],
      },
    },
    {
      key: 'sideLabels',
      params: { ...golden, sideLabels: [{ side: 'AB', text: '6' }] },
    },
    {
      key: 'angleLabels',
      params: {
        ...golden,
        angleLabels: [
          { vertex: 'B', text: 'x°' },
          { vertex: 'C', text: 'y°' },
        ],
      },
    },
    { key: 'rightAngleAt', params: { ...golden, rightAngleAt: null } },
    { key: 'showVertexNames', params: { ...golden, showVertexNames: false } },
  ],
  invalid: [
    {
      label: 'missing required vertices',
      params: { sideLabels: [], angleLabels: [], rightAngleAt: null },
      match: 'vertices',
    },
    {
      label: 'rightAngleAt outside the enum',
      params: { ...golden, rightAngleAt: 'D' },
      match: '/rightAngleAt',
    },
  ],
});

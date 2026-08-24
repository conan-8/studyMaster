import { renderer } from '../circle-features.js';
import { GOLDEN_CIRCLE_FEATURES as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// Feature anchors must stay >= 20° apart at the circumference (renderer
// validates). centerLabel has no schema default — the null variant hides it.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:circle-features',
  golden,
  coverage: [
    { key: 'center', params: { ...golden, center: { x: 5, y: 7 } } },
    { key: 'radius', params: { ...golden, radius: 2.5 } },
    {
      key: 'features',
      params: {
        ...golden,
        features: [
          { type: 'radius', angleDegrees: 30, label: 'r' },
          { type: 'tangent', angleDegrees: 150, label: 't' },
          { type: 'central_angle', angleDegrees: 250, sweepDegrees: 60, label: '60°' },
        ],
      },
    },
    { key: 'centerLabel', params: { ...golden, centerLabel: null } },
    { key: 'showCenterDot', params: { ...golden, showCenterDot: false } },
  ],
  invalid: [
    {
      label: 'missing required showCenterDot',
      params: {
        center: { x: 6, y: 6 },
        radius: 3,
        features: [{ type: 'radius', angleDegrees: 30, label: 'r' }],
      },
      match: 'showCenterDot',
    },
    {
      label: 'feature type outside the enum',
      params: {
        ...golden,
        features: [{ type: 'arc', angleDegrees: 30, label: 'a' }],
      },
      match: '/features/0/type',
    },
  ],
});

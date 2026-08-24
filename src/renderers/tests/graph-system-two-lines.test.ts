import { renderer } from '../graph-system-two-lines.js';
import { GOLDEN_GRAPH_SYSTEM_TWO_LINES as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// line1/line2 variants keep distinct slopes but drop intersectionIsInteger so
// the non-integer intersections are legal; intersectionIsInteger toggling
// removes the coordinate label; labelLines (default false) adds the line tags.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:graph-system-two-lines',
  golden,
  coverage: [
    {
      key: 'line1',
      params: {
        ...golden,
        line1: { slope: 2, yIntercept: 0, label: 'a' },
        intersectionIsInteger: false,
      },
    },
    {
      key: 'line2',
      params: {
        ...golden,
        line2: { slope: -2, yIntercept: 3, label: 'b' },
        intersectionIsInteger: false,
      },
    },
    { key: 'intersectionIsInteger', params: { ...golden, intersectionIsInteger: false } },
    { key: 'markIntersection', params: { ...golden, markIntersection: false } },
    { key: 'xRange', params: { ...golden, xRange: { min: -6, max: 8 } } },
    { key: 'labelLines', params: { ...golden, labelLines: true } },
  ],
  invalid: [
    {
      label: 'missing required line1',
      params: {
        line2: { slope: -1, yIntercept: 2, label: 'b' },
        intersectionIsInteger: true,
        markIntersection: true,
        xRange: { min: -4, max: 6 },
      },
      match: 'line1',
    },
    {
      label: 'line2 slope out of bounds',
      params: { ...golden, line2: { slope: -7, yIntercept: 2, label: 'b' } },
      match: '/line2/slope',
    },
  ],
});

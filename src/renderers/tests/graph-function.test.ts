import { renderer } from '../graph-function.js';
import { GOLDEN_GRAPH_FUNCTION as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// The coefficient blocks are conditional on functionType (schema allOf), so
// the exponential/absoluteValue coverage cases switch functionType too —
// supplying the block changes the rendered curve relative to golden.
const { quadratic: _q, ...withoutQuadratic } = golden;
void _q;

runRendererSuite(renderer, {
  archetypeId: 'sat-math:graph-function',
  golden,
  coverage: [
    {
      key: 'functionType',
      params: {
        ...withoutQuadratic,
        functionType: 'absolute_value',
        absoluteValue: { a: 1, h: 0, k: -1 },
        markedPoints: [],
      },
    },
    { key: 'quadratic', params: { ...golden, quadratic: { a: 2, b: 0, c: -2 }, markedPoints: [] } },
    {
      key: 'exponential',
      params: {
        functionType: 'exponential',
        exponential: { a: 2, b: 2 },
        xRange: { min: -4, max: 4 },
        markedPoints: [],
      },
    },
    {
      key: 'absoluteValue',
      params: {
        functionType: 'absolute_value',
        absoluteValue: { a: 1, h: 1, k: 0 },
        xRange: { min: -4, max: 4 },
        markedPoints: [],
      },
    },
    { key: 'xRange', params: { ...golden, xRange: { min: -6, max: 6 } } },
    { key: 'markedPoints', params: { ...golden, markedPoints: [{ x: 0, y: -2 }] } },
  ],
  invalid: [
    {
      label: 'functionType outside the enum',
      params: { ...golden, functionType: 'cubic' },
      match: '/functionType',
    },
    {
      label: 'missing required xRange',
      params: { functionType: 'quadratic', quadratic: { a: 1, b: 0, c: -2 }, markedPoints: [] },
      match: 'xRange',
    },
  ],
});

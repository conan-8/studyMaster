/**
 * Golden (canonical valid) params for every diagram archetype.
 *
 * Each entry is hand-built to satisfy the archetype's paramsSchema
 * (database/diagrams/<id>.json) — including every cross-field rule the
 * renderers enforce (marked points on the curve, integer intersections,
 * ordering invariants, integer grid solutions). Optional keys with
 * schema-documented defaults (e.g. showIntercepts, yAxisLabel,
 * showVertexNames) are OMITTED here so the renderers' own default-handling
 * is exercised; the per-renderer param-coverage tests then toggle them on.
 */

export type Params = Record<string, unknown>;

export const GOLDEN_GRAPH_LINE: Params = {
  slope: 2,
  yIntercept: -1,
  xRange: { min: -5, max: 5 },
  markedPoints: [
    { x: 1, y: 1, label: 'P' },
    { x: -2, y: -5, label: 'Q' },
  ],
  // xAxisLabel/yAxisLabel default to 'x'/'y'; showIntercepts defaults false.
};

export const GOLDEN_GRAPH_SYSTEM_TWO_LINES: Params = {
  line1: { slope: 1, yIntercept: 0, label: 'a' },
  line2: { slope: -1, yIntercept: 2, label: 'b' },
  intersectionIsInteger: true, // intersection (1, 1): integer, inside xRange
  markIntersection: true,
  xRange: { min: -4, max: 6 },
  // labelLines defaults false.
};

export const GOLDEN_GRAPH_FUNCTION: Params = {
  functionType: 'quadratic',
  quadratic: { a: 1, b: 0, c: -2 }, // y = x^2 - 2
  xRange: { min: -4, max: 4 },
  markedPoints: [
    { x: 1, y: -1 },
    { x: 2, y: 2 },
  ],
};

export const GOLDEN_SCATTERPLOT: Params = {
  points: [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
    { x: 5, y: 6 },
    { x: 7, y: 5 },
    { x: 9, y: 8 },
  ],
  gridExtent: { xMax: 12, yMax: 12 },
  lineOfBestFit: { slope: 0.5, yIntercept: 2, show: true },
  // xAxisLabel/yAxisLabel: optional, no default — omitted.
};

export const GOLDEN_BAR_CHART: Params = {
  categories: [
    { label: 'Club A', value: 10 },
    { label: 'Club B', value: 25 },
    { label: 'Club C', value: 15 },
  ],
  yAxisMax: 30,
  yAxisLabel: 'Students',
  showValues: true,
  // yTickStep null-ish omitted (renderer picks a clean step); xAxisLabel omitted.
};

export const GOLDEN_BOX_PLOT: Params = {
  fiveNumberSummary: { min: 2, q1: 5, median: 8, q3: 12, max: 16 },
  axisMin: 0,
  axisMax: 20,
  axisLabel: 'Score',
  showValues: true,
  // tickStep omitted (renderer picks a clean step).
};

export const GOLDEN_DOT_PLOT: Params = {
  entries: [
    { value: 2, count: 3 },
    { value: 4, count: 2 },
    { value: 6, count: 4 },
    { value: 8, count: 1 },
  ],
  axisLabel: 'Books read',
  markMean: true,
  // tickStep omitted (coarsest clean step: 2); markMedian defaults false.
};

export const GOLDEN_HISTOGRAM: Params = {
  binStart: 0,
  binWidth: 10,
  frequencies: [3, 7, 12, 5, 2],
  xAxisLabel: 'Height (cm)',
  // yAxisLabel defaults 'Frequency'; binEdgesAreIntegers defaults true;
  // showFrequencyLabels defaults false.
};

export const GOLDEN_TABLE_DATA: Params = {
  title: 'Sales by Month',
  headers: ['Month', 'Sales'],
  rows: [
    ['Jan', 120],
    ['Feb', 150],
    ['Mar', 90],
  ],
  // highlightColumn defaults null-ish (omitted); showRowNumbers defaults false.
};

export const GOLDEN_TABLE_TWO_WAY: Params = {
  tableTitle: 'Juniors vs Seniors',
  rowCategories: ['Junior', 'Senior'],
  columnCategories: ['Passed', 'Failed'],
  cells: [
    [30, 10],
    [25, 15],
  ],
  cornerLabel: 'Class',
  // showTotals defaults true.
};

export const GOLDEN_TRIANGLE_LABELED: Params = {
  vertices: {
    A: { x: 0, y: 0 },
    B: { x: 6, y: 0 },
    C: { x: 0, y: 4 },
  },
  sideLabels: [
    { side: 'AB', text: '6' },
    { side: 'CA', text: '4' },
  ],
  angleLabels: [{ vertex: 'B', text: 'x°' }],
  rightAngleAt: 'A', // geometry is exactly 90° at A
  // showVertexNames defaults true.
};

export const GOLDEN_CIRCLE_FEATURES: Params = {
  center: { x: 6, y: 6 },
  radius: 3,
  features: [
    { type: 'radius', angleDegrees: 30, label: 'r' },
    { type: 'tangent', angleDegrees: 150, label: 't' },
  ],
  centerLabel: 'O',
  showCenterDot: true,
};

export const GOLDEN_PARALLEL_LINES_TRANSVERSAL: Params = {
  transversalAngleDegrees: 60,
  givenAngle: { position: 3, measureText: '120°' },
  highlightAngles: [6, 7],
  lineLabels: { top: 'l', bottom: 'm', transversal: 't' },
  // showParallelMarks/showAngleNumbers default true.
};

/** Golden params keyed by archetype id (single source for tests + gallery). */
export const GOLDEN: Readonly<Record<string, Params>> = {
  'sat-math:bar-chart': GOLDEN_BAR_CHART,
  'sat-math:box-plot': GOLDEN_BOX_PLOT,
  'sat-math:circle-features': GOLDEN_CIRCLE_FEATURES,
  'sat-math:dot-plot': GOLDEN_DOT_PLOT,
  'sat-math:graph-function': GOLDEN_GRAPH_FUNCTION,
  'sat-math:graph-line': GOLDEN_GRAPH_LINE,
  'sat-math:graph-system-two-lines': GOLDEN_GRAPH_SYSTEM_TWO_LINES,
  'sat-math:histogram': GOLDEN_HISTOGRAM,
  'sat-math:parallel-lines-transversal': GOLDEN_PARALLEL_LINES_TRANSVERSAL,
  'sat-math:scatterplot': GOLDEN_SCATTERPLOT,
  'sat-math:table-data': GOLDEN_TABLE_DATA,
  'sat-math:table-two-way': GOLDEN_TABLE_TWO_WAY,
  'sat-math:triangle-labeled': GOLDEN_TRIANGLE_LABELED,
};

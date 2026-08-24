# Diagram renderers (`src/renderers/`)

A framework-free library that renders the parameterized diagram archetypes in
`database/diagrams/` to standalone SVG document strings. One renderer per
archetype, 13 in total (4 graph, 6 data/chart, 3 geometry).

## API

```ts
import { render, getRenderer, registeredArchetypeIds } from './renderers/index.js';

const svg: string = render('sat-math:graph-line', {
  slope: 2,
  yIntercept: -1,
  xRange: { min: -5, max: 5 },
  markedPoints: [{ x: 1, y: 1, label: 'P' }],
});
```

- `render(archetypeId, params)` — validate + render in one call; returns the
  full SVG document (XML prolog, single root `<svg>` with `viewBox`,
  `role="img"`, and a `<title>`).
- `getRenderer(archetypeId)` — resolve the `Renderer`
  (`{ archetypeId, rendererRef, render }`); unknown ids throw with the list of
  known archetypes.
- `registeredArchetypeIds()` — the 13 registered ids, sorted.

## The paramsSchema-as-gate contract

Each archetype's `paramsSchema` (in `database/diagrams/<archetypeId>.json`) is
the single source of truth for parameter rules. Every render call first runs
ajv validation (`lib/diagram.ts`), then the renderer enforces the cross-field
guarantees a schema cannot express (a marked point lies on the line, an
intersection is an integer inside the grid, min ≤ q1 ≤ median ≤ q3 ≤ max, …).
All violations throw with a jsonPath-style locator (e.g. `/slope: must be <= 6`,
`/rows/0: row has 3 cells but headers has 2`). Declared schema defaults are
applied by the renderers themselves (ajv does not apply defaults). The design
rule is that every parameter affects the output; the param-coverage tests
enforce it.

## Determinism

Renderers are deterministic: identical params produce a **byte-identical** SVG
string — no clock, no randomness, no locale. All numbers pass through `fmt()`
(2-decimal rounding, `-0` normalized) and serialization is fixed-order,
2-space pretty-printed with a trailing newline.

## Tests and gallery

- `npm test` — the full renderer suite (`src/renderers/tests/`): per renderer
  determinism, document structure, XML well-formedness (a tiny dependency-free
  tag-balance check in `tests/helpers.ts`), param coverage for every
  top-level `paramsSchema` key against the golden params in
  `tests/golden.ts`, and invalid-params rejection; plus registry integrity
  (`tests/registry.test.ts`) and an end-to-end fixture test
  (`tests/e2e.test.ts`).
- `npm run gallery` — renders all 13 archetypes at their golden params plus
  the E2E fixture into `rendered-gallery/` (one `.svg` per figure plus an
  `index.html` grid). A derived artifact; not committed.

## How a generated question's diagram renders

A generated question (`research/sat/test-fixtures/generated-*.json`) carries
`stimulus.diagram = { archetypeId, parameters }`. Rendering it is exactly the
public API call:

```ts
const svg = render(question.stimulus.diagram.archetypeId,
                   question.stimulus.diagram.parameters);
```

`tests/e2e.test.ts` proves this path with
`generated-math-systems-001.json` (two lines, marked integer intersection at
(4, 3), line labels drawn).

## Design note: SVG strings, framework-free

Renderers return plain SVG **strings** built by `lib/svg.ts` — no DOM, no
React, no browser dependency, no runtime deps beyond ajv (validation). Any
host can inline the string into HTML, store it, or serve it as an
`image/svg+xml` document unchanged.

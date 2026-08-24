import { renderer } from '../table-data.js';
import { GOLDEN_TABLE_DATA as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// highlightColumn (null-ish) and showRowNumbers (default false) are omitted
// from golden; toggling them on adds the wash and the row-number column.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:table-data',
  golden,
  coverage: [
    { key: 'title', params: { ...golden, title: null } },
    { key: 'headers', params: { ...golden, headers: ['Month', 'Revenue'] } },
    {
      key: 'rows',
      params: {
        ...golden,
        rows: [
          ['Jan', 120],
          ['Feb', 150],
          ['Mar', 95],
        ],
      },
    },
    { key: 'highlightColumn', params: { ...golden, highlightColumn: 1 } },
    { key: 'showRowNumbers', params: { ...golden, showRowNumbers: true } },
  ],
  invalid: [
    {
      label: 'missing required headers',
      params: {
        title: 'Sales',
        rows: [
          ['Jan', 120],
          ['Feb', 150],
        ],
      },
      match: 'headers',
    },
    {
      label: 'highlightColumn out of range',
      params: { ...golden, highlightColumn: 5 },
      match: '/highlightColumn',
    },
  ],
});

import { renderer } from '../table-two-way.js';
import { GOLDEN_TABLE_TWO_WAY as golden } from './golden.js';
import { runRendererSuite } from './helpers.js';

// showTotals (default true) is omitted from golden; the false variant drops
// the Total row/column. Totals are computed from cells, never authored.
runRendererSuite(renderer, {
  archetypeId: 'sat-math:table-two-way',
  golden,
  coverage: [
    { key: 'tableTitle', params: { ...golden, tableTitle: null } },
    { key: 'rowCategories', params: { ...golden, rowCategories: ['Junior', 'Grad'] } },
    { key: 'columnCategories', params: { ...golden, columnCategories: ['Pass', 'Fail'] } },
    {
      key: 'cells',
      params: {
        ...golden,
        cells: [
          [30, 12],
          [25, 15],
        ],
      },
    },
    { key: 'cornerLabel', params: { ...golden, cornerLabel: null } },
    { key: 'showTotals', params: { ...golden, showTotals: false } },
  ],
  invalid: [
    {
      label: 'missing required cells',
      params: {
        tableTitle: 'T',
        rowCategories: ['Junior', 'Senior'],
        columnCategories: ['Passed', 'Failed'],
      },
      match: 'cells',
    },
    {
      label: 'all-zero table rejected',
      params: {
        ...golden,
        cells: [
          [0, 0],
          [0, 0],
        ],
      },
      match: '/cells',
    },
  ],
});

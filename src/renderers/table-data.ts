/**
 * Renderer: sat-math:table-data (DataTable).
 *
 * Rectangular labeled data table: bold header row with a heavier rule
 * beneath, body rows separated by light horizontal rules, optional accent
 * shading on one column, optional leading row-number column.
 *
 * Params notes (schema: database/diagrams/sat-math:table-data.json):
 * - Every row must have exactly headers.length cells — a mismatch is a
 *   parse-time error (jsonPath-style locator), never a truncated figure.
 * - Numeric cells are rendered exactly as provided (via fmt(), which is
 *   lossless for the schema's magnitudes — no reformatting, so stem
 *   arithmetic always matches the visible table).
 * - The schema does NOT distinguish numeric vs text alignment, so ALL cells
 *   are left-aligned (headers too); noted here per the design brief.
 * - showRowNumbers declares default false but ajv does not apply defaults,
 *   so the renderer applies it itself.
 * - highlightColumn shades the whole column (header included) with a subtle
 *   light-gray wash (COLORS.grid at reduced opacity — the house palette is
 *   monochrome).
 */

import { assertValidParams } from './lib/diagram.js';
import { SvgBuilder, fmt } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

type Cell = number | string;

interface TableDataParams {
  title: string | null;
  headers: string[];
  rows: Cell[][];
  highlightColumn?: number | null;
  showRowNumbers?: boolean;
}

const CANVAS_W = 360;
const MARGIN_X = 24;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 14;
const TITLE_GAP = 22; // px reserved above the table when a caption exists
const HEADER_H = 26;
const ROW_H = 24;
const CELL_PAD_X = 12; // per side
const MIN_COL_W = 72;
const ROWNUM_COL_W = 30;

/** Cell text: numbers exactly as provided (fmt is lossless here), strings verbatim. */
function cellText(c: Cell): string {
  return typeof c === 'number' ? fmt(c) : c;
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:table-data',
  rendererRef: 'DataTable',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:table-data', params);
    const p = params as unknown as TableDataParams;

    const headers = p.headers;
    const nCols = headers.length;
    const showRowNumbers = p.showRowNumbers ?? false;
    const highlight = p.highlightColumn ?? null;

    // Cross-field guarantee: every row matches headers.length exactly.
    for (let i = 0; i < p.rows.length; i++) {
      const row = p.rows[i]!;
      if (row.length !== nCols) {
        throw new Error(
          `/rows/${i}: row has ${row.length} cells but headers has ${nCols} — ` +
            'every row must have exactly headers.length cells',
        );
      }
    }

    // Column widths from content: widest cell/header text + padding, min width.
    const colW: number[] = [];
    for (let c = 0; c < nCols; c++) {
      let w = approxTextWidth(headers[c]!, FONT.size);
      for (const row of p.rows) {
        w = Math.max(w, approxTextWidth(cellText(row[c]!), FONT.size));
      }
      colW.push(Math.max(MIN_COL_W, w + 2 * CELL_PAD_X));
    }
    const extraCols = showRowNumbers ? 1 : 0;
    let tableW = colW.reduce((a, b) => a + b, 0) + extraCols * ROWNUM_COL_W;
    const availW = CANVAS_W - 2 * MARGIN_X;
    if (tableW > availW) {
      // Deterministic proportional shrink, data columns only.
      const scale = (availW - extraCols * ROWNUM_COL_W) / (tableW - extraCols * ROWNUM_COL_W);
      for (let c = 0; c < nCols; c++) colW[c] = colW[c]! * scale;
      tableW = availW;
    }

    const nRows = p.rows.length;
    const tableX = MARGIN_X + (availW - tableW) / 2; // center narrower tables
    const hasTitle = p.title !== null && p.title !== undefined && p.title !== '';
    const tableY = MARGIN_TOP + (hasTitle ? TITLE_GAP : 0);
    const headerBottom = tableY + HEADER_H;
    const tableBottom = headerBottom + nRows * ROW_H;
    const canvasH = tableBottom + MARGIN_BOTTOM;

    const desc =
      `Data table with ${nCols} columns (${headers.join(', ')}) and ${nRows} rows` +
      (hasTitle ? `, captioned "${p.title!}"` : '') +
      (highlight !== null ? `, column ${highlight} highlighted` : '') +
      '.';

    const bld = new SvgBuilder({
      width: CANVAS_W,
      height: canvasH,
      title: 'Labeled Data Table',
      desc,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    if (hasTitle) {
      bld.text(CANVAS_W / 2, MARGIN_TOP + FONT.size * 0.4, p.title!, {
        anchor: 'middle',
        weight: 'bold',
      });
    }

    // Column x-offsets (data columns only; row-number column prepended).
    const colX: number[] = [];
    {
      let x = tableX + (showRowNumbers ? ROWNUM_COL_W : 0);
      for (let c = 0; c < nCols; c++) {
        colX.push(x);
        x += colW[c]!;
      }
    }
    const tableRight = tableX + tableW;

    // Highlight column wash, drawn first so it sits under text and rules.
    if (highlight !== null) {
      if (highlight >= nCols) {
        throw new Error(
          `/highlightColumn: index ${highlight} is out of range for ${nCols} columns`,
        );
      }
      bld.rect(colX[highlight]!, tableY, colW[highlight]!, tableBottom - tableY, {
        fill: COLORS.grid,
        'fill-opacity': 0.5,
      });
    }

    const textY = (lineTop: number, lineH: number): number => lineTop + lineH / 2 + FONT.size * 0.35;

    // Header row: bold, left-aligned (schema does not distinguish alignment).
    for (let c = 0; c < nCols; c++) {
      bld.text(colX[c]! + CELL_PAD_X, textY(tableY, HEADER_H), headers[c]!, { weight: 'bold' });
    }
    if (showRowNumbers) {
      bld.text(tableX + 6, textY(tableY, HEADER_H), '#', { weight: 'bold' });
    }
    // Heavier rule beneath the header; outer top rule matches it.
    bld.line(tableX, tableY, tableRight, tableY, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.axis,
    });
    bld.line(tableX, headerBottom, tableRight, headerBottom, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.line,
    });

    // Body rows, light rules between them, closing rule at the bottom.
    for (let r = 0; r < nRows; r++) {
      const rowTop = headerBottom + r * ROW_H;
      for (let c = 0; c < nCols; c++) {
        bld.text(colX[c]! + CELL_PAD_X, textY(rowTop, ROW_H), cellText(p.rows[r]![c]!));
      }
      if (showRowNumbers) {
        bld.text(tableX + 6, textY(rowTop, ROW_H), String(r + 1));
      }
      const ruleY = rowTop + ROW_H;
      bld.line(tableX, ruleY, tableRight, ruleY, {
        stroke: r === nRows - 1 ? COLORS.ink : COLORS.grid,
        'stroke-width': STROKE.thin,
      });
    }

    bld.end();
    return bld.toString();
  },
};

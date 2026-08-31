/**
 * Renderer: sat-math:table-two-way (TwoWayTable).
 *
 * 2×2 contingency table: the schema parameterizes ONLY the four inner cells
 * plus the category labels; row totals, column totals, and the grand total
 * are COMPUTED here (never authored), so totals can never contradict the
 * inner cells — the registry's zero-mismatch design.
 *
 * Params notes (schema: database/diagrams/sat-math:table-two-way.json):
 * - At least one inner cell must be positive — an all-zero table is a
 *   parse-time error (renderer validates, per the schema description).
 * - showTotals declares default true but ajv does not apply defaults, so the
 *   renderer applies it itself; when false the Total row/column (and grand
 *   total) are omitted so students can compute them.
 * - cornerLabel null leaves the top-left corner cell blank.
 * - Cell max is 999, but totals can reach 3,996 — integers >= 1000 get
 *   thousands separators (deterministic manual formatting, no locale).
 * - Totals row/column are bold with heavier (double) rules per the archetype
 *   notes; the grand total sits bottom-right.
 */

import { assertValidParams } from './lib/diagram.js';
import { SvgBuilder } from './lib/svg.js';
import { approxTextWidth } from './lib/text.js';
import { COLORS, FONT, STROKE } from './lib/style.js';
import type { Renderer } from './types.js';

interface TwoWayParams {
  tableTitle: string | null;
  rowCategories: [string, string];
  columnCategories: [string, string];
  cells: [[number, number], [number, number]];
  cornerLabel?: string | null;
  showTotals?: boolean;
}

const CANVAS_W = 360;
const MARGIN_X = 20;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 14;
const TITLE_GAP = 22;
const HEADER_H = 26;
const ROW_H = 24;
const CELL_PAD_X = 10;
const MIN_COL_W = 56;
const MIN_LABEL_COL_W = 64;

/** Integer with thousands separators for values >= 1000 (manual, locale-free). */
function intText(n: number): string {
  const s = String(n);
  if (n < 1000) return s;
  const groups: string[] = [];
  let rest = s;
  while (rest.length > 3) {
    groups.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  groups.unshift(rest);
  return groups.join(',');
}

/**
 * Greedy two-line word wrap for header cells (deterministic): pack whole
 * words into line 1 until adding another word would exceed targetWidth, the
 * rest goes to line 2. A single over-long word stays unbroken on line 1.
 */
function wrapHeader(text: string): string[] {
  const words = text.split(' ');
  if (words.length < 2) return [text];
  const target = approxTextWidth(text, FONT.size) / 2 + 6;
  const lines: string[] = [words[0]!];
  for (let i = 1; i < words.length; i++) {
    const last = lines[lines.length - 1]!;
    const candidate = `${last} ${words[i]}`;
    if (lines.length < 2 && approxTextWidth(candidate, FONT.size) <= target) {
      lines[lines.length - 1] = candidate;
    } else if (lines.length < 2) {
      lines.push(words[i]!);
    } else {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${words[i]}`;
    }
  }
  return lines;
}

export const renderer: Renderer = {
  archetypeId: 'sat-math:table-two-way',
  rendererRef: 'TwoWayTable',
  render(params: Record<string, unknown>): string {
    assertValidParams('sat-math:table-two-way', params);
    const p = params as unknown as TwoWayParams;

    const showTotals = p.showTotals ?? true;
    const corner = p.cornerLabel ?? null;
    const [a, b] = p.cells[0];
    const [c, d] = p.cells[1];

    // Cross-field guarantee: the table must describe actual data.
    if (a + b + c + d === 0) {
      throw new Error('/cells: at least one cell must be positive (all-zero table rejected)');
    }

    // Computed (never parameterized): row totals, column totals, grand total.
    const rowTotals: [number, number] = [a + b, c + d];
    const colTotals: [number, number] = [a + c, b + d];
    const grand = a + b + c + d;

    const nDataCols = 2 + (showTotals ? 1 : 0);
    const nDataRows = 2 + (showTotals ? 1 : 0);

    // Column widths from content (headers + every value that column shows).
    // Long headers wrap to two lines rather than overflowing a shrunken
    // column: first size against the wrapped lines when the unwrapped table
    // would exceed the canvas.
    const labelColW = Math.max(
      MIN_LABEL_COL_W,
      approxTextWidth(corner ?? '', FONT.size) + 2 * CELL_PAD_X,
      approxTextWidth(p.rowCategories[0], FONT.size) + 2 * CELL_PAD_X,
      approxTextWidth(p.rowCategories[1], FONT.size) + 2 * CELL_PAD_X,
      showTotals ? approxTextWidth('Total', FONT.size) + 2 * CELL_PAD_X : 0,
    );
    const availW = CANVAS_W - 2 * MARGIN_X;
    const unwrappedW =
      labelColW +
      [0, 1, 2].reduce((sum, ci) => {
        if (ci >= nDataCols) return sum;
        const head = showTotals && ci === 2 ? 'Total' : p.columnCategories[ci]!;
        return sum + Math.max(MIN_COL_W, approxTextWidth(head, FONT.size) + 2 * CELL_PAD_X);
      }, 0);
    const wrapHeaders = unwrappedW > availW;
    const headerLines: string[][] = [];
    for (let ci = 0; ci < nDataCols; ci++) {
      const head = showTotals && ci === 2 ? 'Total' : p.columnCategories[ci]!;
      headerLines.push(wrapHeaders ? wrapHeader(head) : [head]);
    }

    const colW: number[] = [];
    for (let ci = 0; ci < nDataCols; ci++) {
      const isTotalCol = showTotals && ci === 2;
      let w = Math.max(...headerLines[ci]!.map((line) => approxTextWidth(line, FONT.size)));
      const vals = isTotalCol
        ? [rowTotals[0], rowTotals[1], grand]
        : ci === 0
          ? [a, c, colTotals[0]]
          : [b, d, colTotals[1]];
      for (const v of showTotals ? vals : vals.slice(0, 2)) {
        w = Math.max(w, approxTextWidth(intText(v), FONT.size));
      }
      colW.push(Math.max(MIN_COL_W, w + 2 * CELL_PAD_X));
    }

    let tableW = labelColW + colW.reduce((s, w) => s + w, 0);
    if (tableW > availW) {
      // Last resort (single-word headers wider than any column): scale, and
      // the header shrinks with a smaller font rather than overflowing.
      const scale = availW / tableW;
      for (let ci = 0; ci < nDataCols; ci++) colW[ci] = colW[ci]! * scale;
      tableW = availW;
    }
    const effLabelColW = tableW - colW.reduce((s, w) => s + w, 0);

    const hasTitle = p.tableTitle !== null && p.tableTitle !== undefined && p.tableTitle !== '';
    const tableX = MARGIN_X + (availW - tableW) / 2;
    const tableY = MARGIN_TOP + (hasTitle ? TITLE_GAP : 0);
    const headerH = HEADER_H + (headerLines.some((l) => l.length > 1) ? 12 : 0);
    const headerBottom = tableY + headerH;
    const tableBottom = headerBottom + nDataRows * ROW_H;
    const canvasH = tableBottom + MARGIN_BOTTOM;

    const desc =
      `Two-way frequency table of ${p.rowCategories.join('/')} by ${p.columnCategories.join('/')}` +
      `, cells ${a}, ${b}, ${c}, ${d}` +
      (showTotals ? `, grand total ${grand}` : ', totals hidden') +
      '.';

    const bld = new SvgBuilder({
      width: CANVAS_W,
      height: canvasH,
      title: 'Two-Way Frequency Table',
      desc,
    });
    bld.group({ 'font-family': FONT.family, 'font-size': FONT.size, fill: COLORS.ink });

    if (hasTitle) {
      bld.text(CANVAS_W / 2, MARGIN_TOP + FONT.size * 0.4, p.tableTitle!, {
        anchor: 'middle',
        weight: 'bold',
      });
    }

    const textY = (lineTop: number, lineH: number): number =>
      lineTop + lineH / 2 + FONT.size * 0.35;

    // Column x-offsets: [labelCol, dataCol0, dataCol1, totalCol?].
    const colX: number[] = [tableX];
    for (let ci = 0; ci < nDataCols; ci++) {
      colX.push(colX[ci]! + (ci === 0 ? effLabelColW : colW[ci - 1]!));
    }
    const tableRight = colX[nDataCols]! + colW[nDataCols - 1]!;

    const colCenter = (ci: number): number => {
      const x0 = colX[ci]!;
      const w = ci === 0 ? effLabelColW : colW[ci - 1]!;
      return x0 + w / 2;
    };

    // --- Rules -------------------------------------------------------------
    // Top rule above the header.
    bld.line(tableX, tableY, tableRight, tableY, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.axis,
    });
    // Heavier (double) rule beneath the header row.
    bld.line(tableX, headerBottom, tableRight, headerBottom, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.line,
    });
    bld.line(tableX, headerBottom + 2.5, tableRight, headerBottom + 2.5, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.thin,
    });
    // Light rules between the two data rows; heavier double rule above the
    // totals row; closing rule at the bottom.
    const rowTop = (r: number): number => headerBottom + r * ROW_H;
    if (showTotals) {
      const totTop = rowTop(2);
      bld.line(tableX, totTop, tableRight, totTop, {
        stroke: COLORS.ink,
        'stroke-width': STROKE.line,
      });
      bld.line(tableX, totTop + 2.5, tableRight, totTop + 2.5, {
        stroke: COLORS.ink,
        'stroke-width': STROKE.thin,
      });
    } else {
      bld.line(tableX, rowTop(1), tableRight, rowTop(1), {
        stroke: COLORS.grid,
        'stroke-width': STROKE.thin,
      });
    }
    bld.line(tableX, tableBottom, tableRight, tableBottom, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.axis,
    });
    // Vertical rules: after the label column always; after the second data
    // column when a totals column follows (heavier double rule).
    bld.line(colX[1]!, tableY, colX[1]!, tableBottom, {
      stroke: COLORS.ink,
      'stroke-width': STROKE.axis,
    });
    if (showTotals) {
      bld.line(colX[3]!, tableY, colX[3]!, tableBottom, {
        stroke: COLORS.ink,
        'stroke-width': STROKE.line,
      });
      bld.line(colX[3]! + 2.5, tableY, colX[3]! + 2.5, tableBottom, {
        stroke: COLORS.ink,
        'stroke-width': STROKE.thin,
      });
    }

    // --- Header row ---------------------------------------------------------
    if (corner !== null && corner !== '') {
      bld.text(colX[0]! + CELL_PAD_X, textY(tableY, headerH), corner);
    }
    for (let ci = 1; ci <= nDataCols; ci++) {
      const lines = headerLines[ci - 1]!;
      const lineH = FONT.size + 2;
      const blockH = lines.length * lineH;
      let ly = tableY + (headerH - blockH) / 2 + FONT.size * 0.85;
      for (const line of lines) {
        bld.text(colCenter(ci), ly, line, { anchor: 'middle', weight: 'bold' });
        ly += lineH;
      }
    }

    // --- Data rows ----------------------------------------------------------
    const cellVals: [number, number][] = [
      [a, b],
      [c, d],
    ];
    for (let r = 0; r < 2; r++) {
      const y = textY(rowTop(r), ROW_H);
      bld.text(colX[0]! + CELL_PAD_X, y, p.rowCategories[r]!, { weight: 'bold' });
      bld.text(colCenter(1), y, intText(cellVals[r]![0]), { anchor: 'middle' });
      bld.text(colCenter(2), y, intText(cellVals[r]![1]), { anchor: 'middle' });
      if (showTotals) {
        bld.text(colCenter(3), y, intText(rowTotals[r]!), { anchor: 'middle', weight: 'bold' });
      }
    }

    // --- Totals row (bold), grand total bottom-right -------------------------
    if (showTotals) {
      const y = textY(rowTop(2), ROW_H);
      bld.text(colX[0]! + CELL_PAD_X, y, 'Total', { weight: 'bold' });
      bld.text(colCenter(1), y, intText(colTotals[0]), { anchor: 'middle', weight: 'bold' });
      bld.text(colCenter(2), y, intText(colTotals[1]), { anchor: 'middle', weight: 'bold' });
      bld.text(colCenter(3), y, intText(grand), { anchor: 'middle', weight: 'bold' });
    }

    bld.end();
    return bld.toString();
  },
};

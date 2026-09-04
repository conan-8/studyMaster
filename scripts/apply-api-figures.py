#!/usr/bin/env python3
"""
apply-api-figures.py — replace PDF-crop diagrams with API-native figures.

For every curated record whose cached API payload (curate/api-cache/) carries
a figure, use the best representation:
  - inline <svg> graph  -> saved as assets/figures/ssqb-<id>.svg, diagram set
  - HTML <table>        -> converted to tableJson (rendered natively),
                           diagram set to null
Math records are left alone for now (their table cells embed base64 math
images that need a LaTeX pass first). Review blocks are preserved.

Idempotent; run after harvest-ssqb-api.py. Then:
  npm run sync:assets && npm run seed
"""

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAT = ROOT / 'research' / 'sat'
CACHE = SAT / 'curate' / 'api-cache'
FIGURES = SAT / 'assets' / 'figures'
CURATED = SAT / 'curated'


class TableParser(HTMLParser):
    """Pull caption / header row / data rows out of a figure table."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.caption = None
        self.headers: list[str] = []
        self.rows: list[list[str]] = []
        self._mode = None  # 'caption' | 'th' | 'td'
        self._cell = ''
        self._row: list[str] = []
        self._row_is_header = True
        self._wrap = None  # '^' | '_' while inside sup/sub

    def handle_starttag(self, tag, attrs):
        if tag == 'caption':
            self._mode = 'caption'
        elif tag == 'tr':
            self._row, self._row_is_header = [], True
        elif tag == 'th':
            self._mode, self._cell = 'th', ''
        elif tag == 'td':
            self._mode, self._cell = 'td', ''
            self._row_is_header = False
        elif tag == 'br':
            self._cell += ' '
        elif tag == 'sup':
            self._wrap = '^'
        elif tag == 'sub':
            self._wrap = '_'

    def handle_endtag(self, tag):
        if tag == 'caption':
            self._mode = None
        elif tag in ('th', 'td'):
            text = re.sub(r'\s+', ' ', self._cell).replace('\xa0', ' ').strip()
            self._row.append(text)
            self._mode = None
        elif tag == 'tr':
            if self._row:
                (self.headers if self._row_is_header else self.rows).append(self._row)
        elif tag == 'sup' or tag == 'sub':
            self._wrap = None

    def handle_data(self, data):
        if self._mode == 'caption':
            self.caption = (self.caption or '') + data
        elif self._mode in ('th', 'td'):
            if self._wrap:
                self._cell += f'\\(^{{{data.strip()}}}\\)' if self._wrap == '^' else f'\\(_{{{data.strip()}}}\\)'
            else:
                self._cell += data


def main() -> int:
    FIGURES.mkdir(parents=True, exist_ok=True)
    svg_n = table_n = skipped = 0
    for f in sorted(CURATED.glob('ssqb-*.json')):
        rec = json.loads(f.read_text())
        if rec.get('section') != 'reading-writing':
            continue
        cache = CACHE / f.name
        if not cache.exists():
            skipped += 1
            continue
        payload = json.loads(cache.read_text())['payload']
        stim = payload.get('stimulus') or payload.get('body') or ''

        m = re.search(r'<svg\b.*?</svg>', stim, re.S | re.I)
        if m:
            (FIGURES / f'{rec["sourceId"]}.svg').write_text(m.group(0))
            rec['diagram'] = f'assets/figures/{rec["sourceId"]}.svg'
            rec['tableJson'] = None
            svg_n += 1
        elif '<table' in stim:
            p = TableParser()
            p.feed(stim)
            rec['tableJson'] = {
                'caption': re.sub(r'\s+', ' ', p.caption or '').replace('\xa0', ' ').strip() or None,
                'columns': p.headers[0] if p.headers else [],
                'rows': p.headers[1:] + p.rows,
            }
            rec['diagram'] = None
            table_n += 1
        else:
            skipped += 1
            continue
        f.write_text(json.dumps(rec, indent=2) + '\n')
    print(f'svg figures: {svg_n} | tables: {table_n} | untouched: {skipped}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

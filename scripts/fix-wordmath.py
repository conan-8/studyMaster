#!/usr/bin/env python3
"""
fix-wordmath.py — convert verbalized math ("fourth root x squared root",
"2raised to x power", "fraction with numerator a , denominator b") inside
\\(...\\) segments of the curated records into real LaTeX.

College Board's alttext transcriptions landed verbatim in the curation
workbook and from there in research/sat/curated/ssqb-*.json; KaTeX rendered
the words as mangled italics ("fourthrootx²+8x+16root"). The converter lives
in scripts/lib/wordmath.py and is also applied by import-curated.py, so this
one-shot script only needs to repair the EXISTING records.

Rewrites research/sat/curated/ssqb-*.json in place (review blocks and all
non-text fields are preserved), then prints a report. Afterwards push the
fixed records to Supabase with:

    npm run seed:curated

Exit 0.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts' / 'lib'))

from wordmath import clean_text, residuals, MATH_SEG_RE  # noqa: E402

CURATED = ROOT / 'research' / 'sat' / 'curated'

TEXT_FIELDS = ('info', 'prompt', 'rationale', 'gridAnswer')


def clean_record(rec: dict) -> tuple[dict, int]:
    """Return (record with cleaned text fields, number of fields changed)."""
    changed = 0
    out = dict(rec)
    for field in TEXT_FIELDS:
        v = out.get(field)
        if isinstance(v, str) and v:
            nv = clean_text(v)
            if nv != v:
                out[field] = nv
                changed += 1
    opts = out.get('options')
    if isinstance(opts, list):
        new_opts = []
        for o in opts:
            if isinstance(o, dict) and isinstance(o.get('text'), str) and o['text']:
                nv = clean_text(o['text'])
                if nv != o['text']:
                    o = {**o, 'text': nv}
                    changed += 1
            new_opts.append(o)
        out['options'] = new_opts
    table = out.get('tableJson')
    if isinstance(table, dict):
        nt = dict(table)
        for key in ('caption', 'columns', 'headers', 'rows'):
            v = nt.get(key)
            if isinstance(v, str):
                nt[key] = clean_text(v)
            elif isinstance(v, list):
                nt[key] = [
                    clean_text(x) if isinstance(x, str) else
                    [clean_text(c) if isinstance(c, str) else c for c in x] if isinstance(x, list) else x
                    for x in v
                ]
        if nt != table:
            out['tableJson'] = nt
            changed += 1
    return out, changed


def main() -> int:
    files = sorted(CURATED.glob('ssqb-*.json'))
    if not files:
        print(f'fix-wordmath: no curated records under {CURATED}')
        return 0
    changed_records = 0
    changed_fields = 0
    leftover: list[tuple[str, str, list[str]]] = []
    for f in files:
        rec = json.loads(f.read_text())
        out, n = clean_record(rec)
        if n:
            f.write_text(json.dumps(out, indent=2) + '\n')
            changed_records += 1
            changed_fields += n
        # residual scan on the cleaned text (report only)
        for field in TEXT_FIELDS + ('A', 'B', 'C', 'D'):
            if field in TEXT_FIELDS:
                v = out.get(field)
            else:
                v = next((o.get('text') for o in out.get('options', []) if o.get('id') == field), None)
            if not isinstance(v, str):
                continue
            for m in MATH_SEG_RE.finditer(v):
                r = residuals(m.group(1))
                if r:
                    leftover.append((out.get('sourceId', f.stem), m.group(1).strip()[:80], r))
    print(f'fix-wordmath: {len(files)} record(s) scanned, {changed_records} rewritten ({changed_fields} field(s))')
    if leftover:
        print(f'fix-wordmath: {len(leftover)} math segment(s) still carry verbal markers (manual review):')
        for sid, seg, r in leftover:
            print(f'  {sid}: {r} in {seg!r}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

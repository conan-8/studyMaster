#!/usr/bin/env python3
"""
import-figures.py — user-supplied figure images -> curated records.

Drop one image per question into research/sat/curate/figures/, named by
question id (raw hex or ssqb-<hex>), any of .png/.jpg/.jpeg/.svg — e.g.
0f9f8ea7.png or ssqb-263f9937.svg. These are the high-fidelity figures saved
straight from the SSQB site; they OVERRIDE the PDF-scrape crops.

For each dropped image:
  - copied to research/sat/assets/figures/ssqb-<id>.<ext>
  - if a curated record exists, its `diagram` field is pointed at the new
    asset (record rewritten in place; review blocks untouched)
  - ids with no curated record are still copied (ready for later curation)

Afterwards run: npm run sync:assets && npm run seed (and npm run build:app is
NOT needed — assets are served from disk). Internal-eval only (gitignored).
"""

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAT = ROOT / 'research' / 'sat'
DROP = SAT / 'curate' / 'figures'
FIGURES = SAT / 'assets' / 'figures'
CURATED = SAT / 'curated'

EXTS = {'.png', '.jpg', '.jpeg', '.svg'}


def norm_id(raw: str) -> str:
    s = raw.strip().lower()
    return s[5:] if s.startswith('ssqb-') else s


def main() -> int:
    if not DROP.exists():
        print(f'nothing to do — drop images into {DROP.relative_to(ROOT)}/ first')
        return 0
    FIGURES.mkdir(parents=True, exist_ok=True)

    updated = copied = orphan = 0
    for f in sorted(DROP.iterdir()):
        if f.suffix.lower() not in EXTS or not f.is_file():
            continue
        qid = norm_id(f.stem)
        if not re.fullmatch(r'[0-9a-f]+', qid):
            print(f'skip (not a question id): {f.name}')
            continue
        dest = FIGURES / f'ssqb-{qid}{f.suffix.lower()}'
        shutil.copy(f, dest)
        if dest.suffix != '.png':
            stale = FIGURES / f'ssqb-{qid}.png'
            if stale.exists():
                stale.unlink()  # supersede the PDF crop
        copied += 1

        rec_path = CURATED / f'ssqb-{qid}.json'
        if rec_path.exists():
            rec = json.loads(rec_path.read_text())
            rec['diagram'] = f'assets/figures/ssqb-{qid}{f.suffix.lower()}'
            rec_path.write_text(json.dumps(rec, indent=2) + '\n')
            updated += 1
        else:
            orphan += 1
            print(f'note: {qid} has no curated record yet — asset staged only')

    print(f'figures copied: {copied} | curated records updated: {updated} | staged without record: {orphan}')
    print('next: npm run sync:assets && npm run seed')
    return 0


if __name__ == '__main__':
    sys.exit(main())

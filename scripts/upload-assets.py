#!/usr/bin/env python3
"""
upload-assets.py — mirror research/sat/assets/** into the public
`question-assets` Supabase Storage bucket, preserving the assets/... key
layout the simulator references.

Why: the harvested ssqb figures are internal-use College Board content and
stay gitignored, so they never reach the git-driven Vercel build. The app
resolves assets/ssqb-* paths against the bucket at runtime (see
bluebook-mockup/src/lib/assets.ts).

    SUPABASE_ANON_KEY=<legacy anon JWT> python3 scripts/upload-assets.py

(SUPABASE_ANON_KEY must be the legacy anon key — the new sb_publishable_*
format is not accepted by the Storage API. Get it from the Supabase
dashboard: Project Settings → API → anon. Writes need a temporary INSERT
policy on storage.objects for the anon role; create it, upload, drop it.)

Exit 0 on success, 1 if any upload failed.
"""

import mimetypes
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'research' / 'sat' / 'assets'
PROJECT = 'https://asnrquijopjjqfjvwalc.supabase.co'
BUCKET = 'question-assets'

KEY = os.environ.get('SUPABASE_ANON_KEY', '')


def main() -> int:
    if not KEY:
        print('upload-assets: SUPABASE_ANON_KEY not set (see docstring)')
        return 1
    if not SRC.exists():
        print(f'upload-assets: {SRC} does not exist — nothing to upload')
        return 0

    files = []
    for dirpath, _, names in os.walk(SRC):
        for n in names:
            p = os.path.join(dirpath, n)
            rel = os.path.relpath(p, SRC)
            files.append((p, 'assets/' + rel.replace(os.sep, '/')))

    def upload(item: tuple[str, str]) -> tuple[str, str | None]:
        path, key = item
        mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        with open(path, 'rb') as fh:
            data = fh.read()
        req = urllib.request.Request(
            f'{PROJECT}/storage/v1/object/{BUCKET}/{key}',
            data=data,
            method='POST',
            headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': mime},
        )
        try:
            with urllib.request.urlopen(req, timeout=60):
                return (key, None)
        except Exception as e:  # noqa: BLE001 — report and continue
            return (key, str(e))

    print(f'upload-assets: {len(files)} file(s) to upload')
    fail = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for i, (key, err) in enumerate(ex.map(upload, files), start=1):
            if err:
                # 400/409 on an existing object is fine — assets are immutable
                if '409' in err or 'Duplicate' in err:
                    continue
                fail += 1
                print(f'FAIL {key}: {err}')
            if i % 250 == 0:
                print(f'  {i}/{len(files)}')
    print(f'upload-assets: done, {fail} failed')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())

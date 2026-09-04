#!/usr/bin/env python3
"""
harvest-ssqb-api.py — bulk-fetch the College Board educator question bank API
(public, no auth) and cache raw payloads for every SAT question.

Endpoints (reverse-engineered from the educator site bundle):
  GET  /questionbank/lookup                     assessment/test/domain codes
  POST /questionbank/digital/get-questions      {asmtEventId, test, domain}
       -> list with questionId (8-hex) + external_id (uuid) / ibn
  POST /questionbank/digital/get-question       {external_id: <uuid|ibn>}
       -> full item (HTML stimulus/stem/options/rationale, MathML, figures)

SAT = asmtEventId 99; test 1 = R&W (domains INI,CAS,EOI,SEC), test 2 = Math
(H,P,Q,S). Math items without external_id are fetched by ibn.

Output: research/sat/curate/api-cache/ssqb-<questionId>.json (raw payload +
list metadata). Resumable: existing cache files are skipped unless --redo.
Concurrency 6, polite retry on 429/5xx. Internal-eval only (gitignored).
"""

import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'research' / 'sat' / 'curate' / 'api-cache'

BASE = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank'
ORIGIN = {'origin': 'https://satsuiteeducatorquestionbank.collegeboard.org',
          'referer': 'https://satsuiteeducatorquestionbank.collegeboard.org/',
          'content-type': 'application/json'}

QUERIES = [
    {'asmtEventId': 99, 'test': 1, 'domain': 'INI,CAS,EOI,SEC'},
    {'asmtEventId': 99, 'test': 2, 'domain': 'H,P,Q,S'},
]


def post(path: str, body: dict, tries: int = 4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(f'{BASE}{path}', json.dumps(body).encode(), ORIGIN)
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < tries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    return None


def fetch_one(item: dict) -> tuple[str, bool, str]:
    qid = item['questionId']
    out = CACHE / f'ssqb-{qid}.json'
    if out.exists() and '--redo' not in sys.argv:
        return qid, False, 'cached'
    key = item.get('external_id') or item.get('ibn')
    if not key:
        return qid, False, 'no-key'
    payload = post('/digital/get-question', {'external_id': key})
    if payload is None or 'item_id' not in payload and 'externalid' not in payload:
        return qid, False, 'fetch-failed'
    rec = {'questionId': qid, 'list': item, 'payload': payload}
    out.write_text(json.dumps(rec, indent=2) + '\n')
    return qid, True, 'ok'


def main() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    items: list[dict] = []
    for q in QUERIES:
        items += post('/digital/get-questions', q)
    print(f'list: {len(items)} questions')

    done = failed = cached = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for qid, wrote, status in ex.map(fetch_one, items):
            if status == 'ok' and wrote:
                done += 1
            elif status == 'cached':
                cached += 1
            else:
                failed += 1
                print(f'FAIL {qid}: {status}')
    print(f'fetched {done}, cached {cached}, failed {failed}; cache holds {len(list(CACHE.glob("ssqb-*.json")))} files')
    return 0


if __name__ == '__main__':
    sys.exit(main())

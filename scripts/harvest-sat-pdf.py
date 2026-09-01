#!/usr/bin/env python3
"""
harvest-sat-pdf.py — SSQB PDF export -> normalized question bank.

Input:  research/sat/harvest-source/EVERYTHING.pdf            (all questions)
        research/sat/harvest-source/EXCLUDING bluebook ones.pdf (bluebook removed)
Output: research/sat/question-bank/ssqb-<id>.json  +  research/sat/index.jsonl

Origin rule: ID in both PDFs -> question_bank; ID in EVERYTHING only ->
bluebook; ID in the excluding PDF only -> hard error (not a subset).

The PDFs use Type3 fonts that split words with stray spaces before 't'
clusters ("repor ted", "Mar ta"); a corpus-frequency joiner repairs them.
Figures are vector drawings: each question's figure cluster is rendered to
research/sat/assets/ssqb-<id>.png at 150 dpi.

Requires: python3 + pymupdf (pip install pymupdf). Internal-eval only —
output dirs are gitignored; never display College Board content to students.
"""

import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'research/sat/harvest-source'
BANK = ROOT / 'research/sat/question-bank'
ASSETS = ROOT / 'research/sat/assets'
INDEX = ROOT / 'research/sat/index.jsonl'

RW_DOMAINS = ['Information and Ideas', 'Craft and Structure', 'Standard English Conventions', 'Expression of Ideas']
DIFF_MAP = {'Easy': ('easy', 2), 'Medium': ('medium', 3), 'Hard': ('hard', 4)}
SKILL_SLUGS = {
    'Central Ideas and Details': 'central-ideas-details',
    'Command of Evidence Textual': 'command-evidence-textual',
    'Command of Evidence Quantitative': 'command-evidence-quantitative',
    'Inferences': 'inferences',
    'Words in Context': 'words-in-context',
    'Text Structure and Purpose': 'text-structure-purpose',
    'Cross-Text Connections': 'cross-text-connections',
    'Boundaries': 'boundaries',
    'Form, Structure, and Sense': 'form-structure-sense',
    'Transitions': 'transitions',
    'Rhetorical Synthesis': 'rhetorical-synthesis',
}
SOURCE_URL = 'https://satsuitequestionbank.collegeboard.org/'


def slug_skill(name: str) -> str:
    key = re.sub(r'[—–-]', ' ', name)
    key = re.sub(r'\s+', ' ', key).strip()
    if key in SKILL_SLUGS:
        return SKILL_SLUGS[key]
    loose = {re.sub(r'[ ,]','', k): v for k, v in SKILL_SLUGS.items()}
    return loose.get(re.sub(r'[ ,]', '', key), key.lower().replace(' ', '-'))


# --- kerning repair (dictionary-based) ----------------------------------------

DICT = {w.strip().lower() for w in open('/usr/share/dict/words', encoding='utf-8', errors='ignore') if w.strip()}

def repair_line(line: str) -> str:
    """The Type3 fonts insert a stray space inside words ("repor ted",
    "Mar ta", "por trait"). Merge adjacent tokens when the concatenation is
    an English word and either (a) the left fragment is not a word, or
    (b) the classic kerning shape: left ends in 'r', right starts with 't'."""
    def fix(m):
        left, right = m.group(1), m.group(2)
        joined = (left + right).lower()
        if joined not in DICT:
            return m.group(0)
        if left.lower() not in DICT:
            return left + right
        if left.endswith('r') and right.startswith('t') and len(right) <= 5:
            return left + right
        return m.group(0)
    prev = None
    while prev != line:
        prev = line
        line = re.sub(r"\b([A-Za-z]{2,}) ([a-z]{1,6})\b", fix, line)
    return line


# --- pdf extraction ----------------------------------------------------------

def question_chunks(doc):
    """Yield (qid, [page indices]) in document order."""
    marks = []
    for i in range(doc.page_count):
        for m in re.finditer(r'Question ID: ([0-9a-f]+)', doc[i].get_text()):
            marks.append((m.group(1), i))
    # questions start at their first page; chunk = pages until next mark's page
    chunks = []
    for j, (qid, page) in enumerate(marks):
        end = marks[j + 1][1] if j + 1 < len(marks) else doc.page_count
        if not chunks or chunks[-1][0] != qid:
            chunks.append((qid, list(range(page, end))))
    return chunks


def parse_question(doc, pages):
    text = '\n'.join(doc[p].get_text() for p in pages)
    text = '\n'.join(repair_line(ln) for ln in text.split('\n'))
    if m := re.search(r'\nQuestion\n', text):
        body = text[m.end():]
    else:
        return None
    meta_vals, rest = split_meta(text[:m.start()])
    if meta_vals is None:
        return None
    body = body.split('\nAnswer\n', 1)
    if len(body) != 2:
        return None
    qtext, after = body[0], body[1]
    # choices: first run of A,B,C,D markers in order (graph axis labels etc. may add noise)
    spans = list(re.finditer(r'^([A-D])\.(?:\s|$)', after, re.M))
    run = []
    for k, cm in enumerate(spans):
        if cm.group(1) == 'A':
            run = [cm]
        elif run and ord(cm.group(1)) == ord(run[-1].group(1)) + 1:
            run.append(cm)
        else:
            run = []
        if len(run) == 4:
            break
    if len(run) != 4:
        return None
    end = run[3].end()
    # choice D ends where the answer/rationale block begins
    tail = after[end:]
    m_ans = re.search(r'^(Correct Answer:?\s*[A-D]|Rationale\b|Choice [A-D]\b)', tail, re.M)
    d_end = m_ans.start() if m_ans else len(tail)
    choices = []
    for k, cm in enumerate(run):
        seg = after[cm.end(): run[k + 1].start() if k + 1 < 4 else end + d_end]
        choices.append({'id': cm.group(1), 'text': ' '.join(seg.split())})
    rationale = ' '.join(tail[d_end:].split()).strip()
    while True:
        stripped = re.sub(r'^(Correct Answer:?\s*[A-D]\s*|Rationale\s*)', '', rationale)
        if stripped == rationale:
            break
        rationale = stripped
    # correct answer: explicit marker first, then rationale text
    correct = None
    if m := re.search(r'Correct Answer:?\s*([A-D])', after):
        correct = m.group(1)
    else:
        best = re.search(r'Choice ([A-D]) is the best answer', rationale)
        if best:
            correct = best.group(1)
        else:
            bad = set()
            for m in re.finditer(r'Choices?\s+((?:[A-D](?:\s*(?:,|and)\s*)?)+)\s+(?:is|are)\s+incorrect', rationale):
                bad |= set(re.findall(r'[A-D]', m.group(1)))
            rem = {'A', 'B', 'C', 'D'} - bad
            correct = rem.pop() if len(rem) == 1 else None
    # passage/stem
    stem, passage, stype = split_stem(qtext)
    # figure?
    fig = extract_figure(doc, pages)
    return dict(meta=meta_vals, stem=stem, passage=passage, stype=stype,
                choices=choices, correct=correct, rationale=rationale, figure_pages=fig)


def split_meta(head: str):
    if 'Difficulty' not in head:
        return None, None
    vals = [v.strip() for v in head.split('Difficulty', 1)[1].split('\n') if v.strip()]
    if len(vals) < 4 or vals[0] != 'SAT':
        return None, None
    section = vals[1]
    diff = next((v for v in reversed(vals) if v in DIFF_MAP), None)
    if diff is None:
        return None, None
    # domain may wrap across value lines ("Standard English" + "Conventions")
    domain, di = None, -1
    for start in range(2, len(vals) - 1):
        for end in range(start + 1, min(start + 4, len(vals)) + 1):
            joined = ' '.join(v for v in vals[start:end] if v not in DIFF_MAP)
            if joined in RW_DOMAINS:
                domain, di = joined, end - 1
                break
        if domain:
            break
    if domain is None:
        return None, None
    dfind = len(vals) - 1 - vals[::-1].index(diff)
    skill_lines = vals[di + 1:dfind]
    skill = ' '.join(skill_lines)
    return dict(section=section, domain=domain, skill=skill, difficulty=diff), None


def split_stem(qtext: str):
    notes = qtext.count('•') >= 2 or 'has taken the following notes' in qtext
    if '______' in qtext:
        i = qtext.rfind('______')
        passage, stem = qtext[: i + 6].strip(), ' '.join(qtext[i + 6:].split())
    else:
        paras = [p for p in re.split(r'\n\s*\n', qtext) if p.strip()]
        if len(paras) >= 2 and paras[-1].strip().endswith('?'):
            passage, stem = paras[0].strip(), ' '.join(paras[-1].split())
        else:
            lines = qtext.strip().split('\n')
            li = max((i for i, ln in enumerate(lines) if ln.strip().endswith('?')), default=-1)
            passage, stem = (' '.join(lines[:li]).strip(), ' '.join(lines[li:]).strip()) if li > 0 else (None, ' '.join(lines).strip())
    stype = 'notes' if notes else ('passage' if passage else 'none')
    if notes and '•' in qtext:
        qtext = qtext.replace('•', '•')
        passage = qtext.split('Answer')[0].strip() if 'Answer' in qtext else qtext.strip()
    return stem, passage, stype


def extract_figure(doc, pages):
    """Bounding box of non-metadata vector drawings, if a figure-sized cluster exists."""
    for p in pages:
        page = doc[p]
        cands = []
        for d in page.get_drawings():
            r = d['rect']
            if r.y1 < 125:  # metadata table zone
                continue
            if r.height < 8 and r.width > 120:  # blank rules
                continue
            if r.width < 8 and r.height < 8:
                continue
            cands.append(r)
        if not cands:
            continue
        x0 = min(r.x0 for r in cands); x1 = max(r.x1 for r in cands)
        y0 = min(r.y0 for r in cands); y1 = max(r.y1 for r in cands)
        if (x1 - x0) > 90 and (y1 - y0) > 50:
            return p, (x0 - 6, y0 - 6, x1 + 6, y1 + 6)
    return None


# --- main ---------------------------------------------------------------------

def main():
    everything = pymupdf.open(SRC / 'EVERYTHING.pdf')
    excluding = pymupdf.open(SRC / 'EXCLUDING bluebook ones.pdf')

    ids_b = set()
    for p in range(excluding.page_count):
        ids_b |= set(re.findall(r'Question ID: ([0-9a-f]+)', excluding[p].get_text()))

    chunks = question_chunks(everything)
    print(f'questions in EVERYTHING: {len(chunks)}; excluding-set: {len(ids_b)}')

    BANK.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    index_lines, stats = [], Counter()
    problems = []

    for qid, pages in chunks:
        parsed = parse_question(everything, pages)
        if parsed is None:
            stats['parse-failed'] += 1
            problems.append(qid)
            continue
        meta, stem, passage = parsed['meta'], parsed['stem'], parsed['passage']
        if parsed['correct'] is None:
            stats['no-answer'] += 1
            problems.append(qid)
            continue
        if not stem:
            stats['no-stem'] += 1
            problems.append(qid)
            continue
        origin = 'question_bank' if qid in ids_b else 'bluebook'
        stats[origin] += 1

        fig_asset = None
        if parsed['figure_pages']:
            pno, rect = parsed['figure_pages']
            pix = everything[pno].get_pixmap(dpi=150, clip=pymupdf.Rect(*rect))
            fig_asset = f'assets/ssqb-{qid}.png'
            pix.save(ASSETS / f'ssqb-{qid}.png')
            stats['with-figure'] += 1

        # legacy skill name: disambiguate by whether a figure/table is present
        skill_name = meta['skill']
        if skill_name == 'Command of Evidence':
            skill_name = 'Command of Evidence Quantitative' if fig_asset else 'Command of Evidence Textual'

        diff_official, diff_internal = DIFF_MAP[meta['difficulty']]
        rec = {
            'sourceId': f'ssqb-{qid}',
            'origin': origin,
            'section': 'reading-writing',
            'domain': meta['domain'],
            'skill': slug_skill(skill_name),
            'difficultyOfficial': diff_official,
            'difficultyInternal': diff_internal,
            'questionType': 'mcq',
            'stimulus': {
                'type': 'figure' if fig_asset else parsed['stype'],
                'text': passage,
                'tableJson': None,
                'figureAsset': fig_asset,
            },
            'stem': stem,
            'choices': parsed['choices'],
            'correctAnswer': parsed['correct'],
            'rationale': parsed['rationale'] or None,
            'sourceUrl': SOURCE_URL,
            'harvestedAt': now,
            'allowedUses': ['internal_eval'],
        }
        name = f'ssqb-{qid}.json'
        (BANK / name).write_text(json.dumps(rec, indent=2) + '\n')
        index_lines.append(json.dumps({
            'sourceId': rec['sourceId'], 'section': rec['section'], 'domain': rec['domain'],
            'skill': rec['skill'], 'difficultyOfficial': diff_official,
            'questionType': 'mcq', 'path': f'question-bank/{name}',
        }))

    INDEX.write_text('\n'.join(index_lines) + '\n')
    print('stats:', dict(stats))
    print('problems:', problems[:20], f'({len(problems)} total)')
    print(f'wrote {len(index_lines)} records + index.jsonl')


if __name__ == '__main__':
    sys.exit(main())

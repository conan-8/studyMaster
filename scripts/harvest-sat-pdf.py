#!/usr/bin/env python3
"""
harvest-sat-pdf.py — SSQB PDF export -> normalized question bank.

Input:  research/sat/harvest-source/  — two PDF pairs, one per section:
          Reading & Writing: EVERYTHING.pdf + 'EXCLUDING bluebook ones.pdf'
          Math:              'EVERYTHING math.pdf' + 'EXCLUDING bluebook math.pdf'
Output: research/sat/question-bank/ssqb-<id>.json  +  research/sat/index.jsonl
        (merge mode: existing records are kept, new ones appended)

Origin rule: ID in both PDFs -> question_bank; ID in the everything PDF only
-> bluebook; ID in the excluding PDF only -> hard error (not a subset).

Reading & Writing: prose extracts cleanly; vector figures (graphs/tables)
are cluster-detected and rendered to PNG.
Math: College Board draws every equation as vector paths — the text layer is
hollow — so each question block is rendered whole (stitched across pages)
and the text answer key ("Correct Answer: D" / "403") is harvested from text.

Requires: python3 + pymupdf + pillow. Internal-eval only — output dirs are
gitignored; never display College Board content to students.
"""

import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'research/sat/harvest-source'
BANK = ROOT / 'research/sat/question-bank'
ASSETS = ROOT / 'research/sat/assets'
INDEX = ROOT / 'research/sat/index.jsonl'

DOMAINS = [
    'Information and Ideas', 'Craft and Structure', 'Standard English Conventions', 'Expression of Ideas',
    'Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry',
]
DIFF_MAP = {'Easy': ('easy', 2), 'Medium': ('medium', 3), 'Hard': ('hard', 4)}
SOURCE_URL = 'https://satsuitequestionbank.collegeboard.org/'

# display name (normalized) -> canonical taxonomy slug
SKILL_SLUGS = {
    'central ideas and details': 'central-ideas-details',
    'command of evidence textual': 'command-evidence-textual',
    'command of evidence quantitative': 'command-evidence-quantitative',
    'inferences': 'inferences',
    'words in context': 'words-in-context',
    'text structure and purpose': 'text-structure-purpose',
    'cross-text connections': 'cross-text-connections',
    'boundaries': 'boundaries',
    'form structure and sense': 'form-structure-sense',
    'transitions': 'transitions',
    'rhetorical synthesis': 'rhetorical-synthesis',
    'linear equations in one variable': 'linear-equations-one-var',
    'linear equations in two variables': 'linear-equations-two-vars',
    'linear functions': 'linear-functions',
    'linear inequalities in one or two variables': 'linear-inequalities',
    'systems of two linear equations in two variables': 'systems-linear-equations',
    'equivalent expressions': 'equivalent-expressions',
    'nonlinear equations in one variable and systems of equations in two variables': 'nonlinear-equations-systems',
    'nonlinear functions': 'nonlinear-functions',
    'ratios rates proportional relationships and units': 'ratios-rates-proportions',
    'percentages': 'percentages',
    'one-variable data distributions and measures of center and spread': 'one-variable-data',
    'two-variable data models and scatterplots': 'two-variable-data',
    'probability and conditional probability': 'probability-conditional',
    'inference from sample statistics and margin of error': 'sample-statistics-margin-error',
    'evaluating statistical claims observational studies and experiments': 'evaluating-claims',
    'area and volume': 'area-volume',
    'lines angles and triangles': 'lines-angles-triangles',
    'right triangles and trigonometry': 'right-triangles-trig',
    'circles': 'circles',
}

# --- kerning repair (dictionary-based) ----------------------------------------

DICT = {w.strip().lower() for w in open('/usr/share/dict/words', encoding='utf-8', errors='ignore') if w.strip()}

CTRL_JUNK = re.compile(r'[\x00-\x08\x0b-\x1f]')

def clean_str(s: str | None) -> str | None:
    """Strip control chars (incl. NUL bytes the Type3 table cells emit) —
    PostgreSQL jsonb cannot store U+0000."""
    return s if s is None else CTRL_JUNK.sub('', s)

# Common English words ending in 'r' (blocked from aggressive r+t joins so
# "after treatment" / "their types" never merge).
R_END_WORDS = set('''for or after before over under other another mother father brother
either neither whether together matter water later letter better power lower upper order corner
center enter number member remember character answer wonder hunter partner painter master monster
register minister poster quarter counter chapter thunder winter summer copper proper super paper
higher slower faster longer stronger bigger smaller larger greater closer easier harder earlier
nearer fewer river never ever cover driver player teacher leader reader writer worker speaker
maker owner dinner winner runner manner inner outer mirror error terror horror favor flavor humor
color doctor actor factor sector editor mentor tutor author offer suffer differ prefer refer star
far car bar war jar her per fur sir your our their year dear hear clear near bear fear tear wear
rear appear disappear career peer beer deer cheer sheer steer poor door floor honor senior junior
major minor mayor sailor tailor scholar dollar collar pillar similar particular regular popular
solar polar however whatever whenever wherever whoever moreover further farther rather gather
weather feather leather sooner former latter computer'''.split())

# Common standalone 't' words (right side) that must not be merged.
STOP_T = set('''the this that these those they their them then than thus there therefore to too
two toward towards through throughout though thought thoughts time times today together total
table tables term terms test tests text texts type types top topic topics town towns team teams
true truth turn turns take takes taken taking tell tells told try tries tried trying tree trees
travel trip trips trust tube tune tunes task tasks target targets'''.split())

def repair_line(line: str) -> str:
    def fix(m):
        left, right = m.group(1), m.group(2)
        joined = (left + right).lower()
        if joined in DICT and left.lower() not in DICT:
            return left + right
        # aggressive r+t kerning split: 'repor ted', 'Par thenogenesis', 'nor th'
        if (left.endswith('r') and right.startswith('t') and len(right) <= 12
                and left.lower() not in R_END_WORDS and right not in STOP_T):
            return left + right
        return m.group(0)
    prev = None
    while prev != line:
        prev = line
        line = re.sub(r"\b([A-Za-z]{2,}) ([a-z]{1,14})\b", fix, line)
    return line

def slug_skill(name: str) -> str:
    key = re.sub(r'[^a-z0-9 ]', ' ', name.lower())
    key = re.sub(r'\s+', ' ', key).strip()
    return SKILL_SLUGS.get(key, key.replace(' ', '-'))

# --- pdf extraction ----------------------------------------------------------

def question_chunks(doc):
    marks = []
    for i in range(doc.page_count):
        for m in re.finditer(r'Question ID: ([0-9a-f]+)', doc[i].get_text()):
            marks.append((m.group(1), i))
    chunks = []
    for j, (qid, page) in enumerate(marks):
        end = marks[j + 1][1] if j + 1 < len(marks) else doc.page_count
        if not chunks or chunks[-1][0] != qid:
            chunks.append((qid, list(range(page, end))))
    return chunks

def split_meta(head: str):
    if 'Difficulty' not in head:
        return None
    vals = [v.strip() for v in head.split('Difficulty', 1)[1].split('\n') if v.strip()]
    if len(vals) < 4 or vals[0] != 'SAT':
        return None
    section = {'Reading and Writing': 'reading-writing', 'Math': 'math'}.get(vals[1])
    if section is None:
        return None
    diff = next((v for v in reversed(vals) if v in DIFF_MAP), None)
    if diff is None:
        return None
    # domain may wrap across value lines ("Geometry and" + "Trigonometry")
    domain, di = None, -1
    for start in range(2, len(vals) - 1):
        for end in range(start + 1, min(start + 5, len(vals)) + 1):
            joined = ' '.join(v for v in vals[start:end] if v not in DIFF_MAP)
            if joined in DOMAINS:
                domain, di = joined, end - 1
                break
        if domain:
            break
    if domain is None:
        return None
    dfind = len(vals) - 1 - vals[::-1].index(diff)
    skill = ' '.join(v for v in vals[di + 1:dfind] if v not in DIFF_MAP)
    skill = repair_line(skill)
    return dict(section=section, domain=domain, skill=skill, difficulty=diff)

def extract_figure(doc, pages):
    """RW: figure clusters (non-metadata vector drawings + their nearby text)
    on EVERY page of the question — graphs often span a page break. Returns a
    list of (page, rect) tuples."""
    out = []
    for p in pages:
        page = doc[p]
        cands = []
        for d in page.get_drawings():
            r = d['rect']
            if r.y1 < 125:
                continue
            if r.width < 8 and r.height < 8:
                continue
            cands.append(r)
        if not cands:
            continue
        x0 = min(r.x0 for r in cands); x1 = max(r.x1 for r in cands)
        y0 = min(r.y0 for r in cands); y1 = max(r.y1 for r in cands)
        if not (((x1 - x0) > 90 and (y1 - y0) > 50) or ((x1 - x0) > 250 and (y1 - y0) > 20)):
            # full figure, or the wide top/bottom slice of a page-split figure
            continue
        # pull in text words near the drawing cluster (labels are text, not drawings).
        # Above the plot only short title-like lines count (long lines are passage).
        zone_sides = pymupdf.Rect(x0 - 70, y0 - 25, x1 + 70, y1 + 12)
        zone_title = pymupdf.Rect(x0 - 10, y0 - 75, x1 + 10, y0 - 25)
        words = page.get_text('words')
        line_words = {}
        for w in words:
            line_words.setdefault((w[5], w[6]), []).append(w)
        for w in words:
            cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
            if cy < 120 or w[4] in ('Question', 'Answer'):  # metadata + section markers
                continue
            inside = zone_sides.contains(pymupdf.Point(cx, cy))
            if not inside and zone_title.contains(pymupdf.Point(cx, cy)):
                inside = len(line_words[(w[5], w[6])]) <= 8
            if inside:
                x0 = min(x0, w[0]); x1 = max(x1, w[2])
                y0 = min(y0, w[1]); y1 = max(y1, w[3])
        out.append((p, (x0 - 2, y0 - 2, x1 + 2, y1 + 2)))
    return out

def vstack(imgs):
    if not imgs:
        return None
    if len(imgs) == 1:
        return imgs[0]
    width = max(i.width for i in imgs)
    height = sum(i.height for i in imgs)
    out = Image.new('RGB', (width, height), 'white')
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height
    return out


def render_question_image(doc, pages):
    """Math: render the whole question block (below the metadata table) across
    its pages, stitched vertically. Cut the last page at the answer/rationale
    text when locatable."""
    imgs = []
    for k, p in enumerate(pages):
        page = doc[p]
        top = 118
        bottom = page.rect.height - 20
        if k == len(pages) - 1:
            cuts = []
            for needle in ('Correct Answer:', 'Rationale'):
                hits = page.search_for(needle)
                cuts += [r.y0 for r in hits]
            if cuts:
                bottom = min(cuts) - 6
        if bottom <= top:
            continue
        pix = page.get_pixmap(dpi=150, clip=pymupdf.Rect(14, top, page.rect.width - 14, bottom))
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        imgs.append(img)
    return vstack(imgs)

STEM_STARTERS = [
    'Which choice', 'Based on the text', 'As used in the text', 'Which of the following',
    'What is', 'What are', 'What value', 'How many', 'Who is', 'Where is', 'When is',
]

def last_stem_cut(text: str):
    """Position of the last stem-starter at a sentence start, or None."""
    cuts = []
    for s in STEM_STARTERS:
        for m in re.finditer(re.escape(s), text):
            before = ' '.join(text[: m.start()].split()).rstrip('”"“ ')
            if m.start() == 0 or before.endswith(('.', '?', '!')):
                cuts.append(m.start())
    return max(cuts) if cuts else None


def bulletize_notes(passage: str) -> str:
    """Notes exports carry no bullet glyphs: rebuild '• item' lines from the
    segment between 'following notes:' and 'The student wants'."""
    m = re.search(r'(following notes:)\n([\s\S]*?)(?=\nThe student wants)', passage)
    if not m:
        return passage
    items, current = [], ''
    for ln in m.group(2).split('\n'):
        ln = ln.strip()
        if not ln:
            continue
        new_item = current == '' or (current.rstrip().endswith(('.', '?', '!')) and ln[:1].isupper())
        if new_item and current:
            items.append(current)
            current = ln
        else:
            current = f'{current} {ln}'.strip()
    if current:
        items.append(current)
    bullets = '\n'.join(f'• {i}' for i in items)
    return passage[: m.start(2)] + bullets + passage[m.end(2):]


def split_stem(qtext: str):
    notes = qtext.count('•') >= 2 or 'has taken the following notes' in qtext
    if '______' in qtext:
        i = qtext.rfind('______')
        passage, rest = qtext[: i + 6].strip(), qtext[i + 6:].strip()
        # everything after the blank is NOT all stem: a trailing context
        # sentence (if any) belongs to the passage; only the actual question
        # ("Which choice ...?") is the stem.
        k = last_stem_cut(rest)
        if k is not None:
            context = rest[:k].strip()
            if context:
                passage = (passage + ' ' + context).strip()
            stem = ' '.join(rest[k:].split())
        else:
            stem = ' '.join(rest.split())
    else:
        k = last_stem_cut(qtext)
        if k is not None:
            passage = qtext[:k].strip() or None
            stem = ' '.join(qtext[k:].split())
        else:
            paras = [p for p in re.split(r'\n\s*\n', qtext) if p.strip()]
            if len(paras) >= 2 and paras[-1].strip().endswith('?'):
                passage, stem = paras[0].strip(), ' '.join(paras[-1].split())
            else:
                lines = qtext.strip().split('\n')
                li = max((i for i, ln in enumerate(lines) if ln.strip().endswith('?')), default=-1)
                passage, stem = (' '.join(lines[:li]).strip(), ' '.join(lines[li:]).strip()) if li > 0 else (None, ' '.join(lines).strip())
    stype = 'notes' if notes else ('passage' if passage else 'none')
    if stype == 'notes' and passage and '•' not in passage:
        passage = bulletize_notes(passage)
    return stem, passage, stype

def page_text_minus_rect(page, rect, pad=3):
    """Page text with words inside the figure bbox dropped — a vector table's
    cell text (numbers, axis labels, caption) must not leak into the passage."""
    if rect is None:
        return page.get_text()
    zone = pymupdf.Rect(rect[0] - pad, rect[1] - pad, rect[2] + pad, rect[3] + pad)
    words = page.get_text('words')  # x0,y0,x1,y1, word, block, line, word_no
    kept = []
    for w in words:
        cx = (w[0] + w[2]) / 2
        cy = (w[1] + w[3]) / 2
        if not zone.contains(pymupdf.Point(cx, cy)):
            kept.append(w)
    lines = {}
    for w in kept:
        lines.setdefault((w[5], w[6]), []).append((w[7], w[4]))
    out = []
    for key in sorted(lines):
        out.append(' '.join(word for _, word in sorted(lines[key])))
    return '\n'.join(out)


def parse_question(doc, pages):
    # RW: find the figure first so its text can be filtered out of the passage
    figs = extract_figure(doc, pages)
    fig_by_page = {pno: rect for pno, rect in figs}
    text = '\n'.join(
        page_text_minus_rect(doc[p], fig_by_page.get(p)) for p in pages
    )
    text = '\n'.join(repair_line(ln) for ln in text.split('\n'))
    text = CTRL_JUNK.sub('', text)
    m = re.search(r'\nQuestion\n', text)
    if not m:
        return None
    meta = split_meta(text[:m.start()])
    if meta is None:
        return None
    is_math = meta['section'] == 'math'
    body = text[m.end():]

    if '\nAnswer\n' in body:
        qtext, after = body.split('\nAnswer\n', 1)
        spans = list(re.finditer(r'^([A-D])\.(?:\s|$)', after, re.M))
        run = []
        for cm in spans:
            if cm.group(1) == 'A':
                run = [cm]
            elif run and ord(cm.group(1)) == ord(run[-1].group(1)) + 1:
                run.append(cm)
            else:
                run = []
            if len(run) == 4:
                break
        if len(run) != 4 and not is_math:
            return None
        if len(run) == 4:
            tail = after[run[3].end():]
            m_ans = re.search(r'^(Correct Answer:?\s*|Rationale\b|Choice [A-D]\b)', tail, re.M)
            d_end = m_ans.start() if m_ans else len(tail)
            choices = []
            for k, cm in enumerate(run):
                seg = after[cm.end(): run[k + 1].start() if k + 1 < 4 else run[3].end() + d_end]
                seg = ' '.join(seg.split())
                choices.append({'id': cm.group(1), 'text': seg if seg else ('[image]' if is_math else seg)})
            rationale = ' '.join(tail[d_end:].split()).strip()
        else:
            # math export sometimes drops the Answer marker -> treat as grid-in
            qtext, choices, rationale = body, [], ''
    else:
        qtext, choices, rationale = body, [], ''

    qtype = 'grid_in' if not choices else 'mcq'
    # stem/passage
    stem, passage, stype = split_stem(qtext)
    # correct answer
    correct = None
    if m := re.search(r'Correct Answer:?\s*([A-D])(?![0-9a-z./])', body):
        correct = m.group(1)
    elif qtype == 'mcq':
        rat = ' '.join(rationale.split())
        if m := re.search(r'Choice ([A-D]) is (?:the best answer|correct)', rat):
            correct = m.group(1)
        else:
            bad = set()
            for mm in re.finditer(r'Choices?\s+((?:[A-D](?:\s*(?:,|and)\s*)?)+)\s+(?:is|are)\s+incorrect', rat):
                bad |= set(re.findall(r'[A-D]', mm.group(1)))
            rem = {'A', 'B', 'C', 'D'} - bad
            correct = rem.pop() if len(rem) == 1 else None
    else:
        if m := re.search(r'Correct Answer:?\s*(\.?[0-9][0-9,./ ]*)', body):
            tokens = [t.strip(' .') for t in m.group(1).split(',')]
            tokens = [t for t in tokens if t]
            frac = next((t for t in tokens if '/' in t), None)
            correct = frac or (tokens[0] if tokens else None)
    rationale = re.sub(r'^(Correct Answer:?\s*[A-D0-9./, ]*\s*|Rationale\s*)', '', ' '.join(rationale.split())).strip()
    while True:
        stripped = re.sub(r'^(Correct Answer:?\s*[A-D0-9./, ]*\s*|Rationale\s*)', '', rationale)
        if stripped == rationale:
            break
        rationale = stripped
    return dict(meta=meta, stem=stem, passage=passage, stype=stype, qtype=qtype,
                choices=choices, correct=correct, rationale=rationale, figure_pages=figs)

# --- main ---------------------------------------------------------------------

def load_pdf_pair(all_path: Path, excl_path: Path):
    doc = pymupdf.open(all_path)
    excl = pymupdf.open(excl_path)
    ids_b = set()
    for p in range(excl.page_count):
        ids_b |= set(re.findall(r'Question ID: ([0-9a-f]+)', excl[p].get_text()))
    return doc, ids_b

def main():
    pairs = [
        (SRC / 'EVERYTHING.pdf', SRC / 'EXCLUDING bluebook ones.pdf'),
        (SRC / 'EVERYTHING math.pdf', SRC / 'EXCLUDING bluebook math.pdf'),
    ]
    BANK.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

    existing = {f.stem for f in BANK.glob('ssqb-*.json')}
    index_entries = {}
    if INDEX.exists():  # keep prior entries for records that still exist
        for ln in INDEX.read_text().splitlines():
            if ln.strip():
                try:
                    e = json.loads(ln)
                    if (BANK.parent / e['path']).exists():
                        index_entries[e['sourceId']] = ln
                except json.JSONDecodeError:
                    pass

    stats = Counter()
    problems = []

    for all_path, excl_path in pairs:
        if not all_path.exists() or not excl_path.exists():
            print(f'skip (missing): {all_path.name}')
            continue
        doc, ids_b = load_pdf_pair(all_path, excl_path)
        chunks = question_chunks(doc)
        only_b = ids_b - {q for q, _ in chunks}
        if only_b:
            print(f'FATAL {all_path.name}: {len(only_b)} IDs in the excluding PDF but not in the all PDF — refusing')
            sys.exit(1)
        print(f'{all_path.name}: {len(chunks)} questions; excluding-set {len(ids_b)}')

        for qid, pages in chunks:
            if f'ssqb-{qid}' in existing:
                stats['already-harvested'] += 1
                continue
            parsed = parse_question(doc, pages)
            if parsed is None or parsed['correct'] is None or not parsed['stem']:
                stats['parse-failed'] += 1
                problems.append(qid)
                continue
            meta = parsed['meta']
            origin = 'question_bank' if qid in ids_b else 'bluebook'
            stats[origin] += 1

            fig_asset = None
            if meta['section'] == 'math':
                img = render_question_image(doc, pages)
                if img is not None:
                    fig_asset = f'assets/ssqb-{qid}.png'
                    img.save(ASSETS / f'ssqb-{qid}.png')
                    stats['with-image'] += 1
            else:
                if parsed['figure_pages']:
                    imgs = []
                    for pno, rect in parsed['figure_pages']:
                        pix = doc[pno].get_pixmap(dpi=150, clip=pymupdf.Rect(*rect))
                        imgs.append(Image.frombytes('RGB', (pix.width, pix.height), pix.samples))
                    img = vstack(imgs)
                    if img is not None:
                        fig_asset = f'assets/ssqb-{qid}.png'
                        img.save(ASSETS / f'ssqb-{qid}.png')
                        stats['with-figure'] += 1

            diff_official, diff_internal = DIFF_MAP[meta['difficulty']]
            skill_name = meta['skill']
            if skill_name == 'Command of Evidence':
                skill_name = 'Command of Evidence Quantitative' if fig_asset else 'Command of Evidence Textual'
            stim_type = 'figure' if fig_asset else parsed['stype']

            rec = {
                'sourceId': f'ssqb-{qid}',
                'origin': origin,
                'section': meta['section'],
                'domain': meta['domain'],
                'skill': slug_skill(skill_name),
                'difficultyOfficial': diff_official,
                'difficultyInternal': diff_internal,
                'questionType': parsed['qtype'],
                'stimulus': {'type': stim_type, 'text': parsed['passage'], 'tableJson': None, 'figureAsset': fig_asset},
                'stem': parsed['stem'],
                'choices': parsed['choices'],
                'correctAnswer': parsed['correct'],
                'rationale': parsed['rationale'] or None,
                'sourceUrl': SOURCE_URL,
                'harvestedAt': now,
                'allowedUses': ['internal_eval'],
            }
            name = f'ssqb-{qid}.json'
            (BANK / name).write_text(json.dumps(rec, indent=2) + '\n')
            existing.add(f'ssqb-{qid}')
            index_entries[rec['sourceId']] = json.dumps({
                'sourceId': rec['sourceId'], 'section': rec['section'], 'domain': rec['domain'],
                'skill': rec['skill'], 'difficultyOfficial': diff_official,
                'questionType': parsed['qtype'], 'path': f'question-bank/{name}',
            })

    INDEX.write_text('\n'.join(index_entries.values()) + '\n')
    print('stats:', dict(stats))
    print('problems:', problems[:20], f'({len(problems)} total)')
    print(f'bank now holds {len(index_entries)} records')

if __name__ == '__main__':
    sys.exit(main())

/**
 * Static spot-check gallery of harvested SAT math records.
 *
 * Renders every math record in research/sat/question-bank/ssqb-*.json to
 * review-gallery/harvested-math.html so the vision-transcription sweep can be
 * spot-checked: figure PNG (served from bluebook-mockup/public/assets/),
 * figure context text, stem, choices with the correct answer marked,
 * rationale, skill, provenance badge (source + verified ✓/✗), and the
 * record's issue list from math-quality-report.json when present.
 *
 * Cards are ordered worst-first — hard failures, then pending/unverified,
 * then verified, then clean — and a filter bar (All / Issues / Unverified /
 * Verified / Pending) narrows the list. Per-record status mirrors
 * scripts/validate-math-bank.ts: needsTranscription records whose only
 * problems are content problems are "pending transcription"; everything else
 * with problems is a hard failure. \( ... \) math renders via KaTeX
 * auto-render.
 *
 * Usage: tsx scripts/harvest-gallery.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'review-gallery');
const BANK_DIR = path.join(REPO_ROOT, 'research', 'sat', 'question-bank');
const REPORT_PATH = path.join(BANK_DIR, 'math-quality-report.json');
/** Figure src relative to review-gallery/harvested-math.html. */
const FIGURE_BASE = '../bluebook-mockup/public/assets';

type Status = 'hard' | 'pending' | 'clean';

const STATUS_LABEL: Record<Status, string> = {
  hard: 'hard failure',
  pending: 'pending transcription',
  clean: 'clean',
};

interface BankRecord {
  sourceId?: string;
  section?: string;
  domain?: string;
  skill?: string;
  difficultyOfficial?: string;
  questionType?: string;
  stem?: string;
  choices?: Array<{ id?: string; text?: string }>;
  correctAnswer?: string;
  rationale?: string;
  needsTranscription?: boolean;
  stimulus?: { type?: string; text?: string; figureAsset?: string };
  provenance?: { source?: string; at?: string; verified?: boolean };
}

interface QualityReport {
  generatedAt: string;
  totalMath: number;
  clean: number;
  pendingTranscription: number;
  hardFailures: number;
  issues: Array<{ id: string; problems: string[] }>;
}

interface Entry {
  sourceId: string;
  record: BankRecord;
  problems: string[];
  status: Status;
  verified: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escaped text, or a visible marker when the field is empty/missing. */
function textOrEmpty(s: string | undefined): string {
  const t = (s ?? '').trim();
  return t.length === 0 ? '<span class="empty">(empty)</span>' : escapeHtml(t);
}

/** Harvested payloads carry fields at top level; tolerate a `payload` wrapper. */
function payloadOf(file: string): BankRecord | null {
  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const inner = record.payload;
  const payload = inner !== null && typeof inner === 'object' && !Array.isArray(inner) ? inner : record;
  return payload as BankRecord;
}

/** Problem messages from the figure-PNG asset checks (not content problems). */
function isPngProblem(message: string): boolean {
  return message.startsWith('figure PNG');
}

/** Same classification as scripts/validate-math-bank.ts. */
function statusOf(record: BankRecord, problems: string[]): Status {
  const needsTranscription = record.needsTranscription === true;
  if (problems.length === 0) return needsTranscription ? 'pending' : 'clean';
  if (needsTranscription && problems.every((p) => !isPngProblem(p))) return 'pending';
  return 'hard';
}

function loadReport(): QualityReport {
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as QualityReport;
}

function loadEntries(report: QualityReport): Entry[] {
  const problemsById = new Map(report.issues.map((issue) => [issue.id, issue.problems]));
  const entries: Entry[] = [];
  const files = fs
    .readdirSync(BANK_DIR)
    .filter((f) => f.startsWith('ssqb-') && f.endsWith('.json'))
    .sort();
  for (const file of files) {
    const fallbackId = path.basename(file, '.json');
    const record = payloadOf(path.join(BANK_DIR, file));
    if (!record || record.section !== 'math') continue;
    const sourceId = record.sourceId && record.sourceId.length > 0 ? record.sourceId : fallbackId;
    const problems = problemsById.get(sourceId) ?? [];
    entries.push({
      sourceId,
      record,
      problems,
      status: statusOf(record, problems),
      verified: record.provenance?.verified === true,
    });
  }
  return entries;
}

/** Worst-first: hard failures, pending/unverified, verified, clean. */
function sortRank(entry: Entry): number {
  if (entry.status === 'hard') return 0;
  if (entry.status === 'pending' || !entry.verified) return 1;
  if (entry.status === 'clean') return 3;
  return 2;
}

function renderChoices(record: BankRecord): string {
  if (record.questionType === 'grid_in') {
    const answer = (record.correctAnswer ?? '').trim();
    const rendered = answer.length > 0 ? escapeHtml(answer) : '<span class="empty">(empty)</span>';
    return `<p class="gridin">Grid-in answer: <code>${rendered}</code></p>`;
  }
  const items = (record.choices ?? [])
    .map((c) => {
      const id = String(c.id ?? '?');
      const correct = id === record.correctAnswer;
      return `<li class="choice${correct ? ' correct' : ''}"><span class="choice-id">${escapeHtml(id)}</span><span class="choice-text">${textOrEmpty(c.text)}</span></li>`;
    })
    .join('\n          ');
  return `<ol class="choices">${items}</ol>`;
}

function renderProvenance(record: BankRecord): string {
  const p = record.provenance;
  if (!p) return '<span class="badge prov-none">no provenance ✗</span>';
  const source = escapeHtml(String(p.source ?? '?'));
  const at = p.at ? ` · ${escapeHtml(String(p.at))}` : '';
  return p.verified === true
    ? `<span class="badge prov-ok">${source}${at} · verified ✓</span>`
    : `<span class="badge prov-bad">${source}${at} · unverified ✗</span>`;
}

function renderCard(entry: Entry): string {
  const { sourceId, record, problems, status, verified } = entry;
  const buckets = [
    problems.length > 0 ? 'b-issues' : '',
    verified ? 'b-verified' : 'b-unverified',
    status === 'pending' ? 'b-pending' : '',
  ].filter((b) => b.length > 0);
  const figure = record.stimulus?.figureAsset
    ? `<img src="${FIGURE_BASE}/${escapeHtml(sourceId)}.png" alt="figure ${escapeHtml(sourceId)}" loading="lazy">`
    : '<div class="no-figure">no figure asset</div>';
  const figureText = record.stimulus?.text?.trim()
    ? `<p class="figure-text">${escapeHtml(record.stimulus.text)}</p>`
    : '';
  const issues =
    problems.length > 0
      ? `<ul class="problems">${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
      : '';
  const answerLine =
    record.questionType === 'grid_in'
      ? ''
      : `<p class="answer-line">Correct answer: <b>${escapeHtml(String(record.correctAnswer ?? '?'))}</b></p>`;
  return `    <article class="card status-${status} ${buckets.join(' ')}">
      <div class="fig">${figure}</div>
      <div class="body">
        <header>
          <span class="id">${escapeHtml(sourceId)}</span>
          <span class="tag">${escapeHtml(String(record.skill ?? '?'))}</span>
          <span class="tag">${escapeHtml(String(record.questionType ?? '?'))}${record.difficultyOfficial ? ` · ${escapeHtml(record.difficultyOfficial)}` : ''}</span>
          <span class="tag tag-${status}">${escapeHtml(STATUS_LABEL[status])}</span>
          ${renderProvenance(record)}
        </header>
        ${figureText}
        <p class="stem">${textOrEmpty(record.stem)}</p>
        ${renderChoices(record)}
        ${answerLine}
        <p class="rationale"><span class="rationale-label">Rationale:</span> ${textOrEmpty(record.rationale)}</p>
        ${issues}
      </div>
    </article>`;
}

function main(): void {
  const report = loadReport();
  const entries = loadEntries(report);
  entries.sort((a, b) => sortRank(a) - sortRank(b) || a.sourceId.localeCompare(b.sourceId));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const counts = {
    all: entries.length,
    issues: entries.filter((e) => e.problems.length > 0).length,
    unverified: entries.filter((e) => !e.verified).length,
    verified: entries.filter((e) => e.verified).length,
    pending: entries.filter((e) => e.status === 'pending').length,
  };

  const cards = entries.map(renderCard).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>studyMaste harvested math review gallery</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <script>
    window.addEventListener('load', function () {
      if (window.renderMathInElement) {
        renderMathInElement(document.body, { delimiters: [{ left: '\\\\(', right: '\\\\)', display: false }], throwOnError: false });
      }
    });
  </script>
  <style>
    body { margin: 0; padding: 24px; background: #f6f6f4; color: #1a1a1a;
           font: 15px/1.5 -apple-system, "Segoe UI", sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p.sub { margin: 0 0 16px; color: #555; }
    .filters { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px;
               padding: 10px 0; margin-bottom: 16px; background: #f6f6f4; }
    .filters button { border: 1px solid #ccc; background: #fff; border-radius: 14px;
                      padding: 4px 12px; font-size: 13px; cursor: pointer; }
    .filters button.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
    .cards { display: flex; flex-direction: column; gap: 16px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 16px;
            display: flex; gap: 16px; }
    .card.status-hard { border-left: 4px solid #b02a37; }
    .card.status-pending { border-left: 4px solid #c98a00; }
    .card.status-clean { border-left: 4px solid #1e6b34; }
    .fig { flex: 0 0 240px; }
    .fig img { max-width: 100%; height: auto; border: 1px solid #e2e2dd; border-radius: 4px;
               background: #fff; }
    .no-figure { display: flex; align-items: center; justify-content: center; width: 240px;
                 height: 160px; border: 1px dashed #ccc; border-radius: 4px; color: #999;
                 font-size: 12px; }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .card header { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
    .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
          font-weight: 600; margin-right: 4px; }
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #eee; color: #444; }
    .tag-hard { background: #f8d7da; color: #8b1f2b; }
    .tag-pending { background: #fff3cd; color: #7a5c00; }
    .tag-clean { background: #d4edda; color: #1e6b34; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
    .prov-ok { background: #d4edda; color: #1e6b34; }
    .prov-bad { background: #fff3cd; color: #7a5c00; }
    .prov-none { background: #eee; color: #888; }
    .figure-text { margin: 0; font-size: 13px; color: #555; white-space: pre-wrap; }
    .stem { margin: 0; font-weight: 600; }
    .choices { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column;
               gap: 6px; }
    .choice { display: flex; gap: 8px; align-items: baseline; border: 1px solid #e2e2dd;
              border-radius: 4px; padding: 6px 10px; font-size: 14px; }
    .choice.correct { border-color: #1e6b34; background: #eef7f0; }
    .choice-id { font-weight: 700; min-width: 14px; }
    .choice-text { flex: 1; }
    .gridin { margin: 0; font-size: 14px; }
    .answer-line { margin: 0; font-size: 13px; color: #333; }
    .rationale { margin: 0; font-size: 13px; color: #333; }
    .rationale-label { color: #555; }
    .problems { margin: 0; padding-left: 18px; font-size: 12px; color: #8b1f2b; }
    .empty { color: #b02a37; font-style: italic; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Harvested math review gallery</h1>
  <p class="sub">${counts.all} math records rendered — quality report ${escapeHtml(report.generatedAt)}: ${report.clean} clean, ${report.pendingTranscription} pending transcription, ${report.hardFailures} hard failures (of ${report.totalMath} total). Sorted worst-first. Derived artifact; regenerate with <code>tsx scripts/harvest-gallery.ts</code>.</p>
  <div class="filters">
    <button class="active" data-filter="all" onclick="applyFilter(this)">All (${counts.all})</button>
    <button data-filter="issues" onclick="applyFilter(this)">Issues (${counts.issues})</button>
    <button data-filter="unverified" onclick="applyFilter(this)">Unverified (${counts.unverified})</button>
    <button data-filter="verified" onclick="applyFilter(this)">Verified (${counts.verified})</button>
    <button data-filter="pending" onclick="applyFilter(this)">Pending (${counts.pending})</button>
  </div>
  <main class="cards">
${cards}
  </main>
  <script>
    function applyFilter(btn) {
      var f = btn.getAttribute('data-filter');
      var buttons = document.querySelectorAll('.filters button');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', buttons[i] === btn);
      }
      var cards = document.querySelectorAll('.card');
      for (var j = 0; j < cards.length; j++) {
        cards[j].style.display = (f === 'all' || cards[j].classList.contains('b-' + f)) ? '' : 'none';
      }
    }
  </script>
</body>
</html>
`;

  const outPath = path.join(OUT_DIR, 'harvested-math.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(
    `Wrote ${counts.all} math records to review-gallery/harvested-math.html ` +
      `(issues ${counts.issues}, unverified ${counts.unverified}, verified ${counts.verified}, pending ${counts.pending})`,
  );
}

main();

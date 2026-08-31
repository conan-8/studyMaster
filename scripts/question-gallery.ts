/**
 * Static review gallery of every generated question draft.
 *
 * Renders each draft in research/sat/generated/ (plus the approved
 * test-fixtures) to review-gallery/index.html: stimulus (passage, table,
 * notes, or rendered SVG figure), stem, choices with misconception wiring,
 * grid-in answers, rationale, and provenance. Correct answers are hidden
 * behind the "Show answers" toggle so the page doubles as a blind review
 * tool.
 *
 * Usage: npm run gallery:questions
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/renderers/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'review-gallery');
const GENERATED_DIR = path.join(REPO_ROOT, 'research', 'sat', 'generated');
const FIXTURES_DIR = path.join(REPO_ROOT, 'research', 'sat', 'test-fixtures');

const DIFFICULTY_LABEL: Record<number, string> = { 2: 'easy', 3: 'medium', 4: 'hard' };

interface QuestionFile {
  file: string;
  data: Record<string, any>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * RW items mark underlined portions of passages with <u>...</u>; escape
 * everything else but render those tags for real.
 */
function escapeHtmlKeepUnderline(s: string): string {
  return escapeHtml(s)
    .replace(/&lt;u&gt;/g, '<u>')
    .replace(/&lt;\/u&gt;/g, '</u>');
}

function loadQuestions(): QuestionFile[] {
  const out: QuestionFile[] = [];
  const fromGenerated = fs
    .readdirSync(GENERATED_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(GENERATED_DIR, f));
  const fromFixtures = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.startsWith('generated-') && f.endsWith('.json'))
    .map((f) => path.join(FIXTURES_DIR, f));
  for (const file of [...fromGenerated, ...fromFixtures].sort()) {
    out.push({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any> });
  }
  return out;
}

function renderTable(tableJson: {
  caption?: string;
  title?: string;
  columns?: string[];
  headers?: string[];
  rows: (string | number)[][];
}): string {
  const columns = tableJson.columns ?? tableJson.headers ?? [];
  const head = columns.map((c) => `<th>${escapeHtml(String(c))}</th>`).join('');
  const body = tableJson.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`)
    .join('');
  const caption =
    tableJson.caption ?? tableJson.title
      ? `<caption>${escapeHtml(String(tableJson.caption ?? tableJson.title))}</caption>`
      : '';
  return `<table class="data">${caption}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderStimulus(stimulus: Record<string, any>): string {
  const parts: string[] = [];
  if (stimulus.type === 'passage') {
    parts.push(`<blockquote class="passage">${escapeHtmlKeepUnderline(stimulus.text)}</blockquote>`);
  } else if (stimulus.type === 'notes') {
    parts.push(`<blockquote class="passage notes">${escapeHtmlKeepUnderline(stimulus.text)}</blockquote>`);
  } else if (stimulus.type === 'table') {
    parts.push(renderTable(stimulus.tableJson));
    if (stimulus.text) parts.push(`<p class="stimulus-text">${escapeHtmlKeepUnderline(stimulus.text)}</p>`);
  } else if (stimulus.type === 'figure') {
    if (stimulus.diagram) {
      const svg = render(stimulus.diagram.archetypeId, structuredClone(stimulus.diagram.parameters));
      parts.push(`<div class="figure">${svg.replace(/^<\?xml[^?]*\?>\s*/, '').trim()}</div>`);
    }
    if (stimulus.text) parts.push(`<p class="stimulus-text">${escapeHtmlKeepUnderline(stimulus.text)}</p>`);
  }
  return parts.join('\n');
}

function renderChoices(data: Record<string, any>): string {
  if (data.questionType === 'grid_in') {
    return `<div class="gridin">Grid-in answer: <span class="answer"><code>${escapeHtml(String(data.correctAnswer))}</code></span></div>`;
  }
  const items = (data.choices as Array<{ id: string; text: string; misconceptionId: string | null }>)
    .map((c) => {
      const correct = c.id === data.correctAnswer;
      const mis = c.misconceptionId
        ? `<span class="misconception">${escapeHtml(c.misconceptionId)}</span>`
        : '<span class="misconception">key</span>';
      return `<li class="choice${correct ? ' correct' : ''}"><span class="choice-id answer">${c.id}</span><span class="choice-text">${escapeHtmlKeepUnderline(c.text)}</span>${mis}</li>`;
    })
    .join('\n');
  return `<ol class="choices">${items}</ol>`;
}

function renderCard({ file, data }: QuestionFile): string {
  const skill = String(data.taxonomyCode ?? '');
  const review = data.review?.status ?? 'unknown';
  const difficulty = DIFFICULTY_LABEL[data.difficultyTarget as number] ?? String(data.difficultyTarget);
  const provenance = data.provenance ?? {};
  return `    <article class="card">
      <header>
        <span class="id">${escapeHtml(data.id)}</span>
        <span class="tag">${escapeHtml(data.subjectCode)}</span>
        <span class="tag">${escapeHtml(skill)}</span>
        <span class="tag">${escapeHtml(data.questionType)} · ${escapeHtml(difficulty)}</span>
        <span class="tag review-${escapeHtml(review)}">${escapeHtml(review)}</span>
      </header>
      <div class="stimulus">${renderStimulus(data.stimulus)}</div>
      <p class="stem">${escapeHtmlKeepUnderline(data.stem)}</p>
      ${renderChoices(data)}
      <details class="rationale"><summary>Rationale</summary><p>${escapeHtml(data.rationale)}</p></details>
      <footer>
        <span>${escapeHtml(path.relative(REPO_ROOT, file))}</span>
        <span>model ${escapeHtml(String(provenance.model ?? '?'))} · prompt ${escapeHtml(String(provenance.promptVersion ?? '?'))}</span>
        <span>hash ${escapeHtml(String(provenance.contentHash ?? '?').slice(0, 12))}…</span>
      </footer>
    </article>`;
}

function main(): void {
  const questions = loadQuestions();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const counts = {
    total: questions.length,
    mcq: questions.filter((q) => q.data.questionType === 'mcq').length,
    grid_in: questions.filter((q) => q.data.questionType === 'grid_in').length,
    pending: questions.filter((q) => q.data.review?.status === 'pending').length,
    approved: questions.filter((q) => q.data.review?.status === 'approved').length,
  };

  const cards = questions.map(renderCard).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>studyMaste question review gallery</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body, { delimiters: [{ left: '\\\\(', right: '\\\\)', display: false }], throwOnError: false });"></script>
  <style>
    body { margin: 0; padding: 24px; background: #f6f6f4; color: #1a1a1a;
           font: 15px/1.5 -apple-system, "Segoe UI", sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p.sub { margin: 0 0 20px; color: #555; }
    .toggle { margin-bottom: 16px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(560px, 1fr));
             gap: 16px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 16px;
            display: flex; flex-direction: column; gap: 10px; }
    .card header { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
    .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
          font-weight: 600; margin-right: 4px; }
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #eee; color: #444; }
    .review-pending { background: #fff3cd; color: #7a5c00; }
    .review-approved { background: #d4edda; color: #1e6b34; }
    .review-rejected { background: #f8d7da; color: #8b1f2b; }
    .passage { margin: 0; padding: 10px 14px; background: #fafaf7; border-left: 3px solid #ccc;
               font-size: 14px; white-space: pre-wrap; }
    .passage.notes { font-size: 13px; }
    .stimulus-text { margin: 8px 0 0; font-size: 14px; }
    table.data { border-collapse: collapse; font-size: 14px; }
    table.data caption { caption-side: top; font-size: 13px; color: #555; padding-bottom: 4px; }
    table.data th, table.data td { border: 1px solid #ccc; padding: 4px 10px; text-align: left; }
    table.data th { background: #f0f0ec; }
    .figure { display: flex; justify-content: center; }
    .figure svg { max-width: 100%; height: auto; }
    .stem { margin: 0; font-weight: 600; }
    .choices { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .choice { display: flex; gap: 8px; align-items: baseline; border: 1px solid #e2e2dd;
              border-radius: 4px; padding: 6px 10px; font-size: 14px; }
    .choice-id { font-weight: 700; min-width: 14px; }
    .choice-text { flex: 1; }
    .misconception { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                     font-size: 11px; color: #888; }
    .answer { display: none; }
    body.show-answers .answer { display: inline; }
    body.show-answers .choice.correct { border-color: #1e6b34; background: #eef7f0; }
    .gridin { font-size: 14px; }
    .rationale summary { cursor: pointer; font-size: 13px; color: #555; }
    .rationale p { margin: 6px 0 0; font-size: 13px; color: #333; }
    .card footer { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: #999;
                   font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>
  <h1>Question review gallery</h1>
  <p class="sub">${counts.total} questions (${counts.mcq} MCQ, ${counts.grid_in} grid-in) — ${counts.pending} pending, ${counts.approved} approved. Derived artifact; regenerate with <code>npm run gallery:questions</code>.</p>
  <label class="toggle"><input type="checkbox" onchange="document.body.classList.toggle('show-answers', this.checked)"> Show answers &amp; misconception wiring</label>
  <main class="cards">
${cards}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
  console.log(`Wrote ${counts.total} questions to review-gallery/index.html`);
}

main();

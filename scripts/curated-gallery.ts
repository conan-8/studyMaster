/**
 * Curated review gallery — renders every display-ready curated record
 * (research/sat/curated/ssqb-*.json) to review-gallery/curated.html using the
 * SAME region layout as the simulator: info pane (left) | prompt + options
 * (right), figure PNGs inline. Text is rendered VERBATIM with the author
 * markup (\\( \\) LaTeX via KaTeX auto-render, [[ ]] underline, **bold**,
 * *italic*, blank line = paragraph) so the page previews exactly what the
 * simulator will show. Correct answers hidden behind the "Show answers"
 * toggle. Derived artifact; regenerate with npm run gallery:curated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'review-gallery');
const CURATED_DIR = path.join(REPO_ROOT, 'research', 'sat', 'curated');

interface CuratedRecord {
  sourceId: string;
  origin: string;
  section: string;
  domain: string;
  skill: string;
  difficultyOfficial: string;
  difficultyInternal: number;
  questionType: string;
  info: string | null;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  gridAnswer: string | null;
  correctAnswer: string;
  rationale: string | null;
  diagram: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Author markup on top of escaped HTML: [[ ]] underline, **bold**, *italic*.
 *  \\( \\) math is left untouched for the KaTeX auto-render pass. */
function renderMarkup(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\{\{imgfull:(.+?)\}\}/g, '<img class="block-img" src="../research/sat/$1" alt="">');
  out = out.replace(/\{\{img:(.+?)\}\}/g, '<img class="inline-img" src="../research/sat/$1" alt="">');
  out = out.replace(/\[\[(.+?)\]\]/g, '<u>$1</u>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return out;
}

function renderCard(rec: CuratedRecord): string {
  const figure = rec.diagram
    ? `<img class="figure-img" src="../research/sat/${escapeHtml(rec.diagram)}" alt="figure">`
    : '';
  const infoPane =
    rec.info || rec.diagram
      ? `<div class="pane info">${figure}${rec.info ? `<div class="passage">${renderMarkup(rec.info)}</div>` : ''}</div>`
      : '';
  const options =
    rec.options.length > 0
      ? `<ol class="choices">${rec.options
          .map(
            (o) =>
              `<li class="choice${o.id === rec.correctAnswer ? ' correct' : ''}"><span class="choice-id answer">${o.id}</span><span class="choice-text">${renderMarkup(o.text)}</span></li>`,
          )
          .join('\n')}</ol>`
      : `<div class="gridin">Grid-in answer: <span class="answer"><code>${escapeHtml(String(rec.gridAnswer))}</code></span></div>`;
  const rationale = rec.rationale
    ? `<details class="rationale"><summary>Rationale</summary><p>${renderMarkup(rec.rationale)}</p></details>`
    : '';
  return `    <article class="card">
      <header>
        <span class="id">${escapeHtml(rec.sourceId)}</span>
        <span class="tag">${escapeHtml(rec.origin)}</span>
        <span class="tag">${escapeHtml(rec.domain)}</span>
        <span class="tag">${escapeHtml(rec.skill)}</span>
        <span class="tag">${escapeHtml(rec.questionType)} · ${escapeHtml(rec.difficultyOfficial)}</span>
      </header>
      <div class="body">
        ${infoPane}
        <div class="pane question">
          <p class="stem">${renderMarkup(rec.prompt)}</p>
          ${options}
          ${rationale}
        </div>
      </div>
    </article>`;
}

function main(): void {
  const records = fs
    .readdirSync(CURATED_DIR)
    .filter((f) => f.startsWith('ssqb-') && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(CURATED_DIR, f), 'utf8')) as CuratedRecord);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const counts = {
    total: records.length,
    withFigure: records.filter((r) => r.diagram).length,
    bluebook: records.filter((r) => r.origin === 'bluebook').length,
  };

  const cards = records.map(renderCard).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>studyMaste curated question gallery</title>
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
    .cards { display: flex; flex-direction: column; gap: 16px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 16px; }
    .card header { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; margin-bottom: 10px; }
    .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; }
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #eee; color: #444; }
    .body { display: flex; gap: 14px; }
    .pane { flex: 1; }
    .pane.info { background: #fafaf7; border-right: 2px dashed #ccc; padding-right: 14px; }
    .passage { font-size: 14px; white-space: pre-wrap; }
    .figure-img { display: block; margin: 0 auto 10px; max-width: 100%; }
    .inline-img { display: inline-block; max-height: 2.2em; vertical-align: middle; margin: 0 2px; }
    .block-img { display: block; margin: 10px auto; max-width: 100%; max-height: 360px; }
    .stem { margin: 0 0 10px; font-weight: 600; white-space: pre-wrap; }
    .choices { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .choice { display: flex; gap: 8px; align-items: baseline; border: 1px solid #e2e2dd;
              border-radius: 4px; padding: 6px 10px; font-size: 14px; }
    .choice-id { font-weight: 700; min-width: 14px; }
    .choice-text { flex: 1; white-space: pre-wrap; }
    .answer { display: none; }
    body.show-answers .answer { display: inline; }
    body.show-answers .choice.correct { border-color: #1e6b34; background: #eef7f0; }
    .gridin { font-size: 14px; }
    .rationale summary { cursor: pointer; font-size: 13px; color: #555; }
    .rationale p { margin: 6px 0 0; font-size: 13px; color: #333; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Curated question gallery</h1>
  <p class="sub">${counts.total} curated questions (${counts.withFigure} with figure, ${counts.bluebook} bluebook). Rendered verbatim from research/sat/curated/ — same regions as the simulator. Regenerate with <code>npm run gallery:curated</code>.</p>
  <label class="toggle"><input type="checkbox" onchange="document.body.classList.toggle('show-answers', this.checked)"> Show answers</label>
  <main class="cards">
${cards}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT_DIR, 'curated.html'), html, 'utf8');
  console.log(`Wrote ${counts.total} curated questions to review-gallery/curated.html`);
}

main();

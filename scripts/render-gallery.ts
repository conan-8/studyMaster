/**
 * Visual gallery of every diagram archetype renderer.
 *
 * Renders each archetype with its golden params (src/renderers/tests/golden.ts)
 * plus the generated-math-systems-001 fixture's stimulus.diagram end-to-end,
 * writing one standalone .svg per figure to rendered-gallery/ plus an
 * index.html that inlines every figure in a clean grid (no external assets).
 *
 * Usage: npm run gallery
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/renderers/index.js';
import { loadDiagramArchetype } from '../src/renderers/lib/diagram.js';
import { GOLDEN } from '../src/renderers/tests/golden.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'rendered-gallery');
const E2E_FIXTURE = path.join(
  REPO_ROOT,
  'research',
  'sat',
  'test-fixtures',
  'generated-math-systems-001.json',
);

interface GalleryEntry {
  /** File-safe id (':' replaced by '-'). */
  fileId: string;
  caption: string;
  svg: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main(): void {
  const entries: GalleryEntry[] = [];

  for (const archetypeId of Object.keys(GOLDEN).sort()) {
    const params = GOLDEN[archetypeId]!;
    const title = loadDiagramArchetype(archetypeId).title;
    entries.push({
      fileId: archetypeId.replaceAll(':', '-'),
      caption: `${archetypeId} — ${title}`,
      svg: render(archetypeId, structuredClone(params)),
    });
  }

  // End-to-end: the systems fixture's stimulus.diagram, exactly as a
  // generated question would carry it.
  const fixture = JSON.parse(fs.readFileSync(E2E_FIXTURE, 'utf8')) as {
    id: string;
    stimulus: { diagram: { archetypeId: string; parameters: Record<string, unknown> } | null };
  };
  const diagram = fixture.stimulus.diagram;
  if (diagram === null) throw new Error(`${fixture.id}: stimulus.diagram is null`);
  entries.push({
    fileId: 'e2e-generated-math-systems-001',
    caption: 'E2E: generated-math-systems-001',
    svg: render(diagram.archetypeId, structuredClone(diagram.parameters)),
  });

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const entry of entries) {
    fs.writeFileSync(path.join(OUT_DIR, `${entry.fileId}.svg`), entry.svg, 'utf8');
  }

  const cards = entries
    .map((entry) => {
      // Strip the XML prolog for HTML inlining (it would parse as a bogus
      // comment); the standalone .svg files keep it.
      const inlined = entry.svg.replace(/^<\?xml[^?]*\?>\s*/, '');
      return `    <figure class="card">
      <div class="figure">${inlined.trim()}</div>
      <figcaption>${escapeHtml(entry.caption)}</figcaption>
    </figure>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>studyMaste diagram renderer gallery</title>
  <style>
    body { margin: 0; padding: 24px; background: #f6f6f4; color: #1a1a1a;
           font: 14px/1.4 -apple-system, "Segoe UI", sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p.sub { margin: 0 0 20px; color: #555; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 16px; }
    .card { margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 6px;
            padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .figure { display: flex; justify-content: center; }
    .figure svg { max-width: 100%; height: auto; }
    figcaption { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                 font-size: 12px; color: #444; }
  </style>
</head>
<body>
  <h1>Diagram renderer gallery</h1>
  <p class="sub">${entries.length} figures — 13 archetypes at golden params + 1 end-to-end generated-question fixture. Derived artifact; regenerate with <code>npm run gallery</code>.</p>
  <main class="grid">
${cards}
  </main>
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');

  for (const entry of entries) {
    const bytes = Buffer.byteLength(entry.svg, 'utf8');
    console.log(`${entry.fileId}.svg\t${bytes} bytes`);
  }
  console.log(`index.html\t${Buffer.byteLength(html, 'utf8')} bytes`);
  console.log(`Wrote ${entries.length} SVGs + index.html to rendered-gallery/`);
}

main();

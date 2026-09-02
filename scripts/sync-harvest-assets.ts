/**
 * sync-harvest-assets: mirrors harvested figure PNGs from
 * research/sat/question-bank/assets/ into bluebook-mockup/public/assets/ so
 * the Bluebook mockup can render math figure questions.
 *
 *   tsx scripts/sync-harvest-assets.ts
 *
 * A destination file that already matches the source on size AND mtime is
 * skipped; otherwise it is (re)copied and the destination mtime is set to
 * the source mtime so later runs see it as identical. Mtimes are compared at
 * whole-second granularity: fs.utimesSync cannot round-trip sub-millisecond
 * precision, so whole seconds (exact for every filesystem involved) are the
 * reliable identity granularity. Prints copied and skipped counts. Exit 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/validate.js';

const SRC_DIR = path.join(REPO_ROOT, 'research', 'sat', 'assets');
const DEST_DIR = path.join(REPO_ROOT, 'bluebook-mockup', 'public', 'assets');

/** mtime identity granularity (see header comment). */
function mtimeSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function main(): void {
  const srcRel = path.relative(REPO_ROOT, SRC_DIR);
  const destRel = path.relative(REPO_ROOT, DEST_DIR);

  if (!fs.existsSync(SRC_DIR)) {
    console.log(`sync-harvest-assets: source dir ${srcRel}/ does not exist — nothing to sync`);
    console.log('copied 0, skipped 0');
    return;
  }

  const names = fs
    .readdirSync(SRC_DIR)
    .filter((n) => n.startsWith('ssqb-') && n.endsWith('.png'))
    .sort();

  let copied = 0;
  let skipped = 0;
  if (names.length > 0) fs.mkdirSync(DEST_DIR, { recursive: true });

  for (const name of names) {
    const src = path.join(SRC_DIR, name);
    const dest = path.join(DEST_DIR, name);
    const srcStat = fs.statSync(src);
    if (fs.existsSync(dest)) {
      const destStat = fs.statSync(dest);
      if (destStat.size === srcStat.size && mtimeSeconds(destStat.mtimeMs) === mtimeSeconds(srcStat.mtimeMs)) {
        skipped++;
        continue;
      }
    }
    fs.copyFileSync(src, dest);
    // Preserve source mtime (whole seconds) so the next run can skip identical files.
    fs.utimesSync(dest, Math.floor(srcStat.atimeMs / 1000), mtimeSeconds(srcStat.mtimeMs));
    copied++;
  }

  console.log(`sync-harvest-assets: ${srcRel}/ -> ${destRel}/ (${names.length} source PNG(s) scanned)`);
  console.log(`copied ${copied}, skipped ${skipped}`);
}

main();

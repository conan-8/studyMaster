/**
 * seed-curated.ts — merge ONLY the curated display-ready records
 * (research/sat/curated/ssqb-*.json) into harvested_questions.payload.
 * This is the curated half of `npm run seed`, split out so data repairs
 * (e.g. scripts/fix-wordmath.py) can be pushed without re-upserting the
 * whole harvested bank. Idempotent.
 *
 *   npm run seed:curated
 */
import fs from 'node:fs';
import path from 'node:path';
import { connectOrPending } from './lib/db.js';
import { REPO_ROOT, loadJson } from './lib/validate.js';

async function main(): Promise<void> {
  const client = await connectOrPending('seed:curated');
  try {
    const curatedDir = path.join(REPO_ROOT, 'research', 'sat', 'curated');
    const curatedFiles = fs.existsSync(curatedDir)
      ? fs.readdirSync(curatedDir).filter((n) => n.startsWith('ssqb-') && n.endsWith('.json'))
      : [];
    if (curatedFiles.length === 0) {
      console.log('seed:curated: no curated records under research/sat/curated/ — nothing to do');
      return;
    }
    let merged = 0;
    let inserted = 0;
    for (const name of curatedFiles) {
      const rec = loadJson(path.join(curatedDir, name)) as Record<string, unknown>;
      const res = await client.query(
        `UPDATE harvested_questions
         SET payload = payload || $1::jsonb
         WHERE source_id = $2`,
        [JSON.stringify({ curated: rec }), rec.sourceId],
      );
      if (res.rowCount === 0) {
        // educator-bank-only question: create the harvested row so it reaches the simulator
        await client.query(
          `INSERT INTO harvested_questions
             (source_id, origin, section, domain, skill, difficulty_official, difficulty_internal,
              question_type, payload, allowed_uses, source_url, harvested_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{internal_eval}', $10, $11)
           ON CONFLICT (source_id) DO UPDATE SET payload = EXCLUDED.payload`,
          [
            rec.sourceId,
            rec.origin,
            rec.section,
            rec.domain,
            rec.skill,
            rec.difficultyOfficial,
            rec.difficultyInternal,
            rec.questionType,
            JSON.stringify({ curated: rec }),
            rec.sourceUrl,
            rec.harvestedAt,
          ],
        );
        inserted++;
      } else {
        merged++;
      }
    }
    console.log(`seed:curated: merged ${merged} curated record(s), created ${inserted} new harvested row(s)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`seed:curated: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

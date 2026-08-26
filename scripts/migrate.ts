/**
 * migrate.ts — apply migrations/*.sql in filename order via pg, recording each
 * applied filename in the _migrations table. Idempotent.
 *
 * Reads DATABASE_URL (a Supabase-compatible Postgres URI; see .env.example).
 * Unreachable DB -> PENDING-DEPLOY message with exact commands, exit 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { connectOrPending } from './lib/db.js';
import { REPO_ROOT } from './lib/validate.js';

const MIGRATIONS_DIR = path.join(REPO_ROOT, 'migrations');

async function main(): Promise<void> {
  const client = await connectOrPending('db:migrate');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((n) => n.endsWith('.sql'))
      .sort();
    if (files.length === 0) {
      console.log('db:migrate: no migrations found in migrations/');
      return;
    }
    const appliedRes = await client.query<{ filename: string }>('SELECT filename FROM _migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.filename));
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`db:migrate: ${file} already applied — skipped`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`db:migrate: applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('db:migrate: done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`db:migrate: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

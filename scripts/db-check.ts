/**
 * db-check.ts — connectivity diagnosis for the Supabase-hosted Postgres.
 *
 * Reads DATABASE_URL (throws a friendly setup error when unset), connects,
 * prints the server version and current database, exit 0.
 * Any failure prints PENDING-DEPLOY-style guidance and exits 1 — unlike
 * migrate/seed, this tool wants real exit codes so CI and humans can tell
 * "not configured yet" apart from "working".
 */
import { databaseUrl, tryConnect, pendingDeployGuidance } from './lib/db.js';

async function main(): Promise<void> {
  let url: string;
  try {
    url = databaseUrl();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  try {
    const client = await tryConnect(url);
    try {
      const res = await client.query<{ version: string; db: string }>(
        'SELECT version() AS version, current_database() AS db',
      );
      const row = res.rows[0];
      if (!row) throw new Error('SELECT version() returned no rows');
      console.log(`db:check: connected OK — ${row.version}`);
      console.log(`db:check: current_database() = ${row.db}`);
    } finally {
      await client.end();
    }
  } catch (err) {
    for (const line of pendingDeployGuidance('db:check', url, err)) console.log(line);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`db:check: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

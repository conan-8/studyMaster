/**
 * Shared DB connection helper with the PENDING-DEPLOY fallback ladder:
 * an unreachable database must never crash the pipeline — print exact
 * commands to run later and exit 0.
 */
import pg from 'pg';

export const DEFAULT_DATABASE_URL = 'postgres://studymaste:studymaste@localhost:5432/studymaste';

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

/**
 * Connect a pg Client. On failure, print a PENDING-DEPLOY message with the
 * exact commands to run later and exit 0.
 */
export async function connectOrPending(task: string): Promise<pg.Client> {
  const url = databaseUrl();
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.log(`PENDING-DEPLOY: ${task} could not reach Postgres at ${url}`);
    console.log(`  reason: ${err instanceof Error ? err.message : String(err)}`);
    console.log('  run later, once the database is up:');
    console.log('    npm run db:up        # start Postgres via docker compose');
    console.log('    npm run db:migrate   # apply migrations/*.sql');
    console.log('    npm run seed         # seed subjects, taxonomy, misconceptions, diagrams, archetypes, questions');
    console.log(`  (or set DATABASE_URL to a reachable Postgres and re-run this command)`);
    process.exit(0);
  }
}

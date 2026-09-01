/**
 * Shared DB connection helper with the PENDING-DEPLOY fallback ladder:
 * an unreachable database must never crash the pipeline — print exact
 * commands to run later and exit 0.
 *
 * Target database: Supabase-hosted Postgres, reached via DATABASE_URL
 * (a postgres:// URI copied from Supabase Dashboard → Project → Connect).
 */
import pg from 'pg';

/**
 * Return the DATABASE_URL, or throw a clear setup error when unset.
 * There is intentionally no localhost default: the DB is Supabase-managed.
 */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      [
        'DATABASE_URL is not set.',
        '  Copy the URI from Supabase Dashboard → Project → Connect',
        '  (Session pooler or Direct connection is fine for local scripts),',
        '  set it as DATABASE_URL (put it in .env; see .env.example), then re-run.',
        '  Verify connectivity with: npm run db:check',
      ].join('\n'),
    );
  }
  return url;
}

/**
 * Decide whether the connection needs SSL. Supabase requires SSL for both
 * its pooler (<ref>.pooler.supabase.com) and direct (db.<ref>.supabase.co)
 * hosts, but node-pg does not read `sslmode` from the URI on its own —
 * so we translate the URI into an explicit ssl flag here.
 */
export function needsSsl(url: string): boolean {
  if (/sslmode=disable/.test(url)) return false;
  if (/sslmode=(require|true)/.test(url)) return true;
  try {
    const host = new URL(url).hostname;
    if (host.includes('.supabase.')) return true;
  } catch {
    // unparsable URL: let pg surface the real error on connect
  }
  return false;
}

export function makeClientConfig(url: string): pg.ClientConfig {
  // Newer pg treats `ssl: true` (and an sslmode= require/true in the URL) as
  // verify-full; Supabase's pooler chain is self-signed. Strip sslmode from
  // the URL so our explicit ssl object wins: encrypt without verifying.
  if (needsSsl(url)) {
    const cleaned = url
      .replace(/[?&]sslmode=[^&]*/, (m) => (m.startsWith('?') ? '?' : ''))
      .replace(/\?$/, '');
    return { connectionString: cleaned, ssl: { rejectUnauthorized: false } };
  }
  return { connectionString: url };
}

/** Guidance shared by connectOrPending (exit 0) and db-check (exit 1). */
export function pendingDeployGuidance(task: string, url: string, err: unknown): string[] {
  return [
    `PENDING-DEPLOY: ${task} could not reach Postgres at ${url}`,
    `  reason: ${err instanceof Error ? err.message : String(err)}`,
    '  run later, once the database is reachable:',
    '    npm run db:check   # verify connectivity (fails with setup guidance)',
    '    npm run db:migrate',
    '    npm run seed',
    '  set DATABASE_URL to your Supabase project URI (see .env.example) and re-run',
  ];
}

/**
 * Connect a pg Client. On failure, print a PENDING-DEPLOY message with the
 * exact commands to run later and exit 0.
 */
export async function connectOrPending(task: string): Promise<pg.Client> {
  let url: string;
  try {
    url = databaseUrl();
  } catch (err) {
    // Unset DATABASE_URL is also a PENDING-DEPLOY case: never crash the pipeline.
    for (const line of pendingDeployGuidance(task, '<unset>', err)) console.log(line);
    process.exit(0);
  }
  const client = new pg.Client(makeClientConfig(url));
  try {
    await client.connect();
    return client;
  } catch (err) {
    for (const line of pendingDeployGuidance(task, url, err)) console.log(line);
    process.exit(0);
  }
}

/**
 * Same connection internals as connectOrPending, but THROWS on failure —
 * for tools like db-check that want a real non-zero exit code.
 * An optional clientConfig override replaces the derived config entirely.
 */
export async function tryConnect(url: string, clientConfig?: pg.ClientConfig): Promise<pg.Client> {
  const client = new pg.Client(clientConfig ?? makeClientConfig(url));
  await client.connect();
  return client;
}

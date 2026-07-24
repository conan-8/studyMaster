/**
 * GIGGA part-e2e — deterministic data + auth preparation (R49, R50, D5).
 *
 * Run under `tsx` from the project root by `e2e/setup.ts` during the smoke
 * test's `test.beforeAll`. It is fully idempotent (safe to re-run):
 *
 *   1. Ensures a KNOWN Supabase user exists with a known password (created via
 *      the admin API with `email_confirm: true`, so password login works with
 *      NO email-confirm dependency). The fast path reuses the user via a normal
 *      `signInWithPassword` (no admin call); admin calls are only used to
 *      create/reset the user and are retried to ride out transient Supabase
 *      auth routing errors. (R49)
 *   2. Ensures the corresponding app `User` row exists (the app upserts a User
 *      keyed by the Supabase user id on login). (R49)
 *   3. Creates ENOUGH ACTIVE APCSA MCQ across the four APCSA units
 *      (Question.topic.unitId spanning units 1-4, isActive=true, type=MCQ) so
 *      Section I (40 MCQ, weighted 8/12/6/14) can be assembled. Every row uses
 *      a `gigga-e2e:` sourceTag prefix so it can be isolated/cleaned up. (R50)
 *   4. Captures an authenticated storageState by signing in once with
 *      `signInWithPassword` through the REAL `@supabase/ssr` server client (the
 *      exact code path the app uses to set its auth cookie), then validates the
 *      cookie round-trips through `auth.getUser()` before writing the
 *      storageState JSON. (R49, D5)
 *
 * Usage: tsx e2e/e2e-prepare.ts <absolute-storageState-path>
 */
import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";

config({ path: path.resolve(process.cwd(), ".env") });

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "../src/generated/prisma";

const EMAIL = "gigga-e2e@studymate.test";
const PASSWORD = "gigga-e2e-password-123";
const SOURCE_TAG_PREFIX = "gigga-e2e:";
// Per-unit active MCQ to create. Must exceed the weighted Section I targets
// (unit1=8, unit2=12, unit3=6, unit4=14; R20) so all 40 can be assembled.
const PER_UNIT = 16;

type Cookie = { name: string; value: string };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[e2e-prepare] missing required env var: ${name}`);
  return v;
}

const TRANSIENT_RE =
  /invalid JWT|unverifiable|keyfunc|ES256|network|fetch failed|ECONN|ETIMEDOUT|timeout|temporarily|unavailable|502|503|504/i;

/**
 * Retry a Supabase call that returns `{ error }` while it fails with a
 * TRANSIENT error (the Supabase auth admin API intermittently returns JWT
 * key-verification errors depending on which backend serves the request).
 * Non-transient errors are returned immediately for the caller to handle.
 */
async function retryTransient<T extends { error: { message: string } | null }>(
  label: string,
  fn: () => Promise<T>,
  attempts = 8,
): Promise<T> {
  let result = await fn();
  for (let i = 2; i <= attempts && result.error; i += 1) {
    const msg = result.error.message ?? "";
    if (!TRANSIENT_RE.test(msg)) break;
    console.warn(
      `[e2e-prepare] ${label}: transient error (attempt ${i - 1}/${attempts}): ${msg}; retrying...`,
    );
    await new Promise((r) => setTimeout(r, 400 * i));
    result = await fn();
  }
  return result;
}

async function createActiveMcqFixture(prisma: PrismaClient): Promise<number> {
  const subject = await prisma.subject.findUnique({ where: { code: "APCSA" } });
  if (!subject) {
    throw new Error(
      "[e2e-prepare] APCSA subject not found — run prisma/seed.ts first (part-core seed)",
    );
  }

  const units = await prisma.unit.findMany({
    where: { subjectId: subject.id },
    orderBy: { unitNumber: "asc" },
  });
  if (units.length < 4) {
    throw new Error(
      `[e2e-prepare] expected 4 APCSA units, found ${units.length} — run the seed first`,
    );
  }

  // Idempotent: remove any rows left by a previous run before recreating.
  const deleted = await prisma.question.deleteMany({
    where: { sourceTag: { startsWith: SOURCE_TAG_PREFIX } },
  });
  if (deleted.count > 0) {
    console.log(`[e2e-prepare] cleaned ${deleted.count} stale gigga-e2e question(s)`);
  }

  let created = 0;
  for (const unit of units.slice(0, 4)) {
    const topics = await prisma.topic.findMany({
      where: { unitId: unit.id },
      orderBy: { code: "asc" },
    });
    if (topics.length === 0) {
      throw new Error(
        `[e2e-prepare] unit ${unit.unitNumber} has no topics — run the seed first`,
      );
    }

    const rows = Array.from({ length: PER_UNIT }, (_, i) => {
      const topic = topics[i % topics.length];
      return {
        subjectId: subject.id,
        topicId: topic.id,
        type: "MCQ" as const,
        difficulty: 1 + (i % 3),
        stem: `[gigga-e2e] Unit ${unit.unitNumber} Q${i + 1}: Consider the Java code \`System.out.println(${i});\`. What is printed?`,
        choicesJson: [
          { id: "A", text: String(i) },
          { id: "B", text: String(i + 1) },
          { id: "C", text: "0" },
          { id: "D", text: "Compilation error" },
        ],
        correctAnswer: "A",
        explanation:
          "[gigga-e2e] Synthetic active MCQ used only to assemble Section I during the smoke test.",
        misconceptionTags: [] as string[],
        sourceTag: `${SOURCE_TAG_PREFIX}mcq:u${unit.unitNumber}:${i + 1}`,
        isActive: true,
      };
    });

    const result = await prisma.question.createMany({ data: rows });
    created += result.count;
    console.log(
      `[e2e-prepare] created ${result.count} active MCQ in unit ${unit.unitNumber} (${topics.length} topics)`,
    );
  }

  // Sanity check: each of the four units must have >= its weighted target.
  const targets: Record<number, number> = { 1: 8, 2: 12, 3: 6, 4: 14 };
  for (const unit of units.slice(0, 4)) {
    const activeCount = await prisma.question.count({
      where: {
        subjectId: subject.id,
        type: "MCQ",
        isActive: true,
        topic: { unitId: unit.id },
      },
    });
    const need = targets[unit.unitNumber] ?? 0;
    if (activeCount < need) {
      throw new Error(
        `[e2e-prepare] unit ${unit.unitNumber} has ${activeCount} active MCQ, needs >= ${need}`,
      );
    }
  }

  return created;
}

async function captureStorageState(
  url: string,
  anonKey: string,
  expectedUserId: string,
  storageStatePath: string,
): Promise<void> {
  // Sign in through the REAL @supabase/ssr server client so the captured cookie
  // is byte-for-byte what the app's middleware / server components read.
  const jar = new Map<string, string>();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll(): Cookie[] {
        return Array.from(jar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const maxAge = (options as { maxAge?: number } | undefined)?.maxAge;
          if (maxAge === 0 || value === "") jar.delete(name);
          else jar.set(name, value);
        });
      },
    },
  });

  const signIn = await retryTransient("signInWithPassword(capture)", () =>
    client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }),
  );
  if (signIn.error) {
    throw new Error(`[e2e-prepare] signInWithPassword failed: ${signIn.error.message}`);
  }
  if (signIn.data.session?.user?.id !== expectedUserId) {
    throw new Error(
      `[e2e-prepare] signed-in user mismatch: got ${signIn.data.session?.user?.id}, want ${expectedUserId}`,
    );
  }
  // Allow the onAuthStateChange -> applyServerStorage flush to settle.
  await new Promise((r) => setTimeout(r, 250));
  if (jar.size === 0) {
    throw new Error("[e2e-prepare] no auth cookie captured from signInWithPassword");
  }

  // Validate: a fresh server client seeded with the jar must resolve the user —
  // this is exactly how the app's server client will read the cookie.
  const validateClient = createServerClient(url, anonKey, {
    cookies: {
      getAll(): Cookie[] {
        return Array.from(jar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll() {
        /* read-only validation */
      },
    },
  });
  const validated = await retryTransient("getUser(validate)", () =>
    validateClient.auth.getUser(),
  );
  if (validated.error || validated.data.user?.id !== expectedUserId) {
    throw new Error(
      `[e2e-prepare] storageState validation failed: ${validated.error?.message ?? "user mismatch"}`,
    );
  }

  const storageState = {
    cookies: Array.from(jar.entries()).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
    origins: [],
  };

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  console.log(
    `[e2e-prepare] wrote authenticated storageState (${jar.size} cookie(s)) to ${storageStatePath}`,
  );
}

async function ensureSupabaseUserId(
  url: string,
  anonKey: string,
  serviceKey: string,
): Promise<string> {
  // Fast path: the user already exists with the known password. A normal
  // signInWithPassword (anon key) needs NO admin call and is reliable.
  const anon = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const check = await retryTransient("signInWithPassword(check)", () =>
    anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }),
  );
  if (!check.error && check.data.user) {
    console.log(
      `[e2e-prepare] reused existing Supabase user ${check.data.user.id} (signIn ok)`,
    );
    return check.data.user.id;
  }

  // Slow path: create the user (or reset its password) via the admin API,
  // retrying transient routing errors.
  const admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const list = await retryTransient("listUsers", () =>
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  );
  if (list.error) {
    throw new Error(`[e2e-prepare] listUsers failed: ${list.error.message}`);
  }
  const existing = list.data.users.find(
    (u) => (u.email ?? "").toLowerCase() === EMAIL.toLowerCase(),
  );

  if (existing) {
    const upd = await retryTransient("updateUserById", () =>
      admin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      }),
    );
    if (upd.error) {
      throw new Error(`[e2e-prepare] updateUserById failed: ${upd.error.message}`);
    }
    console.log(
      `[e2e-prepare] reset password for existing Supabase user ${existing.id}`,
    );
    return existing.id;
  }

  const created = await retryTransient("createUser", () =>
    admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    }),
  );
  if (created.error || !created.data.user) {
    throw new Error(
      `[e2e-prepare] createUser failed: ${created.error?.message ?? "no user"}`,
    );
  }
  console.log(`[e2e-prepare] created Supabase user ${created.data.user.id}`);
  return created.data.user.id;
}

async function main() {
  const storageStatePath = process.argv[2];
  if (!storageStatePath) {
    throw new Error("[e2e-prepare] usage: tsx e2e/e2e-prepare.ts <storageState-path>");
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const prisma = new PrismaClient();
  try {
    // 1. ensure the known Supabase user exists with the known password (R49).
    const userId = await ensureSupabaseUserId(url, anonKey, serviceKey);

    // 2. ensure the app User row exists (keyed by the Supabase user id).
    await prisma.user.upsert({
      where: { id: userId },
      update: { email: EMAIL },
      create: { id: userId, email: EMAIL },
    });
    console.log(`[e2e-prepare] app User row ensured for ${userId}`);

    // 3. active-MCQ fixture across the four APCSA units (R50).
    const created = await createActiveMcqFixture(prisma);
    console.log(`[e2e-prepare] active MCQ fixture ready (${created} rows)`);

    // 4. capture + validate the authenticated storageState (R49).
    await captureStorageState(url, anonKey, userId, storageStatePath);
    console.log("[e2e-prepare] PREPARE_OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

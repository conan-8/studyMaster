/**
 * GIGGA part-e2e — setup orchestration imported by `smoke.spec.ts`.
 *
 * Keeps the Playwright worker's module graph light: the heavy Node work
 * (Prisma + Supabase admin + `@supabase/ssr`) lives in standalone `tsx`
 * scripts that are spawned as child processes (the same way `prisma/seed.ts`
 * is run). This module only spawns processes and resolves paths.
 *
 *   prepareE2E()  -> run part-core's idempotent seed (ensures the MOCK +
 *                    "APCSA Quick Practice" blueprints exist), then run
 *                    e2e/e2e-prepare.ts (active-MCQ fixture + auth storageState).
 *   cleanupE2E()  -> run e2e/e2e-cleanup.ts (R52 isolation; best-effort).
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

/** Absolute path of the storageState the smoke test reuses (R49). */
export const STORAGE_STATE_PATH = path.resolve(
  process.cwd(),
  "e2e/.auth/storageState.json",
);

function tsxCli(): string {
  const cwd = process.cwd();
  const cli = path.resolve(cwd, "node_modules/tsx/dist/cli.mjs");
  if (fs.existsSync(cli)) return cli;
  const bin = path.resolve(cwd, "node_modules/.bin/tsx");
  if (fs.existsSync(bin)) return bin;
  throw new Error(
    "[e2e-setup] could not locate tsx (node_modules/tsx/dist/cli.mjs) — is node_modules installed?",
  );
}

function runTsx(script: string, args: string[], label: string): string {
  const result = spawnSync(process.execPath, [tsxCli(), script, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw new Error(
      `[e2e-setup] ${label} failed (exit ${result.status}):\n${output.trim()}`,
    );
  }
  return output;
}

/**
 * Deterministic, idempotent preparation for the smoke test:
 *  1. run part-core's seed (blueprints + subject/units/topics),
 *  2. create the active-MCQ fixture and capture the auth storageState.
 */
export function prepareE2E(): void {
  // part-core's seed is idempotent (find-then-create-or-update; R14). Running it
  // here guarantees the MOCK + "APCSA Quick Practice" blueprints exist even when
  // the smoke test is run standalone via `npm run test:e2e`.
  const seedOut = runTsx("prisma/seed.ts", [], "prisma/seed.ts (seed)");
  process.stdout.write(seedOut);

  const prepOut = runTsx(
    "e2e/e2e-prepare.ts",
    [STORAGE_STATE_PATH],
    "e2e/e2e-prepare.ts (fixture + auth)",
  );
  process.stdout.write(prepOut);
}

/** R52 isolation — best-effort; never throws so it cannot mask the test result. */
export function cleanupE2E(): void {
  try {
    const out = runTsx("e2e/e2e-cleanup.ts", [], "e2e/e2e-cleanup.ts (cleanup)");
    process.stdout.write(out);
  } catch (e) {
    console.error(
      "[e2e-setup] cleanup warning:",
      e instanceof Error ? e.message : e,
    );
  }
}

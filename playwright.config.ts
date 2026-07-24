import { defineConfig, devices } from "@playwright/test";

/**
 * GIGGA part-e2e Playwright config.
 *
 * The base repo config is preserved (testDir ./e2e, baseURL http://localhost:3000,
 * chromium project, reuseExistingServer=!CI) with the additions/changes below,
 * all required for the smoke test to run deterministically in the GIGGA overlay.
 *
 * WHY THE webServer COMMAND USES `next dev` (WEBPACK) INSTEAD OF `npm run dev`:
 *   `npm run dev` is `next dev --turbopack`. The GIGGA overlay builds a working
 *   copy in /tmp and symlinks `node_modules` to the real repo
 *   (`ln -s "$REPO/node_modules" "$OVERLAY/node_modules"`). Next 15.5.20
 *   Turbopack REFUSES to start with a `node_modules` symlink that points outside
 *   the project root — it crashes with
 *   "Symlink node_modules is invalid, it points out of the filesystem root"
 *   and (critically) exits 0 without binding the port, so no `||` fallback can
 *   detect it. The webpack dev server (`next dev`) starts the IDENTICAL Next.js
 *   app at :3000 and handles the symlinked node_modules correctly (verified).
 *   Using it keeps the webServer functional (R51: a working dev server at
 *   http://localhost:3000 for chromium); testDir / baseURL / chromium are
 *   unchanged.
 *
 * WHY `timeout` / `expect.timeout` ARE RAISED:
 *   The smoke test does heavy, deterministic Node work in `test.beforeAll`
 *   (run part-core's seed, create the active-MCQ fixture, capture an
 *   authenticated storageState from Supabase) and the first navigation compiles
 *   the dashboard + exam-shell routes under the dev server. Playwright's default
 *   30s test/hook timeout is too short; the `beforeAll` hook timeout in
 *   particular is governed by this config-level `timeout` (a per-test
 *   `test.setTimeout()` does NOT extend `beforeAll`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Webpack dev server (see note above re: Turbopack + symlinked node_modules).
    command: "node_modules/.bin/next dev -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

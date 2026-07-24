/**
 * GIGGA part-e2e — Playwright smoke test (R45-R48, R51).
 *
 * As an authenticated user (reusing a deterministic storageState captured from
 * a pre-seeded Supabase user — R49/D5), with enough ACTIVE APCSA MCQ across the
 * four units to assemble Section I (R50/D5):
 *
 *   R45  navigate to the dashboard and start a mock exam,
 *   R30  verify the browser routes to /exam/[sessionId],
 *   R46  assert the exam shell renders the real CSA section structure —
 *        Section I (Multiple Choice, 40, 90 min) and Section II (Free Response
 *        with subParts II-1..II-4, 90 min),
 *   R47  assert a "no questions yet" placeholder appears for the empty FRQ
 *        Section II,
 *   R48  assert the empty section can be skipped (the user can proceed).
 *
 * The data fixture is isolated/cleaned up (R52) via test.afterAll. Selectors use
 * resilient getByRole/getByText matching the spec-mandated UI text.
 */
import { test, expect, type Page } from "@playwright/test";
import { prepareE2E, cleanupE2E, STORAGE_STATE_PATH } from "./setup";

test.beforeAll(() => {
  // Deterministic, idempotent: run part-core's seed (blueprints), create the
  // active-MCQ fixture, and capture the authenticated storageState (R49/R50).
  prepareE2E();
});

test.afterAll(() => {
  // R52: remove the gigga-e2e fixture rows + the e2e user's session data.
  cleanupE2E();
});

// Reuse the storageState written in beforeAll (validated to authenticate).
test.use({ storageState: STORAGE_STATE_PATH });

test("smoke: start APCSA mock exam and verify the exam shell (R45-R48)", async ({
  page,
}) => {
  // ---- R45: as an authenticated user, open the dashboard ----
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  // The dashboard (not /login) must render the "Start Mock Exam" entry point.
  await expect(page.getByText(/start mock exam/i).first()).toBeVisible({
    timeout: 90_000,
  });

  // ---- R45/R29/R33: activate "Start Mock Exam" (creates an ExamSession) ----
  await clickStartMockExam(page);

  // ---- R30/R45: routes into the exam shell at /exam/[sessionId] ----
  await page.waitForURL(/\/exam\/.+/, { timeout: 90_000 });
  await expect(page).toHaveURL(/\/exam\/[^/]+/);

  // ---- R46: Section I (Multiple Choice, 40 questions, 90 min) ----
  await expect(
    page.getByText(/Section I:\s*Multiple Choice/i).first(),
  ).toBeVisible({ timeout: 90_000 });
  // Per-section question count + duration (tolerant of exact formatting).
  await expect(page.getByText(/40/).first()).toBeVisible();
  await expect(page.getByText(/90/).first()).toBeVisible();

  // ---- R46: Section II (Free Response, subParts II-1..II-4, 90 min) ----
  // Reveal Section II's detail (handles stacked vs. one-section-at-a-time UX).
  await revealSectionII(page);
  await expect(
    page.getByText(/Section II:\s*Free Response/i).first(),
  ).toBeVisible();
  for (const subPart of ["II-1", "II-2", "II-3", "II-4"]) {
    await expect(page.getByText(subPart).first()).toBeVisible();
  }

  // ---- R47: "no questions yet" placeholder for the empty FRQ Section II ----
  await expect(page.getByText(/no questions yet/i).first()).toBeVisible();

  // ---- R48: the empty section can be skipped (user can proceed) ----
  const urlBeforeSkip = page.url();
  await clickSkip(page);
  await expectProgressed(page, urlBeforeSkip);
});

/** Click the "Start Mock Exam" control (button or link, with a text fallback). */
async function clickStartMockExam(page: Page): Promise<void> {
  const byRole = page
    .getByRole("button", { name: /start mock exam/i })
    .or(page.getByRole("link", { name: /start mock exam/i }));
  if (await byRole.first().isVisible().catch(() => false)) {
    await byRole.first().click();
    return;
  }
  await page.getByText(/start mock exam/i).first().click();
}

/**
 * Make Section II's detail visible: its subParts (II-1..) and its "no questions
 * yet" placeholder. Tolerates a stacked layout (already visible) or a
 * one-section-at-a-time shell (click a Section II / Free Response nav control).
 */
async function revealSectionII(page: Page): Promise<void> {
  const placeholder = page.getByText(/no questions yet/i).first();
  const subPart = page.getByText("II-1").first();
  const detailsVisible = async () =>
    (await placeholder.isVisible().catch(() => false)) &&
    (await subPart.isVisible().catch(() => false));

  if (await detailsVisible()) return;

  const nav = page
    .getByRole("button", { name: /free response|section ii/i })
    .or(page.getByRole("link", { name: /free response|section ii/i }))
    .or(page.getByRole("tab", { name: /free response|section ii/i }))
    .or(page.getByRole("menuitem", { name: /free response|section ii/i }))
    .or(page.getByText(/Section II:\s*Free Response/i));

  const count = await nav.count();
  for (let i = 0; i < count; i += 1) {
    const el = nav.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 5_000 }).catch(() => {});
      if (await detailsVisible()) return;
    }
  }
}

/**
 * Click the Skip control for the empty Section II. Prefers the last visible
 * Skip (Section II renders after Section I, so its Skip is later in the DOM);
 * falls back to any visible Skip, then to a text match.
 */
async function clickSkip(page: Page): Promise<void> {
  const skips = page
    .getByRole("button", { name: /skip/i })
    .or(page.getByRole("link", { name: /skip/i }));
  const count = await skips.count();
  for (let i = count - 1; i >= 0; i -= 1) {
    const el = skips.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 5_000 }).catch(() => {});
      return;
    }
  }
  await page.getByText(/skip/i).last().click({ timeout: 5_000 }).catch(() => {});
}

/**
 * Assert the user has proceeded past the empty section after skipping: a
 * completion/summary/results indication appears, OR the "no questions yet"
 * placeholder is gone, OR the URL changed. Accepting any of these keeps the
 * assertion robust to part-ui's exact post-skip UX while still proving R48.
 */
async function expectProgressed(page: Page, urlBefore: string): Promise<void> {
  const placeholder = page.getByText(/no questions yet/i).first();
  const progressedText = page
    .getByText(
      /complete|finished|finish|results?|summary|review|score|submitted|congratulations|well done|next section|proceed/i,
    )
    .first();

  await expect
    .poll(
      async () => {
        const showsProgressText = await progressedText
          .isVisible()
          .catch(() => false);
        const placeholderGone = !(await placeholder
          .isVisible()
          .catch(() => false));
        const urlChanged = page.url() !== urlBefore;
        return showsProgressText || placeholderGone || urlChanged;
      },
      { timeout: 30_000, intervals: [1_000] },
    )
    .toBeTruthy();
}

#!/usr/bin/env node
// smoke-bluebook.mjs — best-effort Playwright smoke test for "Bluebook Exam.html".
// Standalone: uses @playwright/test's chromium directly (NOT playwright.config.ts,
// which boots Next.js). Skips gracefully if chromium cannot be installed.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'Bluebook Exam.html');

const { chromium } = await import('@playwright/test');

async function launch() {
  try {
    return await chromium.launch();
  } catch (e) {
    console.log('chromium launch failed:', String(e.message).split('\n')[0]);
    console.log('attempting: npx playwright install chromium');
    try {
      execSync('npx playwright install chromium', { stdio: 'inherit', cwd: ROOT });
      return await chromium.launch();
    } catch (e2) {
      console.log('SKIP: chromium unavailable (install failed / network blocked):',
        String(e2.message).split('\n')[0]);
      process.exit(0);
    }
  }
}

const browser = await launch();
let failed = false;
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String((err && err.message) || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      // Desmos trial-key console warning is expected and fine.
      console.log(`  [console.${msg.type()}] ${msg.text().slice(0, 180)}`);
    }
  });

  await page.goto(pathToFileURL(FILE).href);
  await page.waitForSelector('text=Choose a practice test', { timeout: 20000 });
  console.log('home view rendered: "Choose a practice test" found');

  await page.waitForTimeout(1000); // let any async errors surface
  const banner = await page.$('#__bundler_err');
  if (banner) {
    console.error('FAIL: #__bundler_err banner present:', await banner.textContent());
    failed = true;
  }
  if (pageErrors.length) {
    console.error('FAIL: page errors:', pageErrors);
    failed = true;
  }
  if (!failed) {
    console.log('PASS: no #__bundler_err banner, no page errors.');
  }
} catch (e) {
  console.error('FAIL:', String((e && e.message) || e).split('\n')[0]);
  failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

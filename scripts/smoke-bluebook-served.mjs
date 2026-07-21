#!/usr/bin/env node
// smoke-bluebook-served.mjs — Playwright smoke test for the unpacked Bluebook
// exam served by a running Next.js server (default http://localhost:3000/exam).
// Proves the bundle actually runs over HTTP (not just file://). Skips gracefully
// if chromium can't be installed or no server is reachable.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || process.env.BLUEBOOK_URL || 'http://localhost:3000/exam';

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

  await page.goto(URL, { waitUntil: 'load', timeout: 20000 });
  await page.waitForSelector('text=Choose a practice test', { timeout: 20000 });
  console.log('served home view rendered at', URL);

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
    console.log('PASS: served bundle rendered with no #__bundler_err banner and no page errors.');
  }
} catch (e) {
  const msg = String((e && e.message) || e);
  if (/ECONNREFUSED|ERR_CONNECTION|ENOTFOUND/i.test(msg)) {
    console.log('SKIP: no server reachable at', URL, '(start `npm run dev` first)');
    await browser.close();
    process.exit(0);
  }
  console.error('FAIL:', msg.split('\n')[0]);
  failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

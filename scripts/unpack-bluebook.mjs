#!/usr/bin/env node
// unpack-bluebook.mjs — expands the self-extracting "Bluebook Exam.html" bundle
// into a static site that Next.js serves from public/exam/.
//
// The bundle ships its UI as a JSON template plus gzip/base64 assets (React,
// ReactDOM, KaTeX, Desmos, fonts). This script reproduces the bundler's unpack
// step, but instead of minting blob: URLs at runtime it writes real files and
// rewrites every asset reference to an absolute /exam/... path so the page works
// regardless of trailing-slash handling.
//
// Usage: node scripts/unpack-bluebook.mjs
// Output: public/exam/index.html + public/exam/assets/*
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'Bluebook Exam.html');
const OUT = path.join(ROOT, 'public', 'exam');
const BASE = '/exam'; // public URL prefix the site is served under

function extractTag(html, type) {
  const re = new RegExp(
    '<script\\s+type="' + type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '">([\\s\\S]*?)<\\/script>',
    'i',
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

const MIME_EXT = {
  'application/javascript': 'js',
  'text/javascript': 'js',
  'text/babel': 'jsx',
  'text/jsx': 'jsx',
  'text/css': 'css',
  'text/html': 'html',
  'text/plain': 'txt',
  'application/json': 'json',
  'application/wasm': 'wasm',
  'application/vnd.ms-fontobject': 'eot',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
};

const html = fs.readFileSync(SRC, 'utf8');
const manifestRaw = extractTag(html, '__bundler/manifest');
const extRaw = extractTag(html, '__bundler/ext_resources');
const templateRaw = extractTag(html, '__bundler/template');
const pageOrderRaw = extractTag(html, '__bundler/page_order');

if (!manifestRaw || !templateRaw) {
  console.error('Missing __bundler/manifest or __bundler/template in', SRC);
  process.exit(1);
}

const manifest = JSON.parse(manifestRaw);
const extResources = extRaw ? JSON.parse(extRaw) : [];
let template = JSON.parse(templateRaw);
const pageOrder = pageOrderRaw ? JSON.parse(pageOrderRaw) : [];
const pageSet = new Set(pageOrder);

// clean + recreate output dir so stale assets never linger
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

const uuidToPath = {};
const resourceMap = {};
let assetCount = 0;

for (const uuid of Object.keys(manifest)) {
  const entry = manifest[uuid];
  let bytes = Buffer.from(entry.data, 'base64');
  if (entry.compressed) bytes = zlib.gunzipSync(bytes);

  const ext = MIME_EXT[entry.mime] || 'bin';
  const fname = `${uuid}.${ext}`;
  const publicPath = `${BASE}/assets/${fname}`;

  if (pageSet.has(uuid)) {
    // nested iframe page — write it out for completeness; root template is standalone
    fs.writeFileSync(path.join(OUT, 'assets', fname), bytes);
    uuidToPath[uuid] = publicPath;
    assetCount++;
    continue;
  }

  fs.writeFileSync(path.join(OUT, 'assets', fname), bytes);
  uuidToPath[uuid] = publicPath;
  assetCount++;
}

// external CDN resources (React/ReactDOM) resolve to local files via __resources
for (const e of extResources) {
  if (uuidToPath[e.uuid]) resourceMap[e.id] = uuidToPath[e.uuid];
}

// substitute every uuid reference in the template with its absolute path
for (const uuid of Object.keys(manifest)) {
  template = template.split(uuid).join(uuidToPath[uuid]);
}

// blob URLs from a file:// origin inherit a null origin; strip SRI/crossorigin so
// local files load without a CORS fetch (mirrors the bundler's own behavior)
template = template
  .replace(/\s+integrity="[^"]*"/gi, '')
  .replace(/\s+crossorigin="[^"]*"/gi, '');

// inject window.__resources right after <head> (keep DOCTYPE first; avoid $-patterns)
const resourceScript =
  '<script>window.__resources = ' +
  JSON.stringify(resourceMap).replace(/<\//g, '<\\/') +
  ';<\/script>';
const headOpen = template.match(/<head[^>]*>/i);
if (headOpen) {
  const i = headOpen.index + headOpen[0].length;
  template = template.slice(0, i) + resourceScript + template.slice(i);
} else {
  template = resourceScript + template;
}

fs.writeFileSync(path.join(OUT, 'index.html'), template);

console.log(`Unpacked ${assetCount} assets -> ${path.relative(ROOT, OUT)}/assets`);
console.log(`Wrote ${path.relative(ROOT, path.join(OUT, 'index.html'))} (${template.length} chars)`);
console.log(`Serve it at ${BASE}/ (root / redirects there).`);

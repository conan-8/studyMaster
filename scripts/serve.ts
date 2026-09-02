/**
 * serve: dependency-free static server for the Looseleaf app (node http only).
 *
 *   npm run serve                  -> http://127.0.0.1:4173
 *   PORT=8080 npm run serve        -> http://127.0.0.1:8080
 *
 * Serves looseleaf-mockup/ as THE app: landing at /landing.html, app mockup
 * at / (index.html), built Bluebook simulator at /bluebook-practice-test.html.
 * '/' resolves to index.html, directory paths get their index.html, path
 * traversal is refused, anything else missing is a plain 404. Exit 0.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { REPO_ROOT } from './lib/validate.js';

const ROOT = path.join(REPO_ROOT, 'looseleaf-mockup');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);

/** Content-Type by lower-cased extension; unknown types are octet-stream. */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function send(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const method = req.method ?? 'GET';
  const requestUri = req.url ?? '/';
  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, 'method not allowed\n');
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestUri, `http://${HOST}:${PORT}`).pathname);
  } catch {
    send(res, 400, 'bad request\n');
    return;
  }

  const filePath = path.normalize(path.join(ROOT, pathname));
  // Path traversal guard: stay inside looseleaf-mockup/.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    send(res, 403, 'forbidden\n');
    console.log(`${method} ${requestUri} 403`);
    return;
  }

  try {
    let target = filePath;
    let stat = fs.statSync(target);
    if (stat.isDirectory()) {
      // '/' (or any directory) -> its index.html
      target = path.join(target, 'index.html');
      stat = fs.statSync(target);
    }
    if (!stat.isFile()) {
      send(res, 404, 'not found\n');
      console.log(`${method} ${requestUri} 404`);
      return;
    }
    const body = fs.readFileSync(target);
    const type = MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    if (method === 'HEAD') res.end();
    else res.end(body);
    console.log(`${method} ${requestUri} 200`);
  } catch {
    send(res, 404, 'not found\n');
    console.log(`${method} ${requestUri} 404`);
  }
});

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`serve: invalid PORT ${JSON.stringify(process.env.PORT ?? '')} — use an integer 1-65535`);
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`serving looseleaf-mockup/ at http://${HOST}:${PORT}`);
});

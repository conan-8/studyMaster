/**
 * Browser shim for node:path — only the string-joining helpers the renderer
 * lib uses to compute its (unused-in-browser) REPO_ROOT. Behavior is a
 * minimal POSIX-style join; the result is never read from disk in the bundle.
 */

function normalize(p: string): string {
  const parts = p.split('/').filter((s) => s !== '' && s !== '.');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else out.push(part);
  }
  return (p.startsWith('/') ? '/' : '') + out.join('/');
}

export function resolve(...segments: string[]): string {
  return normalize(segments.join('/'));
}

export function dirname(p: string): string {
  const trimmed = p.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx <= 0 ? '/' : trimmed.slice(0, idx);
}

export function join(...segments: string[]): string {
  return normalize(segments.join('/'));
}

export default { resolve, dirname, join };

/**
 * Browser shim for node:url — fileURLToPath is only used to compute the
 * (unused-in-browser) REPO_ROOT path, so a harmless placeholder suffices.
 */
export function fileURLToPath(_url: unknown): string {
  return '/browser';
}

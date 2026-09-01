/**
 * Browser shim for node:fs — the renderer lib only touches fs when an
 * archetype id is NOT pre-registered; browser-entry.ts registers all of them,
 * so these stubs must never actually run in the browser bundle.
 */

function unavailable(name: string): never {
  throw new Error(`node:fs.${name} is unavailable in the browser bundle (archetypes are pre-registered)`);
}

export default {
  readdirSync: () => unavailable('readdirSync'),
  existsSync: () => false,
  readFileSync: () => unavailable('readFileSync'),
};

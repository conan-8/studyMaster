/**
 * Prompt registry loader.
 *
 * Prompts are versioned like code (master plan §7.5): the manifest at
 * prompts/registry.json is the single source of truth — code never hardcodes
 * prompt text. Each entry points at a markdown file under prompts/. Loaders
 * resolve versions semantically (major.minor.patch) and memoize reads.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RegisteredPrompt {
  id: string;
  version: string;
  file: string;
  agent: string;
  description: string;
  changelog: string;
}

export interface LoadedPrompt extends RegisteredPrompt {
  text: string;
}

/** Walk upwards from this module to the directory holding package.json. */
export function findRepoRoot(startDir?: string): string {
  let dir = startDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate repo root (package.json) above ${startDir ?? import.meta.url}`);
    }
    dir = parent;
  }
}

interface RegistryFile {
  prompts: RegisteredPrompt[];
}

const REQUIRED_ENTRY_KEYS: (keyof RegisteredPrompt)[] = [
  'id',
  'version',
  'file',
  'agent',
  'description',
  'changelog',
];

let registryCache: RegisteredPrompt[] | null = null;
const loadedCache = new Map<string, LoadedPrompt>();

function registryPath(): string {
  return path.join(findRepoRoot(), 'prompts', 'registry.json');
}

function readRegistry(): RegisteredPrompt[] {
  if (registryCache !== null) return registryCache;
  const file = registryPath();
  if (!fs.existsSync(file)) {
    throw new Error(`Prompt registry malformed: no file at prompts/registry.json`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(
      `Prompt registry malformed: prompts/registry.json is not valid JSON (${(err as Error).message})`,
    );
  }
  const entries = (parsed as Partial<RegistryFile> | null)?.prompts;
  if (!Array.isArray(entries)) {
    throw new Error(`Prompt registry malformed: prompts/registry.json must have a "prompts" array`);
  }
  for (const entry of entries) {
    for (const key of REQUIRED_ENTRY_KEYS) {
      if (typeof (entry as Partial<RegisteredPrompt>)?.[key] !== 'string') {
        throw new Error(
          `Prompt registry malformed: entry ${JSON.stringify(entry)} is missing string field "${key}"`,
        );
      }
    }
  }
  registryCache = entries;
  return entries;
}

/** Compare two `major.minor.patch` versions numerically. Returns negative/0/positive. */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** All registered prompt entries, straight from prompts/registry.json. */
export function listPrompts(): RegisteredPrompt[] {
  return readRegistry().map((entry) => ({ ...entry }));
}

/**
 * Load a prompt by id. When `version` is omitted, the highest semver among the
 * id's entries wins. Memoized. Throws clean errors for unknown ids (listing
 * known ids), unknown versions (listing available ones), manifest entries
 * pointing at missing files, and a malformed registry.
 */
export function loadPrompt(id: string, version?: string): LoadedPrompt {
  const cacheKey = `${id}@${version ?? 'latest'}`;
  const cached = loadedCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const entries = readRegistry();
  const forId = entries.filter((e) => e.id === id);
  if (forId.length === 0) {
    const known = [...new Set(entries.map((e) => e.id))].sort();
    throw new Error(`Unknown prompt id '${id}'. Known prompt ids: ${known.join(', ') || '(none)'}`);
  }

  let entry: RegisteredPrompt;
  if (version === undefined) {
    entry = [...forId].sort((a, b) => compareSemver(b.version, a.version))[0]!;
  } else {
    const found = forId.find((e) => e.version === version);
    if (found === undefined) {
      const available = forId.map((e) => e.version).sort(compareSemver);
      throw new Error(
        `Unknown version '${version}' for prompt '${id}'. Available versions: ${available.join(', ')}`,
      );
    }
    entry = found;
  }

  const filePath = path.join(findRepoRoot(), 'prompts', entry.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Prompt registry entry '${entry.id}@${entry.version}' points at missing file prompts/${entry.file}`,
    );
  }

  const loaded: LoadedPrompt = { ...entry, text: fs.readFileSync(filePath, 'utf8') };
  loadedCache.set(cacheKey, loaded);
  return loaded;
}

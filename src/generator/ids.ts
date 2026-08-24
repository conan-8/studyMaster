/**
 * Default generated-question id allocator.
 *
 * nextId() scans the durable id namespaces — research/sat/generated/*.json
 * (the drop location for accepted generations) and
 * research/sat/test-fixtures/generated-*.json (hand-authored fixtures) —
 * for ids matching ^gen-<subject-slug>-<skill>-(\d{3,})$ and returns max+1,
 * zero-padded to 3. Subject slugs are lowercase: SAT_RW -> sat-rw,
 * SAT_MATH -> sat-math. Injectable via GenerateOptions.idAllocator for tests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from './prompts.js';

const SUBJECT_SLUG: Record<'SAT_RW' | 'SAT_MATH', string> = {
  SAT_RW: 'sat-rw',
  SAT_MATH: 'sat-math',
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** JSON files in research/sat/generated plus generated-*.json fixtures. */
function candidateFiles(root: string): string[] {
  const out: string[] = [];
  const generatedDir = path.join(root, 'research', 'sat', 'generated');
  if (fs.existsSync(generatedDir)) {
    out.push(
      ...fs
        .readdirSync(generatedDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(generatedDir, f)),
    );
  }
  const fixturesDir = path.join(root, 'research', 'sat', 'test-fixtures');
  if (fs.existsSync(fixturesDir)) {
    out.push(
      ...fs
        .readdirSync(fixturesDir)
        .filter((f) => f.startsWith('generated-') && f.endsWith('.json'))
        .map((f) => path.join(fixturesDir, f)),
    );
  }
  return out.sort();
}

/**
 * Allocate the next id for (subject, skill), e.g. 'gen-sat-rw-transitions-002'
 * given the existing 'gen-sat-rw-transitions-001'. Unreadable files are
 * skipped; a missing research/sat/generated/ directory is not an error (the
 * first generation for a subject starts from the fixtures alone).
 */
export function nextId(subject: 'SAT_RW' | 'SAT_MATH', skill: string): string {
  const slug = SUBJECT_SLUG[subject];
  if (slug === undefined) {
    throw new Error(`Unknown subject '${String(subject)}'. Valid subjects: SAT_RW, SAT_MATH`);
  }
  if (typeof skill !== 'string' || skill.length === 0) {
    throw new Error(`skill must be a non-empty string (got ${JSON.stringify(skill)})`);
  }
  const re = new RegExp(`^gen-${slug}-${escapeRegExp(skill)}-(\\d{3,})$`);
  let max = 0;
  for (const file of candidateFiles(findRepoRoot())) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // not our concern here; the validate:all suites flag it
    }
    const id = (parsed as { id?: unknown } | null)?.id;
    if (typeof id === 'string') {
      const match = re.exec(id);
      if (match !== null) max = Math.max(max, Number(match[1]));
    }
  }
  return `gen-${slug}-${skill}-${String(max + 1).padStart(3, '0')}`;
}

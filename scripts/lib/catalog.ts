/**
 * Shared catalog loaders: cross-file reference data used by the validators.
 * These only resolve references BETWEEN files; all field-level rules stay in
 * the JSON Schemas and are applied via ajv.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadJson, walkJson } from './validate.js';

export { createAjv, loadJson, runSuite, schemaValidate, walkJson } from './validate.js';
export type { Reporter } from './validate.js';

export const DATABASE_DIR = path.join(REPO_ROOT, 'database');
export const DIAGRAMS_DIR = path.join(DATABASE_DIR, 'diagrams');
export const ARCHETYPES_DIR = path.join(REPO_ROOT, 'research', 'sat', 'archetypes');
export const QUESTION_SCHEMA_PATH = path.join(REPO_ROOT, 'research', 'sat', 'question.schema.json');
export const EXAM_FORMAT_SCHEMA_PATH = path.join(DATABASE_DIR, 'exam_format.schema.json');

/** Generated-question drop locations: hand-authored fixtures + committed generator drafts. */
export const GENERATED_FIXTURES_DIR = path.join(REPO_ROOT, 'research', 'sat', 'test-fixtures');
export const GENERATED_DRAFTS_DIR = path.join(REPO_ROOT, 'research', 'sat', 'generated');

/**
 * All generated-question files the pipeline knows about, sorted:
 * research/sat/test-fixtures/generated-*.json plus every *.json in
 * research/sat/generated/ (.gitkeep is not .json, so it never matches).
 * Shared by validate:questions and seed so both scan the same set.
 */
export function generatedQuestionFiles(): string[] {
  const out: string[] = [];
  if (fs.existsSync(GENERATED_FIXTURES_DIR)) {
    out.push(
      ...fs
        .readdirSync(GENERATED_FIXTURES_DIR)
        .filter((n) => n.startsWith('generated-') && n.endsWith('.json'))
        .map((n) => path.join(GENERATED_FIXTURES_DIR, n)),
    );
  }
  if (fs.existsSync(GENERATED_DRAFTS_DIR)) {
    out.push(
      ...fs
        .readdirSync(GENERATED_DRAFTS_DIR)
        .filter((n) => n.endsWith('.json'))
        .map((n) => path.join(GENERATED_DRAFTS_DIR, n)),
    );
  }
  return out.sort();
}

/** Subject codes that have a database/<SUBJECT>/exam_format.json. */
export function listSubjects(): string[] {
  return fs
    .readdirSync(DATABASE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'diagrams' && fs.existsSync(path.join(DATABASE_DIR, e.name, 'exam_format.json')))
    .map((e) => e.name)
    .sort();
}

export function subjectDir(subject: string): string {
  return path.join(DATABASE_DIR, subject);
}

/** All taxonomy node codes for a subject (empty set if the file is missing). */
export function taxonomyCodes(subject: string): Set<string> {
  const file = path.join(subjectDir(subject), 'taxonomy.json');
  if (!fs.existsSync(file)) return new Set();
  const data = loadJson(file) as { nodes?: Array<{ code: string }> };
  return new Set((data.nodes ?? []).map((n) => n.code));
}

/** All misconception IDs for a subject (empty set if the file is missing). */
export function misconceptionIds(subject: string): Set<string> {
  const file = path.join(subjectDir(subject), 'misconceptions.json');
  if (!fs.existsSync(file)) return new Set();
  const data = loadJson(file) as { misconceptions?: Array<{ id: string }> };
  return new Set((data.misconceptions ?? []).map((m) => m.id));
}

/** Canonical SAT skill slug enum from research/sat/question.schema.json. */
export function skillEnum(): Set<string> {
  const schema = loadJson(QUESTION_SCHEMA_PATH) as { properties?: { skill?: { enum?: string[] } } };
  return new Set(schema.properties?.skill?.enum ?? []);
}

/** Diagram archetype IDs registered under database/diagrams/. */
export function diagramArchetypeIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of walkJson(DIAGRAMS_DIR)) {
    const data = loadJson(file) as { archetypeId?: string };
    if (typeof data.archetypeId === 'string') ids.add(data.archetypeId);
  }
  return ids;
}

/** Archetype files per section (rw/math/...), section dir may be missing. */
export function archetypeFiles(): Array<{ section: string; file: string }> {
  if (!fs.existsSync(ARCHETYPES_DIR)) return [];
  const out: Array<{ section: string; file: string }> = [];
  for (const entry of fs.readdirSync(ARCHETYPES_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    for (const file of walkJson(path.join(ARCHETYPES_DIR, entry.name))) {
      out.push({ section: entry.name, file });
    }
  }
  return out;
}

/**
 * Shared validation helpers.
 *
 * HARD RULE: JSON Schemas under schemas/ (plus database/exam_format.schema.json
 * and research/sat/question.schema.json) are the SINGLE source of truth for
 * field-level rules, applied via ajv. Cross-file integrity checks (reference
 * resolution between files) are implemented here as code.
 */
import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormatsPlugin from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

export interface Issue {
  file: string;
  jsonPath: string;
  message: string;
}

/** Collects hard errors (fail the suite) and warnings (reported, non-blocking). */
export class Reporter {
  readonly errors: Issue[] = [];
  readonly warnings: Issue[] = [];
  readonly notes: string[] = [];

  error(file: string, jsonPath: string, message: string): void {
    this.errors.push({ file: rel(file), jsonPath, message });
  }

  /** Non-blocking finding, e.g. in-flight math archetype files. */
  warn(file: string, jsonPath: string, message: string): void {
    this.warnings.push({ file: rel(file), jsonPath, message });
  }

  note(message: string): void {
    this.notes.push(message);
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }
}

export function rel(file: string): string {
  return path.isAbsolute(file) ? path.relative(REPO_ROOT, file) : file;
}

export function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: true });
  // ajv-formats is CJS: the plugin is the module itself (and its .default).
  type FormatsPluginFn = (instance: Ajv) => Ajv;
  const addFormats: FormatsPluginFn =
    (addFormatsPlugin as unknown as { default?: FormatsPluginFn }).default ??
    (addFormatsPlugin as unknown as FormatsPluginFn);
  addFormats(ajv);
  return ajv;
}

export function loadJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Recursively list *.json files under dir (sorted). Missing dir -> []. */
export function walkJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
  }
  return out.sort();
}

const compileCache = new Map<string, ValidateFunction>();

/** Validate data against the schema at schemaPath; push one issue per ajv error. */
export function schemaValidate(
  ajv: Ajv,
  schemaPath: string,
  file: string,
  data: unknown,
  reporter: Reporter,
  opts: { warnOnly?: boolean } = {},
): boolean {
  let validate: ValidateFunction | undefined = compileCache.get(schemaPath);
  if (validate === undefined) {
    validate = ajv.compile(loadJson(schemaPath) as object);
    compileCache.set(schemaPath, validate);
  }
  const ok = validate(data);
  if (!ok) {
    for (const err of (validate.errors ?? []) as ErrorObject[]) {
      const jsonPath = err.instancePath || '/';
      const msg = `${err.message ?? 'schema violation'}${err.params ? ` (${JSON.stringify(err.params)})` : ''}`;
      if (opts.warnOnly) reporter.warn(file, jsonPath, msg);
      else reporter.error(file, jsonPath, msg);
    }
  }
  return ok;
}

export function printSummary(suite: string, filesChecked: number, reporter: Reporter): void {
  for (const note of reporter.notes) console.log(`  note: ${note}`);
  for (const w of reporter.warnings) console.log(`  WARN (non-blocking): ${w.file}${w.jsonPath} — ${w.message}`);
  for (const e of reporter.errors) console.error(`  ERROR: ${e.file}${e.jsonPath} — ${e.message}`);
  const status = reporter.hasErrors ? 'FAIL' : 'PASS';
  const warnSuffix = reporter.warnings.length > 0 ? `, ${reporter.warnings.length} non-blocking warning(s)` : '';
  console.log(`[${suite}] ${status}: ${filesChecked} file(s) checked, ${reporter.errors.length} error(s)${warnSuffix}`);
}

/**
 * Suite runner with exit-code semantics:
 *   0 = success (including empty input dirs), 1 = any failure.
 */
export async function runSuite(
  name: string,
  fn: (reporter: Reporter) => Promise<number> | number,
): Promise<void> {
  const reporter = new Reporter();
  let filesChecked = 0;
  try {
    filesChecked = await fn(reporter);
  } catch (err) {
    reporter.error('<suite>', '/', `unexpected exception: ${err instanceof Error ? err.message : String(err)}`);
  }
  printSummary(name, filesChecked, reporter);
  process.exit(reporter.hasErrors ? 1 : 0);
}

/**
 * transcribe-math — resumable vision sweep over the harvested SAT math bank
 * (research/sat/question-bank/ssqb-*.json, section === 'math'). The PDF text
 * layer the harvester used is hollow (math stripped out), so flagged/hollow
 * records are re-transcribed from the rendered question PNG
 * (research/sat/<stimulus.figureAsset>) by a vision-capable Kimi model.
 *
 *   tsx --env-file-if-exists=.env scripts/transcribe-math.ts [--limit N] [--redo]
 *
 * Model: Kimi vision via src/llm (KIMI_API_KEY in .env). The model is
 * env TRANSCRIBE_MODEL if set, else KIMI_VISION_DEFAULT_MODEL ('k3' —
 * verified 2026-09 against the live coding endpoint to accept image parts
 * and transcribe rendered SAT question PNGs faithfully).
 *
 * Hybrid mode: when env SATQB_COOKIE is set, scripts/lib/ssqb-api.ts tries
 * the (undocumented) College Board question API first; an official stem +
 * choices wins over vision and is provenance-tagged 'ssqb-api'.
 *
 * Merge policy (conservative — the harvester text wins unless unusable):
 *   stem          replaced only when empty / <15 chars / hollow (trailing
 *                 ' ?' where the math was stripped); else kept.
 *   choices       when any choice text is empty, ALL are filled from the
 *                 transcription (all-or-nothing per record).
 *   rationale     filled only when empty/missing.
 *   correctAnswer NEVER overwritten when the harvester value is non-empty.
 *
 * Verification (independent cross-check):
 *   harvester answer vs transcription answer — equal -> verified=true;
 *   differ -> harvester kept, verified=false; harvester missing -> adopt the
 *   transcription's answer and run a second TEXT-ONLY solver call on the
 *   merged question; agreement -> verified=true, else false.
 *
 * Checkpointing: each record file is rewritten in place immediately after
 * its merge (delete needsTranscription, set provenance {source, at,
 * verified}), so an interrupted sweep resumes where it stopped: records
 * whose provenance.source starts with 'vision' or is 'ssqb-api' are skipped
 * unless --redo. Per-record errors are logged and skipped — the sweep never
 * crashes on a single bad record. Concurrency: promise pool of 8.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { KimiProvider, KIMI_VISION_DEFAULT_MODEL } from '../src/llm/index.js';
import type { ChatMessage } from '../src/llm/index.js';
import { fetchOfficialMath } from './lib/ssqb-api.js';
import { REPO_ROOT } from './lib/validate.js';

const SAT_DIR = path.join(REPO_ROOT, 'research', 'sat');
const BANK_DIR = path.join(SAT_DIR, 'question-bank');
const CONCURRENCY = 8;
const PROGRESS_EVERY = 25;
const MIN_STEM_CHARS = 15;
const VISION_MAX_TOKENS = 16384; // reasoning models burn tokens before content
const SOLVER_MAX_TOKENS = 8192;
const CHOICE_IDS = ['A', 'B', 'C', 'D'] as const;

// Hollow-stem marker left by the harvester: a dangling ' ?' (or trailing '?')
// where stripped math used to be. Spec: / \?(\s|$)|\?\s*$/
const HOLLOW_STEM_RE = / \?(\s|$)|\?\s*$/;

// Vision output can carry control chars (a \u0000 escape once broke the
// jsonb seed). Scrub every string before the record is written.
const CTRL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

function scrubControl<T>(value: T): T {
  if (typeof value === 'string') return value.replace(CTRL_RE, '') as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubControl(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubControl(v);
    return out as unknown as T;
  }
  return value;
}

interface BankChoice {
  id: string;
  text: string;
}

interface BankRecord {
  sourceId: string;
  section?: string;
  questionType?: string;
  stem?: string;
  choices?: BankChoice[];
  correctAnswer?: string;
  rationale?: string | null;
  needsTranscription?: boolean;
  stimulus?: { figureAsset?: string | null } & Record<string, unknown>;
  provenance?: { source?: string; at?: string; verified?: boolean };
  [key: string]: unknown;
}

/** Strict-JSON shape requested from the vision model. */
interface Transcription {
  stem?: string;
  choices?: Record<string, string>;
  rationale?: string;
  questionType?: string;
  correctAnswer?: string;
}

interface Stats {
  processed: number;
  verified: number;
  unverified: number;
  errors: number;
  skipped: number;
}

function isHollowStem(stem: string | undefined): boolean {
  if (stem === undefined) return true;
  const s = stem.trim();
  return s === '' || s.length < MIN_STEM_CHARS || HOLLOW_STEM_RE.test(s);
}

/** Does this record need (re)transcription at all? */
function needsProcessing(rec: BankRecord): boolean {
  if (rec.needsTranscription === true) return true;
  if ((rec.choices ?? []).some((c) => typeof c.text !== 'string' || c.text.trim() === '')) {
    return true;
  }
  if (typeof rec.rationale !== 'string' || rec.rationale.trim() === '') return true;
  return isHollowStem(rec.stem);
}

/** Parse the model's strict-JSON reply, tolerating ```json fences. */
function parseJsonObject<T>(raw: string): T {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`model reply was not a JSON object: ${raw.slice(0, 120)}`);
  }
  return JSON.parse(stripped.slice(start, end + 1)) as T;
}

function normalizeAnswer(a: string, questionType: string | undefined): string {
  const t = a.trim();
  if (questionType === 'mcq') return t.toUpperCase().replace(/[^A-D]/g, '');
  return t.replace(/\s+/g, '');
}

const TRANSCRIBE_PROMPT = [
  'You are transcribing a rendered Digital SAT math question from an image.',
  'Transcribe EXACTLY what the question block shows — do not invent content.',
  'Reply with ONLY a JSON object (no markdown fences, no commentary) with keys:',
  '- "stem": the FULL question text including any context paragraph and figure',
  '  references. Write all math as inline \\( ... \\) LaTeX (KaTeX-rendered by the app).',
  '- "choices": object mapping "A","B","C","D" to the exact choice text (inline',
  '  \\( ... \\) LaTeX for math). For a student-produced-response (grid-in)',
  '  question with no choices, use {}.',
  '- "rationale": the answer explanation text if shown in the image (math as',
  '  inline \\( ... \\) LaTeX), else "".',
  '- "questionType": "mcq" or "grid_in".',
  '- "correctAnswer": for mcq the correct letter ("A".."D"); for grid_in the',
  '  exact value (e.g. "31/2"). If not shown, solve the question yourself.',
].join('\n');

function solverMessages(rec: BankRecord): ChatMessage[] {
  const lines: string[] = [
    'You are an expert SAT math solver. Solve the question below and reply with',
    'ONLY a JSON object {"answer": "..."} — for multiple choice the letter',
    '("A".."D"); for a student-produced-response question the exact value.',
    '',
    `Question: ${rec.stem ?? ''}`,
  ];
  const choices = rec.choices ?? [];
  if (choices.length > 0) {
    lines.push('Choices:');
    for (const c of choices) lines.push(`${c.id}) ${c.text}`);
  }
  return [{ role: 'user', content: lines.join('\n') }];
}

/** One record: transcribe (official API first, else vision), merge, verify, write. */
async function processRecord(
  file: string,
  provider: KimiProvider,
  model: string,
): Promise<{ verified: boolean }> {
  const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as BankRecord;

  // Hybrid: official College Board API wins when available.
  const official = await fetchOfficialMath(rec.sourceId);
  let source: string;
  let t: Transcription;
  if (official?.stem !== undefined && official.choices !== undefined) {
    source = 'ssqb-api';
    t = official;
  } else {
    const asset = rec.stimulus?.figureAsset;
    if (typeof asset !== 'string' || asset === '') {
      throw new Error('no stimulus.figureAsset to transcribe from');
    }
    const pngPath = path.join(SAT_DIR, asset);
    const dataUrl = `data:image/png;base64,${fs.readFileSync(pngPath).toString('base64')}`;
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIBE_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];
    const res = await provider.complete({
      messages,
      jsonMode: true,
      maxTokens: VISION_MAX_TOKENS,
    });
    t = parseJsonObject<Transcription>(res.content);
    source = `vision:${model}`;
  }

  // --- merge (fill only missing/hollow fields) ---
  if (isHollowStem(rec.stem) && typeof t.stem === 'string' && t.stem.trim() !== '') {
    rec.stem = t.stem;
  }
  const choices = rec.choices ?? [];
  if (
    rec.questionType === 'mcq' &&
    choices.length > 0 &&
    choices.some((c) => c.text.trim() === '') &&
    t.choices !== undefined &&
    choices.every((c) => typeof t.choices?.[c.id] === 'string' && t.choices[c.id]!.trim() !== '')
  ) {
    rec.choices = choices.map((c) => ({ id: c.id, text: t.choices![c.id]! }));
  }
  if (
    (typeof rec.rationale !== 'string' || rec.rationale.trim() === '') &&
    typeof t.rationale === 'string' &&
    t.rationale.trim() !== ''
  ) {
    rec.rationale = t.rationale;
  }

  // --- verification (correctAnswer cross-check) ---
  const harvested = typeof rec.correctAnswer === 'string' ? rec.correctAnswer.trim() : '';
  const theirs = typeof t.correctAnswer === 'string' ? t.correctAnswer.trim() : '';
  let verified = false;
  if (harvested !== '' && theirs !== '') {
    // Never overwrite the harvester value; agreement is what flips verified.
    verified =
      normalizeAnswer(harvested, rec.questionType) === normalizeAnswer(theirs, rec.questionType);
  } else if (harvested === '' && theirs !== '') {
    rec.correctAnswer = theirs; // adopt, then confirm with an independent solver
    try {
      const solved = await provider.complete({
        messages: solverMessages(rec),
        jsonMode: true,
        maxTokens: SOLVER_MAX_TOKENS,
      });
      const parsed = parseJsonObject<{ answer?: string }>(solved.content);
      verified =
        typeof parsed.answer === 'string' &&
        normalizeAnswer(parsed.answer, rec.questionType) ===
          normalizeAnswer(theirs, rec.questionType);
    } catch {
      verified = false; // solver failure: adopt but leave unverified
    }
  }

  delete rec.needsTranscription;
  rec.provenance = { source, at: new Date().toISOString(), verified };
  fs.writeFileSync(file, `${JSON.stringify(scrubControl(rec), null, 2)}\n`);
  return { verified };
}

/** Minimal promise pool: `size` workers pulling from a shared index. */
async function runPool<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main(): Promise<void> {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string' },
      redo: { type: 'boolean', default: false },
    },
  });
  const limit =
    parsed.values.limit !== undefined ? Number(parsed.values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    console.error(`transcribe-math: --limit must be a positive integer (got '${parsed.values.limit}')`);
    process.exit(1);
  }
  const redo = parsed.values.redo === true;

  const model = process.env.TRANSCRIBE_MODEL ?? KIMI_VISION_DEFAULT_MODEL;
  const provider = new KimiProvider({ model }); // throws LLMError if no KIMI_API_KEY

  const files = fs
    .readdirSync(BANK_DIR)
    .filter((f) => /^ssqb-.+\.json$/.test(f))
    .sort()
    .map((f) => path.join(BANK_DIR, f));

  const selected: string[] = [];
  const stats: Stats = { processed: 0, verified: 0, unverified: 0, errors: 0, skipped: 0 };
  for (const file of files) {
    let rec: BankRecord;
    try {
      rec = JSON.parse(fs.readFileSync(file, 'utf8')) as BankRecord;
    } catch {
      stats.skipped++;
      continue;
    }
    if (rec.section !== 'math') continue; // RW records are another sweep's job
    const src = rec.provenance?.source ?? '';
    if (!redo && (src.startsWith('vision') || src === 'ssqb-api')) {
      stats.skipped++; // already transcribed in a previous run (checkpoint)
      continue;
    }
    if (!needsProcessing(rec)) {
      stats.skipped++;
      continue;
    }
    selected.push(file);
    if (limit !== undefined && selected.length >= limit) break;
  }

  console.log(
    `transcribe-math: ${selected.length} record(s) selected via ${provider.name}/${model}` +
      `${redo ? ' (--redo)' : ''}${process.env.SATQB_COOKIE ? ' +ssqb-api hybrid' : ''}`,
  );

  let done = 0;
  await runPool(selected, CONCURRENCY, async (file) => {
    const id = path.basename(file, '.json');
    try {
      const { verified } = await processRecord(file, provider, model);
      stats.processed++;
      if (verified) stats.verified++;
      else stats.unverified++;
    } catch (err) {
      stats.errors++;
      console.error(`  ERROR ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done++;
    if (done % PROGRESS_EVERY === 0 || done === selected.length) {
      console.log(`transcribe-math: progress ${done}/${selected.length}`);
    }
  });

  console.log(
    `transcribe-math: done — ${JSON.stringify({
      processed: stats.processed,
      verified: stats.verified,
      unverified: stats.unverified,
      errors: stats.errors,
      skipped: stats.skipped,
    })}`,
  );
  process.exit(stats.errors > 0 && stats.processed === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`transcribe-math: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

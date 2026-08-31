/**
 * generate-question — CLI front-end for the question generator
 * (src/generator/generate.ts). One run = a batch of questions for ONE
 * (subject, skill, difficulty) job, written as drafts to
 * research/sat/generated/ (or --out-dir).
 *
 * Usage:
 *   npm run generate -- --subject SAT_RW --skill transitions --difficulty 3 \
 *     [--diagram] [--count 2] [--provider mock|openrouter|kimi] \
 *     [--mock-script <file> ...] [--out-dir <dir>]
 *
 * Providers:
 *   mock        deterministic replay of --mock-script files. Scripts are
 *               consumed IN ORDER across ALL questions in the batch (one per
 *               complete() call; a repair retry consumes the next script).
 *               Exhausting the queue mid-batch is a hard error naming how
 *               many more scripts are needed. Default provider when neither
 *               --provider nor env GENERATOR_PROVIDER is set.
 *   openrouter  live generation; requires env OPENROUTER_API_KEY
 *               (https://openrouter.ai/keys), optional env OPENROUTER_MODEL.
 *               Missing key -> clean exit-1 with setup instructions.
 *   kimi        live generation via the Kimi Code plan; requires env
 *               KIMI_API_KEY, optional env KIMI_MODEL (default
 *               k3). Missing key -> clean exit-1 with setup
 *               instructions.
 *
 * Drafts land with review.status 'pending' — they are committed (original
 * content, license-safe) and enter the review lifecycle documented in
 * research/README.md: human review flips review fields to 'approved', then
 * npm run validate:questions + npm run seed pick them up.
 *
 * Exit codes: 0 = every requested question generated and written;
 *             1 = bad args, provider setup failure, or any question failed
 *                 (failures are reported per question; the batch continues).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generateQuestion, GenerateError } from '../src/generator/generate.js';
import type { AttemptLog } from '../src/generator/generate.js';
import { mockFromFiles, resolveProvider, LLMError, SUPPORTED_PROVIDERS } from '../src/llm/index.js';
import type { LLMProvider } from '../src/llm/index.js';
import { REPO_ROOT } from './lib/validate.js';

const SUBJECTS = ['SAT_RW', 'SAT_MATH'] as const;
type Subject = (typeof SUBJECTS)[number];
const DIFFICULTIES = ['2', '3', '4'] as const;
const MAX_ATTEMPTS = 4; // generateQuestion default repair budget

const USAGE = `Usage: npm run generate -- --subject SAT_RW|SAT_MATH --skill <slug> --difficulty 2|3|4 \\
  [--diagram] [--count N] [--provider mock|openrouter|kimi] [--mock-script <file> ...] [--out-dir <dir>]`;

interface CliArgs {
  subject: Subject;
  skill: string;
  difficulty: 2 | 3 | 4;
  withDiagram: boolean;
  count: number;
  provider?: string;
  mockScripts: string[];
  outDir: string;
}

function fail(message: string): never {
  console.error(`generate: ${message}`);
  process.exit(1);
}

function parseCli(argv: string[]): CliArgs {
  // util.parseArgs repeats a multiple:true flag per value (--mock-script a
  // --mock-script b); users naturally write --mock-script a b. Rewrite the
  // latter: bare tokens after --mock-script (up to the next --flag) belong
  // to it. Any other positional token is rejected by parseArgs itself.
  const normalized: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--mock-script') {
      const values: string[] = [];
      while (i + 1 < argv.length && !argv[i + 1]!.startsWith('--')) {
        values.push(argv[++i]!);
      }
      if (values.length === 0) {
        normalized.push(token); // let parseArgs report the missing argument
      } else {
        for (const v of values) normalized.push(`--mock-script=${v}`);
      }
    } else {
      normalized.push(token);
    }
  }
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: normalized,
      options: {
        subject: { type: 'string' },
        skill: { type: 'string' },
        difficulty: { type: 'string' },
        diagram: { type: 'boolean', default: false },
        count: { type: 'string', default: '1' },
        provider: { type: 'string' },
        'mock-script': { type: 'string', multiple: true, default: [] },
        'out-dir': { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    });
  } catch (err) {
    fail(`${(err as Error).message}\n${USAGE}`);
  }
  // parseArgs values are typed loosely (string | boolean | array); narrow here.
  const v = parsed.values as {
    subject?: string;
    skill?: string;
    difficulty?: string;
    diagram?: boolean;
    count?: string;
    provider?: string;
    'mock-script'?: string[];
    'out-dir'?: string;
    help?: boolean;
  };
  if (v.help === true) {
    console.log(USAGE);
    process.exit(0);
  }

  if (v.subject === undefined) fail(`missing required --subject\n${USAGE}`);
  if (!SUBJECTS.includes(v.subject as Subject)) {
    fail(`unknown --subject '${v.subject}'. Valid: ${SUBJECTS.join(', ')}`);
  }
  if (v.skill === undefined || v.skill === '') fail(`missing required --skill <slug>\n${USAGE}`);
  if (v.difficulty === undefined) fail(`missing required --difficulty 2|3|4\n${USAGE}`);
  if (!DIFFICULTIES.includes(v.difficulty as '2' | '3' | '4')) {
    fail(`--difficulty must be one of 2, 3, 4 (got '${v.difficulty}')`);
  }
  const count = Number(v.count);
  if (!Number.isInteger(count) || count < 1) {
    fail(`--count must be a positive integer (got '${v.count}')`);
  }
  if (
    v.provider !== undefined &&
    !(SUPPORTED_PROVIDERS as readonly string[]).includes(v.provider)
  ) {
    fail(`unknown --provider '${v.provider}'. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }

  return {
    subject: v.subject as Subject,
    skill: v.skill,
    difficulty: Number(v.difficulty) as 2 | 3 | 4,
    withDiagram: v.diagram === true,
    count,
    provider: v.provider,
    mockScripts: v['mock-script'] ?? [],
    outDir: v['out-dir'] ?? path.join(REPO_ROOT, 'research', 'sat', 'generated'),
  };
}

function resolveCli(args: CliArgs): LLMProvider {
  const providerName = args.provider ?? process.env.GENERATOR_PROVIDER ?? 'mock';
  if (providerName === 'mock') {
    if (args.mockScripts.length === 0) {
      fail(
        'mock provider needs at least one --mock-script <file> ' +
          `(one assistant response per file, consumed in order across ALL questions; ` +
          `worst case ${args.count * MAX_ATTEMPTS} scripts for --count ${args.count}).`,
      );
    }
    for (const p of args.mockScripts) {
      if (!fs.existsSync(p)) fail(`mock script not found: ${p}`);
    }
    return resolveProvider('mock', { scripts: mockFromFiles(args.mockScripts) });
  }
  try {
    return resolveProvider(providerName);
  } catch (err) {
    // missing OPENROUTER_API_KEY (LLMError) or unknown env GENERATOR_PROVIDER
    fail(err instanceof Error ? err.message : String(err));
  }
}

function attemptsSummary(attempts: AttemptLog[]): string {
  return attempts.map((a) => `attempt ${a.attempt}: ${a.outcome}`).join(', ');
}

function usageSummary(attempts: AttemptLog[]): string {
  let prompt = 0;
  let completion = 0;
  let known = false;
  for (const a of attempts) {
    if (a.usage === undefined) continue;
    known = true;
    prompt += a.usage.promptTokens;
    completion += a.usage.completionTokens;
  }
  return known ? `${prompt} in / ${completion} out tokens` : 'usage not reported';
}

async function main(): Promise<void> {
  const args = parseCli(process.argv.slice(2));
  const provider = resolveCli(args);
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log(
    `generate: ${args.count} question(s) — ${args.subject}:${args.skill} difficulty ${args.difficulty}` +
      `${args.withDiagram ? ' +diagram' : ''} via ${provider.name}`,
  );

  const generatedIds: string[] = [];
  let failures = 0;
  for (let i = 0; i < args.count; i++) {
    const tag = `[${i + 1}/${args.count}]`;
    try {
      const result = await generateQuestion({
        subjectCode: args.subject,
        skill: args.skill,
        difficulty: args.difficulty,
        withDiagram: args.withDiagram,
        provider,
      });
      const question = result.question as { id?: string };
      const id = typeof question.id === 'string' ? question.id : '(no id)';
      const last = result.attempts[result.attempts.length - 1];
      console.log(
        `${tag} ${id} — ${last?.outcome ?? 'accepted'} (${attemptsSummary(result.attempts)}; ` +
          `${usageSummary(result.attempts)}; model ${result.model}, prompt ${result.promptVersion})`,
      );
      const outFile = path.join(args.outDir, `${id}.json`);
      fs.writeFileSync(outFile, `${JSON.stringify(question, null, 2)}\n`);
      generatedIds.push(id);
    } catch (err) {
      failures++;
      if (err instanceof GenerateError) {
        console.error(`${tag} FAILED — ${err.message}`);
      } else if (err instanceof LLMError && err.message.includes('mock provider exhausted')) {
        const remaining = args.count - i;
        console.error(
          `${tag} FAILED — ${err.message}. All ${args.mockScripts.length} mock script(s) are spent ` +
            `with ${remaining} question(s) left in the batch: supply at least ${remaining} more script(s) ` +
            `(up to ${remaining * MAX_ATTEMPTS} if every question burns its full repair budget of ${MAX_ATTEMPTS} attempts).`,
        );
      } else {
        console.error(`${tag} FAILED — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const rel = (p: string): string => (path.isAbsolute(p) ? path.relative(REPO_ROOT, p) : p);
  console.log(
    `generate: done — ${generatedIds.length} generated (${generatedIds.join(', ') || 'none'})` +
      `${failures > 0 ? `, ${failures} failed` : ''} -> ${rel(args.outDir)}`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`generate: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

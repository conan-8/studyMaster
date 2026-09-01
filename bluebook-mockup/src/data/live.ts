import type { ExamModule, Question } from '../types/exam'

/**
 * Live question bank — replaces the static lorem-ipsum data/exam.ts TEST.
 *
 * Three question kinds, per the product's store partition:
 *   generated — our original questions (Supabase question_versions, display)
 *   bank      — online SSQB items (harvested_questions, origin=question_bank)
 *   bluebook  — SSQB items that appear in Bluebook practice exams
 *               (harvested_questions, origin=bluebook)
 *
 * Content text uses \( ... \) inline LaTeX (rendered by RichText/KaTeX) and
 * <u>...</u> underline markup (converted to the mockup's [[...]] markup).
 * Diagrams carry { archetypeId, parameters } and render through the
 * parameterized SVG renderer bundle.
 */

const SUPABASE_URL = 'https://asnrquijopjjqfjvwalc.supabase.co'
const ANON_KEY = 'sb_publishable_qg5QMNLb-D-BelY5G27kYA_UnZU0Hxh'
const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }

export type SourceKind = 'generated' | 'bank' | 'bluebook'

interface RawGenerated {
  question_id: string
  payload: {
    questionType: 'mcq' | 'grid_in'
    stimulus?: { type?: string; text?: string | null; tableJson?: TableJson | null; diagram?: LiveDiagram | null }
    stem: string
    choices?: Array<{ id: string; text: string }>
    correctAnswer: string
    taxonomyCode: string
  }
}

interface RawHarvested {
  source_id: string
  origin: 'bluebook' | 'question_bank'
  payload: {
    questionType: 'mcq' | 'grid_in'
    section: 'reading-writing' | 'math'
    domain: string
    skill: string
    difficultyInternal: number
    stimulus?: { type?: string; text?: string | null; tableJson?: TableJson | null; figureAsset?: string | null }
    stem: string
    choices?: Array<{ id: string; text: string }>
    correctAnswer: string
  }
}

interface TableJson {
  caption?: string
  columns?: string[]
  headers?: string[]
  rows?: Array<Array<string | number>>
}

interface LiveDiagram {
  archetypeId: string
  parameters: Record<string, unknown>
}

export interface BankQuestion extends Question {
  kind: SourceKind
  section: 'rw' | 'math'
  difficulty: number
}

/** <u>x</u> → [[x]] so the mockup's RichText underlines it. */
function underlines(text: string): string {
  return text.replace(/<u>(.+?)<\/u>/g, '[[$1]]')
}

function prettyTaxonomy(code: string): string {
  const slug = code.includes(':') ? code.split(':')[1]! : code
  return slug
    .split('-')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

function toQuestion(
  id: string,
  kind: SourceKind,
  section: 'rw' | 'math',
  skill: string,
  difficulty: number,
  payload: RawGenerated['payload'] | RawHarvested['payload'],
): BankQuestion {
  const stim = payload.stimulus
  const diagram = (stim as RawGenerated['payload']['stimulus'])?.diagram
  const rawTable = stim?.tableJson
  const table = rawTable
    ? {
        caption: rawTable.caption,
        columns: rawTable.columns ?? rawTable.headers ?? [],
        rows: rawTable.rows ?? [],
      }
    : undefined
  return {
    id,
    kind,
    section,
    difficulty,
    skill,
    prompt: payload.stem,
    passage: stim?.text ? underlines(stim.text) : undefined,
    table,
    options: payload.choices?.map((c) => c.text),
    correct: payload.correctAnswer,
    diagram: diagram ? { live: { archetypeId: diagram.archetypeId, parameters: diagram.parameters } } : undefined,
  }
}

let cache: { generated: BankQuestion[]; harvested: BankQuestion[] } | null = null

export async function fetchBank(): Promise<{ generated: BankQuestion[]; harvested: BankQuestion[] }> {
  if (cache) return cache
  const [g, h] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/question_versions?select=question_id,payload&review_status=eq.approved`, {
      headers: H,
    }).then((r) => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/harvested_questions?select=source_id,origin,payload`, { headers: H }).then((r) =>
      r.json(),
    ),
  ])
  const generated: BankQuestion[] = (Array.isArray(g) ? g : []).map((r: RawGenerated) =>
    toQuestion(
      r.question_id,
      'generated',
      r.payload.taxonomyCode.startsWith('SAT_RW') ? 'rw' : 'math',
      prettyTaxonomy(r.payload.taxonomyCode),
      3,
      r.payload,
    ),
  )
  const harvested: BankQuestion[] = (Array.isArray(h) ? h : []).map((r: RawHarvested) =>
    toQuestion(
      r.source_id,
      r.origin === 'bluebook' ? 'bluebook' : 'bank',
      r.payload.section === 'reading-writing' ? 'rw' : 'math',
      `${r.payload.domain} — ${prettyTaxonomy(r.payload.skill)}`,
      r.payload.difficultyInternal,
      r.payload,
    ),
  )
  cache = { generated, harvested }
  return cache
}

/** Questions for one source selection (excludeBluebook drops bluebook items). */
export function selectQuestions(
  bank: { generated: BankQuestion[]; harvested: BankQuestion[] },
  source: SourceKind,
  excludeBluebook: boolean,
): BankQuestion[] {
  if (source === 'generated') return bank.generated
  let items = bank.harvested
  if (excludeBluebook) items = items.filter((q) => q.kind !== 'bluebook')
  return items.filter((q) => q.kind === source)
}

/** Build a 4-module digital-SAT-shaped test from whatever the bank holds. */
export function assembleTest(questions: BankQuestion[]): ExamModule[] {
  const rw = questions.filter((q) => q.section === 'rw')
  const math = questions.filter((q) => q.section === 'math')
  const half = (list: BankQuestion[], module: string, i: number): BankQuestion[] =>
    list.slice(i, i + Math.ceil(list.length / 2)).map((q) => ({ ...q, id: `${module}-${q.id}` }))

  const modules: ExamModule[] = []
  const rwSplit = Math.ceil(rw.length / 2)
  const mathSplit = Math.ceil(math.length / 2)
  const minutes = (count: number, realCount: number, realMinutes: number): number =>
    Math.max(5, Math.round((count / realCount) * realMinutes))

  modules.push({
    id: 'rw1',
    label: 'Section 1, Module 1',
    title: 'Reading and Writing',
    minutes: minutes(rwSplit || 1, 27, 32),
    split: true,
    questions: half(rw, 'rw1', 0),
  })
  modules.push({
    id: 'rw2',
    label: 'Section 1, Module 2',
    title: 'Reading and Writing',
    minutes: minutes(rw.length - rwSplit || 1, 27, 32),
    split: true,
    questions: half(rw, 'rw2', rwSplit),
  })
  modules.push({
    id: 'math1',
    label: 'Section 2, Module 1',
    title: 'Math',
    minutes: minutes(mathSplit || 1, 22, 35),
    split: false,
    questions: half(math, 'math1', 0),
  })
  modules.push({
    id: 'math2',
    label: 'Section 2, Module 2',
    title: 'Math',
    minutes: minutes(math.length - mathSplit || 1, 22, 35),
    split: false,
    questions: half(math, 'math2', mathSplit),
  })
  return modules.filter((m) => m.questions.length > 0)
}

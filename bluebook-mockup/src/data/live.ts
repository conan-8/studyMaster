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
  /** Archetype/skill slug — the canonical categorization (same namespace as
   *  the 30 generator archetypes). */
  archetype: string
  domain: string
}

/** <u>x</u> → [[x]] so the mockup's RichText underlines it. */
function underlines(text: string): string {
  return text.replace(/<u>(.+?)<\/u>/g, '[[$1]]')
}

const SPEAKER_RX = /^[A-Z][A-Z' .]{1,24}:/
const VERSE_RX = /\b(poem|poetry|sonnet|verse|play|drama)\b/i

/** Notes passages (rhetorical synthesis): guarantee one bulleted line per
 *  note. Wrapped continuation fragments (start with punctuation/lowercase)
 *  are folded back into the previous note. */
function bulletNotes(text: string): string {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const l = raw.trim()
    if (!l) {
      out.push('')
      continue
    }
    if (l.startsWith('•') || l.startsWith('-') || l.startsWith('–')) {
      out.push(l)
      continue
    }
    if (/^(While researching|A student|The student)/.test(l)) {
      out.push(l)
      continue
    }
    if ((/^[.,"'”’)]/.test(l) || /^[a-z]/.test(l)) && out.length) {
      out[out.length - 1] += ` ${l}`
      continue
    }
    out.push(`• ${l}`)
  }
  return out.join('\n')
}

/** Hard-wrapped PDF prose: join lines so the text reflows to the pane width
 *  when the divider is dragged. Verse and plays keep their line breaks;
 *  Text headings and speaker labels always start a new paragraph. */
function reflow(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l)
  if (lines.length <= 1) return text.trim()
  if (VERSE_RX.test(text.slice(0, 250))) return lines.join('\n')
  const blocks: string[] = []
  let cur = ''
  const flush = () => {
    if (cur) {
      blocks.push(cur)
      cur = ''
    }
  }
  for (const l of lines) {
    if (l.startsWith('**Text') || SPEAKER_RX.test(l)) {
      flush()
      cur = l
      continue
    }
    if (cur && cur.length >= 40 && !cur.startsWith('**')) cur = `${cur} ${l}`
    else {
      flush()
      cur = l
    }
  }
  flush()
  return blocks.join('\n\n')
}

/** Passage cleanup: bold Text 1/Text 2 headings, bullet the notes passages,
 *  and unwrap hard-broken prose so lines always fit the pane. */
function formatPassage(text: string, archetype: string): string {
  const t = underlines(text).replace(/^(Text\s+\w+)\s*$/gm, '**$1**')
  return archetype === 'rhetorical-synthesis' ? bulletNotes(t) : reflow(t)
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
  archetype: string,
  domain: string,
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
  const rawImage = (stim as RawHarvested['payload']['stimulus'])?.figureAsset
  const imageAsset = rawImage ? `/${rawImage}` : undefined
  return {
    id,
    kind,
    section,
    difficulty,
    skill,
    archetype,
    domain,
    prompt: payload.stem,
    passage: stim?.text ? formatPassage(stim.text, archetype) : undefined,
    table,
    options: payload.choices?.map((c) => c.text),
    correct: payload.correctAnswer,
    diagram: diagram ? { live: { archetypeId: diagram.archetypeId, parameters: diagram.parameters } } : undefined,
    imageAsset,
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
      r.payload.taxonomyCode.split(':')[1] ?? '',
      '',
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
      r.payload.skill,
      r.payload.domain,
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

/** Digital SAT domain blueprints (percent of each section's questions). */
const BLUEPRINT: Record<'rw' | 'math', Array<[string, number]>> = {
  rw: [
    ['Craft and Structure', 0.28],
    ['Information and Ideas', 0.26],
    ['Standard English Conventions', 0.26],
    ['Expression of Ideas', 0.2],
  ],
  math: [
    ['Algebra', 0.35],
    ['Advanced Math', 0.35],
    ['Problem-Solving and Data Analysis', 0.15],
    ['Geometry and Trigonometry', 0.15],
  ],
}
const SECTION_LENGTH: Record<'rw' | 'math', number> = { rw: 54, math: 44 } // both modules combined

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Largest-remainder allocation of `total` items across weighted buckets. */
function allocate(total: number, weights: number[]): number[] {
  const raw = weights.map((w) => w * total)
  const floors = raw.map(Math.floor)
  let rem = total - floors.reduce((s, n) => s + n, 0)
  const order = raw
    .map((v, i) => [v - floors[i]!, i] as const)
    .sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (rem <= 0) break
    floors[i]! += 1
    rem -= 1
  }
  return floors
}

/** Sample `pool` down to the section's real-test domain ratio. */
function sampleByBlueprint(pool: BankQuestion[], section: 'rw' | 'math'): BankQuestion[] {
  const spec = BLUEPRINT[section]
  const total = Math.min(pool.length, SECTION_LENGTH[section])
  const quotas = allocate(total, spec.map(([, w]) => w))
  const byDomain = new Map<string, BankQuestion[]>()
  for (const q of shuffle(pool)) {
    const key = spec.some(([d]) => d === q.domain) ? q.domain : '_other'
    if (!byDomain.has(key)) byDomain.set(key, [])
    byDomain.get(key)!.push(q)
  }
  const picked: BankQuestion[] = []
  spec.forEach(([domain], i) => {
    picked.push(...(byDomain.get(domain) ?? []).slice(0, quotas[i]!))
  })
  // fill any shortfall from leftovers so small banks still build a full test
  if (picked.length < total) {
    const used = new Set(picked)
    picked.push(...shuffle(pool.filter((q) => !used.has(q))).slice(0, total - picked.length))
  }
  return shuffle(picked)
}

/** Archetype (skill-slug) counts for one source — the categorization view. */
export function archetypeCounts(
  bank: { generated: BankQuestion[]; harvested: BankQuestion[] },
  source: SourceKind,
  excludeBluebook: boolean,
): Array<{ archetype: string; count: number }> {
  const qs = selectQuestions(bank, source, excludeBluebook)
  const counts = new Map<string, number>()
  for (const q of qs) counts.set(q.archetype, (counts.get(q.archetype) ?? 0) + 1)
  return [...counts.entries()]
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count || a.archetype.localeCompare(b.archetype))
}

/** Build a 4-module digital-SAT-shaped test at real domain ratios. */
export function assembleTest(questions: BankQuestion[]): ExamModule[] {
  const rw = sampleByBlueprint(questions.filter((q) => q.section === 'rw'), 'rw')
  const math = sampleByBlueprint(questions.filter((q) => q.section === 'math'), 'math')

  const modules: ExamModule[] = []
  const rwSplit = Math.ceil(rw.length / 2)
  const mathSplit = Math.ceil(math.length / 2)
  const minutes = (count: number, realCount: number, realMinutes: number): number =>
    Math.max(5, Math.round((count / realCount) * realMinutes))
  const half = (list: BankQuestion[], module: string, from: number, to: number): BankQuestion[] =>
    list.slice(from, to).map((q) => ({ ...q, id: `${module}-${q.id}` }))

  modules.push({
    id: 'rw1',
    label: 'Section 1, Module 1',
    title: 'Reading and Writing',
    minutes: minutes(rwSplit || 1, 27, 32),
    split: true,
    questions: half(rw, 'rw1', 0, rwSplit),
  })
  modules.push({
    id: 'rw2',
    label: 'Section 1, Module 2',
    title: 'Reading and Writing',
    minutes: minutes(rw.length - rwSplit || 1, 27, 32),
    split: true,
    questions: half(rw, 'rw2', rwSplit, rw.length),
  })
  modules.push({
    id: 'math1',
    label: 'Section 2, Module 1',
    title: 'Math',
    minutes: minutes(mathSplit || 1, 22, 35),
    split: false,
    questions: half(math, 'math1', 0, mathSplit),
  })
  modules.push({
    id: 'math2',
    label: 'Section 2, Module 2',
    title: 'Math',
    minutes: minutes(math.length - mathSplit || 1, 22, 35),
    split: false,
    questions: half(math, 'math2', mathSplit, math.length),
  })
  return modules.filter((m) => m.questions.length > 0)
}

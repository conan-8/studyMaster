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
 *
 * Curated layer: harvested records may carry payload.curated (imported from
 * the human curation workbook, research/sat/curate/) — those render VERBATIM
 * with info/prompt/options/diagram mapped 1:1 to screen regions, bypassing
 * the reflow/bulleting heuristics below.
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
    rationale?: string
  }
}

/** Human-curated display-ready block (payload.curated) — fields map 1:1 to
 *  simulator regions and are rendered VERBATIM: no reflow, no bulleting, no
 *  stem-splitting. Author markup: \( \) LaTeX, [[ ]] underline, **bold**,
 *  *italic*, blank line = paragraph. */
interface CuratedBlock {
  section: 'reading-writing' | 'math'
  domain: string
  skill: string
  difficultyInternal: number
  info: string | null
  prompt: string
  options: Array<{ id: string; text: string }>
  gridAnswer: string | null
  correctAnswer: string
  rationale: string | null
  diagram: string | null
  review?: { status: 'approved' | 'returned'; reasons?: string[]; note?: string | null; at: string }
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
    rationale?: string
    curated?: CuratedBlock
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
  /** Vision-transcribed bank items carry provenance { verified: true }. */
  verified?: boolean
  /** Curated records only: true once approved in the /review tool. Curated
   *  questions enter the simulator pools only when approved. */
  approved?: boolean
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
  const verified = (payload as { provenance?: { verified?: boolean } }).provenance?.verified === true
  return {
    id,
    kind,
    section,
    difficulty,
    skill,
    archetype,
    domain,
    verified,
    prompt: payload.stem,
    passage: stim?.text ? formatPassage(stim.text, archetype) : undefined,
    table,
    options: payload.choices?.map((c) => c.text),
    correct: payload.correctAnswer,
    rationale: payload.rationale ?? undefined,
    diagram: diagram ? { live: { archetypeId: diagram.archetypeId, parameters: diagram.parameters } } : undefined,
    imageAsset,
  }
}

/** Curated records render verbatim — the authoring sheet is the source of
 *  truth for what lands in each pane, so none of the layout heuristics
 *  (reflow/bulletNotes/underlines) apply. */
function toCuratedQuestion(r: RawHarvested, c: CuratedBlock): BankQuestion {
  return {
    id: r.source_id,
    kind: r.origin === 'bluebook' ? 'bluebook' : 'bank',
    section: c.section === 'reading-writing' ? 'rw' : 'math',
    difficulty: c.difficultyInternal,
    skill: `${c.domain} — ${prettyTaxonomy(c.skill)}`,
    archetype: c.skill,
    domain: c.domain,
    verified: true,
    approved: c.review?.status === 'approved',
    prompt: c.prompt,
    passage: c.info ?? undefined,
    options: c.options.length > 0 ? c.options.map((o) => o.text) : undefined,
    correct: c.correctAnswer,
    rationale: c.rationale ?? undefined,
    imageAsset: c.diagram ? `/${c.diagram}` : undefined,
  }
}

const PAGE_SIZE = 1000 // PostgREST server-side row cap per request

/** PostgREST silently caps each response at PAGE_SIZE rows — page with
 *  offset until a short page arrives so the whole bank is fetched. */
async function fetchAllPages(url: string): Promise<unknown[]> {
  const out: unknown[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(`${url}&offset=${offset}&limit=${PAGE_SIZE}`, { headers: H })
    const page: unknown = await res.json()
    if (!Array.isArray(page)) return [] // error payload — treat as empty
    out.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return out
}

let cache: { generated: BankQuestion[]; harvested: BankQuestion[] } | null = null

export async function fetchBank(): Promise<{ generated: BankQuestion[]; harvested: BankQuestion[] }> {
  if (cache) return cache
  const [g, h] = await Promise.all([
    fetchAllPages(`${SUPABASE_URL}/rest/v1/question_versions?select=question_id,payload&review_status=eq.approved`),
    fetchAllPages(`${SUPABASE_URL}/rest/v1/harvested_questions?select=source_id,origin,payload`),
  ])
  const generated: BankQuestion[] = (g as RawGenerated[]).map((r) =>
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
  const harvested: BankQuestion[] = (h as RawHarvested[]).map((r) =>
    r.payload.curated
      ? toCuratedQuestion(r, r.payload.curated)
      : toQuestion(
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

/** Questions for one source selection (excludeBluebook drops bluebook items;
 *  verifiedOnly keeps only items with a verified vision transcription). */
export function selectQuestions(
  bank: { generated: BankQuestion[]; harvested: BankQuestion[] },
  source: SourceKind,
  excludeBluebook: boolean,
  verifiedOnly = false,
): BankQuestion[] {
  const onlyVerified = (qs: BankQuestion[]): BankQuestion[] =>
    verifiedOnly ? qs.filter((q) => q.verified === true) : qs
  if (source === 'generated') return onlyVerified(bank.generated)
  // curated records (approved !== undefined) require approval; non-curated
  // records (math, fixtures) keep the current behavior until curated.
  let items = bank.harvested.filter((q) => q.approved === undefined || q.approved === true)
  if (excludeBluebook) items = items.filter((q) => q.kind !== 'bluebook')
  return onlyVerified(items.filter((q) => q.kind === source))
}

/** Correctness check shared by the sim (exam scoring) and zen (check-as-you-go).
 *  MCQ compares option letters; grid-in compares numeric value with fraction
 *  and tolerance handling. */
export function isCorrect(question: { options?: string[]; correct: string }, value: string): boolean {
  if (question.options) return value === question.correct
  const norm = (s: string): number => {
    const t = s.trim()
    if (!t) return NaN
    if (t.includes('/')) {
      const [a, b] = t.split('/')
      return Number(a) / Number(b)
    }
    return Number(t)
  }
  const a = norm(value)
  const b = norm(question.correct)
  if (Number.isNaN(a) || Number.isNaN(b)) return value.trim() === question.correct.trim()
  return Math.abs(a - b) < 1e-6
}

export interface StudentEventInput {
  question_id: string
  correct: boolean
  mode: 'exam' | 'practice' | 'diagnostic'
  time_ms: number
  choice_id?: string
  grid_in_answer?: string
}

/** Record answered questions to Supabase student_events (dev student). */
export async function postEvents(events: StudentEventInput[]): Promise<void> {
  if (events.length === 0) return
  const now = new Date().toISOString()
  const body = events.map((e) => ({
    student_id: 'dev',
    question_id: e.question_id,
    question_version: 1,
    mode: e.mode,
    idk: false,
    choice_id: e.choice_id ?? null,
    grid_in_answer: e.grid_in_answer ?? null,
    correct: e.correct,
    time_ms: e.time_ms,
    occurred_at: now,
  }))
  await fetch(`${SUPABASE_URL}/rest/v1/student_events`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
}

export type ZenSubject = 'all' | 'math' | 'rw'
export type ZenDifficulty = 'chill' | 'standard' | 'brutal'

/** Endless-stream pool for Zen mode: filter by subject + difficulty bucket.
 *  chill = easy (2), standard = everything, brutal = hard (4). Generated
 *  questions carry no difficulty (mapped to 3), so they land in standard. */
export function selectZen(
  bank: { generated: BankQuestion[]; harvested: BankQuestion[] },
  subject: ZenSubject,
  difficulty: ZenDifficulty,
): BankQuestion[] {
  let items = [...bank.generated, ...bank.harvested]
  if (subject !== 'all') items = items.filter((q) => q.section === subject)
  if (difficulty === 'chill') items = items.filter((q) => q.difficulty === 2)
  if (difficulty === 'brutal') items = items.filter((q) => q.difficulty === 4)
  return items
}

/** Skill-targeted drill pool: only questions whose archetype (skill slug) is
 *  in `skills`. Powers the looseleaf skill-map "practice" actions. */
export function selectBySkills(
  bank: { generated: BankQuestion[]; harvested: BankQuestion[] },
  skills: string[],
): BankQuestion[] {
  const set = new Set(skills)
  return [...bank.generated, ...bank.harvested].filter((q) => set.has(q.archetype))
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
  verifiedOnly = false,
): Array<{ archetype: string; count: number }> {
  const qs = selectQuestions(bank, source, excludeBluebook, verifiedOnly)
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

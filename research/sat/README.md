# SAT question bank research area

Normalized scaffold for harvesting and validating Digital SAT questions
(Reading & Writing + Math) from the College Board Suite of Assessments
Question Bank (SSQB).

## Folder layout

```
research/sat/
├── README.md                ← this file
├── question.schema.json     ← JSON Schema draft-07 for the normalized contract
├── curated.schema.json      ← JSON Schema draft-07 for the display-ready curated contract
├── question-bank/           ← harvested normalized questions (gitignored)
├── assets/                  ← harvested figure PNGs (gitignored)
├── assets/figures/          ← standalone figure PNGs for curated records (gitignored)
├── curate/                  ← human curation workbook(s), e.g. sat_questions.xlsx (gitignored)
├── curated/                 ← display-ready curated records + import report (gitignored)
├── archetypes/              ← original question archetypes derived from the bank (ours)
└── test-fixtures/           ← original sample questions for validator tests (ours)
```

`question-bank/`, `assets/`, `curate/`, `curated/`, `index.jsonl`, and
`.harvest-progress.json` are gitignored — see the licensing rule below.

## Harvest workflow

Content enters via **two PDF exports** dropped into `research/sat/harvest-source/`
(gitignored — College Board content never touches git):

1. **PDF A — all questions** (the full filtered export, answer explanations
   included).
2. **PDF B — Bluebook excluded** (same filters, with the Bluebook/practice
   items filtered out).

The organizer parses both, keys every question by its printed ID, and diffs
the sets: IDs in both PDFs → `origin: "question_bank"`; IDs in A only →
`origin: "bluebook"`; anything in B but missing from A is an export error and
gets flagged, not silently classified. Output is normalized records in
`question-bank/` + figures in `assets/` + `index.jsonl`, validated by
`npm run validate:sat-bank` and seeded into `harvested_questions`.

The `SATQB_COOKIE` API route remains a higher-fidelity alternative (exact
LaTeX instead of PDF-typeset math) if ever needed later.

## Curated layer (display-ready records)

The harvest pipeline infers layout (passage vs stem vs choices) with
heuristics; the curated layer replaces that with human-authored text stored
exactly as the simulator displays it. One record per question in
`curated/ssqb-<id>.json`, validated against `curated.schema.json`, with fields
mapping 1:1 to simulator regions:

- `info` — left-pane stimulus text (`null` when the question has none)
- `prompt` — question text above the answer options
- `options` / `gridAnswer` — the answer area
- `diagram` — standalone figure PNG (`assets/figures/ssqb-<id>.png`) or `null`
- `correctAnswer` / `rationale` — authoritative, from the curation sheet

Metadata (`origin`, `domain`, `skill`, difficulties, `sourceUrl`,
`harvestedAt`) is joined from the harvested bank by `sourceId` at import time.

Workflow:

```bash
npm run import:curated     # curate/sat_questions.xlsx -> curated/*.json + report + figure copies
npm run gallery:curated    # review-gallery/curated.html — verbatim visual QA
npm run seed               # merges each curated record into harvested_questions.payload.curated
```

The simulator (`bluebook-mockup/src/data/live.ts`) renders records carrying
`payload.curated` VERBATIM — no reflow, bulleting, or stem-splitting — while
non-curated records keep the heuristic path. Author markup in the sheet:
`\( \)` LaTeX, `[[ ]]` underline, `**bold**`, `*italic*`, blank line =
paragraph.

The import report (`curated-import-report.txt`) lists skipped rows and
cross-check flags (curated `correctAnswer`/`bluebook`/`diagram` columns are
authoritative; disagreements with the harvest are logged, never fatal).

## Validating the bank

The validator has two modes (a custom-directory mode is not supported):

```bash
npm run validate:sat-bank                                   # question-bank + test-fixtures (runs --fixtures)
npx tsx scripts/validate-sat-bank.ts                        # validates research/sat/question-bank only
npx tsx scripts/validate-sat-bank.ts --fixtures             # validates question-bank + research/sat/test-fixtures
```

The validator checks every `*.json` in the directory (recursively) against
the contract in `question.schema.json` (required fields, enums, choice-count
conditionality, difficulty mapping), cross-checks `index.jsonl` when present
(every indexed `path` exists and every file is indexed), and prints a
skill × difficulty counts summary. Exit code is 0 on success (including an
empty bank), 1 on any failure.

## Normalized question contract

See `question.schema.json` for the authoritative JSON Schema. Each question
record contains:

- `sourceId` — `ssqb-<original College Board id>`
- `origin` — `bluebook` (appears in a Bluebook practice exam) or
  `question_bank` (general online question-bank item); the simulator's
  Bank/Bluebook toggle keys off this
- `section` — `reading-writing` or `math`
- `domain` — exact domain display name (e.g. `Craft and Structure`)
- `skill` — exact skill slug (e.g. `words-in-context`)
- `difficultyOfficial` / `difficultyInternal` — see mapping below
- `questionType` — `mcq` (exactly 4 choices, ids A–D) or `grid_in`
  (empty choices array, numeric-string `correctAnswer`)
- `stimulus` — `type` one of `passage | table | figure | notes | none`, with
  `text`, `tableJson`, `figureAsset` (`assets/<sourceId>.svg`) as applicable
- `stem`, `rationale` (nullable), `sourceUrl`, `harvestedAt` (ISO 8601),
  `allowedUses` (`["internal_eval"]`)

## Difficulty mapping

| `difficultyOfficial` | `difficultyInternal` |
| -------------------- | -------------------- |
| `easy`               | 2                    |
| `medium`             | 3                    |
| `hard`               | 4                    |

## Canonical SAT taxonomy

### Reading & Writing (`reading-writing`)

- **Information and Ideas**: `central-ideas-details`, `command-evidence-textual`,
  `command-evidence-quantitative`, `inferences`
- **Craft and Structure**: `words-in-context`, `text-structure-purpose`,
  `cross-text-connections`
- **Standard English Conventions**: `boundaries`, `form-structure-sense`
- **Expression of Ideas**: `transitions`, `rhetorical-synthesis`

### Math (`math`)

- **Algebra**: `linear-equations-one-var`, `linear-functions`,
  `linear-equations-two-vars`, `systems-linear-equations`, `linear-inequalities`
- **Advanced Math**: `equivalent-expressions`, `nonlinear-functions`,
  `nonlinear-equations-systems`
- **Problem-Solving and Data Analysis**: `ratios-rates-proportions`,
  `percentages`, `one-variable-data`, `two-variable-data`,
  `probability-conditional`, `sample-statistics-margin-error`,
  `evaluating-claims`
- **Geometry and Trigonometry**: `area-volume`, `lines-angles-triangles`,
  `right-triangles-trig`, `circles`

## Licensing rule

Harvested College Board question content is **internal_eval only**. It must
never be committed to git and must never be shown to students. Only
original, derived archetypes (`archetypes/`) and our own test fixtures
(`test-fixtures/`) may be committed and used in the product.

When a harvester eventually runs, its output seeds into the **separate
`harvested_questions` table** (migrations/004) — never into the generated
question store (`questions`/`question_versions`, `source='generated'`).
`harvested_questions` splits content by `origin` (`bluebook` vs
`question_bank`), is RLS-locked, and carries only a dev-only anon read
policy for the local simulator; only server-side service-role jobs may
write it.

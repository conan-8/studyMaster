# Research Mission — Field Guide

Collect the raw material that powers the app. **Current scope is SAT-first**:
the two Digital SAT sections (`SAT_MATH`, `SAT_RW`) are the only live subjects.
AP expansion is planned future work — see [Future work](#future-work).

> **One rule to remember:** the *format facts* are ours to use; *released exam
> questions* are internal-eval only. See [Licensing & usage](#licensing--usage)
> and `research/sat/README.md` for the full SAT harvest rules.

---

## The 4 data tracks (current state)

| # | Track | What it is | Where it lives NOW | Validator |
|---|-------|-----------|--------------------|-----------|
| 1 | **Exam format** | Sections, timing, question counts, domain weights, policies | `database/<SUBJECT>/exam_format.json` (SAT_MATH, SAT_RW) | `npm run validate:exam-formats` |
| 2 | **Taxonomy + misconceptions** | Domains → skills per subject, plus the distractor-wiring / remediation library | `database/<SUBJECT>/taxonomy.json`, `database/<SUBJECT>/misconceptions.json` | `npm run validate:taxonomy`, `npm run validate:misconceptions` |
| 3 | **Diagram registry** | Parameterized diagram archetypes (one JSON per figure type, with `paramsSchema` + renderer ref) | `database/diagrams/<id>.json` (13 entries, `sat-math:*`) | `npm run validate:diagrams` |
| 4 | **Question archetypes + generated questions** | Per-skill generation archetypes (JSON recipe + worked-example `.md`), and original displayable questions produced from them | `research/sat/archetypes/<rw\|math>/<slug>.{json,md}` (30 archetypes), `research/sat/test-fixtures/generated-*.json`, `research/sat/generated/*.json` (generator drafts, committed) | `npm run validate:archetypes`, `npm run validate:questions` |

Contracts for every track live in `schemas/` (see `schemas/README.md`) and are
the single source of truth — validators, generators, and the DB seed all
reference them.

Current counts: 2 exam formats, 38 taxonomy nodes, 139 misconceptions,
13 diagram archetypes, 30 question archetypes.

---

## Naming conventions

Use the **canonical subject code** from the exam format files:

```
SAT_MATH   SAT_RW        (live)
AP_*       (future — e.g. AP_US_HISTORY, AP_CALC_AB)
```

Subject-scoped codes are `<SUBJECT>:<slug>` (e.g. `SAT_RW:transitions`); diagram
archetype IDs are lowercase `<family>:<name>` (e.g. `sat-math:graph-line`).
Generated-question IDs match `^gen-[a-z0-9-]+-[0-9]{3,}$`.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run validate:all` | Run every validation suite below, in order |
| `npm run validate:exam-formats` | `database/*/exam_format.json` vs `database/exam_format.schema.json` |
| `npm run validate:taxonomy` | `database/*/taxonomy.json` vs `schemas/taxonomy.schema.json` |
| `npm run validate:misconceptions` | `database/*/misconceptions.json` vs `schemas/misconception.schema.json` (+ taxonomy cross-refs) |
| `npm run validate:diagrams` | `database/diagrams/*.json` vs `schemas/diagram-archetype.schema.json` |
| `npm run validate:archetypes` | `research/sat/archetypes/*/*.json` vs `schemas/archetype.schema.json` (+ cross-refs) |
| `npm run validate:questions` | `research/sat/test-fixtures/generated-*.json` AND `research/sat/generated/*.json` vs `schemas/generated-question.schema.json` (+ taxonomy, misconception, and diagram-parameter cross-checks; neutral to `review.status`) |
| `npm run validate:sat-bank` | Harvested bank + dry-run fixtures vs `research/sat/question.schema.json` |
| `npm run generate` | Generate question drafts from an archetype (mock replay or live via OpenRouter) into `research/sat/generated/` — see [Generating questions](#generating-questions) |
| `npm test` | Diagram renderer suite (registry, determinism, param coverage, E2E) — see `src/renderers/README.md` |
| `npm run gallery` | Render every diagram archetype (golden params + E2E fixture) to `rendered-gallery/` |
| `npm run db:up` | Start Postgres via `docker compose up -d` |
| `npm run db:migrate` | Apply `migrations/*.sql` (clean PENDING-DEPLOY exit 0 if DB unreachable) |
| `npm run seed` | Seed subjects, taxonomy, misconceptions, diagrams, archetypes, approved questions (same PENDING-DEPLOY fallback) |

---

## Authoring a generated question (track 4)

1. Pick the archetype for the target skill (`research/sat/archetypes/<section>/<slug>.json` + its `.md` worked example).
2. Write an original item following its `generationRecipe` and `validationChecklist`.
3. Shape it to `schemas/generated-question.schema.json`: mcq = exactly 4 choices with the key's `misconceptionId: null` and distractors wired to real ids from `database/<SUBJECT>/misconceptions.json`; grid_in = `choices: []` + numeric-string answer. Graph items set `stimulus.diagram` to a `database/diagrams/` archetype ID plus parameters that validate against its `paramsSchema`.
4. Set `provenance` (`archetypeSlug`, `promptVersion`, `model`, `generatedAt`, `contentHash` = sha256 of the canonical JSON minus the hash field) and `review`; `allowedUses: ["display"]`.
5. Save as `research/sat/test-fixtures/generated-<desc>-NNN.json` and run `npm run validate:questions`.

---

## Generating questions

`npm run generate` drives the propose-validate-repair loop in
`src/generator/generate.ts`: the model proposes a draft, deterministic code
validates it against `schemas/generated-question.schema.json` plus cross-checks,
and a repair retry (up to 4 attempts) feeds back every violation. Accepted
drafts land in `research/sat/generated/<id>.json` — **drafts are committed**
(original content, license-safe) with `review.status: "pending"`.

Keyless dry-run with the mock provider (one `--mock-script` file per assistant
response, consumed in order across ALL questions — a repair retry consumes the
next script, so supply up to `--count × 4`):

```sh
npm run generate -- --subject SAT_RW --skill transitions --difficulty 3 \
  --mock-script /tmp/response-a.json /tmp/response-b.json
```

Live generation via OpenRouter (set `OPENROUTER_MODEL` to override the default
`minimax/minimax-m3`):

```sh
export OPENROUTER_API_KEY=<key from https://openrouter.ai/keys>
npm run generate -- --subject SAT_RW --skill transitions --difficulty 3 \
  --provider openrouter --count 2
```

Flags: `--diagram` (figure item; only SAT_MATH skills with a `diagramSpec`),
`--count N`, `--out-dir` (default `research/sat/generated/`). One failing
question fails the batch exit code but not the other questions.

**Review lifecycle:** drafts arrive `pending` → a human reviews the file and
flips `review` to `{status: "approved", reviewer, notes}` →
`npm run validate:questions` (status-neutral; checks both fixtures and drafts)
→ `npm run seed` ingests `approved` questions only and reports pending/rejected
as skipped counts. Rejected drafts: flip `status` to `"rejected"` or delete
the file.

---

## Licensing & usage

- **Safe to use:** facts, concepts, skills, question *formats*, rubric
  *structures*, public-domain & CC & U.S.-government material (with citations).
- **Internal-eval only** (`allowedUses: ["internal_eval"]`): released College
  Board questions and anything harvested from the SSQB. Never republished,
  never trained on, gitignored under `research/sat/question-bank/` and
  `research/sat/assets/`.
- **Display** (`allowedUses: ["display"]`): original questions we author from
  our own archetypes — the generated-question track above.
- Flag every asset with `display` / `internal_eval` / `train`. When unsure
  about a license, leave it out.
- This is guidance, not legal advice — get the IP lawyer involved before launch.

---

## Future work

- **SAT bank harvester** (`research/sat/`): the SSQB harvest workflow,
  normalized harvested-question contract (`question.schema.json`), and the
  licensing rules for harvested material are documented in
  `research/sat/README.md`. The harvested bank feeds archetype calibration and
  internal evaluation only — never display.
- **AP expansion:** each new AP subject is a new `database/<SUBJECT>/` folder
  with the same three files (`exam_format.json`, `taxonomy.json`,
  `misconceptions.json`) validated by the same suites, plus its own archetype
  set. AP taxonomy uses the units → topics → learning objectives shape already
  supported by `schemas/taxonomy.schema.json`.

# Database (data files)

Validated, seed-ready data for the studyMaste content layer. Everything here is
plain JSON checked into Git; `schemas/` holds the contracts, `scripts/` holds
the validators and the seed that loads these files into Postgres.

## Layout

```
database/
├── exam_format.schema.json      ← contract for per-subject exam_format.json
├── SAT_MATH/
│   ├── exam_format.json         ← sections, timing, question counts, domain weights, policies
│   ├── taxonomy.json            ← domains → skills (nodes[] with code/kind/slug/parentCode)
│   └── misconceptions.json      ← distractor-wiring + remediation library
├── SAT_RW/
│   ├── exam_format.json
│   ├── taxonomy.json
│   └── misconceptions.json
└── diagrams/                    ← diagram archetype registry (shared across subjects)
    └── sat-math:graph-line.json ← one file per figure type: paramsSchema + rendererRef
```

Current counts: 2 subjects, 38 taxonomy nodes, 139 misconceptions,
13 diagram archetypes.

## Naming rules

- Subject folders use the canonical subject code: `SAT_MATH`, `SAT_RW`
  (future: `AP_*`). Pattern: `^(AP|SAT)_[A-Z0-9_]+$`.
- Taxonomy node codes and misconception IDs are subject-scoped:
  `<SUBJECT>:<slug>` (e.g. `SAT_RW:transitions`,
  `SAT_MATH:percentages-decimal-point-slip`).
- Diagram archetype files are named by their ID, lowercase
  `<family>:<name>.json` (e.g. `sat-math:graph-system-two-lines.json`).
  The matching SVG renderers live in `src/renderers/` (see
  `src/renderers/README.md`).
- Question-generation archetypes live with the research material, not here:
  `research/sat/archetypes/<section>/<slug>.json` (+ `.md` worked example).

## Data flow

```
database/ + research/sat/  →  npm run validate:all  →  npm run db:up
                           →  npm run db:migrate    →  npm run seed  →  Postgres
```

1. **Validators** (`scripts/validate-*.ts`) check every file against its
   schema plus cross-references (misconceptions → taxonomy codes, generated
   questions → taxonomy / misconceptions / diagram `paramsSchema`).
2. **Migrate** (`npm run db:migrate`) applies `migrations/*.sql`
   (tables: subjects, taxonomy_nodes, misconceptions, diagram_archetypes,
   archetypes, questions, question_versions, student_events, mastery,
   misconception_stats).
3. **Seed** (`npm run seed`) upserts all of it — subjects from
   `exam_format.json`, taxonomy nodes, misconceptions, diagram archetypes,
   archetypes (whole file as spec JSONB), and approved generated questions
   from `research/sat/test-fixtures/generated-*.json`. Seeding is idempotent
   (`ON CONFLICT DO UPDATE`).
4. If Postgres is unreachable, `db:migrate` and `seed` print a PENDING-DEPLOY
   message with the exact commands and exit 0 — safe for CI without Docker.

## Adding a subject (AP expansion)

Create `database/<NEW_SUBJECT>/` with the same three files
(`exam_format.json`, `taxonomy.json`, `misconceptions.json`). The validators
and seed discover subjects by scanning `database/` for folders containing
`exam_format.json` — no code changes needed. AP taxonomies use the
units → topics → learning objectives shape already supported by
`schemas/taxonomy.schema.json`.

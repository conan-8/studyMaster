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
database/ + research/sat/  →  npm run validate:all  →  npm run db:check
                            →  npm run db:migrate     →  npm run seed  →  Supabase Postgres
```

The target database is **Supabase (managed Postgres)**; there is no local
database to start. Set `DATABASE_URL` in `.env` to the URI from Supabase
Dashboard → Project → Connect (Session pooler or Direct connection, port
5432 — see `.env.example`).

1. **Validators** (`scripts/validate-*.ts`) check every file against its
   schema plus cross-references (misconceptions → taxonomy codes, generated
   questions → taxonomy / misconceptions / diagram `paramsSchema`).
2. **Check** (`npm run db:check`) verifies connectivity to the Supabase
   Postgres and prints the server version — a real non-zero exit code when
   it can't connect, with setup guidance.
3. **Migrate** (`npm run db:migrate`) applies `migrations/*.sql`
   (tables: subjects, taxonomy_nodes, misconceptions, diagram_archetypes,
   archetypes, questions, question_versions, student_events, mastery,
   misconception_stats, bluebook_questions).
4. **Seed** (`npm run seed`) upserts all of it — subjects from
   `exam_format.json`, taxonomy nodes, misconceptions, diagram archetypes,
   archetypes (whole file as spec JSONB), and approved generated questions
   from `research/sat/test-fixtures/generated-*.json`. Seeding is idempotent
   (`ON CONFLICT DO UPDATE`).

## Question stores: generated vs Bluebook

The question bank is deliberately partitioned:

- **Generated/original questions** (ours, license-safe, `allowedUses:
  ["display"]`) live in `questions` + `question_versions` with
  `source = 'generated'` — seeded from approved drafts under
  `research/sat/generated/` and `research/sat/test-fixtures/generated-*.json`.
- **Harvested Bluebook/SSQB questions** (College Board content,
  `allowedUses: ["internal_eval"]` only — never shown to students) live in
  the separate `bluebook_questions` table, seeded from
  `research/sat/question-bank/*.json` (gitignored; the harvester is planned
  but not built — see `research/sat/README.md`). The table has RLS enabled
  with no policies, so anon/authenticated roles cannot read it; only
  server-side service-role jobs can.
5. If the database is unreachable (`DATABASE_URL` unset or the Supabase
   project not responding), `db:migrate` and `seed` print a PENDING-DEPLOY
   message with the exact commands and exit 0 — the pipeline never hard-fails
   on a not-yet-provisioned database. This fallback depends only on
   `DATABASE_URL` reachability, not on any local service.

### Supabase notes

- The tables in `migrations/001_init.sql` map 1:1 onto a Supabase project's
  Postgres — no schema changes needed; migrations run as plain SQL.
- Scripts (`db:check`, `db:migrate`, `seed`) connect with plain `pg` over the
  session/direct connection — no Supabase client library required for the
  data layer.
- When the app ships, runtime reads go through `supabase-js` with Row Level
  Security: public-read for display content (questions, diagrams) and
  owner-only for student data (`student_events`, `mastery`,
  `misconception_stats`). RLS policies are a future concern — noted here so
  the table design keeps it in mind, not designed in depth yet.
- Supabase Storage buckets (future): a private bucket with short-lived
  signed URLs for scan-and-grade image uploads; a public bucket for
  generated diagram SVGs / rendered assets.

## Adding a subject (AP expansion)

Create `database/<NEW_SUBJECT>/` with the same three files
(`exam_format.json`, `taxonomy.json`, `misconceptions.json`). The validators
and seed discover subjects by scanning `database/` for folders containing
`exam_format.json` — no code changes needed. AP taxonomies use the
units → topics → learning objectives shape already supported by
`schemas/taxonomy.schema.json`.

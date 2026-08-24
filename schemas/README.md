# Schemas

JSON Schema (draft-07) contracts for the studyMaste data layer. These files are
the **single source of truth** for validation: ajv validators consume them
directly, and no validation logic may be duplicated elsewhere (validators,
generators, and DB writers all reference these schemas).

| Schema | Validates | Where its data files live |
|---|---|---|
| `taxonomy.schema.json` | Subject taxonomy: domains/skills (SAT) and units/topics/learning objectives (AP) | `database/<SUBJECT>/taxonomy.json` |
| `misconception.schema.json` | Subject misconception library (distractor wiring + remediation) | `database/<SUBJECT>/misconceptions.json` |
| `diagram-archetype.schema.json` | One diagram archetype registry entry (parameterized diagram + renderer ref) | `database/diagrams/<id>.json` |
| `archetype.schema.json` | Question-generation archetype for one skill | `research/sat/archetypes/<section>/<slug>.json` |
| `generated-question.schema.json` | Original displayable questions (rationale required, `display` only) | `research/sat/test-fixtures/generated-*.json` (for now) |
| `student-event.schema.json` | Runtime student attempt / IDK events | DB table (`student_events`) |
| `mastery.schema.json` | Per-student, per-taxonomy-node mastery aggregates | DB table (`mastery`) |
| `misconception-stat.schema.json` | Per-student, per-misconception hit counters | DB table (`misconception_stats`) |

## Conventions

- All schemas are draft-07 with `$id` of the form
  `https://studymaste.dev/schemas/<filename>`, plus `title` and `description`.
- `additionalProperties: false` is used wherever the shape is closed.
- Subject codes match `^(AP|SAT)_[A-Z0-9_]+$` (e.g. `SAT_RW`, `SAT_MATH`).
- Subject-scoped node/misconception codes match
  `^[A-Z]+[A-Z0-9_]*:[a-z0-9-]+$` (e.g. `SAT_RW:transitions`).
- Diagram archetype IDs match `^[a-z0-9-]+:[a-z0-9-]+$` (e.g.
  `sat-math:graph-line`).
- Conditional shape rules use draft-07 `allOf`/`if`/`then` (see
  `generated-question.schema.json` for mcq vs grid_in and distractor-wiring
  rules).

Note: the harvested-question contract (`research/sat/question.schema.json`,
`internal_eval` only) is intentionally separate from
`generated-question.schema.json`.

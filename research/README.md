# Research Mission — Field Guide

Collect the raw material that powers the app. Everything you gather lives here in
`research/` first; finished, validated files get promoted into the app folders
(`database/`, `content/`). This guide answers **what to collect, in what file
format, how to name it, and where it ends up.**

> **One rule to remember:** the *format facts* are ours to use; the *released
> exam questions* are internal-eval only. See [Licensing & usage](#licensing--usage).

---

## The 4 data tracks

For each of the 38 AP subjects, the app needs four things:

| # | Track | What it is | File format | Staging here | Promotes to |
|---|-------|-----------|-------------|--------------|-------------|
| 1 | **Exam format** | Sections, timing, question counts, unit weights, policies | `JSON` w/ schema | *(done — 38/38)* | `database/<Folder>/exam_format.json` |
| 2 | **Taxonomy** | Units → topics → learning objectives + skills from the CED | `JSON` | `research/taxonomy/` | `content/taxonomy/` + DB |
| 3 | **Calibration set** | Released FRQs + scoring guidelines + scored student samples | `JSON` | `research/calibration/` | internal DB only |
| 4 | **Stimulus / link-outs** | License-verified public-domain sources (OpenStax, NARA, LOC, Gov data…) + `teach`-step link map | `JSON` or `CSV` | `research/stimulus/` | DB (display) |

Raw scouting notes per subject go in `research/notes/` and act as your scratchpad
before anything becomes structured.

---

## Naming conventions

Use the **canonical subject code** from the exam format files (already in Git):

```
AP_US_HISTORY   AP_CALC_AB   AP_PHYS_1   AP_SPANISH_LANG   AP_STUDIO_2D   ...
```

Files are named with that code:

```
research/taxonomy/AP_US_HISTORY.json
research/calibration/AP_US_HISTORY/2025.json     # one JSON file per release year
research/stimulus/AP_US_HISTORY.json
research/notes/AP_US_HISTORY.md
```

> Note: the current parser script uses shorter DB codes (`apush.json` for
> `AP_US_HISTORY`). For research files keep the canonical code above; if you work
> with `npm run parse:ced`, it writes its own output name and that's fine too.

---

## Track 1 — Exam format (DONE, don't redo)

All 38 subjects already exist and validate:

```bash
npx tsx scripts/validate-exam-formats.ts
```

Only collect track 1 data **when a subject launches a new format** (e.g., the
2025→2026 revisions). Source: the College Board CED "exam format" / `apcentral`
course page. See `database/README.md` for the schema.

---

## Track 2 — Taxonomy (the big one)

**Recommended path (parser):** you just supply the official CED PDF for a subject
and run the already-built parser:

```bash
npm run parse:ced -- content/ced/apush-ced.pdf
```

This generates units/topics/learning-objectives/skills into `content/taxonomy/`
and upserts the DB. The current parser is hardcoded to APUSH (see
`scripts/parse-ced.ts:25`); it's the template for adding the next subject.

**Scouting checklist** (if collecting by hand, produce a `taxonomy.template.json`):

1. Find the official CED PDF (2025–26) on AP Central for the subject.
2. Record every **unit**: number, full title, and exam weight % from the CED.
3. Record every **topic** under each unit: exact CED code + printed title.
4. Record the **learning objectives** (code + statement) per topic.
5. Record the **skills** with their codes (e.g., `1.A`) and names.

Format:
```json
{
  "subject": { "code": "AP_US_HISTORY", "name": "AP U.S. History" },
  "units": [
    {
      "unitNumber": 1,
      "title": "Period 1: 1491–1607",
      "examWeight": 0.05,
      "topics": [
        { "code": "1.1", "title": "Contextualizing Period 1", "learningObjectives": [] }
      ]
    }
  ],
  "skills": [ { "code": "1.A", "name": "Explain a historical concept" } ]
}
```
Copy `templates/taxonomy.template.json` for each subject.

---

## Track 3 — Calibration set (internal-only)

Released, graded materials that benchmark the AI grader. **Never displayed to
students, never trained on.** Data comes from College Board's public
released-exam pages each summer, or old released exams (e.g., a cracked `Bluebook
Exam.html` in the repo root can be mined for question structure).

Per subject, one JSON file per release year:

```json
{
  "subject": "AP_US_HISTORY",
  "year": 2025,
  "allowed_uses": ["internal_eval"],
  "questions": [
    {
      "prompt": "Evaluate the extent to which...",
      "documents": [ { "label": "Doc 1", "source": "...", "text": "..." } ],
      "rubric_rows": [
        { "row": 1, "name": "Thesis/Claim", "points": 1, "description": "..." }
      ],
      "samples": [
        { "awarded_score": 3, "sample_response": "...", "reader_commentary": "..." }
      ]
    }
  ]
}
```
Copy `templates/calibration.template.json`.

---

## Track 4 — Stimulus / link-outs

License-safe substance for question content and the `teach`-step link map. Prefer
**public domain / U.S. government / CC / OpenStax**. Record provenance for
everything — the app refuses unclear licenses by default.

- NARA / Library of Congress primary sources → DBQ stimulus
- Supreme Court opinions, Constitution, Federalist Papers → AP Gov
- Census / CDC / NOAA / USGS data → Stats / Bio / Enviro
- Project Gutenberg → pre-1930 English passages
- OpenStax / LibreTexts → topic-correlated readings

Format: `templates/links-log.csv` (or structured JSON if you want to tag
taxonomy codes). Every entry needs: `kind` (stimulus | linkout), `title`, `url`,
`license`, `taxonomy_code`, `notes`.

---

## Per-subject workflow

1. Copy `templates/subject-notes.md` → `notes/<CODE>.md`; fill sources & findings.
2. Collect track data *into the plain-text notes first* — it's fast and lossless.
3. Promote trustworthy items into structured files (`research/taxonomy/`, etc.).
4. Log every source link (with license + date) in the subject's `links-log.csv`.
5. Update `PROGRESS.csv` (one row per subject per track; mark `DONE`/`WIP`/empty).
6. Hand off finished files to the app folder (`content/`, `database/`).

---

## Licensing & usage

- **Safe to use:** facts, concepts, skills, question *formats*, rubric
  *structures*, public-domain & CC & U.S.-government material (with citations).
- **Internal-eval only** (`allowed_uses: ["internal_eval"]`): released College
  Board questions, scoring guidelines, scored samples. Never republished, never
  trained on.
- **Train** only in-house/consented human-graded data (golden dataset) — never
  College Board content.
- Flag every collected asset with `display` / `internal_eval` / `train`, matching
  the pipeline's `allowed_uses` enforcement. When unsure about a license, leave
  it out.
- This is guidance, not legal advice — get the IP lawyer involved before launch.

---

## Validation quick-reference

| Command | What it checks |
|---------|----------------|
| `npm run validate:exam-formats` | All 38 exam format JSON files against the schema |
| `npm run parse:ced -- content/ced/apush-ced.pdf` | CED PDF → taxonomy + DB upsert |
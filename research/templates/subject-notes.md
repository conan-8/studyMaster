# <SUBJECT_NAME> (<SUBJECT_CODE>)

> Scouting scratchpad for one AP subject (future work — SAT subjects already
> exist under `database/`). Copy to `research/notes/<SUBJECT_CODE>.md` and fill
> in as you collect. Promote trustworthy findings into the subject's
> `database/<SUBJECT_CODE>/` folder (`exam_format.json`, `taxonomy.json`,
> `misconceptions.json`), then run `npm run validate:all` and `npm run seed`.

## Sources found

| Kind | Title | URL | License | Found |
|------|-------|-----|---------|-------|
| CED PDF | | | College Board | |
| Released FRQ + scoring | | | College Board (internal) | |
| Scoring guidelines | | | College Board (internal) | |
| Scored samples | | | College Board (internal) | |

## Exam format snapshot

- Mode (FULLY_DIGITAL / HYBRID_DIGITAL / PORTFOLIO / THROUGH_COURSE):
- Sections (type, #questions, minutes, weight, calculator?):
- Special policies:

## Units & topics (from CED)

| Unit # | Unit title | Exam weight | # topics | Notes |
|--------|-----------|------------|---------|-------|
| 1 | | % | | |

## Skills

| Code | Name |
|------|------|
| | |

## Calibration finds

- Year: FRQs found, rubric rows, samples, links:

## Stimulus / link-out candidates

- ($kind, taxonomy code, license) title + URL:

## Open questions / risks

- Format change notice? 2026–27 revision?
- Anything license-uncertain to exclude:

## Data flow

- [ ] Exam format JSON → `database/<SUBJECT_CODE>/exam_format.json` (validate against `database/exam_format.schema.json`)
- [ ] Taxonomy JSON (units → topics → LOs → skills) → `database/<SUBJECT_CODE>/taxonomy.json`
- [ ] Misconception library → `database/<SUBJECT_CODE>/misconceptions.json`
- [ ] `npm run validate:all` green → `npm run seed`
- [ ] Calibration/stimulus material: hold in notes until those tracks are built (planned — see `research/README.md#future-work`)
# Database — AP Exam Format Data

Structured exam format definitions for all 38 AP subjects.

## Structure

```
database/
├── exam_format.schema.json   # JSON Schema for validation
├── README.md                 # This file
├── AP_Calculus_AB/
│   └── exam_format.json
├── AP_Calculus_BC/
│   └── exam_format.json
└── ...                       # One folder per AP subject
```

## Schema

Each `exam_format.json` file conforms to `exam_format.schema.json` and contains:

- **subject** — Code, display name, and exam delivery mode
- **totalDurationMinutes** — Total exam time (0 for portfolio/through-course)
- **sections** — Timed sections with question counts, weights, and calculator policies
- **unitWeights** — Course units with exam weight ranges
- **scoringNotes** — How the exam is scored
- **specialPolicies** — Calculator policy, reference sheet availability, delivery notes

## Exam Modes

| Mode | Description |
|------|-------------|
| `FULLY_DIGITAL` | Entire exam delivered digitally (Bluebook) |
| `HYBRID_DIGITAL` | MCQ digital, FRQ paper or mixed delivery |
| `PORTFOLIO` | No timed exam; portfolio submission (Studio Art) |
| `THROUGH_COURSE` | Assessment embedded in course work (AP Research) |

## Validation

Run the validation script to check all files:

```bash
npx tsx scripts/validate-exam-formats.ts
```

## Data Source

Exam formats reflect the 2025–26 College Board course and exam descriptions.

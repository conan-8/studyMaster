# Course and Exam Descriptions (CED)

This directory holds the official College Board Course and Exam Description PDFs
used as the source of truth for the curriculum parser pipeline (agent I1).

PDFs are **not** committed to the repository (see `.gitignore` — `content/ced/*.pdf`)
because they are large binaries owned by the College Board. Download them manually
and place them here before running the parser.

## AP U.S. History (APUSH)

- Expected file: `apush-ced.pdf`
- Source: <https://apcentral.collegeboard.org/courses/ap-united-states-history>
- Direct CED PDF: <https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf>

After downloading, save the PDF as `content/ced/apush-ced.pdf`, then run:

```bash
npm run parse:ced -- content/ced/apush-ced.pdf
```

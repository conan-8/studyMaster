# src/generator — the question generator

The generator turns a `(subjectCode, skill, difficulty, withDiagram)` job into
one schema-valid, display-only SAT question. Master plan §7: **agents propose,
deterministic code disposes** — the LLM only ever supplies content fields; the
pipeline owns identity, provenance, and review state.

## Architecture (text)

```
 job (subject, skill, difficulty, withDiagram?)
      |
      v
 assembleInputs (inputs.ts)          loadPrompt (prompts.ts)
 archetype + misconception slice     prompts/registry.json -> prompts/question-generator/vX.Y.Z.md
 + allowed diagram ids + user msg            |
      +------------------------------+------+
      v
 generateQuestion (generate.ts)  — the propose-validate-repair loop
      |  attempt 1..maxAttempts (default 4):
      |    provider.complete(messages, jsonMode)
      |    {"error": ...}            -> terminal: reject, abort (no retry)
      |    validateDraft (validate-output.ts)
      |      ok                     -> finalize + return
      |      failed                 -> log ALL errors, append repair msg, retry
      v
 finalize: pipeline assigns id, subjectCode, taxonomyCode, provenance
           (incl. sha256 contentHash over canonical JSON), review=pending,
           allowedUses=['display'], variantOf=null
```

The generate flow: **assemble → prompt → LLM → deterministic gate → repair
loop → pipeline fields.** The gate (`validateDraft`) strips the pipeline keys
the model must never supply, tolerantly parses (```json fences ok, numeric
strings inside diagram parameters re-serialized), then checks ajv against
`schemas/generated-question.schema.json` plus cross-checks a schema cannot
express (difficulty echo, diagram presence/params via the renderer lib,
misconception slice membership, key-choice wiring).

## Files

| file | role |
| --- | --- |
| `generate.ts` | the loop, `GenerateError`, `AttemptLog`, content hashing |
| `inputs.ts` | job → archetype/misconceptions/diagram ids/user message |
| `prompts.ts` | versioned prompt registry loader (`loadPrompt`, `findRepoRoot`) |
| `validate-output.ts` | the deterministic output gate |
| `ids.ts` | `nextId` — continues the `gen-<subject>-<skill>-NNN` sequence from fixtures |
| `eval/` | the eval harness (below) |

## Providers

`generateQuestion` takes any `LLMProvider` (see `src/llm/`):

- **mock** — `MockProvider(model, scripts)` consumes canned responses in
  order; deterministic, keyless, used by tests and the eval harness.
- **openrouter** — live calls; needs `OPENROUTER_API_KEY` in the environment
  (see `scripts/generate-question.ts` for CLI usage).

## Eval harness (`eval/`)

v0 of the §7.9 promotion machinery: **no prompt/model version promotes
without meeting or beating the incumbent.** Golden scenarios in
`eval/scenarios.ts` script the mock model's responses and pin the full
pipeline behaviour (assembly, gate, repair loop, pipeline-field assignment).

Run it:

```
npm run eval:generator
```

Prints a per-scenario table plus summary metrics, writes
`eval/report-last-run.json` (gitignored; records `ranAt`, the prompt version
that ran, node version, metrics, per-scenario results), and **exits 1 if any
scenario fails** — wire that exit code into CI before promoting.

Metrics:

- **overall pass rate** — scenarios meeting their expectation / total.
- **accepted-first-try rate** — accepted in exactly 1 attempt / all accepted.
  Dropping under a new prompt/model means more repair traffic per item.
- **avg attempts per accepted** — mean attempts over accepted scenarios;
  1.00 is ideal.
- **repair-recovery rate** — runs accepted after ≥1 rejected attempt / all
  runs that took a repair retry. Measures how well the repair loop converts
  bad first drafts.
- **rejection-correctness** — scenarios expected to reject that did (with the
  exact attempt count). Guards against the gate silently weakening.

Adding a scenario: append to `SCENARIOS` in `eval/scenarios.ts` — name,
request, ordered `scripts` (one per attempt), `expect` (outcome + optional
exact attempt count), and a category (`happy` / `repair` / `rejection` /
`contract`). Craft mock outputs against real repo data (real misconception
ids, real diagram params); see the existing drafts for the pattern.

**Promotion rule:** a prompt or model change must (1) re-run
`npm run eval:generator` to 100% pass, and (2) add scenarios pinning any NEW
failure mode it caused — the golden set only grows.

## Further reading

- `prompts/registry.json` — the versioned prompt manifest (the eval report
  records which version ran).
- `research/README.md` § "Generating questions" — the analyst-facing workflow
  (`npm run generate`) that sits on top of this module.

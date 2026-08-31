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
      |    provider.complete(messages, jsonMode)   (transient errors retried x2)
      |    {"error": ...}            -> terminal: reject, abort (no retry)
      |    validateDraft (validate-output.ts)
      |      failed                 -> log ALL errors, append repair msg, retry
      |    checkDuplicate (dedup.ts, opt-in)
      |      Jaccard >= 0.85        -> 'too similar' error, repair
      |    shuffleChoices (shuffle.ts) — deterministic, rationale remapped
      |    runVerifier (opt-in, fail-open)
      |      solver mismatch        -> repair
      |    all gates pass           -> finalize + return
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
misconception slice membership, key-choice wiring). A draft that passes the
gate then runs the post-validation safeguards in order — dedup (opt-in),
deterministic choice shuffle, independent-solver verification (opt-in) — and
any safeguard failure feeds the same repair loop (see Pipeline safeguards).

## Prompt v1.2.0 behavior

Current generator prompt: `question-generator@1.2.0` (plus the
`question-verifier@1.0.0` independent-solver prompt, below).

- **Diagram jobs inject ALL allowed archetypes** — `inputs.ts` renders the
  skill's full `diagramSpec.allowedArchetypeIds` list, each with its
  `archetypeId` + `paramsSchema`; the model picks the single most natural
  archetype. The gate rejects any `archetypeId` outside the allowed list.
- **Canonical `tableJson`** — `{"caption"?, "columns", "rows"}` exactly;
  `title`/`headers` shapes fail the schema.
- **Choice order is pipeline-owned** — the model writes rationales as
  "Choice X" references; the post-acceptance shuffle re-letters the choices
  and remaps those references (below).

## Pipeline safeguards

| safeguard | where | behaviour |
| --- | --- | --- |
| Transient retry | `completeWithRetry` (generate.ts) | timeouts, 5xx/429, network errors resend the SAME request up to 2 extra times (400ms×try backoff); other errors propagate immediately |
| Near-duplicate detection | `dedup.ts` | word-set Jaccard ≥ 0.85 over the COMBINED normalized stem + stimulus text + choice texts against the fixtures + generated corpus; an exact full-item match short-circuits. Combined content matters because RW stem templates are fixed (stem-only Jaccard would be 1.0 for the whole skill). A hit feeds the repair loop |
| Deterministic choice shuffle | `shuffle.ts` | seeded by the sha256 of the draft's own canonical JSON (same content → same order): Fisher–Yates reorder, re-letter A–D, remap `correctAnswer` and every rationale "Choice X" reference. `grid_in` drafts pass through untouched |
| Independent-solver verification | `runVerifier` (generate.ts) | a second provider call runs the `question-verifier` prompt over the post-shuffle draft; answer/verdict mismatch or a two-step difficulty gap feeds the repair loop. **Fail-open:** a missing verifier prompt, a verifier LLM error, or unparseable verifier output is accepted as `unverified` — never a rejection. A one-step difficulty gap is a warning only |

## CLI quality-gate flags (`scripts/generate-question.ts`)

| flag | effect | default |
| --- | --- | --- |
| `--no-verify` | disable independent-solver verification | verification ON for live providers (`openrouter`, `kimi`), forced OFF for `mock` |
| `--no-dedup` | disable near-duplicate detection | dedup ON for live providers, forced OFF for `mock` |

The mock provider replays canned output, so verifying or deduping it is
meaningless — both gates are forced off for it regardless of flags.

## Files

| file | role |
| --- | --- |
| `generate.ts` | the loop, `GenerateError`, `AttemptLog`, content hashing, transient retry, independent-solver verification |
| `inputs.ts` | job → archetype/misconceptions/diagram ids/user message |
| `prompts.ts` | versioned prompt registry loader (`loadPrompt`, `findRepoRoot`) |
| `validate-output.ts` | the deterministic output gate |
| `shuffle.ts` | deterministic choice shuffle + rationale "Choice X" remap |
| `dedup.ts` | near-duplicate detection against the existing-question corpus |
| `ids.ts` | `nextId` — continues the `gen-<subject>-<skill>-NNN` sequence from fixtures |
| `eval/` | the eval harness (below) |

## Providers

`generateQuestion` takes any `LLMProvider` (see `src/llm/`):

- **mock** — `MockProvider(model, scripts)` consumes canned responses in
  order; deterministic, keyless, used by tests and the eval harness.
- **openrouter** — live calls; needs `OPENROUTER_API_KEY` in the environment
  (see `scripts/generate-question.ts` for CLI usage).
- **kimi** — live calls via the Kimi Code plan; needs `KIMI_API_KEY`,
  optional `KIMI_MODEL` (default `k3`, a reasoning model — single questions
  can take 60–180s).

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

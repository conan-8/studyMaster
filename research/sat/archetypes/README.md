# SAT Question Archetype Specs

Machine-readable specifications of each SAT question type, authored to drive
the AI question generator. Each archetype consists of a JSON spec (consumed
by the generator prompt) and a Markdown companion (human reference, with one
original worked example per type).

## Reading & Writing archetypes (`rw/`)

| Slug | Skill | Domain | Core trap mechanism |
|------|-------|--------|---------------------|
| `central-ideas-details` | Central Ideas and Details | Information and Ideas | True supporting detail inflated into the main idea; scope overgeneralization |
| `command-evidence-textual` | Command of Evidence: Textual | Information and Ideas | Finding matches the topic but not the claim's exact logical shape (variables/scope/direction) |
| `command-evidence-quantitative` | Command of Evidence: Quantitative | Information and Ideas | Accurate data citation that is irrelevant to the claim; misread rows/trend reversals |
| `inferences` | Inferences | Information and Ideas | Premise restatement and overreach beyond the evidence's licensed scope/certainty |
| `words-in-context` | Words in Context | Craft and Structure | Wrong sense of a plausible word; near-synonym failing collocation or one clause's clue |
| `text-structure-purpose` | Text Structure and Purpose | Craft and Structure | Choice summarizes a sentence's content while mislabeling its rhetorical role; verb overstatement |
| `cross-text-connections` | Cross-Text Connections | Craft and Structure | Stance swap between Text 1 and Text 2; mislabeled relationship (refutes vs complicates) |
| `boundaries` | Boundaries | Standard English Conventions | Comma splice / semicolon misuse at clause boundaries; unclosed or false punctuation pairs |
| `form-structure-sense` | Form, Structure, and Sense | Standard English Conventions | Form agreeing with a decoy noun/antecedent instead of the true subject; tense-signal mismatch |
| `transitions` | Transitions | Expression of Ideas | Connector naming the wrong logical relation (contrast vs cause vs example) for the sentence pair |
| `rhetorical-synthesis` | Rhetorical Synthesis | Expression of Ideas | Accurate, well-written sentence using notes that don't serve the stated rhetorical goal |

## How the generator consumes these specs

For each question to be generated, the generator looks up the archetype spec
matching the requested skill slug and injects it into the prompt. The
`stimulusShape` block constrains what kind of stimulus to build (passage
length range, structure, whether a table/notes/dual-text is required);
`stemTemplates` pins the stem to the formulaic phrasings the real exam uses;
`answerMode` and `choicePatterns` describe how the four choices must be
shaped; `distractorLogic` tells the generator the specific trap mechanisms
to instantiate (one distinct trap per distractor); `difficultyLevers` maps
the requested difficulty to concrete construction choices; and
`generationRecipe` provides the step-by-step build order — construct the
stimulus around a pre-decided key, derive distractors from named traps, then
run the `validationChecklist` as a self-review pass before emitting the
final item. The `exemplarSlots` arrays are placeholders to be filled with
harvested question-bank IDs for few-shot grounding. The Markdown companions
are not injected; they exist for human review, calibration, and prompt
debugging.

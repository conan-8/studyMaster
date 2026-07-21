import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";
import { getPrompt } from "@/lib/llm/registry";
import {
  QUESTION_GENERATOR_PROMPT,
  buildUnitQuestionsMessage,
} from "@/lib/questions/prompts";
import {
  unitMcqBatchSchema,
  type GeneratedMcq,
} from "@/lib/questions/schema";
import { QuestionType } from "@/generated/prisma";

const SUBJECT_CODE = "APUSH";
const TAXONOMY_PATH = "content/taxonomy/apush.json";
const SOURCE_TAG = "generated:v2";
const DEFAULT_PER_UNIT = 4;

const BATCH_SCHEMA_DESCRIPTION = `{
  "questions": [
    {
      "topicCode": "<string: exact topic code from the list, e.g. 3.2>",
      "stem": "<string: analytical question about the stimulus>",
      "stimulus": "<string|null: short primary source / scenario>",
      "choices": [
        { "id": "A", "text": "<string>" },
        { "id": "B", "text": "<string>" },
        { "id": "C", "text": "<string>" },
        { "id": "D", "text": "<string>" }
      ],
      "correctAnswer": "<string: one of A, B, C, D>",
      "explanation": "<string: why correct, why distractors fail>",
      "difficulty": "<integer 1-5>",
      "misconceptionTags": ["<string: kebab-case tag>"]
    }
  ]
}`;

type UnitView = {
  unitNumber: number;
  title: string;
  topics: { id: string; code: string; title: string; los: string[] }[];
};

type FailedUnit = { label: string; error: string };

async function resolvePrompt(): Promise<string> {
  try {
    await prisma.promptRegistry.upsert({
      where: { name_version: { name: "question-generator", version: 1 } },
      update: { content: QUESTION_GENERATOR_PROMPT },
      create: {
        name: "question-generator",
        version: 1,
        content: QUESTION_GENERATOR_PROMPT,
      },
    });
    const prompt = await getPrompt("question-generator");
    return prompt.content;
  } catch (err) {
    console.warn(
      "Prompt registry unavailable, using built-in prompt:",
      err instanceof Error ? err.message : String(err),
    );
    return QUESTION_GENERATOR_PROMPT;
  }
}

function loadLearningObjectives(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!existsSync(TAXONOMY_PATH)) return map;
  try {
    const taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, "utf8")) as {
      units?: {
        topics?: { code: string; learningObjectives?: { statement: string }[] }[];
      }[];
    };
    for (const unit of taxonomy.units ?? []) {
      for (const topic of unit.topics ?? []) {
        const statements = (topic.learningObjectives ?? []).map(
          (lo) => lo.statement,
        );
        if (statements.length > 0) map.set(topic.code, statements);
      }
    }
  } catch {
    // Taxonomy JSON is optional enrichment; ignore parse errors.
  }
  return map;
}

function buildTopicsBlock(unit: UnitView): string {
  return unit.topics
    .map((topic) => {
      const los = topic.los.map((lo) => `      - ${lo}`).join("\n");
      return `  ${topic.code} — ${topic.title}${los ? `\n${los}` : ""}`;
    })
    .join("\n");
}

function validateMcq(mcq: GeneratedMcq): string | null {
  const ids = mcq.choices.map((c) => c.id);
  if (!ids.includes(mcq.correctAnswer)) {
    return `correctAnswer "${mcq.correctAnswer}" is not one of ${ids.join(", ")}`;
  }
  return null;
}

async function main() {
  const perUnit =
    Number.parseInt(process.argv[2] ?? "", 10) || DEFAULT_PER_UNIT;

  const subject = await prisma.subject.findUnique({
    where: { code: SUBJECT_CODE },
    include: {
      units: {
        orderBy: { unitNumber: "asc" },
        include: { topics: { orderBy: { code: "asc" } } },
      },
    },
  });
  if (!subject || subject.units.length === 0) {
    console.error(`No units found for ${SUBJECT_CODE} in the database.`);
    console.error("Run `npm run parse:ced` first to upsert the taxonomy.");
    process.exit(1);
  }

  const losByCode = loadLearningObjectives();
  const units: UnitView[] = subject.units.map((unit) => ({
    unitNumber: unit.unitNumber,
    title: unit.title,
    topics: unit.topics.map((topic) => ({
      id: topic.id,
      code: topic.code,
      title: topic.title,
      los: losByCode.get(topic.code) ?? [],
    })),
  }));

  const topicCount = units.reduce((n, u) => n + u.topics.length, 0);
  console.log(
    `Loaded ${units.length} units and ${topicCount} topics for ${subject.code}`,
  );
  if (losByCode.size > 0) {
    console.log(`Enriched prompt with learning objectives for ${losByCode.size} topics`);
  }

  const topicIdByCode = new Map(
    units.flatMap((u) => u.topics.map((t) => [t.code, t.id] as const)),
  );

  const systemPrompt = await resolvePrompt();

  const deleted = await prisma.question.deleteMany({
    where: { sourceTag: SOURCE_TAG, isActive: false },
  });
  if (deleted.count > 0) {
    console.log(`Cleared ${deleted.count} pending ${SOURCE_TAG} questions`);
  }

  const failedUnits: FailedUnit[] = [];
  let generated = 0;
  let skipped = 0;

  for (const unit of units) {
    try {
      const batch = unitMcqBatchSchema.parse(
        await callLLM({
          system: systemPrompt,
          user: buildUnitQuestionsMessage(
            BATCH_SCHEMA_DESCRIPTION,
            perUnit,
            unit.title,
            buildTopicsBlock(unit),
          ),
          schema: unitMcqBatchSchema,
          purpose: `question-generator-unit-${unit.unitNumber}`,
          maxTokens: 4096,
        }),
      );

      let unitCreated = 0;
      for (const mcq of batch.questions) {
        const problem = validateMcq(mcq);
        const topicId = topicIdByCode.get(mcq.topicCode);
        if (problem || !topicId) {
          skipped += 1;
          console.warn(
            `  Unit ${unit.unitNumber}: skipped ${mcq.topicCode} — ${problem ?? `unknown topic code "${mcq.topicCode}"`}`,
          );
          continue;
        }

        await prisma.question.create({
          data: {
            subjectId: subject.id,
            topicId,
            type: QuestionType.MCQ,
            difficulty: mcq.difficulty,
            stem: mcq.stem,
            stimulus: mcq.stimulus ?? null,
            choicesJson: mcq.choices,
            correctAnswer: mcq.correctAnswer,
            explanation: mcq.explanation,
            misconceptionTags: mcq.misconceptionTags,
            sourceTag: SOURCE_TAG,
            isActive: false,
          },
        });
        unitCreated += 1;
        generated += 1;
      }
      console.log(`Unit ${unit.unitNumber}: created ${unitCreated} MCQs`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failedUnits.push({ label: `unit-${unit.unitNumber}`, error: message });
      console.warn(`Unit ${unit.unitNumber}: generation failed — ${message}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`MCQs generated: ${generated}`);
  console.log(`Skipped (invalid): ${skipped}`);
  console.log(`Failed units: ${failedUnits.length}`);
  if (failedUnits.length > 0) {
    for (const f of failedUnits) {
      console.log(`  - ${f.label}: ${f.error}`);
    }
  }
  console.log(
    `\nGenerated questions are inactive — review them at /admin/review.`,
  );
}

main()
  .catch((err) => {
    console.error("generate-questions failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";
import { getPrompt } from "@/lib/llm/registry";
import {
  CSA_QUESTION_GENERATOR_PROMPT,
  QUESTION_GENERATOR_PROMPT,
  buildUnitQuestionsMessage,
} from "@/lib/questions/prompts";
import {
  unitMcqBatchSchema,
  type GeneratedMcq,
} from "@/lib/questions/schema";
import { QuestionType } from "@/generated/prisma";

const DEFAULT_PER_UNIT = 4;

type SubjectConfig = {
  code: string;
  label: string;
  promptName: string;
  systemPrompt: string;
  sourceTag: string;
  taxonomyPath: string;
  schemaDescription: string;
  styleHint?: string;
};

const SUBJECT_CONFIGS: Record<string, SubjectConfig> = {
  APUSH: {
    code: "APUSH",
    label: "AP U.S. History",
    promptName: "question-generator",
    systemPrompt: QUESTION_GENERATOR_PROMPT,
    sourceTag: "generated:v2",
    taxonomyPath: "content/taxonomy/apush.json",
    schemaDescription: `{
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
}`,
  },
  APCSA: {
    code: "APCSA",
    label: "AP Computer Science A",
    promptName: "question-generator-APCSA",
    systemPrompt: CSA_QUESTION_GENERATOR_PROMPT,
    sourceTag: "generated:csa-v1",
    taxonomyPath: "content/taxonomy/apcsa.json",
    styleHint: `Every question should be a code-tracing exercise: put a short valid Java snippet in "stimulus" (plain text, no markdown fences) unless the topic is purely conceptual, and ask the student to predict output or execution behavior.`,
    schemaDescription: `{
  "questions": [
    {
      "topicCode": "<string: exact topic code from the list, e.g. 2.4>",
      "stem": "<string: what does this code print / value of a variable after the loop / which statement is true>",
      "stimulus": "<string|null: Java code snippet as plain text, no markdown fences>",
      "choices": [
        { "id": "A", "text": "<string>" },
        { "id": "B", "text": "<string>" },
        { "id": "C", "text": "<string>" },
        { "id": "D", "text": "<string>" }
      ],
      "correctAnswer": "<string: one of A, B, C, D>",
      "explanation": "<string: step-by-step trace; why distractors fail>",
      "difficulty": "<integer 1-5>",
      "misconceptionTags": ["<string: kebab-case tag>"]
    }
  ]
}`,
  },
};

const SUBJECT_CODE = process.env.SUBJECT_CODE ?? "APCSA";
const config = SUBJECT_CONFIGS[SUBJECT_CODE];
if (!config) {
  console.error(
    `Unknown SUBJECT_CODE "${SUBJECT_CODE}". Available: ${Object.keys(SUBJECT_CONFIGS).join(", ")}`,
  );
  process.exit(1);
}

type UnitView = {
  unitNumber: number;
  title: string;
  topics: { id: string; code: string; title: string; los: string[] }[];
};

type FailedUnit = { label: string; error: string };

async function resolvePrompt(subjectConfig: SubjectConfig): Promise<string> {
  try {
    await prisma.promptRegistry.upsert({
      where: {
        name_version: { name: subjectConfig.promptName, version: 1 },
      },
      update: { content: subjectConfig.systemPrompt },
      create: {
        name: subjectConfig.promptName,
        version: 1,
        content: subjectConfig.systemPrompt,
      },
    });
    const prompt = await getPrompt(subjectConfig.promptName);
    return prompt.content;
  } catch (err) {
    console.warn(
      "Prompt registry unavailable, using built-in prompt:",
      err instanceof Error ? err.message : String(err),
    );
    return subjectConfig.systemPrompt;
  }
}

function loadLearningObjectives(taxonomyPath: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!existsSync(taxonomyPath)) return map;
  try {
    const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8")) as {
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
    console.error(
      "Run `npx prisma db seed` first (CSA taxonomy comes from the seed, not parse:ced).",
    );
    process.exit(1);
  }

  const losByCode = loadLearningObjectives(config.taxonomyPath);
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

  const systemPrompt = await resolvePrompt(config);

  const deleted = await prisma.question.deleteMany({
    where: { sourceTag: config.sourceTag, isActive: false, subjectId: subject.id },
  });
  if (deleted.count > 0) {
    console.log(
      `Cleared ${deleted.count} pending ${config.sourceTag} questions`,
    );
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
            config.schemaDescription,
            perUnit,
            unit.title,
            buildTopicsBlock(unit),
            config.label,
            config.styleHint,
          ),
          schema: unitMcqBatchSchema,
          purpose: `question-generator-${config.code}-unit-${unit.unitNumber}`,
          maxTokens: 8192,
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
            sourceTag: config.sourceTag,
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

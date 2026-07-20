import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocumentProxy, extractText } from "unpdf";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";
import { getPrompt } from "@/lib/llm/registry";
import { chunkByUnit, extractSkillsRegion } from "@/lib/curriculum/chunk";
import {
  unitExtractionSchema,
  skillsExtractionSchema,
  type CurriculumTaxonomy,
  type Skill,
  type Topic,
  type Unit,
  type UnitExtraction,
} from "@/lib/curriculum/schema";
import {
  CURRICULUM_PARSER_PROMPT,
  buildUnitUserMessage,
} from "@/lib/curriculum/prompts";
import { ExamMode } from "@/generated/prisma";

const SUBJECT_CODE = "APUSH";
const SUBJECT_NAME = "AP U.S. History";
const DEFAULT_PDF = "content/ced/apush-ced.pdf";
const OUTPUT_PATH = "content/taxonomy/apush.json";

const UNIT_SCHEMA_DESCRIPTION = `{
  "unit": {
    "unitNumber": "<integer: the period/unit number>",
    "title": "<string: full unit/period title as printed>",
    "examWeight": "<number: decimal fraction, e.g. 0.05>",
    "topics": [
      {
        "code": "<string: exact CED topic code, e.g. 1.1>",
        "title": "<string: printed topic title>",
        "learningObjectives": [
          { "code": "<string: e.g. Unit 1: Learning Objective A>", "statement": "<string: full objective text>" }
        ]
      }
    ]
  },
  "skills": [
    { "code": "<string: skill code, e.g. 1.A>", "name": "<string: skill name>" }
  ]
}`;

const SKILLS_SCHEMA_DESCRIPTION = `{
  "skills": [
    { "code": "<string: skill code, e.g. 1.A>", "name": "<string: skill name>" }
  ]
}`;

type FailedChunk = { label: string; error: string };

function normalizeWeight(weight: number): number {
  if (!Number.isFinite(weight)) return 0;
  const fraction = weight > 1 ? weight / 100 : weight;
  return Math.min(1, Math.max(0, fraction));
}

function dedupeTopics(topics: Topic[]): Topic[] {
  const byCode = new Map<string, Topic>();
  for (const topic of topics) {
    if (!byCode.has(topic.code)) byCode.set(topic.code, topic);
  }
  return [...byCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
}

function dedupeSkills(skills: Skill[]): Skill[] {
  const byCode = new Map<string, Skill>();
  for (const skill of skills) {
    if (!byCode.has(skill.code)) byCode.set(skill.code, skill);
  }
  return [...byCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
}

async function resolvePrompt(): Promise<string> {
  try {
    await prisma.promptRegistry.upsert({
      where: { name_version: { name: "curriculum-parser", version: 1 } },
      update: { content: CURRICULUM_PARSER_PROMPT },
      create: {
        name: "curriculum-parser",
        version: 1,
        content: CURRICULUM_PARSER_PROMPT,
      },
    });
    const prompt = await getPrompt("curriculum-parser");
    return prompt.content;
  } catch (err) {
    console.warn(
      "Prompt registry unavailable, using built-in prompt:",
      err instanceof Error ? err.message : String(err),
    );
    return CURRICULUM_PARSER_PROMPT;
  }
}

async function persistTaxonomy(taxonomy: CurriculumTaxonomy): Promise<void> {
  const subject = await prisma.subject.upsert({
    where: { code: SUBJECT_CODE },
    update: { name: SUBJECT_NAME },
    create: {
      code: SUBJECT_CODE,
      name: SUBJECT_NAME,
      examMode: ExamMode.FULLY_DIGITAL,
    },
  });

  for (const unit of taxonomy.units) {
    const persistedUnit = await prisma.unit.upsert({
      where: {
        subjectId_unitNumber: {
          subjectId: subject.id,
          unitNumber: unit.unitNumber,
        },
      },
      update: { title: unit.title, examWeight: unit.examWeight },
      create: {
        subjectId: subject.id,
        unitNumber: unit.unitNumber,
        title: unit.title,
        examWeight: unit.examWeight,
      },
    });

    for (const topic of unit.topics) {
      await prisma.topic.upsert({
        where: {
          unitId_code: { unitId: persistedUnit.id, code: topic.code },
        },
        update: { title: topic.title },
        create: {
          unitId: persistedUnit.id,
          code: topic.code,
          title: topic.title,
        },
      });
    }
  }
}

async function main() {
  const pdfPath = process.argv[2] ?? DEFAULT_PDF;
  if (!existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    console.error(
      "Download the APUSH CED and save it there (see content/ced/README.md).",
    );
    process.exit(1);
  }

  console.log(`Reading PDF: ${pdfPath}`);
  const bytes = new Uint8Array(readFileSync(pdfPath));
  const pdf = await getDocumentProxy(bytes);
  const { text: pages } = await extractText(pdf, { mergePages: false });
  console.log(`Extracted ${pages.length} pages of text`);

  const systemPrompt = await resolvePrompt();

  const chunks = chunkByUnit(pages);
  const unitTexts = new Map<number, string[]>();
  for (const chunk of chunks) {
    if (chunk.unit == null) continue;
    const list = unitTexts.get(chunk.unit) ?? [];
    list.push(chunk.text);
    unitTexts.set(chunk.unit, list);
  }
  const unitNumbers = [...unitTexts.keys()].sort((a, b) => a - b);
  console.log(`Found ${unitNumbers.length} unit headings: ${unitNumbers.join(", ")}`);

  const extractions: UnitExtraction[] = [];
  const failedChunks: FailedChunk[] = [];

  for (const unitNumber of unitNumbers) {
    const chunkText = (unitTexts.get(unitNumber) ?? []).join("\n\n");
    try {
      const result = unitExtractionSchema.parse(
        await callLLM({
          system: systemPrompt,
          user: buildUnitUserMessage(UNIT_SCHEMA_DESCRIPTION, chunkText),
          schema: unitExtractionSchema,
          purpose: `curriculum-parser-unit-${unitNumber}`,
          maxTokens: 4096,
        }),
      );
      extractions.push(result);
      console.log(`Unit ${unitNumber}: extracted ${result.unit.topics.length} topics`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failedChunks.push({ label: `unit-${unitNumber}`, error: message });
      console.warn(`Unit ${unitNumber}: extraction failed — ${message}`);
    }
  }

  const collectedSkills: Skill[] = [];
  for (const ex of extractions) collectedSkills.push(...ex.skills);

  const skillsText = extractSkillsRegion(pages);
  if (skillsText) {
    try {
      const result = await callLLM({
        system: systemPrompt,
        user: buildUnitUserMessage(SKILLS_SCHEMA_DESCRIPTION, skillsText),
        schema: skillsExtractionSchema,
        purpose: "curriculum-parser-skills",
        maxTokens: 4096,
      });
      collectedSkills.push(...result.skills);
      console.log(`Skills pass: extracted ${result.skills.length} skills`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failedChunks.push({ label: "skills", error: message });
      console.warn(`Skills pass failed — ${message}`);
    }
  }

  const unitMap = new Map<number, Unit>();
  for (const ex of extractions) {
    const incoming = ex.unit;
    const existing = unitMap.get(incoming.unitNumber);
    if (existing) {
      existing.topics.push(...incoming.topics);
      if (!existing.title && incoming.title) existing.title = incoming.title;
      existing.examWeight = incoming.examWeight || existing.examWeight;
    } else {
      unitMap.set(incoming.unitNumber, {
        unitNumber: incoming.unitNumber,
        title: incoming.title,
        examWeight: incoming.examWeight,
        topics: [...incoming.topics],
      });
    }
  }

  const units: Unit[] = [...unitMap.values()]
    .map((unit) => ({
      ...unit,
      examWeight: normalizeWeight(unit.examWeight),
      topics: dedupeTopics(unit.topics),
    }))
    .sort((a, b) => a.unitNumber - b.unitNumber);

  const taxonomy: CurriculumTaxonomy = {
    subject: { code: SUBJECT_CODE, name: SUBJECT_NAME },
    units,
    skills: dedupeSkills(collectedSkills),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(taxonomy, null, 2), "utf8");
  console.log(`Wrote taxonomy to ${OUTPUT_PATH}`);

  try {
    await persistTaxonomy(taxonomy);
    console.log("Database upsert complete");
  } catch (err) {
    console.warn(
      "Database upsert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const topicCount = units.reduce((n, u) => n + u.topics.length, 0);
  console.log("\n=== Summary ===");
  console.log(`Units found:  ${units.length}`);
  console.log(`Topics found: ${topicCount}`);
  console.log(`Skills found: ${taxonomy.skills.length}`);
  console.log(`Failed chunks: ${failedChunks.length}`);
  if (failedChunks.length > 0) {
    for (const f of failedChunks) {
      console.log(`  - ${f.label}: ${f.error}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("parse-ced failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

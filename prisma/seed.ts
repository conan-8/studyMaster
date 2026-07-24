import { PrismaClient, ExamMode } from "../src/generated/prisma";
import type { Prisma } from "../src/generated/prisma";
import { CURRICULUM_PARSER_PROMPT } from "../src/lib/curriculum/prompts";
import {
  CSA_QUESTION_GENERATOR_PROMPT,
  QUESTION_GENERATOR_PROMPT,
} from "../src/lib/questions/prompts";
import { loadExamFormat } from "../src/lib/exam-format/loader";

const prisma = new PrismaClient();

type TopicSeed = { code: string; title: string };
type UnitSeed = {
  unitNumber: number;
  title: string;
  examWeight: number;
  topics: TopicSeed[];
};
type SubjectSeed = {
  code: string;
  name: string;
  examMode: ExamMode;
  units: UnitSeed[];
};

const apushSeed: SubjectSeed = {
  code: "APUSH",
  name: "AP U.S. History",
  examMode: ExamMode.FULLY_DIGITAL,
  units: [
    {
      unitNumber: 1,
      title: "Period 1: 1491-1607",
      examWeight: 0.05,
      topics: [
        { code: "1.1", title: "Contextualizing Period 1" },
        { code: "1.2", title: "Native American Societies Before 1491" },
        { code: "1.3", title: "European Exploration in the Americas" },
      ],
    },
    {
      unitNumber: 2,
      title: "Period 2: 1607-1754",
      examWeight: 0.1,
      topics: [
        { code: "2.1", title: "The Columbian Exchange" },
        { code: "2.2", title: "Labor, Slavery, and Caste in the Spanish Borderlands" },
        { code: "2.3", title: "Interactions Between American Indians and Europeans" },
        { code: "2.4", title: "Slavery in the British Colonies" },
      ],
    },
    {
      unitNumber: 3,
      title: "Period 3: 1754-1800",
      examWeight: 0.15,
      topics: [
        { code: "3.1", title: "The French and Indian War" },
        { code: "3.2", title: "The American Revolution" },
        { code: "3.3", title: "The Articles of Confederation" },
        { code: "3.4", title: "The Constitution and Compromise" },
      ],
    },
    {
      unitNumber: 4,
      title: "Period 4: 1800-1848",
      examWeight: 0.1,
      topics: [
        { code: "4.1", title: "The Rise of Democratic Culture" },
        { code: "4.2", title: "The Market Revolution" },
        { code: "4.3", title: "Reform Movements" },
        { code: "4.4", title: "Manifest Destiny" },
      ],
    },
    {
      unitNumber: 5,
      title: "Period 5: 1844-1877",
      examWeight: 0.15,
      topics: [
        { code: "5.1", title: "Sectionalism and the Road to Civil War" },
        { code: "5.2", title: "The Civil War" },
        { code: "5.3", title: "Reconstruction" },
      ],
    },
    {
      unitNumber: 6,
      title: "Period 6: 1865-1898",
      examWeight: 0.1,
      topics: [
        { code: "6.1", title: "The New South and Industrialization" },
        { code: "6.2", title: "Westward Expansion and the Indian Wars" },
        { code: "6.3", title: "The Gilded Age and Labor" },
      ],
    },
    {
      unitNumber: 7,
      title: "Period 7: 1890-1945",
      examWeight: 0.15,
      topics: [
        { code: "7.1", title: "The Progressive Era" },
        { code: "7.2", title: "World War I" },
        { code: "7.3", title: "The Great Depression and New Deal" },
        { code: "7.4", title: "World War II" },
      ],
    },
    {
      unitNumber: 8,
      title: "Period 8: 1945-1980",
      examWeight: 0.1,
      topics: [
        { code: "8.1", title: "The Cold War Begins" },
        { code: "8.2", title: "The Civil Rights Movement" },
        { code: "8.3", title: "The Great Society and Vietnam" },
      ],
    },
    {
      unitNumber: 9,
      title: "Period 9: 1980-Present",
      examWeight: 0.1,
      topics: [
        { code: "9.1", title: "The Reagan Revolution" },
        { code: "9.2", title: "The End of the Cold War" },
        { code: "9.3", title: "America in the 21st Century" },
      ],
    },
  ],
};

const apcsaSeed: SubjectSeed = {
  code: "APCSA",
  name: "AP Computer Science A",
  examMode: ExamMode.HYBRID_DIGITAL,
  units: [
    {
      unitNumber: 1,
      title: "Using Objects and Methods",
      examWeight: 0.2,
      topics: [
        { code: "1.1", title: "Primitives and Reference Types" },
        { code: "1.2", title: "String Operations" },
        { code: "1.3", title: "Math and Wrapper Classes" },
        { code: "1.4", title: "Method Calls and Parameters" },
      ],
    },
    {
      unitNumber: 2,
      title: "Selection and Iteration",
      examWeight: 0.3,
      topics: [
        { code: "2.1", title: "Boolean Expressions and De Morgan's Laws" },
        { code: "2.2", title: "Conditionals (if / else if / else)" },
        { code: "2.3", title: "while Loops and Tracing" },
        { code: "2.4", title: "for Loops and Off-by-One Reasoning" },
        { code: "2.5", title: "Nested Iteration" },
      ],
    },
    {
      unitNumber: 3,
      title: "Class Creation",
      examWeight: 0.14,
      topics: [
        { code: "3.1", title: "Class Anatomy and Encapsulation" },
        { code: "3.2", title: "Constructors and Object Creation" },
        { code: "3.3", title: "Accessors, Mutators, and Instance State" },
        { code: "3.4", title: "static vs. Instance Members and Scope" },
      ],
    },
    {
      unitNumber: 4,
      title: "Data Collections",
      examWeight: 0.36,
      topics: [
        { code: "4.1", title: "Array Creation and Traversal" },
        { code: "4.2", title: "ArrayList Operations" },
        { code: "4.3", title: "Two-Dimensional Arrays" },
        { code: "4.4", title: "Standard Algorithms (Min/Max, Sum, Search, Frequency)" },
        { code: "4.5", title: "File I/O and Dataset Processing (File and Scanner)" },
      ],
    },
  ],
};

const SUBJECT_SEEDS: SubjectSeed[] = [apushSeed, apcsaSeed];

// ---------------------------------------------------------------------------
// ExamBlueprint seeding (R1-R14)
// ---------------------------------------------------------------------------
// The APCSA subject gets exactly one MOCK blueprint + exactly one PRACTICE
// blueprint (two rows total). ExamBlueprint has no natural unique key (only
// `id`), so idempotency is guaranteed by an explicit find-then-create-or-update
// keyed on {subjectId, name}; re-running the seed never duplicates a row (R14).
//
// These names are the single source of truth and MUST match the constants in
// src/lib/exam/blueprints.ts (PRACTICE_BLUEPRINT_NAME / MOCK_BLUEPRINT_NAME).
const APCSA_SUBJECT_CODE = "APCSA";
const MOCK_BLUEPRINT_NAME = "AP Computer Science A Mock Exam";
const PRACTICE_BLUEPRINT_NAME = "APCSA Quick Practice";
const APCSA_EXAM_FORMAT_FOLDER = "AP_Computer_Science_A";

/**
 * MOCK sectionsJson derived from the REAL CSA format file (R6-R11): two sections
 * in order, Section I (MCQ 40/90/50, empty subParts) then Section II (type stored
 * as the literal string "FRQ", 4/90/50, four subParts II-1..II-4). No FRQ
 * Question rows are created and the QuestionType enum is unchanged (R11/R12).
 */
function buildMockSectionsJson(): Prisma.InputJsonValue {
  const format = loadExamFormat(APCSA_EXAM_FORMAT_FOLDER);
  return format.sections.map((section) => ({
    id: section.id,
    name: section.name,
    type: section.type,
    questionCount: section.questionCount,
    durationMinutes: section.durationMinutes,
    weightPercent: section.weightPercent,
    calculatorAllowed: section.calculatorAllowed,
    subParts: section.subParts.map((subPart) => ({
      id: subPart.id,
      name: subPart.name,
      questionCount: subPart.questionCount,
      durationMinutes: subPart.durationMinutes,
    })),
  }));
}

/**
 * PRACTICE sectionsJson (R7): exactly one MCQ section with questionCount 10. The
 * per-unit scope is applied at assembly time and is NOT stored per blueprint row.
 */
function buildPracticeSectionsJson(): Prisma.InputJsonValue {
  return [
    {
      id: "I",
      name: "Quick Practice",
      type: "MCQ",
      questionCount: 10,
      durationMinutes: 20,
      weightPercent: 100,
      calculatorAllowed: false,
      subParts: [],
    },
  ];
}

/** Idempotent create-or-update keyed on {subjectId, name} (R14). */
async function upsertBlueprint(
  subjectId: string,
  name: string,
  sectionsJson: Prisma.InputJsonValue,
): Promise<void> {
  const existing = await prisma.examBlueprint.findFirst({ where: { subjectId, name } });
  if (existing) {
    await prisma.examBlueprint.update({
      where: { id: existing.id },
      data: { sectionsJson },
    });
  } else {
    await prisma.examBlueprint.create({
      data: { subjectId, name, sectionsJson },
    });
  }
}

/**
 * Seed exactly one MOCK + one PRACTICE APCSA blueprint (R1-R5). The subject is
 * resolved by code "APCSA" (never a hardcoded id — R4). Idempotent across runs.
 */
async function seedBlueprints(): Promise<void> {
  const subject = await prisma.subject.findUnique({ where: { code: APCSA_SUBJECT_CODE } });
  if (!subject) {
    throw new Error(`Subject not found for code "${APCSA_SUBJECT_CODE}"`);
  }

  await upsertBlueprint(subject.id, MOCK_BLUEPRINT_NAME, buildMockSectionsJson());
  await upsertBlueprint(subject.id, PRACTICE_BLUEPRINT_NAME, buildPracticeSectionsJson());

  console.log(
    `Seeded ${APCSA_SUBJECT_CODE} blueprints: "${MOCK_BLUEPRINT_NAME}" (MOCK) and "${PRACTICE_BLUEPRINT_NAME}" (PRACTICE)`,
  );
}

async function seedSubject(seed: SubjectSeed): Promise<void> {
  const subject = await prisma.subject.upsert({
    where: { code: seed.code },
    update: { name: seed.name, examMode: seed.examMode },
    create: {
      code: seed.code,
      name: seed.name,
      examMode: seed.examMode,
    },
  });

  for (const unit of seed.units) {
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

  const topicCount = seed.units.reduce((n, u) => n + u.topics.length, 0);
  console.log(
    `Seeded ${seed.code} (${seed.name}) with ${seed.units.length} units and ${topicCount} topics`,
  );
}

async function main() {
  for (const seed of SUBJECT_SEEDS) {
    await seedSubject(seed);
  }

  await seedBlueprints();

  await prisma.promptRegistry.upsert({
    where: { name_version: { name: "frq-saq-grader", version: 1 } },
    update: { content: "TODO: write the FRQ/SAQ grading prompt" },
    create: {
      name: "frq-saq-grader",
      version: 1,
      content: "TODO: write the FRQ/SAQ grading prompt",
    },
  });

  await prisma.promptRegistry.upsert({
    where: { name_version: { name: "curriculum-parser", version: 1 } },
    update: { content: CURRICULUM_PARSER_PROMPT },
    create: {
      name: "curriculum-parser",
      version: 1,
      content: CURRICULUM_PARSER_PROMPT,
    },
  });

  await prisma.promptRegistry.upsert({
    where: { name_version: { name: "question-generator", version: 1 } },
    update: { content: QUESTION_GENERATOR_PROMPT },
    create: {
      name: "question-generator",
      version: 1,
      content: QUESTION_GENERATOR_PROMPT,
    },
  });

  await prisma.promptRegistry.upsert({
    where: { name_version: { name: "question-generator-APCSA", version: 1 } },
    update: { content: CSA_QUESTION_GENERATOR_PROMPT },
    create: {
      name: "question-generator-APCSA",
      version: 1,
      content: CSA_QUESTION_GENERATOR_PROMPT,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient, QuestionType } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const subject = await prisma.subject.findFirst({
    where: { code: "APUSH" },
    include: {
      units: {
        orderBy: { unitNumber: "asc" },
        include: { topics: { orderBy: { code: "asc" } } },
      },
    },
  });

  const topic = subject?.units.flatMap((u) => u.topics)[0];

  if (!subject || !topic) {
    console.log("Run `npx prisma db seed` first");
    process.exit(1);
  }

  await prisma.question.deleteMany({ where: { sourceTag: "generated:v1" } });

  const created = await prisma.$transaction([
    prisma.question.create({
      data: {
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.MCQ,
        difficulty: 3,
        stem: "The pattern of Spanish colonial settlement described in the excerpt most directly contributed to which of the following?",
        stimulus:
          "Historians have noted that Spanish colonizers in the Americas tended to settle in dense urban centers built atop existing Indigenous communities, relying on coerced labor systems such as the encomienda to extract wealth from the surrounding territory.",
        choicesJson: [
          {
            id: "A",
            text: "The rapid industrialization of colonial port cities",
          },
          {
            id: "B",
            text: "The development of a rigid racial and social caste hierarchy",
          },
          {
            id: "C",
            text: "The widespread adoption of democratic self-government",
          },
          {
            id: "D",
            text: "The complete assimilation of Indigenous and Spanish cultures",
          },
        ],
        correctAnswer: "B",
        explanation:
          "Spanish colonial society was organized around a caste system that ranked people by ancestry and place of birth, a structure that emerged directly from the patterns of conquest, urban settlement, and coerced labor described in the excerpt.",
        misconceptionTags: ["confuses-causation"],
        sourceTag: "generated:v1",
        isActive: false,
      },
    }),
    prisma.question.create({
      data: {
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.MCQ,
        difficulty: 2,
        stem: "Which of the following best describes a primary motivation for European exploration of the Americas in the fifteenth century?",
        stimulus: null,
        choicesJson: [
          {
            id: "A",
            text: "The desire to establish religious freedom for minority faiths",
          },
          {
            id: "B",
            text: "The search for new sources of industrial raw materials",
          },
          {
            id: "C",
            text: "The goal of spreading democratic institutions abroad",
          },
          {
            id: "D",
            text: "The pursuit of new trade routes to Asian markets",
          },
        ],
        correctAnswer: "D",
        explanation:
          "European monarchs sponsored voyages primarily to find direct sea routes to the lucrative spice and silk markets of Asia, bypassing Ottoman-controlled overland routes.",
        misconceptionTags: [],
        sourceTag: "generated:v1",
        isActive: false,
      },
    }),
    prisma.question.create({
      data: {
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.SAQ,
        difficulty: 4,
        stem: "Answer parts A, B, and C.\nA) Briefly describe ONE specific historical event or development that supports the argument above.\nB) Briefly describe ONE specific historical event or development that modifies the argument above.\nC) Briefly explain how ONE specific historical event or development provides context for the argument above.",
        stimulus: null,
        correctAnswer: null,
        rubricJson: {
          points: [
            { criterion: "Thesis", points: 1 },
            { criterion: "Evidence", points: 2 },
          ],
        },
        explanation:
          "A strong response presents a historically defensible thesis, supports it with two pieces of specific evidence, and demonstrates historical reasoning through contextualization.",
        misconceptionTags: ["vague-evidence"],
        sourceTag: "generated:v1",
        isActive: false,
      },
    }),
    prisma.question.create({
      data: {
        subjectId: subject.id,
        topicId: topic.id,
        type: QuestionType.DBQ,
        difficulty: 5,
        stem: "Evaluate the extent to which the Columbian Exchange transformed the societies of the Americas in the period from 1492 to 1750.",
        stimulus:
          "Document 1\nLetter from a Spanish colonial official to the Crown, 1542:\n\"In these lands there is neither silver nor gold to be had without the labor of the natives, and yet their numbers diminish daily, for the sicknesses that came with our ships have taken more than any sword could.\"\n\nDocument 2\nAccount of a Franciscan missionary in New Spain, 1560:\n\"The fields that once grew maize and squash now feed cattle brought from Castile, and the people who remain till soil that their grandfathers would not recognize.\"",
        correctAnswer: null,
        rubricJson: {
          points: [
            { criterion: "Thesis", points: 1 },
            { criterion: "Document analysis", points: 4 },
            { criterion: "Evidence beyond the documents", points: 1 },
            { criterion: "Contextualization", points: 1 },
          ],
        },
        explanation:
          "A strong response evaluates the demographic, economic, and ecological transformations wrought by the Columbian Exchange, using the documents' perspectives on disease, labor, and agricultural change while situating them in broader Atlantic-world context.",
        misconceptionTags: ["describes-not-analyzes"],
        sourceTag: "generated:v1",
        isActive: false,
      },
    }),
  ]);

  console.log("Created review questions:");
  for (const q of created) {
    console.log(`  ${q.id} (${q.type})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

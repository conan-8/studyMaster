import { PrismaClient, ExamMode } from "../src/generated/prisma";

const prisma = new PrismaClient();

type TopicSeed = { code: string; title: string };
type UnitSeed = {
  unitNumber: number;
  title: string;
  examWeight: number;
  topics: TopicSeed[];
};

const units: UnitSeed[] = [
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
];

async function main() {
  await prisma.subject.deleteMany({ where: { code: "APUSH" } });

  const subject = await prisma.subject.create({
    data: {
      code: "APUSH",
      name: "AP U.S. History",
      examMode: ExamMode.FULLY_DIGITAL,
      units: {
        create: units.map((u) => ({
          unitNumber: u.unitNumber,
          title: u.title,
          examWeight: u.examWeight,
          topics: { create: u.topics },
        })),
      },
    },
    include: { units: { include: { topics: true } } },
  });

  const topicCount = subject.units.reduce((n, u) => n + u.topics.length, 0);
  console.log(
    `Seeded ${subject.code} (${subject.name}) with ${subject.units.length} units and ${topicCount} topics`,
  );

  await prisma.promptRegistry.upsert({
    where: { name_version: { name: "frq-saq-grader", version: 1 } },
    update: { content: "TODO: write the FRQ/SAQ grading prompt" },
    create: {
      name: "frq-saq-grader",
      version: 1,
      content: "TODO: write the FRQ/SAQ grading prompt",
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

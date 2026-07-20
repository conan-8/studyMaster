import { z } from "zod";

export const learningObjectiveSchema = z.object({
  code: z.string(),
  statement: z.string(),
});

export const skillSchema = z.object({
  code: z.string(),
  name: z.string(),
});

export const topicSchema = z.object({
  code: z.string(),
  title: z.string(),
  learningObjectives: z.array(learningObjectiveSchema).default([]),
});

export const unitSchema = z.object({
  unitNumber: z.number().int(),
  title: z.string(),
  examWeight: z.number(),
  topics: z.array(topicSchema),
});

export const unitExtractionSchema = z.object({
  unit: unitSchema,
  skills: z.array(skillSchema).default([]),
});

export const skillsExtractionSchema = z.object({
  skills: z.array(skillSchema),
});

export type LearningObjective = z.infer<typeof learningObjectiveSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type UnitExtraction = z.infer<typeof unitExtractionSchema>;
export type SkillsExtraction = z.infer<typeof skillsExtractionSchema>;

export type CurriculumTaxonomy = {
  subject: { code: string; name: string };
  units: Unit[];
  skills: Skill[];
};

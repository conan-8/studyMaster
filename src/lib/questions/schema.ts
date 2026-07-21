import { z } from "zod";

export const choiceSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const generatedMcqSchema = z.object({
  topicCode: z.string(),
  stem: z.string(),
  stimulus: z.string().nullable().optional(),
  choices: z.array(choiceSchema).length(4),
  correctAnswer: z.string(),
  explanation: z.string(),
  difficulty: z.number().int().min(1).max(5),
  misconceptionTags: z.array(z.string()).default([]),
});

export const unitMcqBatchSchema = z.object({
  questions: z.array(generatedMcqSchema),
});

export type Choice = z.infer<typeof choiceSchema>;
export type GeneratedMcq = z.infer<typeof generatedMcqSchema>;
export type UnitMcqBatch = z.infer<typeof unitMcqBatchSchema>;

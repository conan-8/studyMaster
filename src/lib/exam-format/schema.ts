import { z } from "zod";

export const examModeSchema = z.enum([
  "FULLY_DIGITAL",
  "HYBRID_DIGITAL",
  "PORTFOLIO",
  "THROUGH_COURSE",
]);

export const subjectSchema = z.object({
  code: z.string().regex(/^AP_[A-Z0-9_]+$/),
  name: z.string().min(1),
  examMode: examModeSchema,
});

export const sectionTypeSchema = z.enum([
  "MCQ",
  "FRQ",
  "ESSAY",
  "PERFORMANCE_TASK",
  "PORTFOLIO",
  "SIGHT_SINGING",
  "ORAL_DEFENSE",
]);

export const subPartSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  questionCount: z.number().int().min(0),
  durationMinutes: z.number().min(0),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: sectionTypeSchema,
  questionCount: z.number().int().min(0),
  durationMinutes: z.number().min(0),
  weightPercent: z.number().min(0).max(100),
  calculatorAllowed: z.boolean(),
  subParts: z.array(subPartSchema),
});

export const weightPercentSchema = z.union([
  z.number().min(0).max(100),
  z.object({
    min: z.number().min(0).max(100),
    max: z.number().min(0).max(100),
  }),
]);

export const unitWeightSchema = z.object({
  unit: z.number().int().min(1),
  title: z.string().min(1),
  weightPercent: weightPercentSchema,
});

export const specialPoliciesSchema = z.object({
  calculatorPolicy: z.string(),
  referenceSheet: z.boolean(),
  deliveryNotes: z.string(),
});

export const examFormatSchema = z.object({
  subject: subjectSchema,
  totalDurationMinutes: z.number().min(0),
  sections: z.array(sectionSchema),
  unitWeights: z.array(unitWeightSchema),
  scoringNotes: z.string(),
  specialPolicies: specialPoliciesSchema,
});

export type ExamMode = z.infer<typeof examModeSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type SectionType = z.infer<typeof sectionTypeSchema>;
export type SubPart = z.infer<typeof subPartSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type WeightPercent = z.infer<typeof weightPercentSchema>;
export type UnitWeight = z.infer<typeof unitWeightSchema>;
export type SpecialPolicies = z.infer<typeof specialPoliciesSchema>;
export type ExamFormat = z.infer<typeof examFormatSchema>;

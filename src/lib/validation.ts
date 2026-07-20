import { z } from "zod";

// Reserved for a future profile/name feature. A unit test depends on this exact
// shape, so keep it unchanged.
export const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  ageConfirm: z.literal("true", {
    errorMap: () => ({
      message: "You must confirm that you are 13 or older to create an account.",
    }),
  }),
});

export const reviewApproveSchema = z.object({
  questionId: z.string().uuid("Invalid question id"),
});

export const reviewRejectSchema = z.object({
  questionId: z.string().uuid("Invalid question id"),
  reason: z.string().min(1, "A reason is required to reject a question"),
});

export const reviewBatchApproveSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1, "No questions selected"),
});

export const reviewChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const reviewEditSchema = z.object({
  questionId: z.string().uuid("Invalid question id"),
  stem: z.string().min(1, "Stem is required"),
  stimulus: z.string().optional(),
  explanation: z.string().min(1, "Explanation is required"),
  correctAnswer: z.string().optional(),
  choicesJson: z.string().optional(),
});

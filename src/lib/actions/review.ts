"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  reviewApproveSchema,
  reviewBatchApproveSchema,
  reviewChoiceSchema,
  reviewEditSchema,
  reviewRejectSchema,
} from "@/lib/validation";
import { Prisma, ReviewDecisionType } from "@/generated/prisma";

export type ReviewState = {
  error?: string;
  message?: string;
  affectedIds?: string[];
};

type AdminCheck = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!profile?.isAdmin) {
    return { ok: false as const, error: "Admin access required." };
  }

  return { ok: true as const };
}

export async function approveQuestion(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const result = reviewApproveSchema.safeParse({
    questionId: String(formData.get("questionId") ?? ""),
  });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input." };
  }

  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const { questionId } = result.data;

  try {
    await prisma.$transaction([
      prisma.question.update({
        where: { id: questionId },
        data: { isActive: true },
      }),
      prisma.reviewDecision.create({
        data: {
          questionId,
          decision: ReviewDecisionType.APPROVED,
        },
      }),
    ]);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { error: "Question not found." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  return { message: "Question approved.", affectedIds: [questionId] };
}

export async function rejectQuestion(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const result = reviewRejectSchema.safeParse({
    questionId: String(formData.get("questionId") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
  });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input." };
  }

  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const { questionId, reason } = result.data;

  try {
    await prisma.reviewDecision.create({
      data: {
        questionId,
        decision: ReviewDecisionType.REJECTED,
        reason,
      },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  return { message: "Question rejected.", affectedIds: [questionId] };
}

export async function editAndApproveQuestion(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const result = reviewEditSchema.safeParse({
    questionId: String(formData.get("questionId") ?? ""),
    stem: String(formData.get("stem") ?? "").trim(),
    stimulus: String(formData.get("stimulus") ?? ""),
    explanation: String(formData.get("explanation") ?? "").trim(),
    correctAnswer:
      formData.get("correctAnswer") === null
        ? undefined
        : String(formData.get("correctAnswer")),
    choicesJson:
      formData.get("choicesJson") === null
        ? undefined
        : String(formData.get("choicesJson")),
  });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input." };
  }

  const { questionId, stem, stimulus, explanation, correctAnswer, choicesJson } =
    result.data;

  let parsedChoices: { id: string; text: string }[] | undefined;
  if (choicesJson) {
    let raw: unknown;
    try {
      raw = JSON.parse(choicesJson);
    } catch {
      return { error: "Choices JSON is not valid JSON." };
    }
    const choicesResult = z.array(reviewChoiceSchema).safeParse(raw);
    if (!choicesResult.success) {
      return {
        error: choicesResult.error.issues[0]?.message ?? "Invalid choices.",
      };
    }
    parsedChoices = choicesResult.data;
  }

  const updateData: {
    stem: string;
    explanation: string;
    stimulus: string | null;
    isActive: boolean;
    correctAnswer?: string;
    choicesJson?: { id: string; text: string }[];
  } = {
    stem,
    explanation,
    stimulus: stimulus?.trim() ? stimulus : null,
    isActive: true,
  };

  if (correctAnswer !== undefined) {
    updateData.correctAnswer = correctAnswer;
  }
  if (parsedChoices) {
    updateData.choicesJson = parsedChoices;
  }

  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  try {
    await prisma.$transaction([
      prisma.question.update({
        where: { id: questionId },
        data: updateData,
      }),
      prisma.reviewDecision.create({
        data: {
          questionId,
          decision: ReviewDecisionType.APPROVED,
          editedJson: updateData,
        },
      }),
    ]);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { error: "Question not found." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  return {
    message: "Changes saved and question approved.",
    affectedIds: [questionId],
  };
}

export async function batchApproveQuestions(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const ids = formData.getAll("questionId").map(String);

  const result = reviewBatchApproveSchema.safeParse({ questionIds: ids });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input." };
  }

  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const { questionIds } = result.data;

  try {
    await prisma.$transaction([
      prisma.question.updateMany({
        where: { id: { in: questionIds }, isActive: false },
        data: { isActive: true },
      }),
      prisma.reviewDecision.createMany({
        data: questionIds.map((id) => ({
          questionId: id,
          decision: ReviewDecisionType.APPROVED,
        })),
      }),
    ]);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  return {
    message: `${questionIds.length} questions approved.`,
    affectedIds: questionIds,
  };
}

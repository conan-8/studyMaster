import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  reviewBatchApproveSchema,
  reviewChoiceSchema,
  reviewEditSchema,
  reviewRejectSchema,
} from "@/lib/validation";

const validId = "11111111-1111-4111-8111-111111111111";

describe("reviewRejectSchema", () => {
  it("accepts a valid question id and reason", () => {
    const result = reviewRejectSchema.safeParse({
      questionId: validId,
      reason: "Stem is ambiguous",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questionId).toBe(validId);
      expect(result.data.reason).toBe("Stem is ambiguous");
    }
  });

  it("rejects an empty reason", () => {
    const result = reviewRejectSchema.safeParse({
      questionId: validId,
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid question id", () => {
    const result = reviewRejectSchema.safeParse({
      questionId: "not-a-uuid",
      reason: "Bad question",
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewBatchApproveSchema", () => {
  it("accepts a non-empty array of uuids", () => {
    const result = reviewBatchApproveSchema.safeParse({
      questionIds: [validId],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty array", () => {
    const result = reviewBatchApproveSchema.safeParse({ questionIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects arrays containing non-uuid strings", () => {
    const result = reviewBatchApproveSchema.safeParse({
      questionIds: [validId, "nope"],
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewEditSchema", () => {
  it("accepts a valid edit payload", () => {
    const result = reviewEditSchema.safeParse({
      questionId: validId,
      stem: "A revised stem",
      stimulus: "",
      explanation: "Why the answer is correct",
      correctAnswer: "B",
      choicesJson: '[{"id":"A","text":"One"},{"id":"B","text":"Two"}]',
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty stem", () => {
    const result = reviewEditSchema.safeParse({
      questionId: validId,
      stem: "",
      explanation: "Why the answer is correct",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty explanation", () => {
    const result = reviewEditSchema.safeParse({
      questionId: validId,
      stem: "A revised stem",
      explanation: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewChoiceSchema", () => {
  it("validates a parsed choices JSON array", () => {
    const parsed = JSON.parse('[{"id":"A","text":"One"},{"id":"B","text":"Two"}]');
    const result = z.array(reviewChoiceSchema).safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ id: "A", text: "One" });
    }
  });

  it("rejects choices with missing fields", () => {
    const parsed = JSON.parse('[{"id":"A"},{"text":"Two"}]');
    const result = z.array(reviewChoiceSchema).safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("rejects choices with empty strings", () => {
    const parsed = JSON.parse('[{"id":"","text":""}]');
    const result = z.array(reviewChoiceSchema).safeParse(parsed);
    expect(result.success).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrompt, FALLBACK_PROMPTS } from "@/lib/llm/registry";

const mockFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    promptRegistry: {
      findFirst: mockFindFirst,
    },
  },
}));

beforeEach(() => {
  mockFindFirst.mockReset();
});

describe("getPrompt", () => {
  it("returns the latest prompt from the database when present", async () => {
    mockFindFirst.mockResolvedValue({ content: "db-content", version: 3 });

    await expect(getPrompt("frq-saq-grader")).resolves.toEqual({
      content: "db-content",
      version: 3,
    });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { name: "frq-saq-grader" },
      orderBy: { version: "desc" },
    });
  });

  it("falls back to FALLBACK_PROMPTS when the database has no match", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getPrompt("frq-saq-grader")).resolves.toEqual(
      FALLBACK_PROMPTS["frq-saq-grader"],
    );
  });

  it("throws for an unknown prompt with no fallback", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getPrompt("nope")).rejects.toThrow("Unknown prompt: nope");
  });
});

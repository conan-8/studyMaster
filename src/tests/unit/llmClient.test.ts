import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lLMCallLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

const schema = z.object({ ok: z.literal(true) });

function fakeResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    text: async () => text,
  };
}

const mockFetch = vi.fn();
let logSpy: MockInstance<typeof console.log>;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

describe("callLLM", () => {
  it("returns parsed data on a valid first response", async () => {
    mockFetch.mockResolvedValueOnce(fakeResponse('{"ok": true}'));

    await expect(callLLM({ user: "x", schema, purpose: "p" })).resolves.toEqual({
      ok: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(prisma.lLMCallLog.create).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it("retries once when the first response fails validation", async () => {
    mockFetch
      .mockResolvedValueOnce(fakeResponse('{"ok": false}'))
      .mockResolvedValueOnce(fakeResponse('{"ok": true}'));

    await expect(callLLM({ user: "x", schema, purpose: "p" })).resolves.toEqual({
      ok: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body) as {
      messages: { role: string; content: string }[];
    };
    const retryMessage = secondBody.messages.find(
      (m) => m.role === "user" && m.content.includes("failed validation"),
    );
    expect(retryMessage).toBeDefined();
  });

  it("throws when both responses fail validation", async () => {
    mockFetch
      .mockResolvedValueOnce(fakeResponse('{"ok": false}'))
      .mockResolvedValueOnce(fakeResponse('{"ok": false}'));

    await expect(callLLM({ user: "x", schema, purpose: "p" })).rejects.toThrow();
  });

  it("throws on non-ok HTTP responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "boom",
      json: async () => ({}),
    });

    await expect(callLLM({ user: "x", schema, purpose: "p" })).rejects.toThrow(
      "500",
    );
  });

  it("throws when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(callLLM({ user: "x", schema, purpose: "p" })).rejects.toThrow(
      "OPENROUTER_API_KEY",
    );
  });
});

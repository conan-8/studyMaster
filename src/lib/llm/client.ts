import { z } from "zod";
import { prisma } from "@/lib/prisma";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MAX_TOKENS = 1024;

type Message = { role: "user" | "assistant"; content: string };

export type CallLLMOptions<T> = {
  system?: string;
  user: string;
  schema: z.ZodType<T>;
  purpose: string;
  model?: string;
  maxTokens?: number;
};

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

function parseAndValidate<T>(
  text: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

async function requestOnce(args: {
  model: string;
  maxTokens: number;
  system?: string;
  messages: Message[];
  purpose: string;
}): Promise<{ text: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const started = Date.now();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      ...(args.system ? { system: args.system } : {}),
      messages: args.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as AnthropicResponse;

  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const latencyMs = Date.now() - started;

  console.log({
    model: args.model,
    inputTokens,
    outputTokens,
    latencyMs,
    purpose: args.purpose,
  });

  try {
    await prisma.lLMCallLog.create({
      data: {
        model: args.model,
        inputTokens,
        outputTokens,
        latencyMs,
        purpose: args.purpose,
      },
    });
  } catch (err) {
    console.error("Failed to write LLMCallLog", err);
  }

  return { text };
}

export async function callLLM<T>(opts: CallLLMOptions<T>): Promise<T> {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

  const messages: Message[] = [{ role: "user", content: opts.user }];

  const first = await requestOnce({
    model,
    maxTokens,
    system: opts.system,
    messages,
    purpose: opts.purpose,
  });
  const v1 = parseAndValidate(first.text, opts.schema);
  if (v1.ok) return v1.data;

  messages.push({ role: "assistant", content: first.text });
  messages.push({
    role: "user",
    content: `Your previous output failed validation: ${v1.error}`,
  });

  const second = await requestOnce({
    model,
    maxTokens,
    system: opts.system,
    messages,
    purpose: opts.purpose,
  });
  const v2 = parseAndValidate(second.text, opts.schema);
  if (v2.ok) return v2.data;

  throw new Error(`LLM output failed validation after retry: ${v2.error}`);
}

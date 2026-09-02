/**
 * Kimi provider — Kimi Code plan backend (OpenAI-compatible chat completions).
 *
 * Configuration is env-first (KIMI_API_KEY, KIMI_MODEL) with constructor
 * overrides, and fetch is injectable so tests never touch the network. Every
 * failure path throws LLMError tagged '[kimi]' and never leaks the API key
 * into messages.
 *
 * Note: Kimi coding models are reasoning models — they spend max_tokens on
 * reasoning_content before emitting content, so the token budget is higher
 * than for chat models and truncation with empty content gets its own error.
 *
 * Vision: the coding endpoint accepts multimodal messages (ChatMessage.content
 * as an array of {type:'text'} / {type:'image_url'} parts, data: URLs fine).
 * KIMI_VISION_DEFAULT_MODEL is the default for vision workloads such as
 * scripts/transcribe-math.ts; 'k3' was verified against the live endpoint
 * (2026-09) to accept image parts and transcribe rendered SAT question PNGs
 * faithfully. Override with the TRANSCRIBE_MODEL env var there.
 */

import { LLMError } from './types.js';
import type { LLMProvider, LLMRequest, LLMResponse, LLMUsage } from './types.js';

export const KIMI_URL = 'https://api.kimi.com/coding/v1/chat/completions';
export const DEFAULT_MODEL = 'k3';
/** Vision-capable default for transcription workloads (see header comment). */
export const KIMI_VISION_DEFAULT_MODEL = 'k3';
export const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_TEMPERATURE = 1; // k3 (and other coding models) only accept 1
const DEFAULT_MAX_TOKENS = 16384;
const ERROR_BODY_PREVIEW_CHARS = 500;

export interface KimiOptions {
  /** Defaults to env KIMI_API_KEY; missing → constructor throws LLMError. */
  apiKey?: string;
  /** Defaults to env KIMI_MODEL, else 'k3'. */
  model?: string;
  /** Injectable for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms; defaults to env KIMI_TIMEOUT_MS, else 180000. */
  timeoutMs?: number;
}

interface ChatCompletionPayload {
  choices?: Array<{
    message?: { content?: unknown };
    finish_reason?: string;
  }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class KimiProvider implements LLMProvider {
  readonly name = 'kimi';
  readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: KimiOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.KIMI_API_KEY;
    if (apiKey === undefined || apiKey === '') {
      throw new LLMError(
        'missing API key: set the KIMI_API_KEY environment variable ' +
          '(export KIMI_API_KEY=<your key from https://kimi.com>) ' +
          'or pass { apiKey } to new KimiProvider()',
        this.name,
      );
    }
    this.apiKey = apiKey;
    this.defaultModel = opts.model ?? process.env.KIMI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    const envTimeout = process.env.KIMI_TIMEOUT_MS;
    this.timeoutMs =
      opts.timeoutMs ??
      (envTimeout !== undefined && Number.isFinite(Number(envTimeout)) && Number(envTimeout) > 0
        ? Number(envTimeout)
        : DEFAULT_TIMEOUT_MS);
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.defaultModel,
      messages: req.messages,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (req.jsonMode) {
      body['response_format'] = { type: 'json_object' };
    }

    // AbortController cancels a real in-flight request; the race guarantees the
    // timeout still fires for fetchImpls that ignore the abort signal (e.g.
    // never-resolving test doubles).
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new LLMError(`request timed out after ${this.timeoutMs}ms`, this.name),
        );
      }, this.timeoutMs);
    });
    let raw: Response;
    try {
      raw = await Promise.race([
        this.fetchImpl(KIMI_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
        timeout,
      ]);
    } catch (err) {
      if (err instanceof LLMError) throw err; // our timeout
      throw new LLMError(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
        err,
      );
    } finally {
      clearTimeout(timer!);
    }

    if (!raw.ok) {
      const text = await raw.text();
      throw new LLMError(
        `HTTP ${raw.status}: ${text.slice(0, ERROR_BODY_PREVIEW_CHARS)}`,
        this.name,
      );
    }

    let payload: ChatCompletionPayload;
    try {
      payload = (await raw.json()) as ChatCompletionPayload;
    } catch (err) {
      throw new LLMError('response was not valid JSON', this.name, err);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string') {
      throw new LLMError(
        `malformed response: missing choices[0].message.content; got ${JSON.stringify(payload).slice(0, ERROR_BODY_PREVIEW_CHARS)}`,
        this.name,
      );
    }
    if (content === '' && choice?.finish_reason === 'length') {
      throw new LLMError(
        'response truncated during reasoning before any content was emitted; ' +
          'raise max_tokens (request.maxTokens) above the 8192 default',
        this.name,
      );
    }

    const usage: LLMUsage | undefined =
      typeof payload.usage?.prompt_tokens === 'number' &&
      typeof payload.usage.completion_tokens === 'number'
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
          }
        : undefined;

    const response: LLMResponse = {
      content,
      model: payload.model ?? this.defaultModel,
      provider: this.name,
    };
    if (usage !== undefined) response.usage = usage;
    return response;
  }
}

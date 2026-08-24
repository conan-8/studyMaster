/**
 * OpenRouter provider — the repo's production backend (historical choice; see
 * git history "switch back to OpenRouter with minimax/m3").
 *
 * Configuration is env-first (OPENROUTER_API_KEY, OPENROUTER_MODEL) with
 * constructor overrides, and fetch is injectable so tests never touch the
 * network. Every failure path throws LLMError tagged '[openrouter]' and never
 * leaks the API key into messages.
 */

import { LLMError } from './types.js';
import type { LLMProvider, LLMRequest, LLMResponse, LLMUsage } from './types.js';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MODEL = 'minimax/minimax-m3';
export const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;
const ERROR_BODY_PREVIEW_CHARS = 500;

export interface OpenRouterOptions {
  /** Defaults to env OPENROUTER_API_KEY; missing → constructor throws LLMError. */
  apiKey?: string;
  /** Defaults to env OPENROUTER_MODEL, else 'minimax/minimax-m3'. */
  model?: string;
  /** Injectable for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms; defaults to 60000. */
  timeoutMs?: number;
}

interface ChatCompletionPayload {
  choices?: Array<{ message?: { content?: unknown } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'openrouter';
  readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: OpenRouterOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (apiKey === undefined || apiKey === '') {
      throw new LLMError(
        'missing API key: set the OPENROUTER_API_KEY environment variable ' +
          '(export OPENROUTER_API_KEY=<your key from https://openrouter.ai/keys>) ' +
          'or pass { apiKey } to new OpenRouterProvider()',
        this.name,
      );
    }
    this.apiKey = apiKey;
    this.defaultModel = opts.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
        this.fetchImpl(OPENROUTER_URL, {
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

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new LLMError(
        `malformed response: missing choices[0].message.content; got ${JSON.stringify(payload).slice(0, ERROR_BODY_PREVIEW_CHARS)}`,
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

/**
 * LLM provider abstraction — the single internal client every AI agent calls
 * through (master plan §7: "model-provider abstraction so models can be
 * swapped per-agent").
 *
 * Callers speak only in LLMRequest/LLMResponse; providers (mock, openrouter)
 * are interchangeable and chosen via resolveProvider() in factory.ts.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for structured JSON output (OpenAI response_format). */
  jsonMode?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: LLMUsage;
}

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

/**
 * Error thrown by every provider. The message is prefixed with '[<provider>]'
 * so failures deep in the pipeline remain attributable.
 */
export class LLMError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'LLMError';
  }
}

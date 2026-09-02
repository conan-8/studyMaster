/**
 * LLM provider abstraction — the single internal client every AI agent calls
 * through (master plan §7: "model-provider abstraction so models can be
 * swapped per-agent").
 *
 * Callers speak only in LLMRequest/LLMResponse; providers (mock, openrouter)
 * are interchangeable and chosen via resolveProvider() in factory.ts.
 */

/**
 * One part of a multimodal chat message (OpenAI chat-completions shape).
 * 'text' carries plain text; 'image_url' carries an image by URL — a
 * data: URL (e.g. data:image/png;base64,...) is accepted by the Kimi
 * provider, which is how local question renders are sent for transcription.
 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  /**
   * Plain string for text-only messages (the common case; every pre-vision
   * caller keeps working unchanged), or an array of parts for multimodal
   * (vision) requests. Providers pass parts through to the wire unchanged;
   * only construct part arrays for providers/models that accept images.
   */
  content: string | ChatContentPart[];
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

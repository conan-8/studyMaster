/**
 * Public surface of the LLM provider abstraction layer.
 */

export type {
  ChatMessage,
  LLMRequest,
  LLMUsage,
  LLMResponse,
  LLMProvider,
} from './types.js';
export { LLMError } from './types.js';

export { MockProvider, mockFromFiles } from './mock.js';
export type { MockScript } from './mock.js';

export {
  OpenRouterProvider,
  OPENROUTER_URL,
  DEFAULT_MODEL as OPENROUTER_DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS as OPENROUTER_DEFAULT_TIMEOUT_MS,
} from './openrouter.js';
export type { OpenRouterOptions } from './openrouter.js';

export {
  KimiProvider,
  KIMI_URL,
  DEFAULT_MODEL as KIMI_DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS as KIMI_DEFAULT_TIMEOUT_MS,
} from './kimi.js';
export type { KimiOptions } from './kimi.js';

export { resolveProvider, SUPPORTED_PROVIDERS } from './factory.js';
export type { ResolveOptions, SupportedProvider } from './factory.js';

/**
 * Provider resolution: one entry point that turns a name (CLI arg, env var,
 * or default) into a ready-to-use LLMProvider.
 *
 * Default is 'mock' so keyless dry-runs work out of the box; the mock with no
 * scripts constructs fine and only fails on complete() ('exhausted'), which
 * is the desired loud failure when someone runs generation without scripts.
 */

import { MockProvider } from './mock.js';
import type { MockScript } from './mock.js';
import { OpenRouterProvider } from './openrouter.js';
import { KimiProvider } from './kimi.js';
import type { LLMProvider } from './types.js';

export const SUPPORTED_PROVIDERS = ['mock', 'openrouter', 'kimi'] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface ResolveOptions {
  /** Scripts for the mock provider; ignored by other providers. */
  scripts?: MockScript[];
}

/**
 * Resolve a provider by name. Falls back to env GENERATOR_PROVIDER, then
 * 'mock'. Unknown names throw listing the supported providers.
 */
export function resolveProvider(name?: string, opts?: ResolveOptions): LLMProvider {
  const resolved = name ?? process.env.GENERATOR_PROVIDER ?? 'mock';
  switch (resolved) {
    case 'mock':
      return new MockProvider('mock-1', opts?.scripts ?? []);
    case 'openrouter':
      return new OpenRouterProvider();
    case 'kimi':
      return new KimiProvider();
    default:
      throw new Error(
        `Unknown LLM provider '${resolved}'. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
      );
  }
}

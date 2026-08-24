/**
 * Deterministic Mock provider for tests and keyless dry-runs.
 *
 * A MockProvider consumes a queue of scripts IN ORDER — one script per
 * complete() call, no randomness — so two identically-constructed providers
 * produce byte-identical results. Scripts are either a canned response
 * ({content}) or a canned failure ({error}); exhausting the queue is an
 * LLMError so a keyless run without scripts fails loudly, not silently.
 */

import fs from 'node:fs';
import { LLMError } from './types.js';
import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

/** One queued reply: a canned response body, or a canned failure message. */
export type MockScript = { content: string } | { error: string };

export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly defaultModel: string;
  private readonly scripts: MockScript[];
  private consumed = 0;

  constructor(model: string, scripts: MockScript[]) {
    this.defaultModel = model;
    // Copy so later mutation of the caller's array cannot alter behaviour.
    this.scripts = [...scripts];
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const script = this.scripts[this.consumed];
    if (script === undefined) {
      throw new LLMError(
        `mock provider exhausted: ${this.consumed} scripts consumed`,
        this.name,
      );
    }
    this.consumed += 1;
    if ('error' in script) {
      throw new LLMError(script.error, this.name);
    }
    return {
      content: script.content,
      model: this.defaultModel,
      provider: this.name,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

/**
 * Build one MockScript per file: content is the trimmed file text. Handy for
 * replaying recorded LLM outputs from disk (e.g. fixtures/*.json).
 */
export function mockFromFiles(paths: string[]): MockScript[] {
  return paths.map((p) => ({ content: fs.readFileSync(p, 'utf8').trim() }));
}
